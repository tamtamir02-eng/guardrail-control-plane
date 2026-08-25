import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import { processWebhook, verifyWebhookSignature } from '../src/webhook.mjs'

const secret = 'pilot-webhook-secret-value'

function signed(payload) {
  const body = Buffer.from(JSON.stringify(payload))
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  return { body, signature }
}

test('webhook signature verification rejects tampering', () => {
  const { body, signature } = signed({ value: 1 })
  assert.equal(verifyWebhookSignature(body, signature, secret), true)
  assert.equal(verifyWebhookSignature(Buffer.from('{"value":2}'), signature, secret), false)
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
      GITHUB_WEBHOOK_SECRET: secret,
      GITHUB_APP_ID: '1',
      GITHUB_PRIVATE_KEY_PATH: 'unused-by-fake'
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
