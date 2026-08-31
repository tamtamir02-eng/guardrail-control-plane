import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import { loadPolicy } from '../src/policy.mjs'
import { createGuardrailServer } from '../src/server.mjs'

const target = 'tamtamir02-eng/codex-guardrail-pilot'
const secret = 'i'.repeat(32)
const headSha = 'a'.repeat(40)
const baseSha = 'b'.repeat(40)

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

test('synthetic webhook flows through ingress, local task adapter, worker and policy evaluation', async () => {
  const calls = { pull: 0, base: 0, created: [], updated: [] }
  const github = {
    async getPullRequest() {
      calls.pull += 1
      return {
        head: { sha: headSha, ref: 'feature', repo: { full_name: target } },
        base: { ref: 'main', repo: { full_name: target } },
        user: { login: 'author' }
      }
    },
    async getBranchHead() {
      calls.base += 1
      return baseSha
    },
    async findCheckRunByExternalId() { return null },
    async createCheckRun(owner, repo, sha, externalId) {
      calls.created.push({ owner, repo, sha, externalId })
      return { id: 42, status: 'in_progress' }
    },
    async updateCheckRun(owner, repo, id, value) {
      calls.updated.push({ owner, repo, id, ...value })
    }
  }
  const server = createGuardrailServer({
    role: 'local',
    logger: () => {},
    env: {
      GITHUB_WEBHOOK_SECRET: secret,
      GITHUB_APP_ID: '1',
      GITHUB_PRIVATE_KEY_PATH: 'unused-by-fake',
      GUARDRAIL_TARGET_REPOSITORY: target
    },
    workerDependencies: {
      tokenFactory: async () => 't'.repeat(40),
      githubFactory: () => github,
      policy: loadPolicy(),
      gitEvaluator: async (input) => ({
        baseSha: input.expectedBaseSha,
        headSha: input.expectedHeadSha,
        mergeBase: baseSha,
        records: [{ status: 'M', sourcePath: null, destinationPath: 'src/example.js' }]
      })
    }
  })
  const port = await listen(server)
  try {
    const payload = {
      action: 'synchronize',
      installation: { id: 1 },
      repository: { full_name: target },
      pull_request: { number: 7 }
    }
    const body = JSON.stringify(payload)
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
    const response = await fetch(`http://127.0.0.1:${port}/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-delivery': 'integration-delivery-1',
        'x-github-event': 'pull_request',
        'x-hub-signature-256': signature
      },
      body
    })
    assert.equal(response.status, 202)
    assert.equal(calls.pull, 2)
    assert.equal(calls.base, 2)
    assert.equal(calls.created.length, 1)
    assert.match(calls.created[0].externalId, new RegExp(`^github-[0-9a-f]{64}:7:${baseSha}$`))
    assert.equal(calls.updated.at(-1).conclusion, 'success')
    assert.match(calls.updated.at(-1).title, /accepted by Guardrail V4.2/)
  } finally {
    await close(server)
  }
})
