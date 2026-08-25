import assert from 'node:assert/strict'
import test from 'node:test'

import { validateRedApproval } from '../src/approval.mjs'
import { loadPolicy } from '../src/policy.mjs'

const headX = 'a'.repeat(40)
const headY = 'b'.repeat(40)
const basePolicy = loadPolicy()
const policy = { ...basePolicy, authorized_reviewers: ['security-human'] }

function review({ login = 'security-human', state = 'APPROVED', commitId = headX, type = 'User', id = 1 }) {
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

test('accepts an authorized human approval on exact HEAD', () => {
  assert.deepEqual(validate([review({})]).approvers, ['security-human'])
})

test('Shadow H: approval on SHA X is stale after push to SHA Y', () => {
  assert.equal(validate([review({ commitId: headX })], { headSha: headY }).approved, false)
})

test('Shadow I: unauthorized reviewer approval is rejected', () => {
  assert.equal(validate([review({ login: 'other-human' })]).approved, false)
})

test('PR author cannot approve their own RED change', () => {
  assert.equal(validate([review({ login: 'author' })], { policy: { ...policy, authorized_reviewers: ['author'] } }).approved, false)
})

test('bots, Apps, GitHub Actions and Codex identities are rejected', () => {
  for (const candidate of [
    review({ login: 'security-human[bot]', type: 'Bot' }),
    review({ login: 'codex-reviewer' }),
    review({ login: 'github-actions' })
  ]) {
    assert.equal(validate([candidate], { policy: { ...policy, authorized_reviewers: [candidate.user.login] } }).approved, false)
  }
})

test('current-HEAD CHANGES_REQUESTED and unresolved conversations block approval', () => {
  assert.equal(validate([
    review({ id: 1 }),
    review({ login: 'blocker', state: 'CHANGES_REQUESTED', id: 2 })
  ]).approved, false)
  assert.equal(validate([review({})], { unresolvedConversationCount: 1 }).approved, false)
})

test('latest current-HEAD review state supersedes the same reviewer state', () => {
  const result = validate([
    review({ state: 'CHANGES_REQUESTED', id: 1 }),
    review({ state: 'APPROVED', id: 2 })
  ])
  assert.equal(result.approved, true)
})

test('Shadow J: comments, reactions and PR body are not review inputs', () => {
  assert.equal(validate([]).approved, false)
})

test('Pilot policy has no invented human approver and fails closed', () => {
  const result = validateRedApproval({
    reviews: [review({})],
    headSha: headX,
    authorLogin: 'author',
    unresolvedConversationCount: 0,
    policy: basePolicy
  })
  assert.equal(result.approved, false)
  assert.equal(result.reason, 'HUMAN SECURITY APPROVER REQUIRED')
})
