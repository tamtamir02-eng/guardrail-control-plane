import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import test from 'node:test'

import { createAppJwt } from '../src/app-auth.mjs'

test('GitHub App JWT is RS256, short-lived, and signed by the supplied key', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  const now = 2_000_000_000
  const jwt = createAppJwt(12345, privatePem, now)
  const [headerPart, payloadPart, signaturePart] = jwt.split('.')
  const header = JSON.parse(Buffer.from(headerPart, 'base64url'))
  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url'))
  assert.deepEqual(header, { alg: 'RS256', typ: 'JWT' })
  assert.deepEqual(payload, { iat: now - 60, exp: now + 540, iss: '12345' })
  assert.equal(
    verify('RSA-SHA256', Buffer.from(`${headerPart}.${payloadPart}`), publicKey, Buffer.from(signaturePart, 'base64url')),
    true
  )
})
