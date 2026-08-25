import { readFileSync } from 'node:fs'

import { FailClosedError } from './errors.mjs'

const RANK = Object.freeze({ GREEN: 0, YELLOW: 1, RED: 2, CONTROL_PLANE: 3 })
const REQUIRED_CLASSES = Object.freeze(Object.keys(RANK))
const ALLOWED_STATUSES = new Set(['A', 'M', 'D', 'R', 'C'])

function escapeRegex(character) {
  return /[.()+^${}|[\]\\]/.test(character) ? `\\${character}` : character
}

export function globToRegex(glob) {
  if (typeof glob !== 'string' || glob.length === 0 || glob.includes('\\')) {
    throw new FailClosedError('Invalid policy glob')
  }

  let expression = '^'
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index]
    const next = glob[index + 1]
    const afterNext = glob[index + 2]

    if (character === '*' && next === '*' && afterNext === '/') {
      expression += '(?:.*/)?'
      index += 2
    } else if (character === '*' && next === '*') {
      expression += '.*'
      index += 1
    } else if (character === '*') {
      expression += '[^/]*'
    } else if (character === '?') {
      expression += '[^/]'
    } else {
      expression += escapeRegex(character)
    }
  }

  return new RegExp(`${expression}$`, 'i')
}

export function validatePolicy(policy) {
  if (!policy || policy.schema_version !== 1 || typeof policy.policy_version !== 'string') {
    throw new FailClosedError('Unsupported or malformed policy bundle')
  }
  if (!REQUIRED_CLASSES.includes(policy.default_classification)) {
    throw new FailClosedError('Invalid default classification')
  }
  if (!Array.isArray(policy.authorized_reviewers) || !Array.isArray(policy.machine_identity_patterns)) {
    throw new FailClosedError('Malformed reviewer policy')
  }
  for (const classification of REQUIRED_CLASSES) {
    const patterns = policy.classifications?.[classification]
    if (!Array.isArray(patterns) || patterns.length === 0) {
      throw new FailClosedError(`Missing ${classification} policy patterns`)
    }
    for (const pattern of patterns) globToRegex(pattern)
  }
  for (const pattern of policy.machine_identity_patterns) new RegExp(pattern, 'i')
  return policy
}

export function loadPolicy(policyUrl = new URL('../config/policy.v4.2.json', import.meta.url)) {
  try {
    return validatePolicy(JSON.parse(readFileSync(policyUrl, 'utf8')))
  } catch (error) {
    if (error instanceof FailClosedError) throw error
    throw new FailClosedError(`Cannot load authoritative policy: ${error.message}`)
  }
}

function normalizePath(path) {
  if (typeof path !== 'string' || path.length === 0 || path.includes('\0')) {
    throw new FailClosedError('Malformed diff path')
  }
  const normalized = path.replaceAll('\\', '/')
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new FailClosedError('Unsafe diff path')
  }
  return normalized
}

function pathsForRecord(record) {
  if (!record || !ALLOWED_STATUSES.has(record.status)) {
    throw new FailClosedError(`Unsupported diff status: ${record?.status ?? 'missing'}`)
  }

  if (record.status === 'R' || record.status === 'C') {
    return [normalizePath(record.sourcePath), normalizePath(record.destinationPath)]
  }
  if (record.status === 'D') return [normalizePath(record.sourcePath)]
  return [normalizePath(record.destinationPath)]
}

export function classifyPath(path, policy) {
  validatePolicy(policy)
  const normalized = normalizePath(path)
  let selected = policy.default_classification
  const matches = []

  for (const classification of REQUIRED_CLASSES) {
    for (const pattern of policy.classifications[classification]) {
      if (globToRegex(pattern).test(normalized)) {
        matches.push({ classification, pattern })
        if (RANK[classification] > RANK[selected]) selected = classification
      }
    }
  }
  return { path: normalized, classification: selected, matches }
}

export function classifyChanges(records, policy) {
  validatePolicy(policy)
  if (!Array.isArray(records)) throw new FailClosedError('Diff records are missing')

  let classification = 'GREEN'
  const pathResults = []
  for (const record of records) {
    for (const path of pathsForRecord(record)) {
      const result = classifyPath(path, policy)
      pathResults.push({ status: record.status, ...result })
      if (RANK[result.classification] > RANK[classification]) {
        classification = result.classification
      }
    }
  }

  return {
    policyVersion: policy.policy_version,
    classification,
    requiresApproval: RANK[classification] >= RANK.RED,
    pathResults
  }
}
