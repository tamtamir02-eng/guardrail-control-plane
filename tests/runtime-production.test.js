import assert from 'node:assert/strict'
import { createHmac, generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { processIngressWebhook } from '../src/ingress.mjs'
import { createStructuredLogger } from '../src/logging.mjs'
import { createTaskEnvelope, validateTaskEnvelope } from '../src/task-contract.mjs'
import { CloudTasksQueue, LocalTaskQueue } from '../src/task-queue.mjs'
import { validateEnvironment } from '../scripts/preflight.mjs'

const secret = 's'.repeat(32)
const target = 'tamtamir02-eng/codex-guardrail-pilot'

function webhook(deliveryId = 'delivery-runtime-1') {
  const payload = {
    action: 'synchronize',
    installation: { id: 12 },
    repository: { full_name: target },
    pull_request: { number: 9, body: 'untrusted content must not enter the task' }
  }
  const body = Buffer.from(JSON.stringify(payload))
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  return { body, deliveryId, event: 'pull_request', signature }
}

test('valid webhook creates a minimal task and duplicate delivery runs the worker once', async () => {
  const handled = []
  const queue = new LocalTaskQueue(async (envelope) => handled.push(envelope))
  const input = webhook()
  const first = await processIngressWebhook({
    ...input,
    env: { GITHUB_WEBHOOK_SECRET: secret, GUARDRAIL_TARGET_REPOSITORY: target },
    queue
  })
  const second = await processIngressWebhook({
    ...input,
    env: { GITHUB_WEBHOOK_SECRET: secret, GUARDRAIL_TARGET_REPOSITORY: target },
    queue
  })
  assert.equal(first.duplicate, false)
  assert.equal(second.duplicate, true)
  assert.equal(handled.length, 1)
  assert.equal(handled[0].prNumber, 9)
  assert.equal(JSON.stringify(handled[0]).includes('untrusted content'), false)
  assert.equal(JSON.stringify(handled[0]).includes(secret), false)
})

test('invalid webhook signature fails before task creation', async () => {
  let enqueued = false
  await assert.rejects(processIngressWebhook({
    ...webhook(),
    signature: 'sha256=invalid',
    env: { GITHUB_WEBHOOK_SECRET: secret, GUARDRAIL_TARGET_REPOSITORY: target },
    queue: { enqueue: async () => { enqueued = true } }
  }), /signature is invalid/)
  assert.equal(enqueued, false)
})

test('missing webhook secret fails closed before task creation', async () => {
  let enqueued = false
  await assert.rejects(processIngressWebhook({
    ...webhook(),
    env: { GUARDRAIL_TARGET_REPOSITORY: target },
    queue: { enqueue: async () => { enqueued = true } }
  }), /not configured/)
  assert.equal(enqueued, false)
})

test('task envelope validation rejects config and identity changes', () => {
  const input = webhook()
  const payload = JSON.parse(input.body.toString('utf8'))
  const envelope = createTaskEnvelope({ ...input, payload, targetRepository: target })
  assert.equal(validateTaskEnvelope(envelope, target), envelope)
  assert.throws(() => validateTaskEnvelope({ ...envelope, prNumber: 0 }, target), /number is invalid/)
  assert.throws(() => validateTaskEnvelope(envelope, 'owner/other'), /outside the configured target/)
})

test('Cloud Tasks contract uses deterministic name, OIDC and minimal JSON body', async () => {
  let request
  const queue = new CloudTasksQueue({
    GOOGLE_CLOUD_PROJECT: 'project-1',
    GUARDRAIL_TASKS_LOCATION: 'me-west1',
    GUARDRAIL_TASKS_QUEUE: 'guardrail',
    GUARDRAIL_WORKER_URL: 'https://worker.example.run.app',
    GUARDRAIL_TASKS_OIDC_SERVICE_ACCOUNT: 'caller@project-1.iam.gserviceaccount.com'
  }, {
    tokenFactory: async () => 'a'.repeat(40),
    fetchImpl: async (url, options) => {
      request = { url, options }
      return { ok: true, status: 200 }
    }
  })
  const input = webhook()
  const envelope = createTaskEnvelope({
    ...input,
    payload: JSON.parse(input.body.toString('utf8')),
    targetRepository: target
  })
  await queue.enqueue(envelope)
  const sent = JSON.parse(request.options.body)
  assert.match(sent.task.name, new RegExp(`${envelope.taskId}$`))
  assert.equal(sent.task.httpRequest.oidcToken.serviceAccountEmail, 'caller@project-1.iam.gserviceaccount.com')
  assert.equal(sent.task.httpRequest.oidcToken.audience, 'https://worker.example.run.app')
  assert.equal(JSON.parse(Buffer.from(sent.task.httpRequest.body, 'base64')).deliveryId, input.deliveryId)
  assert.equal(request.options.headers.Authorization, `Bearer ${'a'.repeat(40)}`)
})

test('structured logger allowlist redacts secrets, tokens and authorization headers', () => {
  let output = ''
  const logger = createStructuredLogger({ stream: { write: (value) => { output += value } } })
  logger('ERROR', 'redaction_test', {
    delivery_id: 'delivery-1',
    result: 'failure',
    private_key: 'PRIVATE-SECRET',
    installation_token: 'TOKEN-SECRET',
    Authorization: 'Bearer AUTH-SECRET',
    error: 'TOKEN-SECRET'
  })
  assert.match(output, /delivery-1/)
  for (const forbidden of ['PRIVATE-SECRET', 'TOKEN-SECRET', 'AUTH-SECRET', 'Authorization']) {
    assert.equal(output.includes(forbidden), false)
  }
})

test('production preflight validates commit identity and rejects Smee or Windows paths', () => {
  const directory = mkdtempSync(join(tmpdir(), 'guardrail-production-preflight-'))
  try {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const keyPath = join(directory, 'app.pem')
    const buildCommitPath = join(directory, 'BUILD_COMMIT')
    writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }))
    writeFileSync(buildCommitPath, `${'a'.repeat(40)}\n`)
    const common = {
      GUARDRAIL_PREFLIGHT_MODE: 'production',
      GUARDRAIL_RUNTIME_ROLE: 'worker',
      GITHUB_APP_ID: '123',
      GITHUB_PRIVATE_KEY_PATH: keyPath,
      GUARDRAIL_TARGET_REPOSITORY: target,
      GUARDRAIL_EXPECTED_COMMIT: 'a'.repeat(40),
      GUARDRAIL_DEPLOYED_COMMIT: 'a'.repeat(40),
      GUARDRAIL_BUILD_COMMIT_PATH: buildCommitPath,
      GUARDRAIL_IMAGE_DIGEST: `sha256:${'b'.repeat(64)}`,
      GUARDRAIL_VERSION: '4.2.0',
      PORT: '8080',
      HOST: '0.0.0.0'
    }
    if (process.platform === 'win32') {
      assert.throws(() => validateEnvironment(common, 'production'), /Linux container paths/)
    }
    const linuxPathConfig = { ...common, GITHUB_PRIVATE_KEY_PATH: '/var/run/secrets/guardrail/app.pem' }
    assert.throws(() => validateEnvironment({ ...linuxPathConfig, SMEE_URL: 'https://smee.io/example' }, 'production'), /must not depend on Smee/)
    assert.throws(() => validateEnvironment({ ...linuxPathConfig, GUARDRAIL_DEPLOYED_COMMIT: 'c'.repeat(40) }, 'production'), /must be identical/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
