import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'

import { FailClosedError } from './errors.mjs'

function base64Url(value) {
  return Buffer.from(value).toString('base64url')
}

export function createAppJwt(appId, privateKey, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!/^\d+$/.test(String(appId)) || typeof privateKey !== 'string' || !privateKey.includes('PRIVATE KEY')) {
    throw new FailClosedError('GitHub App identity is not configured')
  }
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64Url(JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + 540, iss: String(appId) }))
  const signingInput = `${header}.${payload}`
  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  signer.end()
  return `${signingInput}.${signer.sign(privateKey).toString('base64url')}`
}

export function readPrivateKey(privateKeyPath) {
  if (typeof privateKeyPath !== 'string' || !isAbsolute(privateKeyPath)) {
    throw new FailClosedError('GITHUB_PRIVATE_KEY_PATH must be an absolute secret-mounted path')
  }
  try {
    return readFileSync(privateKeyPath, 'utf8')
  } catch (error) {
    throw new FailClosedError(`Cannot read GitHub App private key: ${error.code ?? 'unknown error'}`)
  }
}

export async function createInstallationToken({ appId, privateKeyPath, installationId, fetchImpl = fetch }) {
  if (!Number.isInteger(Number(installationId))) throw new FailClosedError('Missing installation ID')
  const jwt = createAppJwt(appId, readPrivateKey(privateKeyPath))
  const response = await fetchImpl(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${jwt}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'guardrail-control-plane-v4.2'
    }
  })
  if (!response.ok) throw new FailClosedError(`Installation token request failed with HTTP ${response.status}`)
  const body = await response.json()
  if (typeof body.token !== 'string' || body.token.length < 20) {
    throw new FailClosedError('Installation token response is malformed')
  }
  return body.token
}
