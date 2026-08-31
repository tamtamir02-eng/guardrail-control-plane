import { FailClosedError } from './errors.mjs'

function requireUrl(value, name) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') throw new Error('HTTPS required')
    if (url.pathname !== '/' || url.search || url.hash) throw new Error('Service root URL required')
    return url.origin
  } catch {
    throw new FailClosedError(`${name} must be an HTTPS URL`)
  }
}

export async function metadataAccessToken(fetchImpl = fetch) {
  const response = await fetchImpl(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(3000) }
  )
  if (!response.ok) throw new FailClosedError('Cannot obtain Google runtime identity')
  const body = await response.json()
  if (typeof body.access_token !== 'string' || body.access_token.length < 20) {
    throw new FailClosedError('Google runtime identity response is malformed')
  }
  return body.access_token
}

export class CloudTasksQueue {
  constructor(env = process.env, { fetchImpl = fetch, tokenFactory = metadataAccessToken } = {}) {
    this.project = env.GOOGLE_CLOUD_PROJECT
    this.location = env.GUARDRAIL_TASKS_LOCATION
    this.queue = env.GUARDRAIL_TASKS_QUEUE
    this.workerUrl = requireUrl(env.GUARDRAIL_WORKER_URL, 'GUARDRAIL_WORKER_URL')
    this.oidcServiceAccount = env.GUARDRAIL_TASKS_OIDC_SERVICE_ACCOUNT
    this.oidcAudience = requireUrl(env.GUARDRAIL_TASKS_OIDC_AUDIENCE ?? env.GUARDRAIL_WORKER_URL, 'GUARDRAIL_TASKS_OIDC_AUDIENCE')
    this.fetchImpl = fetchImpl
    this.tokenFactory = tokenFactory
    for (const [name, value] of Object.entries({
      GOOGLE_CLOUD_PROJECT: this.project,
      GUARDRAIL_TASKS_LOCATION: this.location,
      GUARDRAIL_TASKS_QUEUE: this.queue,
      GUARDRAIL_TASKS_OIDC_SERVICE_ACCOUNT: this.oidcServiceAccount
    })) {
      if (typeof value !== 'string' || value.length === 0) throw new FailClosedError(`${name} is not configured`)
    }
  }

  async enqueue(envelope) {
    const token = await this.tokenFactory(this.fetchImpl)
    const parent = `projects/${this.project}/locations/${this.location}/queues/${this.queue}`
    const response = await this.fetchImpl(`https://cloudtasks.googleapis.com/v2/${parent}/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        task: {
          name: `${parent}/tasks/${envelope.taskId}`,
          httpRequest: {
            httpMethod: 'POST',
            url: `${this.workerUrl}/tasks/evaluate`,
            headers: { 'Content-Type': 'application/json' },
            body: Buffer.from(JSON.stringify(envelope)).toString('base64'),
            oidcToken: {
              serviceAccountEmail: this.oidcServiceAccount,
              audience: this.oidcAudience
            }
          },
          dispatchDeadline: '300s'
        }
      }),
      signal: AbortSignal.timeout(5000)
    })
    if (response.status === 409) return { duplicate: true, taskId: envelope.taskId }
    if (!response.ok) throw new FailClosedError(`Cloud Tasks enqueue failed with HTTP ${response.status}`)
    return { duplicate: false, taskId: envelope.taskId }
  }
}

export class LocalTaskQueue {
  constructor(handler) {
    this.handler = handler
    this.taskIds = new Set()
  }

  async enqueue(envelope) {
    if (this.taskIds.has(envelope.taskId)) return { duplicate: true, taskId: envelope.taskId }
    this.taskIds.add(envelope.taskId)
    await this.handler(envelope)
    return { duplicate: false, taskId: envelope.taskId }
  }
}
