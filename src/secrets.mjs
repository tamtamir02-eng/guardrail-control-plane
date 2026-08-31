import { readFileSync } from 'node:fs'

import { FailClosedError } from './errors.mjs'

export function readSecret({ env, valueName, pathName, minimumLength = 1 }) {
  const path = env[pathName]
  let value
  if (typeof path === 'string' && path.length > 0) {
    try {
      value = readFileSync(path, 'utf8').trim()
    } catch (error) {
      throw new FailClosedError(`Cannot read ${pathName}`, { code: error.code ?? 'SECRET_READ_FAILED' })
    }
  } else {
    value = env[valueName]
  }
  if (typeof value !== 'string' || value.length < minimumLength || /^<.*>$/.test(value)) {
    throw new FailClosedError(`${valueName} is not configured`, { code: 'SECRET_NOT_CONFIGURED' })
  }
  return value
}
