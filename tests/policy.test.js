import assert from 'node:assert/strict'
import test from 'node:test'

import { classifyChanges, classifyPath, loadPolicy } from '../src/policy.mjs'

const policy = loadPolicy()

function modified(path) {
  return { status: 'M', sourcePath: null, destinationPath: path }
}

test('classifies normal source as YELLOW', () => {
  assert.equal(classifyChanges([modified('src/file.js')], policy).classification, 'YELLOW')
})

test('Shadow A: target risk policy is CONTROL_PLANE, not authoritative input', () => {
  assert.equal(classifyChanges([modified('RISK_POLICY.md')], policy).classification, 'CONTROL_PLANE')
})

test('Shadow B: target workflow gate is CONTROL_PLANE', () => {
  assert.equal(
    classifyChanges([modified('.github/workflows/guardrail-v4-ci.yml')], policy).classification,
    'CONTROL_PLANE'
  )
})

test('CONTROL_PLANE overrides a cosmetic markdown match', () => {
  assert.equal(classifyPath('AGENTS.md', policy).classification, 'CONTROL_PLANE')
})

test('Shadow D: RED to normal rename remains RED', () => {
  const result = classifyChanges([
    { status: 'R', sourcePath: 'auth/file.js', destinationPath: 'src/file.js' }
  ], policy)
  assert.equal(result.classification, 'RED')
})

test('Shadow E: normal to RED rename is RED', () => {
  const result = classifyChanges([
    { status: 'R', sourcePath: 'src/file.js', destinationPath: 'auth/file.js' }
  ], policy)
  assert.equal(result.classification, 'RED')
})

test('Shadow F: deletion from RED is RED', () => {
  const result = classifyChanges([{ status: 'D', sourcePath: 'auth/file.js', destinationPath: null }], policy)
  assert.equal(result.classification, 'RED')
})

test('copy from or to RED is RED', () => {
  assert.equal(classifyChanges([
    { status: 'C', sourcePath: 'auth/file.js', destinationPath: 'src/file.js' }
  ], policy).classification, 'RED')
  assert.equal(classifyChanges([
    { status: 'C', sourcePath: 'src/file.js', destinationPath: 'auth/file.js' }
  ], policy).classification, 'RED')
})

test('unsupported or partial records fail closed', () => {
  assert.throws(() => classifyChanges([{ status: 'T', destinationPath: 'src/file.js' }], policy), /Unsupported/)
  assert.throws(() => classifyChanges([{ status: 'R', sourcePath: 'auth/file.js' }], policy), /Malformed/)
})
