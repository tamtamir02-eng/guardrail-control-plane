import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluatePullRequest } from '../src/evaluation.mjs'
import { loadPolicy } from '../src/policy.mjs'

const shaX = 'a'.repeat(40)
const shaY = 'b'.repeat(40)
const baseSha = 'c'.repeat(40)

class FakeGitHub {
  constructor({ heads = [shaX, shaX], bases = [baseSha, baseSha], reviews = [], unresolved = 0 } = {}) {
    this.heads = [...heads]
    this.bases = [...bases]
    this.reviews = reviews
    this.unresolved = unresolved
    this.created = []
    this.updated = []
  }

  async getPullRequest() {
    const head = this.heads.length > 1 ? this.heads.shift() : this.heads[0]
    return {
      head: { sha: head, ref: 'feature', repo: { full_name: 'owner/repo' } },
      base: { ref: 'main', repo: { full_name: 'owner/repo' } },
      user: { login: 'author' }
    }
  }

  async getBranchHead() {
    return this.bases.length > 1 ? this.bases.shift() : this.bases[0]
  }

  async createCheckRun(owner, repo, headSha) {
    this.created.push({ owner, repo, headSha })
    return { id: 42, app: { id: 999 } }
  }

  async updateCheckRun(owner, repo, id, value) {
    this.updated.push({ owner, repo, id, ...value })
  }

  async listReviews() {
    return this.reviews
  }

  async unresolvedReviewConversationCount() {
    return this.unresolved
  }
}

function gitEvaluator(records) {
  return async (input) => ({ baseSha: input.expectedBaseSha, headSha: input.expectedHeadSha, mergeBase: baseSha, records })
}

function run(github, records, policy = loadPolicy()) {
  return evaluatePullRequest({
    owner: 'owner',
    repo: 'repo',
    number: 7,
    installationToken: 't'.repeat(40),
    github,
    gitEvaluator: gitEvaluator(records),
    policy
  })
}

test('GREEN/YELLOW success is created and concluded on the exact live HEAD', async () => {
  const github = new FakeGitHub()
  const result = await run(github, [{ status: 'M', destinationPath: 'src/file.js', sourcePath: null }])
  assert.equal(result.conclusion, 'success')
  assert.deepEqual(github.created, [{ owner: 'owner', repo: 'repo', headSha: shaX }])
  assert.equal(github.updated[0].conclusion, 'success')
})

test('HEAD change before conclusion invalidates old evaluation and never publishes success', async () => {
  const github = new FakeGitHub({ heads: [shaX, shaY] })
  const result = await run(github, [{ status: 'M', destinationPath: 'src/file.js', sourcePath: null }])
  assert.equal(result.invalidated, true)
  assert.equal(github.created[0].headSha, shaX)
  assert.equal(github.updated[0].conclusion, 'action_required')
  assert.equal(github.updated.some((update) => update.conclusion === 'success'), false)
})

test('base change before conclusion also invalidates the evaluation', async () => {
  const github = new FakeGitHub({ bases: [baseSha, shaY] })
  const result = await run(github, [{ status: 'M', destinationPath: 'src/file.js', sourcePath: null }])
  assert.equal(result.invalidated, true)
  assert.equal(github.updated[0].conclusion, 'action_required')
})

test('RED without a configured independent human stays action_required', async () => {
  const github = new FakeGitHub()
  const result = await run(github, [{ status: 'M', destinationPath: 'auth/file.js', sourcePath: null }])
  assert.equal(result.conclusion, 'action_required')
  assert.match(github.updated[0].title, /HUMAN SECURITY APPROVER REQUIRED/)
})

test('malformed evaluator result is published as failure-closed', async () => {
  const github = new FakeGitHub()
  await assert.rejects(
    run(github, [{ status: 'T', destinationPath: 'src/file.js', sourcePath: null }]),
    /Unsupported/
  )
  assert.equal(github.updated[0].conclusion, 'failure')
})

test('completed check with the same external id makes a duplicate delivery idempotent', async () => {
  const github = new FakeGitHub()
  let queriedExternalId
  github.findCheckRunByExternalId = async (owner, repo, head, externalId) => {
    queriedExternalId = externalId
    return { id: 77, status: 'completed', conclusion: 'success' }
  }
  const result = await evaluatePullRequest({
    owner: 'owner',
    repo: 'repo',
    number: 7,
    installationToken: 't'.repeat(40),
    github,
    gitEvaluator: async () => { throw new Error('must not run for a completed duplicate') },
    policy: loadPolicy(),
    idempotencyKey: 'delivery:7'
  })
  assert.equal(result.duplicate, true)
  assert.equal(result.checkRunId, 77)
  assert.equal(github.created.length, 0)
  assert.equal(queriedExternalId, `delivery:7:${baseSha}`)
  assert.equal(github.heads.length, 1)
  assert.equal(github.bases.length, 1)
})

test('Git failure is concluded as failure and never as success', async () => {
  const github = new FakeGitHub()
  await assert.rejects(evaluatePullRequest({
    owner: 'owner',
    repo: 'repo',
    number: 7,
    installationToken: 't'.repeat(40),
    github,
    gitEvaluator: async () => { throw new Error('git unavailable') },
    policy: loadPolicy()
  }), /git unavailable/)
  assert.equal(github.updated.at(-1).conclusion, 'failure')
  assert.equal(github.updated.some((update) => update.conclusion === 'success'), false)
})

test('GitHub re-read failure is concluded as failure and never as success', async () => {
  const github = new FakeGitHub()
  const original = github.getPullRequest.bind(github)
  let reads = 0
  github.getPullRequest = async () => {
    reads += 1
    if (reads === 2) throw new Error('GitHub API unavailable')
    return original()
  }
  await assert.rejects(run(github, [{ status: 'M', destinationPath: 'src/file.js', sourcePath: null }]), /GitHub API unavailable/)
  assert.equal(github.updated.at(-1).conclusion, 'failure')
  assert.equal(github.updated.some((update) => update.conclusion === 'success'), false)
})

test('invalid policy configuration is concluded as failure and never as success', async () => {
  const github = new FakeGitHub()
  await assert.rejects(run(github, [{ status: 'M', destinationPath: 'src/file.js', sourcePath: null }], {}), /malformed policy/)
  assert.equal(github.updated.at(-1).conclusion, 'failure')
  assert.equal(github.updated.some((update) => update.conclusion === 'success'), false)
})
