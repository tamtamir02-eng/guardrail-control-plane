import { FailClosedError } from './errors.mjs'

function timestamp(review) {
  const value = Date.parse(review.submitted_at ?? '')
  return Number.isFinite(value) ? value : -1
}

function isMachineIdentity(user, policy) {
  if (!user || user.type !== 'User' || typeof user.login !== 'string') return true
  return policy.machine_identity_patterns.some((pattern) => new RegExp(pattern, 'i').test(user.login))
}

export function validateRedApproval({
  reviews,
  headSha,
  authorLogin,
  unresolvedConversationCount,
  policy
}) {
  if (!Array.isArray(reviews) || !/^[0-9a-f]{40,64}$/i.test(headSha ?? '')) {
    throw new FailClosedError('Malformed review evidence')
  }
  if (!Number.isInteger(unresolvedConversationCount) || unresolvedConversationCount < 0) {
    throw new FailClosedError('Review conversation state is unknown')
  }
  if (!Array.isArray(policy.authorized_reviewers) || !Array.isArray(policy.machine_identity_patterns)) {
    throw new FailClosedError('Reviewer policy is malformed')
  }

  const authorized = new Set(policy.authorized_reviewers.map((login) => login.toLowerCase()))
  const currentReviews = reviews.filter((review) => review?.commit_id === headSha)
  const latestByReviewer = new Map()

  for (const review of currentReviews) {
    const login = review.user?.login
    if (typeof login !== 'string' || typeof review.state !== 'string') continue
    const key = login.toLowerCase()
    const existing = latestByReviewer.get(key)
    if (!existing || timestamp(review) > timestamp(existing) || Number(review.id) > Number(existing.id)) {
      latestByReviewer.set(key, review)
    }
  }

  const blockingReviews = [...latestByReviewer.values()].filter(
    (review) => review.state === 'CHANGES_REQUESTED'
  )
  if (blockingReviews.length > 0) {
    return {
      approved: false,
      reason: 'CHANGES_REQUESTED remains active on the current HEAD',
      approvers: []
    }
  }
  if (unresolvedConversationCount > 0) {
    return {
      approved: false,
      reason: 'Blocking review conversations remain unresolved',
      approvers: []
    }
  }

  const approvers = [...latestByReviewer.values()]
    .filter((review) => review.state === 'APPROVED')
    .filter((review) => !isMachineIdentity(review.user, policy))
    .filter((review) => review.user.login.toLowerCase() !== authorLogin.toLowerCase())
    .filter((review) => authorized.has(review.user.login.toLowerCase()))
    .map((review) => review.user.login)

  if (approvers.length === 0) {
    return {
      approved: false,
      reason: 'HUMAN SECURITY APPROVER REQUIRED',
      approvers: []
    }
  }

  return { approved: true, reason: 'Authorized current-HEAD human approval is valid', approvers }
}
