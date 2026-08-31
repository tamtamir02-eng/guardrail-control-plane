import { createInstallationToken } from './app-auth.mjs'
import { evaluatePullRequest } from './evaluation.mjs'
import { errorType } from './logging.mjs'
import { GitHubClient } from './github-client.mjs'
import { loadPolicy } from './policy.mjs'
import { splitRepository, validateTaskEnvelope } from './task-contract.mjs'
import { fetchAndAnalyzePullRequest } from './trusted-git.mjs'

export async function processTaskEnvelope({
  envelope,
  env = process.env,
  dependencies = {},
  logger = () => {}
}) {
  const started = Date.now()
  const task = validateTaskEnvelope(envelope, env.GUARDRAIL_TARGET_REPOSITORY)
  const { owner, repo } = splitRepository(task.repository)
  try {
    const tokenFactory = dependencies.tokenFactory ?? createInstallationToken
    const token = await tokenFactory({
      appId: env.GITHUB_APP_ID,
      privateKeyPath: env.GITHUB_PRIVATE_KEY_PATH,
      installationId: task.installationId
    })
    const github = dependencies.githubFactory?.(token) ?? new GitHubClient(token, fetch, env.GITHUB_APP_ID)
    const policy = dependencies.policy ?? loadPolicy()
    const evaluator = dependencies.evaluator ?? evaluatePullRequest
    const gitEvaluator = dependencies.gitEvaluator ?? fetchAndAnalyzePullRequest

    let numbers
    if (task.kind === 'pull_request') {
      numbers = [task.prNumber]
    } else {
      const pulls = await github.listOpenPullRequests(owner, repo, task.baseRef)
      numbers = pulls.map((pull) => Number(pull.number))
    }
    if (numbers.some((number) => !Number.isInteger(number) || number < 1)) {
      throw new Error('GitHub returned a malformed pull request number')
    }
    const results = []
    for (const number of numbers) {
      const result = await evaluator({
        owner,
        repo,
        number,
        installationToken: token,
        github,
        gitEvaluator,
        policy,
        idempotencyKey: `${task.taskId}:${number}`
      })
      results.push(result)
      logger('INFO', 'evaluation_complete', {
        delivery_id: task.deliveryId,
        github_event: task.event,
        pr_number: number,
        head_sha: result.headSha,
        classification: result.classification?.classification,
        result: result.conclusion,
        duration_ms: Date.now() - started,
        check_run_id: result.checkRunId,
        duplicate: result.duplicate === true
      })
    }
    return results
  } catch (error) {
    logger('ERROR', 'evaluation_failed_closed', {
      delivery_id: task.deliveryId,
      github_event: task.event,
      pr_number: task.prNumber ?? undefined,
      result: 'failure',
      phase: 'worker',
      error_type: errorType(error),
      duration_ms: Date.now() - started
    })
    throw error
  }
}
