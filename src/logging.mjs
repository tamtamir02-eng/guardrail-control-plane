const ALLOWED_FIELDS = new Set([
  'service',
  'runtime_role',
  'deployed_version',
  'deployed_commit',
  'image_digest',
  'delivery_id',
  'github_event',
  'pr_number',
  'head_sha',
  'classification',
  'result',
  'duration_ms',
  'phase',
  'check_run_id',
  'duplicate',
  'error_type'
])

function safeScalar(value) {
  if (typeof value === 'string') return value.slice(0, 256)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return undefined
}

export function errorType(error) {
  if (!error || typeof error !== 'object') return 'UnknownError'
  const name = typeof error.name === 'string' ? error.name : 'Error'
  const code = typeof error.details?.code === 'string' ? error.details.code : null
  return code ? `${name}:${code}` : name
}

export function createStructuredLogger({ stream = process.stdout, metadata = {} } = {}) {
  return (severity, event, fields = {}) => {
    const record = {
      severity,
      event,
      timestamp: new Date().toISOString()
    }
    for (const source of [metadata, fields]) {
      for (const [key, value] of Object.entries(source)) {
        if (!ALLOWED_FIELDS.has(key)) continue
        const safe = safeScalar(value)
        if (safe !== undefined) record[key] = safe
      }
    }
    stream.write(`${JSON.stringify(record)}\n`)
  }
}

export function runtimeMetadata(env = process.env) {
  return {
    service: env.K_SERVICE ?? 'guardrail-v4.2',
    runtime_role: env.GUARDRAIL_RUNTIME_ROLE ?? 'local',
    deployed_version: env.GUARDRAIL_VERSION ?? '4.2.0-local',
    deployed_commit: env.GUARDRAIL_DEPLOYED_COMMIT ?? 'local',
    image_digest: env.GUARDRAIL_IMAGE_DIGEST ?? 'local'
  }
}
