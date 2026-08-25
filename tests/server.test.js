import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import { createGuardrailServer } from '../src/server.mjs'

const signatureKey = 'x'.repeat(32)

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

test('local HTTP server accepts the signed POST /webhook route and rejects other routes', async () => {
  const server = createGuardrailServer({
    env: {
      GITHUB_WEBHOOK_SECRET: signatureKey,
      GITHUB_APP_ID: '1',
      GITHUB_PRIVATE_KEY_PATH: 'unused-by-fake',
      GUARDRAIL_TARGET_REPOSITORY: 'tamtamir02-eng/codex-guardrail-pilot'
    },
    dependencies: {
      tokenFactory: async () => 't'.repeat(40),
      githubFactory: () => ({}),
      policy: { policy_version: 'test' },
      gitEvaluator: async () => ({}),
      evaluator: async () => ({ conclusion: 'success' })
    }
  })
  const port = await listen(server)

  try {
    const body = JSON.stringify({
      action: 'opened',
      installation: { id: 1 },
      repository: { full_name: 'tamtamir02-eng/codex-guardrail-pilot' },
      pull_request: { number: 1 }
    })
    const signature = `sha256=${createHmac('sha256', signatureKey).update(body).digest('hex')}`
    const accepted = await fetch(`http://127.0.0.1:${port}/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'pull_request',
        'x-hub-signature-256': signature
      },
      body
    })
    assert.equal(accepted.status, 200)
    assert.equal(await accepted.text(), 'accepted')

    const rejected = await fetch(`http://127.0.0.1:${port}/wrong-path`, { method: 'POST' })
    assert.equal(rejected.status, 404)
  } finally {
    await close(server)
  }
})
