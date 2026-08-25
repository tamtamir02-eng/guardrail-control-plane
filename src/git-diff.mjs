import { spawnSync } from 'node:child_process'

import { FailClosedError } from './errors.mjs'

const RAW_HEADER = /^:([0-7]{6}) ([0-7]{6}) ([0-9a-f]{7,64}) ([0-9a-f]{7,64}) ([A-Z])(\d{0,3})$/
const SUPPORTED = new Set(['A', 'M', 'D', 'R', 'C'])

export function runGit(repository, args, options = {}) {
  const result = spawnSync('git', ['-C', repository, ...args], {
    encoding: 'utf8',
    shell: false,
    timeout: options.timeout ?? 60_000,
    maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
    env: options.env ?? process.env
  })
  if (result.error || result.status !== 0 || result.signal) {
    const reason = result.error?.message || result.stderr?.trim() || `git exited ${result.status}`
    throw new FailClosedError(`Git metadata operation failed: ${reason}`)
  }
  return result.stdout
}

export function parseRawDiff(raw) {
  if (typeof raw !== 'string') throw new FailClosedError('Diff output is not text')
  if (raw.length === 0) return []
  if (!raw.endsWith('\0')) throw new FailClosedError('Partial diff output')

  const fields = raw.split('\0')
  fields.pop()
  const records = []

  for (let index = 0; index < fields.length;) {
    const header = fields[index]
    index += 1
    const match = RAW_HEADER.exec(header)
    if (!match) throw new FailClosedError('Malformed raw diff header')

    const [, oldMode, newMode, oldSha, newSha, status, scoreText] = match
    if (!SUPPORTED.has(status)) throw new FailClosedError(`Unsupported diff status: ${status}`)
    if ((status === 'R' || status === 'C') !== Boolean(scoreText)) {
      throw new FailClosedError('Malformed rename/copy score')
    }

    const sourceOrDestination = fields[index]
    index += 1
    if (!sourceOrDestination) throw new FailClosedError('Missing diff path')

    const record = {
      status,
      score: scoreText ? Number(scoreText) : null,
      oldMode,
      newMode,
      oldSha,
      newSha,
      sourcePath: status === 'D' || status === 'R' || status === 'C' ? sourceOrDestination : null,
      destinationPath: status === 'D' ? null : sourceOrDestination
    }

    if (status === 'R' || status === 'C') {
      record.destinationPath = fields[index]
      index += 1
      if (!record.destinationPath) throw new FailClosedError('Missing rename/copy destination')
    }
    records.push(record)
  }

  return records
}

function resolveCommit(repository, ref) {
  const output = runGit(repository, ['rev-parse', '--verify', `${ref}^{commit}`]).trim()
  if (!/^[0-9a-f]{40,64}$/.test(output)) throw new FailClosedError(`Invalid commit for ${ref}`)
  return output
}

export function analyzeRepository(repository, baseRef, headRef) {
  const baseSha = resolveCommit(repository, baseRef)
  const headSha = resolveCommit(repository, headRef)
  const mergeBases = runGit(repository, ['merge-base', '--all', baseSha, headSha])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)

  if (mergeBases.length !== 1 || !/^[0-9a-f]{40,64}$/.test(mergeBases[0])) {
    throw new FailClosedError('Ambiguous or missing merge base')
  }

  const mergeBase = mergeBases[0]
  const raw = runGit(repository, [
    'diff',
    '--raw',
    '-z',
    '-M',
    '-C',
    '--find-copies-harder',
    '--no-ext-diff',
    '--no-textconv',
    mergeBase,
    headSha
  ])

  return {
    baseSha,
    headSha,
    mergeBase,
    records: parseRawDiff(raw)
  }
}
