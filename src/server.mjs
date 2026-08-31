import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

import { FailClosedError } from './errors.mjs'
import { processIngressWebhook } from './ingress.mjs'
import { createStructuredLogger, runtimeMetadata } from './logging.mjs'
import { LocalTaskQueue } from './task-queue.mjs'
import { processTaskEnvelope } from './worker.mjs'

const MAX_WEBHOOK_BYTES = 2 * 1024 * 1024
const MAX_TASK_BYTES = 64 * 1024

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > limit && !settled) {
        settled = true
        reject(new FailClosedError('Request body exceeds the accepted limit'))
        request.destroy()
      } else if (!settled) {
        chunks.push(chunk)
      }
    })
    request.on('end', () => {
      if (!settled) resolve(Buffer.concat(chunks))
    })
    request.on('error', (error) => {
      if (!settled) reject(error)
    })
  })
}

function json(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(value))
}

function parseJson(body) {
  try {
    return JSON.parse(body.toString('utf8'))
  } catch {
    throw new FailClosedError('Task JSON is invalid')
  }
}

export function runtimeAddress(env = process.env) {
  const port = Number(env.PORT ?? 8080)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new FailClosedError('PORT is invalid')
  return { host: env.HOST ?? '0.0.0.0', port }
}

export function createGuardrailServer(options = {}) {
  const env = options.env ?? process.env
  const role = options.role ?? env.GUARDRAIL_RUNTIME_ROLE ?? 'local'
  if (!['ingress', 'worker', 'local'].includes(role)) throw new FailClosedError('GUARDRAIL_RUNTIME_ROLE is invalid')
  const metadata = runtimeMetadata({ ...env, GUARDRAIL_RUNTIME_ROLE: role })
  const logger = options.logger ?? createStructuredLogger({ metadata })
  const worker = (envelope) => processTaskEnvelope({
    envelope,
    env,
    dependencies: options.workerDependencies ?? options.dependencies,
    logger
  })
  const localQueue = options.queue ?? (role === 'local' ? new LocalTaskQueue(worker) : null)

  return createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      json(response, 200, { status: 'ok', ...metadata })
      return
    }
    if ((role === 'ingress' || role === 'local') && request.method === 'POST' && request.url === '/webhook') {
      try {
        const body = await readBody(request, MAX_WEBHOOK_BYTES)
        const result = await processIngressWebhook({
          deliveryId: request.headers['x-github-delivery'],
          event: request.headers['x-github-event'],
          signature: request.headers['x-hub-signature-256'],
          body,
          env,
          queue: localQueue ?? options.queue,
          logger
        })
        json(response, 202, { accepted: true, duplicate: result.duplicate, ignored: result.ignored })
      } catch (error) {
        const status = error.details?.code === 'INVALID_SIGNATURE' ? 401 : error instanceof FailClosedError ? 400 : 500
        json(response, status, { accepted: false, error: 'request failed closed' })
      }
      return
    }
    if ((role === 'worker' || role === 'local') && request.method === 'POST' && request.url === '/tasks/evaluate') {
      const requireTaskHeader = role === 'worker' && env.GUARDRAIL_REQUIRE_TASK_HEADER !== 'false'
      if (requireTaskHeader && typeof request.headers['x-cloudtasks-taskname'] !== 'string') {
        json(response, 403, { accepted: false, error: 'worker caller rejected' })
        return
      }
      try {
        const body = await readBody(request, MAX_TASK_BYTES)
        const results = await worker(parseJson(body))
        json(response, 200, { accepted: true, count: results.length })
      } catch {
        json(response, 500, { accepted: false, error: 'evaluation failed closed' })
      }
      return
    }
    json(response, 404, { error: 'not found' })
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { host, port } = runtimeAddress()
  const server = createGuardrailServer()
  server.listen(port, host, () => {
    const logger = createStructuredLogger({ metadata: runtimeMetadata() })
    logger('INFO', 'server_listening', { result: 'ready' })
  })
  const shutdown = () => server.close(() => process.exit(0))
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}
