import { spawnSync } from 'node:child_process'
import { createPrivateKey } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'

import { loadPolicy } from '../src/policy.mjs'
import { readSecret } from '../src/secrets.mjs'

const REQUIRED_TARGET = 'tamtamir02-eng/codex-guardrail-pilot'

function requireValue(env, name) {
  const value = env[name]
  if (typeof value !== 'string' || value.length === 0 || /^<.*>$/.test(value)) throw new Error(`${name} is missing`)
  return value
}

function validateTarget(env) {
  const target = requireValue(env, 'GUARDRAIL_TARGET_REPOSITORY')
  if (target.toLowerCase() !== REQUIRED_TARGET.toLowerCase()) {
    throw new Error(`GUARDRAIL_TARGET_REPOSITORY must be ${REQUIRED_TARGET}`)
  }
  return target
}

function validatePrivateKey(env, production) {
  const privateKeyPath = requireValue(env, 'GITHUB_PRIVATE_KEY_PATH')
  if (!isAbsolute(privateKeyPath)) throw new Error('GITHUB_PRIVATE_KEY_PATH must be absolute')
  if (production && (/^[A-Za-z]:[\\/]/.test(privateKeyPath) || privateKeyPath.includes('\\'))) {
    throw new Error('Production secret paths must be Linux container paths')
  }
  let privateKey
  try {
    privateKey = createPrivateKey(readFileSync(privateKeyPath, 'utf8'))
  } catch {
    throw new Error('GITHUB_PRIVATE_KEY_PATH is not a readable private key')
  }
  if (privateKey.asymmetricKeyType !== 'rsa') throw new Error('GitHub App private key must be RSA')
}

function requireHttpsUrl(env, name) {
  try {
    const url = new URL(requireValue(env, name))
    if (url.protocol !== 'https:') throw new Error('HTTPS required')
  } catch {
    throw new Error(`${name} must be an HTTPS URL`)
  }
}

function requireLinuxSecretPath(env, name) {
  const path = requireValue(env, name)
  if (!path.startsWith('/') || path.includes('\\') || /^[A-Za-z]:/.test(path)) {
    throw new Error(`${name} must be a Linux container path`)
  }
  return path
}

function validateProduction(env) {
  const role = requireValue(env, 'GUARDRAIL_RUNTIME_ROLE')
  if (!['ingress', 'worker'].includes(role)) throw new Error('Production role must be ingress or worker')
  const expectedCommit = requireValue(env, 'GUARDRAIL_EXPECTED_COMMIT').toLowerCase()
  const deployedCommit = requireValue(env, 'GUARDRAIL_DEPLOYED_COMMIT').toLowerCase()
  if (!/^[0-9a-f]{40}$/.test(expectedCommit) || expectedCommit !== deployedCommit) {
    throw new Error('Expected and deployed commit SHAs must be identical full SHAs')
  }
  if (!/^sha256:[0-9a-f]{64}$/i.test(requireValue(env, 'GUARDRAIL_IMAGE_DIGEST'))) {
    throw new Error('GUARDRAIL_IMAGE_DIGEST must be an immutable sha256 digest')
  }
  requireValue(env, 'GUARDRAIL_VERSION')
  const host = env.HOST ?? '0.0.0.0'
  if (host !== '0.0.0.0') throw new Error('Production HOST must be 0.0.0.0')
  for (const [name, value] of Object.entries(env)) {
    if (name.toUpperCase().includes('SMEE') || String(value).toLowerCase().includes('smee.io')) {
      throw new Error('Production configuration must not depend on Smee')
    }
  }
  const buildCommitPath = env.GUARDRAIL_BUILD_COMMIT_PATH ?? '/app/BUILD_COMMIT'
  let bakedCommit
  try {
    bakedCommit = readFileSync(buildCommitPath, 'utf8').trim().toLowerCase()
  } catch {
    throw new Error('Baked build commit is not readable')
  }
  if (bakedCommit !== expectedCommit) throw new Error('Baked build commit does not match expected commit')
  if (role === 'ingress') {
    requireLinuxSecretPath(env, 'GITHUB_WEBHOOK_SECRET_PATH')
    readSecret({ env, valueName: 'GITHUB_WEBHOOK_SECRET', pathName: 'GITHUB_WEBHOOK_SECRET_PATH', minimumLength: 32 })
    requireValue(env, 'GOOGLE_CLOUD_PROJECT')
    requireValue(env, 'GUARDRAIL_TASKS_LOCATION')
    requireValue(env, 'GUARDRAIL_TASKS_QUEUE')
    requireHttpsUrl(env, 'GUARDRAIL_WORKER_URL')
    requireValue(env, 'GUARDRAIL_TASKS_OIDC_SERVICE_ACCOUNT')
    requireHttpsUrl(env, 'GUARDRAIL_TASKS_OIDC_AUDIENCE')
  } else {
    const appId = requireValue(env, 'GITHUB_APP_ID')
    if (!/^\d+$/.test(appId) || Number(appId) < 1) throw new Error('GITHUB_APP_ID must be a positive number')
    validatePrivateKey(env, true)
  }
  return { role, expectedCommit, deployedCommit, buildCommitPath, host }
}

