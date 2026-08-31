import { createHash } from 'node:crypto'

import { FailClosedError } from './errors.mjs'

const PULL_REQUEST_ACTIONS = new Set(['opened', 'reopened', 'synchronize', 'ready_for_review', 'edited'])
const REVIEW_ACTIONS = new Set(['submitted', 'dismissed', 'edited'])
const DELIVERY_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/
const REPOSITORY_PATTERN = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/

function parseRepository(fullName) {
  const match = REPOSITORY_PATTERN.exec(fullName ?? '')
  if (!match) throw new FailClosedError('Webhook repository is malformed')
  return { owner: match[1], repo: match[2], fullName: `${match[1]}/${match[2]}` }
}

function assertAllowedRepository(actual, configured) {
  const allowed = parseRepository(configured)
  if (actual.fullName.toLowerCase() !== allowed.fullName.toLowerCase()) {
    throw new FailClosedError('Webhook repository is outside the configured target')
  }
}

function taskIdForDelivery(deliveryId) {
  return `github-${createHash('sha256').update(deliveryId).digest('hex')}`
}

function validBranch(branch) {
  return typeof branch === 'string' && branch.length > 0 && !branch.startsWith('-') && !/[\s~^:?*[\\]/.test(branch)
}

export function createTaskEnvelope({ deliveryId, event, payload, targetRepository }) {
  if (typeof deliveryId !== 'string' || !DELIVERY_PATTERN.test(deliveryId)) {
    throw new FailClosedError('GitHub delivery ID is missing or malformed')
  }
  const repository = parseRepository(payload?.repository?.full_name)
  assertAllowedRepository(repository, targetRepository)
  const installationId = Number(payload?.installation?.id)
  if (!Number.isInteger(installationId) || installationId < 1) {
    throw new FailClosedError('GitHub installation ID is missing')
  }

  let kind = null
  let prNumber = null
  let baseRef = null
  if (event === 'pull_request' && PULL_REQUEST_ACTIONS.has(payload?.action)) {
    kind = 'pull_request'
    prNumber = Number(payload?.pull_request?.number)
  } else if (event === 'pull_request_review' && REVIEW_ACTIONS.has(payload?.action)) {
    kind = 'pull_request'
    prNumber = Number(payload?.pull_request?.number)
  } else if (event === 'push' && typeof payload?.ref === 'string' && payload.ref.startsWith('refs/heads/')) {
    kind = 'base_push'
    baseRef = payload.ref.slice('refs/heads/'.length)
  } else {
    return null
  }
  if (kind === 'pull_request' && (!Number.isInteger(prNumber) || prNumber < 1)) {
    throw new FailClosedError('Pull request number is malformed')
  }
  if (kind === 'base_push' && !validBranch(baseRef)) {
    throw new FailClosedError('Push base ref is malformed')
  }

  return Object.freeze({
    schemaVersion: 1,
    taskId: taskIdForDelivery(deliveryId),
    deliveryId,
    event,
    kind,
    action: typeof payload.action === 'string' ? payload.action : null,
    repository: repository.fullName,
    installationId,
    prNumber,
    baseRef
  })
}

export function validateTaskEnvelope(envelope, targetRepository) {
  if (!envelope || envelope.schemaVersion !== 1 || typeof envelope.taskId !== 'string') {
    throw new FailClosedError('Task envelope schema is invalid')
  }
  if (!DELIVERY_PATTERN.test(envelope.deliveryId ?? '') || envelope.taskId !== taskIdForDelivery(envelope.deliveryId)) {
    throw new FailClosedError('Task identity is invalid')
  }
  const repository = parseRepository(envelope.repository)
  assertAllowedRepository(repository, targetRepository)
  if (!Number.isInteger(envelope.installationId) || envelope.installationId < 1) {
    throw new FailClosedError('Task installation ID is invalid')
  }
  if (envelope.kind === 'pull_request') {
    if (!Number.isInteger(envelope.prNumber) || envelope.prNumber < 1) {
      throw new FailClosedError('Task pull request number is invalid')
    }
  } else if (envelope.kind === 'base_push') {
    if (!validBranch(envelope.baseRef)) {
      throw new FailClosedError('Task base ref is invalid')
    }
  } else {
    throw new FailClosedError('Task kind is invalid')
  }
  return envelope
}

export function splitRepository(fullName) {
  const { owner, repo } = parseRepository(fullName)
  return { owner, repo }
}
