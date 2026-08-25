import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { analyzeRepository, parseRawDiff } from '../src/git-diff.mjs'
import { classifyChanges, loadPolicy } from '../src/policy.mjs'
import { cleanup, commit, createRepository, git, remove, write } from './helpers/git-fixture.mjs'

const repositories = []
const policy = loadPolicy()

afterEach(() => {
  while (repositories.length) cleanup(repositories.pop())
})

function repository() {
  const value = createRepository()
  repositories.push(value)
  return value
}

test('base unchanged produces the feature diff from one merge base', () => {
  const repo = repository()
  const base = commit(repo, 'base', { 'src/base.js': 'base\n' })
  git(repo, 'switch', '-c', 'feature')
  commit(repo, 'feature', { 'src/feature.js': 'feature\n' })
  const result = analyzeRepository(repo, base, 'feature')
  assert.equal(result.mergeBase, base)
  assert.deepEqual(result.records.map((record) => record.status), ['A'])
})

test('Shadow G: base advancement keeps the correct historic merge base', () => {
  const repo = repository()
  const base = commit(repo, 'base', { 'src/base.js': 'base\n' })
  git(repo, 'switch', '-c', 'feature')
  commit(repo, 'feature', { 'src/feature.js': 'feature\n' })
  git(repo, 'switch', 'main')
  commit(repo, 'main advances', { 'docs/base-moved.md': 'advanced\n' })

  const result = analyzeRepository(repo, 'main', 'feature')
  assert.equal(result.mergeBase, base)
  assert.deepEqual(result.records.map((record) => record.destinationPath), ['src/feature.js'])
})

test('PR behind base and multiple PR commits are evaluated from merge base to HEAD', () => {
  const repo = repository()
  const base = commit(repo, 'base', { 'src/base.js': 'base\n' })
  git(repo, 'switch', '-c', 'feature')
  commit(repo, 'feature one', { 'src/one.js': 'one\n' })
  commit(repo, 'feature two', { 'src/two.js': 'two\n' })
  git(repo, 'switch', 'main')
  commit(repo, 'main advances', { 'docs/advanced.md': 'advanced\n' })

  const result = analyzeRepository(repo, 'main', 'feature')
  assert.equal(result.mergeBase, base)
  assert.deepEqual(result.records.map((record) => record.destinationPath).sort(), ['src/one.js', 'src/two.js'])
})

test('rename after base movement retains RED source metadata', () => {
  const repo = repository()
  const base = commit(repo, 'base', {
    'auth/file.js': 'sensitive\n',
    'src/existing.js': 'existing\n'
  })
  git(repo, 'switch', '-c', 'feature')
  git(repo, 'mv', 'auth/file.js', 'src/file.js')
  git(repo, 'commit', '-m', 'rename')
  git(repo, 'switch', 'main')
  commit(repo, 'main advances', { 'docs/advanced.md': 'advanced\n' })

  const result = analyzeRepository(repo, 'main', 'feature')
  assert.equal(result.mergeBase, base)
  assert.equal(result.records[0].status, 'R')
  assert.equal(result.records[0].sourcePath, 'auth/file.js')
  assert.equal(classifyChanges(result.records, policy).classification, 'RED')
})

test('deleted RED file is represented and classified as RED', () => {
  const repo = repository()
  commit(repo, 'base', { 'auth/file.js': 'sensitive\n' })
  git(repo, 'switch', '-c', 'feature')
  remove(repo, 'auth/file.js')
  commit(repo, 'delete')
  const result = analyzeRepository(repo, 'main', 'feature')
  assert.equal(result.records[0].status, 'D')
  assert.equal(classifyChanges(result.records, policy).classification, 'RED')
})

test('copied RED file is detected with source and destination', () => {
  const repo = repository()
  commit(repo, 'base', { 'auth/file.js': 'sensitive\n' })
  git(repo, 'switch', '-c', 'feature')
  write(repo, 'src/file.js', 'sensitive\n')
  commit(repo, 'copy')
  const result = analyzeRepository(repo, 'main', 'feature')
  assert.equal(result.records[0].status, 'C')
  assert.equal(result.records[0].sourcePath, 'auth/file.js')
  assert.equal(result.records[0].destinationPath, 'src/file.js')
  assert.equal(classifyChanges(result.records, policy).classification, 'RED')
})

test('malformed and partial raw diff input fails closed', () => {
  assert.throws(() => parseRawDiff(':100644 100644 aaaaaaa bbbbbbb M\0src/file.js'), /Partial/)
  assert.throws(() => parseRawDiff('malformed\0src/file.js\0'), /Malformed/)
  assert.throws(
    () => parseRawDiff(':100644 100644 aaaaaaa bbbbbbb T\0src/file.js\0'),
    /Unsupported/
  )
})

test('unrelated histories have no unambiguous merge base and fail closed', () => {
  const repo = repository()
  commit(repo, 'main', { 'src/main.js': 'main\n' })
  git(repo, 'switch', '--orphan', 'unrelated')
  commit(repo, 'unrelated', { 'src/other.js': 'other\n' })
  assert.throws(() => analyzeRepository(repo, 'main', 'unrelated'), /Git metadata operation failed|merge base/)
})
