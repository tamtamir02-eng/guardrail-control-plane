import assert from 'node:assert/strict'
import test from 'node:test'

import { isTrustedGuardrailCheck } from '../src/check-identity.mjs'

test('Shadow C: same-name GitHub Actions check is not trusted as the Guardrail App', () => {
  assert.equal(isTrustedGuardrailCheck({ name: 'guardrail-v4.2', app: { id: 15368 } }, 424242), false)
})

test('check name and exact App ID must both match', () => {
  assert.equal(isTrustedGuardrailCheck({ name: 'guardrail-v4.2', app: { id: 424242 } }, 424242), true)
  assert.equal(isTrustedGuardrailCheck({ name: 'other', app: { id: 424242 } }, 424242), false)
  assert.equal(isTrustedGuardrailCheck({ name: 'guardrail-v4.2', app: null }, 424242), false)
})
