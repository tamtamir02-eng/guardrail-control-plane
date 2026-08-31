import { FailClosedError } from './errors.mjs'
import { errorType } from './logging.mjs'
import { readSecret } from './secrets.mjs'
import { createTaskEnvelope } from './task-contract.mjs'
import { CloudTasksQueue } from './task-queue.mjs'
import { verifyWebhookSignature } from './webhook.mjs'

export async function processIngressWebhook({
  deliveryId,
  event,
  signature,
  body,
  env = process.env,
  queue,
  logger = () => {}
}) {
  const started = Date.now()
  try {
    const secret = readSecret({
      env,
      valueName: 'GITHUB_WEBHOOK_SECRET',
      pathName: 'GITHUB_WEBHOOK_SECRET_PATH',
      minimumLength: 16
    })
    if (!verifyWebhookSignature(body, signature, secret)) {
      throw new FailClosedError('Webhook signature is invalid', { code: 'INVALID_SIGNATURE' })
    }
    let payload
    try {
      payload = JSON.parse(body.toString('utf8'))
    } catch {
      throw new FailClosedError('Webhook JSON is invalid', { code: 'INVALID_JSON' })
    }
    const envelope = createTaskEnvelope({
      deliveryId,
      event,
      payload,
      targetRepository: env.GUARDRAIL_TARGET_REPOSITORY
    })
    if (!envelope) {
      logger('INFO', 'webhook_ignored', {
        delivery_id: deliveryId,
        github_event: event,
        result: 'ignored',
        duration_ms: Date.now() - started
      })
      return { ignored: true, duplicate: false }
    }
    const activeQueue = queue ?? new CloudTasksQueue(env)
    const result = await activeQueue.enqueue(envelope)
    logger('INFO', 'webhook_enqueued', {
      delivery_id: deliveryId,
      github_event: event,
      pr_number: envelope.prNumber ?? undefined,
      result: result.duplicate ? 'duplicate' : 'enqueued',
      duplicate: result.duplicate,
      duration_ms: Date.now() - started
    })
    return { ignored: false, ...result, envelope }
  } catch (error) {
    logger('ERROR', 'webhook_rejected', {
      delivery_id: deliveryId,
      github_event: event,
      result: 'failure',
      phase: 'ingress',
      error_type: errorType(error),
      duration_ms: Date.now() - started
    })
    throw error
  }
}
