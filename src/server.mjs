import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

import { FailClosedError } from './errors.mjs'
import { processWebhook } from './webhook.mjs'

const MAX_WEBHOOK_BYTES = 2 * 1024 * 1024

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_WEBHOOK_BYTES) {
        reject(new FailClosedError('Webhook body exceeds the accepted limit'))
        request.destroy()
      } else {
        chunks.push(chunk)
      }
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

export function createGuardrailServer(options = {}) {
  return createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/webhook') {
      response.writeHead(404).end('not found')
      return
    }
    try {
      const body = await readBody(request)
      await processWebhook({
        event: request.headers['x-github-event'],
        signature: request.headers['x-hub-signature-256'],
        body,
        env: options.env ?? process.env,
        dependencies: options.dependencies
      })
      response.writeHead(200).end('accepted')
    } catch (error) {
      const status = error instanceof FailClosedError ? 400 : 500
      response.writeHead(status).end('evaluation failed closed')
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000)
  const host = process.env.HOST ?? '127.0.0.1'
  createGuardrailServer().listen(port, host, () => {
    console.log(`Guardrail V4.2 shadow server listening on ${host}:${port}`)
  })
}
