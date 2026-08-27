import assert from 'node:assert/strict'
import test from 'node:test'

import { validateRedApproval } from '../src/approval.mjs'
import { loadPolicy } from '../src/policy.mjs'

const headX = 'a'.repeat(40)
const headY = 'b'.repeat(40)
const authorizedReviewer = 'tamtamir02-eng'
const implementerBot = 'tamir-codex-implementer-v4-2-pilot[bot]'
const guardrailBot = 'tamir-guardrail-v4-2-local-shadow[bot]'
const basePolicy = loadPolicy()
const policy = basePolicy

function review({ login = authorizedReviewer, state = 'APPROVED', commitId = headX, type = 'User', id = 1 }) {
  return {
    id,
    state,
    commit_id: commitId,
    submitted_at: `2026-08-25T00:00:0${id}Z`,
    user: { login, type }
  }
}

function validate(reviews, overrides = {}) {
  return validateRedApproval({
    reviews,
    headSha: headX,
    authorLogin: 'author',
    unresolvedConversationCount: 0,
    policy,
    ...overrides
  })
}

test('authoritative policy contains only the approved Tamir human identity', () => {
  assert.deepEqual(basePolicy.authorized_reviewers, [authorizedReviewer])
})

test('accepts tamtamir02-eng APPROVED on the exact current HEAD', () => {
  assert.deepEqual(validate([review({})]).approvers, [authorizedReviewer])
})

test('rejects tamtamir02-eng approval on an old SHA after push to a new HEAD', () => {
  assert.equal(validate([review({ commitId: headX })], { headSha: headY }).approved, false)
})

test('Shadow I: unauthorized reviewer approval is rejected', () => {
  assert.equal(validate([review({ login: 'other-human' })]).approved, false)
})

test('PR author cannot approve their own RED change', () => {
  assert.equal(validate([review({})], { authorLogin: authorizedReviewer }).approved, false)
})

test('Implementer bot, Guardrail App bot, GitHub Actions and Codex identities are rejected', () => {
  for (const candidate of [
    review({ login: implementerBot, type: 'Bot' }),
    review({ login: guardrailBot, type: 'Bot' }),
    review({ login: 'codex-reviewer' }),
    review({ login: 'github-actions' })
  ]) {
    assert.equal(validate([candidate], { policy: { ...policy, authorized_reviewers: [candidate.user.login] } }).approved, false)
  }
})

test('CHANGES_REQUESTED is not approval and unresolved conversations block approval', () => {
  assert.equal(validate([review({ state: 'CHANGES_REQUESTED' })]).approved, false)
  assert.equal(validate([review({})], { unresolvedConversationCount: 1 }).approved, false)
})

test('latest current-HEAD review state supersedes the same reviewer state', () => {
  const result = validate([
    review({ state: 'CHANGES_REQUESTED', id: 1 }),
    review({ state: 'APPROVED', id: 2 })
  ])
  assert.equal(result.approved, true)
})

test('comments and reactions cannot create approval evidence', () => {
  const comment = { id: 10, body: 'APPROVED', user: { login: authorizedReviewer, type: 'User' } }
  const reaction = { id: 11, content: '+1', user: { login: authorizedReviewer, type: 'User' } }
  assert.equal(validate([comment, reaction]).approved, false)
})
