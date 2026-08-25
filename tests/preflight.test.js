import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import test from 'node:test'

import { assertNodeVersion, assertPortAvailable, validateEnvironment } from '../scripts/preflight.mjs'

test('preflight accepts a pinned local-only least-privilege configuration', () => {
  const directory = mkdtempSync(join(tmpdir(), 'guardrail-preflight-'))
  try {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const privateKeyPath = join(directory, 'app.pem')
    writeFileSync(privateKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }))

    const config = validateEnvironment({
      GITHUB_APP_ID: '12345',
      GITHUB_PRIVATE_KEY_PATH: privateKeyPath,
      GITHUB_WEBHOOK_SECRET: 'a'.repeat(32),
      GUARDRAIL_TARGET_REPOSITORY: 'tamtamir02-eng/codex-guardrail-pilot',
      GUARDRAIL_EXPECTED_COMMIT: 'f2409a4dcde81766eda1dd50f3bf7e8e8f440e64',
      HOST: '127.0.0.1',
      PORT: '3000'
    })

    assert.equal(config.port, 3000)
    assert.equal(config.host, '127.0.0.1')
    assert.equal(config.target, 'tamtamir02-eng/codex-guardrail-pilot')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('preflight rejects an unapproved target repository', () => {
  const directory = mkdtempSync(join(tmpdir(), 'guardrail-preflight-'))
  try {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const privateKeyPath = join(directory, 'app.pem')
    writeFileSync(privateKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }))
    assert.throws(() => validateEnvironment({
      GITHUB_APP_ID: '12345',
      GITHUB_PRIVATE_KEY_PATH: privateKeyPath,
      GITHUB_WEBHOOK_SECRET: 'a'.repeat(32),
      GUARDRAIL_TARGET_REPOSITORY: 'owner/another-repo',
      GUARDRAIL_EXPECTED_COMMIT: 'f'.repeat(40)
    }), /must be tamtamir02-eng\/codex-guardrail-pilot/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('preflight enforces Node.js 20 or newer', () => {
  assert.doesNotThrow(() => assertNodeVersion('20.0.0'))
  assert.throws(() => assertNodeVersion('18.20.0'), /Node.js 20\+/)
})

test('preflight detects a port already occupied on loopback', async () => {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  try {
    await assert.rejects(
      assertPortAvailable(server.address().port, '127.0.0.1'),
      /is not available/
    )
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
