import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

export function git(repository, ...args) {
  const result = spawnSync('git', ['-C', repository, ...args], {
    encoding: 'utf8', shell: false, timeout: 30_000
  })
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || `git exited ${result.status}`)
  }
  return result.stdout.trim()
}

export function createRepository() {
  const repository = mkdtempSync(join(tmpdir(), 'guardrail-test-'))
  git(repository, 'init', '-b', 'main')
  git(repository, 'config', 'user.name', 'Guardrail Test')
  git(repository, 'config', 'user.email', 'guardrail-test@example.invalid')
  return repository
}

export function write(repository, path, content) {
  const fullPath = join(repository, path)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content)
}

export function remove(repository, path) {
  unlinkSync(join(repository, path))
}

export function commit(repository, message, files = {}) {
  for (const [path, content] of Object.entries(files)) write(repository, path, content)
  git(repository, 'add', '-A')
  git(repository, 'commit', '-m', message)
  return git(repository, 'rev-parse', 'HEAD')
}

export function cleanup(repository) {
  if (!repository.startsWith(tmpdir())) throw new Error('unsafe fixture cleanup')
  rmSync(repository, { recursive: true, force: true })
}
