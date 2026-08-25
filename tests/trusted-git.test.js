import assert from 'node:assert/strict'
import test from 'node:test'

import { secureGitEnvironment } from '../src/trusted-git.mjs'

test('trusted Git authenticates installation tokens as an x-access-token HTTP password', () => {
  const token = 'test-installation-token'
  const env = secureGitEnvironment(token, 'C:\\empty-hooks')
  const authorization = env.GIT_CONFIG_VALUE_0

  assert.match(authorization, /^Authorization: Basic /)
  assert.doesNotMatch(authorization, /Bearer/)
  assert.doesNotMatch(authorization, new RegExp(token))

  const encoded = authorization.slice('Authorization: Basic '.length)
  assert.equal(Buffer.from(encoded, 'base64').toString('utf8'), `x-access-token:${token}`)
})
