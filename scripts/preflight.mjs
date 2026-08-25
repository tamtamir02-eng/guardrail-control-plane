import { spawnSync } from 'node:child_process'
import { createPrivateKey } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'

import { loadPolicy } from '../src/policy.mjs'

const REQUIRED_TARGET = 'tamtamir02-eng/codex-guardrail-pilot'

function requireValue(env, name) {
  const value = env[name]
  if (typeof value !== 'string' || value.length === 0 || /^<.*>$/.test(value)) {
    throw new Error(`${name} is missing`)
  }
  return value
}

export function validateEnvironment(env = process.env) {
  const appId = requireValue(env, 'GITHUB_APP_ID')
  if (!/^\d+$/.test(appId) || Number(appId) < 1) throw new Error('GITHUB_APP_ID must be a positive number')

  const privateKeyPath = requireValue(env, 'GITHUB_PRIVATE_KEY_PATH')
  if (!isAbsolute(privateKeyPath)) throw new Error('GITHUB_PRIVATE_KEY_PATH must be absolute')
  let privateKey
  try {
    privateKey = createPrivateKey(readFileSync(privateKeyPath, 'utf8'))
  } catch {
    throw new Error('GITHUB_PRIVATE_KEY_PATH is not a readable private key')
  }
  if (privateKey.asymmetricKeyType !== 'rsa') throw new Error('GitHub App private key must be RSA')

  const webhookSecret = requireValue(env, 'GITHUB_WEBHOOK_SECRET')
  if (webhookSecret.length < 32) throw new Error('GITHUB_WEBHOOK_SECRET must contain at least 32 characters')

  const target = requireValue(env, 'GUARDRAIL_TARGET_REPOSITORY')
  if (target.toLowerCase() !== REQUIRED_TARGET.toLowerCase()) {
    throw new Error(`GUARDRAIL_TARGET_REPOSITORY must be ${REQUIRED_TARGET}`)
  }

  const expectedCommit = requireValue(env, 'GUARDRAIL_EXPECTED_COMMIT')
  if (!/^[0-9a-f]{40}$/i.test(expectedCommit)) throw new Error('GUARDRAIL_EXPECTED_COMMIT must be a full commit SHA')

  const host = env.HOST ?? '127.0.0.1'
  if (host !== '127.0.0.1') throw new Error('HOST must remain 127.0.0.1 for local shadow mode')
  const port = Number(env.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 through 65535')

  return { expectedCommit: expectedCommit.toLowerCase(), host, port, target: REQUIRED_TARGET }
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

export function assertGitState(expectedCommit) {
  run('git', ['--version'])
  const actualCommit = run('git', ['rev-parse', 'HEAD']).toLowerCase()
  if (actualCommit !== expectedCommit) {
    throw new Error(`Control-plane commit mismatch: expected ${expectedCommit}, found ${actualCommit}`)
  }
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
  await check('required local environment and RSA key are valid', () => {
    config = validateEnvironment(env)
  })
  await check('authoritative policy bundle is readable and valid', () => loadPolicy())
  await check('Git is available, commit is pinned, and working tree is clean', () => assertGitState(config.expectedCommit))
  await check(`port ${config.port} is free on loopback`, () => assertPortAvailable(config.port, config.host))
  console.log(`PREFLIGHT PASSED (${checks.length} checks; target ${config.target})`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPreflight().catch((error) => {
    console.error(`PREFLIGHT FAILED: ${error.message}`)
    process.exitCode = 1
  })
}
