import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

import { FailClosedError, RefChangedError } from './errors.mjs'
import { analyzeRepository } from './git-diff.mjs'

function validateRepository(fullName) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName ?? '')) {
    throw new FailClosedError('Invalid GitHub repository name')
  }
  return fullName
}

function validateBranch(branch) {
  if (typeof branch !== 'string' || branch.length === 0 || branch.startsWith('-') || /[\s~^:?*[\\]/.test(branch)) {
    throw new FailClosedError('Invalid Git branch name')
  }
  return branch
}

function secureGitEnvironment(token, hooksDirectory) {
  const config = [
    ['http.extraHeader', `Authorization: Bearer ${token}`],
    ['protocol.allow', 'never'],
    ['protocol.https.allow', 'always'],
    ['core.hooksPath', hooksDirectory],
    ['credential.interactive', 'false']
  ]
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_COUNT: String(config.length) }
  config.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${index}`] = key
    env[`GIT_CONFIG_VALUE_${index}`] = value
  })
  return env
}

function run(repository, args, env) {
  const result = spawnSync('git', ['-C', repository, ...args], {
    encoding: 'utf8',
    shell: false,
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
    env
  })
  if (result.error || result.status !== 0 || result.signal) {
    throw new FailClosedError(`Trusted Git fetch failed: ${result.error?.message || result.stderr?.trim() || result.status}`)
  }
  return result.stdout.trim()
}

function safeCleanup(directory) {
  const root = resolve(tmpdir()) + sep
  const target = resolve(directory)
  if (!target.startsWith(root) || !basename(target).startsWith('guardrail-v42-')) {
    throw new FailClosedError('Refusing unsafe temporary cleanup')
  }
  rmSync(target, { recursive: true, force: true })
}

export function fetchAndAnalyzePullRequest({
  installationToken,
  targetRepository,
  headRepository,
  baseBranch,
  headBranch,
  expectedBaseSha,
  expectedHeadSha
}) {
  validateRepository(targetRepository)
  validateRepository(headRepository)
  validateBranch(baseBranch)
  validateBranch(headBranch)
  if (!/^[0-9a-f]{40,64}$/i.test(expectedBaseSha ?? '') || !/^[0-9a-f]{40,64}$/i.test(expectedHeadSha ?? '')) {
    throw new FailClosedError('Expected refs are malformed')
  }

  const temporary = mkdtempSync(join(tmpdir(), 'guardrail-v42-'))
  const bareRepository = join(temporary, 'metadata.git')
  const emptyTemplate = join(temporary, 'empty-template')
  const emptyHooks = join(temporary, 'empty-hooks')
  mkdirSync(emptyTemplate)
  mkdirSync(emptyHooks)
  const env = secureGitEnvironment(installationToken, emptyHooks)

  try {
    const init = spawnSync('git', ['init', '--bare', `--template=${emptyTemplate}`, bareRepository], {
      encoding: 'utf8', shell: false, timeout: 30_000, env
    })
    if (init.error || init.status !== 0) throw new FailClosedError('Cannot initialize trusted bare repository')

    const targetUrl = `https://github.com/${targetRepository}.git`
    const headUrl = `https://github.com/${headRepository}.git`
    run(bareRepository, [
      'fetch', '--no-tags', '--force', '--filter=blob:none', targetUrl,
      `+refs/heads/${baseBranch}:refs/guardrail/base`
    ], env)
    run(bareRepository, [
      'fetch', '--no-tags', '--force', '--filter=blob:none', headUrl,
      `+refs/heads/${headBranch}:refs/guardrail/head`
    ], env)

    const actualBaseSha = run(bareRepository, ['rev-parse', 'refs/guardrail/base^{commit}'], env)
    const actualHeadSha = run(bareRepository, ['rev-parse', 'refs/guardrail/head^{commit}'], env)
    if (actualBaseSha !== expectedBaseSha || actualHeadSha !== expectedHeadSha) {
      throw new RefChangedError('A live ref changed while Git metadata was fetched', {
        expectedBaseSha,
        actualBaseSha,
        expectedHeadSha,
        actualHeadSha
      })
    }

    return analyzeRepository(bareRepository, 'refs/guardrail/base', 'refs/guardrail/head')
  } finally {
    safeCleanup(temporary)
  }
}
