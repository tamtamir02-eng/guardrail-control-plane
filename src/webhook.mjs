import { createHmac, timingSafeEqual } from 'node:crypto'

import { createInstallationToken } from './app-auth.mjs'
import { evaluatePullRequest } from './evaluation.mjs'
import { FailClosedError } from './errors.mjs'
import { GitHubClient } from './github-client.mjs'
import { loadPolicy } from './policy.mjs'
import { fetchAndAnalyzePullRequest } from './trusted-git.mjs'

const PULL_REQUEST_ACTIONS = new Set(['opened', 'reopened', 'synchronize', 'ready_for_review', 'edited'])
const REVIEW_ACTIONS = new Set(['submitted', 'dismissed', 'edited'])

export function verifyWebhookSignature(body, signature, secret) {
  if (!Buffer.isBuffer(body) || typeof secret !== 'string' || secret.length < 16) {
    throw new FailClosedError('Webhook verification is not configured')
  }
  if (typeof signature !== 'string' || !signature.startsWith('sha256=')) return false
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

function parseRepository(payload) {
  const fullName = payload?.repository?.full_name
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(fullName ?? '')
  if (!match) throw new FailClosedError('Webhook repository is malformed')
  return { owner: match[1], repo: match[2] }
}

function parseAllowedRepository(value) {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(value ?? '')
  if (!match) throw new FailClosedError('GUARDRAIL_TARGET_REPOSITORY is not configured')
  return { owner: match[1], repo: match[2] }
}

function assertAllowedRepository(actual, configured) {
  const allowed = parseAllowedRepository(configured)
  if (actual.owner.toLowerCase() !== allowed.owner.toLowerCase()
    || actual.repo.toLowerCase() !== allowed.repo.toLowerCase()) {
    throw new FailClosedError('Webhook repository is outside the configured target')
  }
}

export async function processWebhook({
  event,
  signature,
  body,
  env = process.env,
  dependencies = {}
}) {
  if (!verifyWebhookSignature(body, signature, env.GITHUB_WEBHOOK_SECRET)) {
    throw new FailClosedError('Webhook signature is invalid')
  }
  let payload
  try {
    payload = JSON.parse(body.toString('utf8'))
  } catch {
    throw new FailClosedError('Webhook JSON is invalid')
  }

  const { owner, repo } = parseRepository(payload)
  assertAllowedRepository({ owner, repo }, env.GUARDRAIL_TARGET_REPOSITORY)
  const installationId = payload?.installation?.id
  const tokenFactory = dependencies.tokenFactory ?? createInstallationToken
  const token = await tokenFactory({
    appId: env.GITHUB_APP_ID,
    privateKeyPath: env.GITHUB_PRIVATE_KEY_PATH,
    installationId
  })
  const github = dependencies.githubFactory?.(token) ?? new GitHubClient(token, fetch, env.GITHUB_APP_ID)
  const policy = dependencies.policy ?? loadPolicy()
  const evaluator = dependencies.evaluator ?? evaluatePullRequest
  const gitEvaluator = dependencies.gitEvaluator ?? fetchAndAnalyzePullRequest

  const evaluate = (number) => evaluator({
    owner,
    repo,
    number,
    installationToken: token,
    github,
    gitEvaluator,
    policy
  })

  if (event === 'pull_request' && PULL_REQUEST_ACTIONS.has(payload.action)) {
    return [await evaluate(payload?.pull_request?.number)]
  }
  if (event === 'pull_request_review' && REVIEW_ACTIONS.has(payload.action)) {
    return [await evaluate(payload?.pull_request?.number)]
  }
  if (event === 'push' && typeof payload.ref === 'string' && payload.ref.startsWith('refs/heads/')) {
    const base = payload.ref.slice('refs/heads/'.length)
    const pulls = await github.listOpenPullRequests(owner, repo, base)
    const results = []
    for (const pull of pulls) results.push(await evaluate(pull.number))
    return results
  }
  return []
}