function validateLocal(env) {
  const appId = requireValue(env, 'GITHUB_APP_ID')
  if (!/^\d+$/.test(appId) || Number(appId) < 1) throw new Error('GITHUB_APP_ID must be a positive number')
  validatePrivateKey(env, false)
  readSecret({ env, valueName: 'GITHUB_WEBHOOK_SECRET', pathName: 'GITHUB_WEBHOOK_SECRET_PATH', minimumLength: 32 })
  const expectedCommit = requireValue(env, 'GUARDRAIL_EXPECTED_COMMIT')
  if (!/^[0-9a-f]{40}$/i.test(expectedCommit)) throw new Error('GUARDRAIL_EXPECTED_COMMIT must be a full commit SHA')
  const host = env.HOST ?? '127.0.0.1'
  if (host !== '127.0.0.1') throw new Error('Local HOST must remain 127.0.0.1')
  return { role: 'local', expectedCommit: expectedCommit.toLowerCase(), host }
}

export function validateEnvironment(env = process.env, mode = env.GUARDRAIL_PREFLIGHT_MODE ?? 'local') {
  const target = validateTarget(env)
  const port = Number(env.PORT ?? (mode === 'production' ? 8080 : 3000))
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 through 65535')
  const config = mode === 'production' ? validateProduction(env) : validateLocal(env)
  return { ...config, mode, port, target }
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false })
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed`)
  return result.stdout.trim()
}

export function assertNodeVersion(version = process.versions.node) {
  const major = Number(version.split('.')[0])
  if (!Number.isInteger(major) || major < 20) throw new Error(`Node.js 20+ is required; found ${version}`)
}

export function assertGitAvailable() {
  const version = run('git', ['--version'])
  if (!/^git version \d+\./.test(version)) throw new Error('Git CLI version is malformed')
  return version
}

export function assertGitState(expectedCommit) {
  assertGitAvailable()
  const actualCommit = run('git', ['rev-parse', 'HEAD']).toLowerCase()
  if (actualCommit !== expectedCommit) throw new Error(`Control-plane commit mismatch: expected ${expectedCommit}, found ${actualCommit}`)
  const status = run('git', ['status', '--porcelain', '--untracked-files=all'])
  if (status.length > 0) throw new Error('Control-plane working tree is not clean')
}

export function assertPortAvailable(port, host) {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.once('error', () => reject(new Error(`Local port ${port} is not available on ${host}`)))
    server.listen(port, host, () => server.close((error) => error ? reject(error) : resolve()))
  })
}

export async function runPreflight(env = process.env) {
  const checks = []
  const check = async (label, action) => {
    await action()
    checks.push(label)
    console.log(`PASS: ${label}`)
  }
  let config
  await check('Node.js version is 20 or newer', () => assertNodeVersion())
  await check('Git CLI is installed', () => assertGitAvailable())
  await check('runtime environment and mounted secrets are valid', () => {
    config = validateEnvironment(env)
  })
  await check('authoritative policy bundle is readable and valid', () => loadPolicy())
  if (config.mode === 'local') {
    await check('local Git commit is pinned and working tree is clean', () => assertGitState(config.expectedCommit))
    await check(`port ${config.port} is free on loopback`, () => assertPortAvailable(config.port, config.host))
  }
  console.log(`PREFLIGHT PASSED (${checks.length} checks; ${config.mode}/${config.role}; target ${config.target})`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPreflight().catch((error) => {
    console.error(`PREFLIGHT FAILED: ${error.message}`)
    process.exitCode = 1
  })
}
