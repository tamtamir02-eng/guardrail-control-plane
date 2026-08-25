import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import { processWebhook, verifyWebhookSignature } from '../src/webhook.mjs'

const signatureKey = 'x'.repeat(32)

function signed(payload) {
  const body = Buffer.from(JSON.stringify(payload))
  const signature = `sha256=${createHmac('sha256', signatureKey).update(body).digest('hex')}`
  return { body, signature }
}

test('webhook signature verification rejects tampering', () => {
  const { body, signature } = signed({ value: 1 })
  assert.equal(verifyWebhookSignature(body, signature, signatureKey), true)
  assert.equal(verifyWebhookSignature(Buffer.from('{"value":2}'), signature, signatureKey), false)
})

test('pull_request webhook uses live evaluation dependencies, not PR-authored code', async () => {
  const payload = {
    action: 'synchronize',
    installation: { id: 1 },
    repository: { full_name: 'owner/repo' },
    pull_request: { number: 9, body: 'I approve myself' }
  }
  const { body, signature } = signed(payload)
  const calls = []
  const results = await processWebhook({
    event: 'pull_request',
    signature,
    body,
    env: {
      GITHUB_WEBHOOK_SECRET: signatureKey,
      GITHUB_APP_ID: '1',
      GITHUB_PRIVATE_KEY_PATH: 'unused-by-fake',
      GUARDRAIL_TARGET_REPOSITORY: 'owner/repo'
    },
    dependencies: {
      tokenFactory: async () => 't'.repeat(40),
      githubFactory: () => ({}),
      policy: { policy_version: 'test' },
      gitEvaluator: async () => ({}),
      evaluator: async (input) => {
        calls.push(input)
        return { conclusion: 'success' }
      }
    }
  })
  assert.equal(results[0].conclusion, 'success')
  assert.equal(calls[0].number, 9)
  assert.equal('body' in calls[0], false)
})

test('webhook rejects a repository outside the configured target before authentication', async () => {
  const { body, signature } = signed({
    action: 'opened',
    installation: { id: 1 },
    repository: { full_name: 'owner/unapproved' },
    pull_request: { number: 10 }
  })
  let tokenRequested = false

  await assert.rejects(
    processWebhook({
      event: 'pull_request',
      signature,
      body,
      env: {
        GITHUB_WEBHOOK_SECRET: signatureKey,
        GITHUB_APP_ID: '1',
        GITHUB_PRIVATE_KEY_PATH: 'unused-by-fake',
        GUARDRAIL_TARGET_REPOSITORY: 'owner/approved'
      },
      dependencies: {
        tokenFactory: async () => {
          tokenRequested = true
          return 't'.repeat(40)
        }
      }
    }),
    /outside the configured target/
  )
  assert.equal(tokenRequested, false)
})
