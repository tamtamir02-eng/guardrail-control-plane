import { validateRedApproval } from './approval.mjs'
import { FailClosedError } from './errors.mjs'
import { classifyChanges } from './policy.mjs'

function repositoryIdentity(pr) {
  const targetRepository = pr?.base?.repo?.full_name
  const headRepository = pr?.head?.repo?.full_name
  if (typeof targetRepository !== 'string' || typeof headRepository !== 'string') {
    throw new FailClosedError('Pull request repository identity is incomplete')
  }
  return { targetRepository, headRepository }
}

function validSha(sha) {
  return /^[0-9a-f]{40,64}$/i.test(sha ?? '')
}

function summaryFor(result, approval) {
  const base = [
    `Policy version: ${result.policyVersion}`,
    `Classification: ${result.classification}`,
    `Changed paths evaluated: ${result.pathResults.length}`
  ]
  if (approval) base.push(`Approval: ${approval.reason}`)
  return base.join('\n')
}

export async function evaluatePullRequest({
  owner,
  repo,
  number,
  installationToken,
  github,
  gitEvaluator,
  policy
}) {
  const start = await github.getPullRequest(owner, repo, number)
  const headSha = start?.head?.sha
  const baseBranch = start?.base?.ref
  const headBranch = start?.head?.ref
  const authorLogin = start?.user?.login
  if (!validSha(headSha) || typeof baseBranch !== 'string' || typeof headBranch !== 'string' || typeof authorLogin !== 'string') {
    throw new FailClosedError('Live pull request state is malformed')
  }

  const expectedTarget = `${owner}/${repo}`.toLowerCase()
  const { targetRepository, headRepository } = repositoryIdentity(start)
  if (targetRepository.toLowerCase() !== expectedTarget) {
    throw new FailClosedError('Pull request target does not match the webhook repository')
  }
  const baseSha = await github.getBranchHead(owner, repo, baseBranch)
  const checkRun = await github.createCheckRun(owner, repo, headSha)
  if (!Number.isInteger(Number(checkRun?.id))) throw new FailClosedError('Created check run has no ID')

  try {
    const diff = await gitEvaluator({
      installationToken,
      targetRepository,
      headRepository,
      baseBranch,
      headBranch,
      expectedBaseSha: baseSha,
      expectedHeadSha: headSha
    })
    if (diff.baseSha !== baseSha || diff.headSha !== headSha) {
      throw new FailClosedError('Git evaluator returned refs other than the live refs')
    }

    const classification = classifyChanges(diff.records, policy)
    let approval = null
    let conclusion = 'success'
    let title = `${classification.classification} change accepted in shadow mode`

    if (classification.requiresApproval) {
      const reviews = await github.listReviews(owner, repo, number)
      const unresolvedConversationCount = await github.unresolvedReviewConversationCount(owner, repo, number)
      approval = validateRedApproval({
        reviews,
        headSha,
        authorLogin,
        unresolvedConversationCount,
        policy
      })
      if (!approval.approved) {
        conclusion = 'action_required'
        title = `${classification.classification}: HUMAN SECURITY APPROVER REQUIRED`
      }
    }

    const end = await github.getPullRequest(owner, repo, number)
    const finalHeadSha = end?.head?.sha
    const finalBaseSha = await github.getBranchHead(owner, repo, baseBranch)
    if (finalHeadSha !== headSha || finalBaseSha !== baseSha) {
      await github.updateCheckRun(owner, repo, checkRun.id, {
        conclusion: 'action_required',
        title: 'Evaluation invalidated by a live ref change',
        summary: `No success was published. Evaluated HEAD ${headSha}; current HEAD ${finalHeadSha ?? 'unknown'}.`
      })
      return {
        checkRunId: checkRun.id,
        headSha,
        conclusion: 'action_required',
        invalidated: true,
        classification
      }
    }

    await github.updateCheckRun(owner, repo, checkRun.id, {
      conclusion,
      title,
      summary: summaryFor(classification, approval)
    })
    return { checkRunId: checkRun.id, headSha, conclusion, invalidated: false, classification, approval }
  } catch (error) {
    await github.updateCheckRun(owner, repo, checkRun.id, {
      conclusion: 'failure',
      title: 'Guardrail evaluation failed closed',
      summary: error instanceof FailClosedError ? error.message : 'Unexpected evaluator failure'
    })
    throw error
  }
}
