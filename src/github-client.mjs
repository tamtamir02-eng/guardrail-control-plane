import { FailClosedError } from './errors.mjs'

function repositoryPath(owner, repo) {
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new FailClosedError('Invalid repository identity')
  }
  return `/repos/${owner}/${repo}`
}

export class GitHubClient {
  constructor(token, fetchImpl = fetch, appId = null) {
    if (typeof token !== 'string' || token.length < 20) throw new FailClosedError('Missing installation token')
    this.token = token
    this.fetchImpl = fetchImpl
    this.appId = Number.isInteger(Number(appId)) ? Number(appId) : null
  }

  async request(path, { method = 'GET', body } = {}) {
    const response = await this.fetchImpl(`https://api.github.com${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'guardrail-control-plane-v4.2'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    if (!response.ok) {
      const requestId = response.headers.get('x-github-request-id') ?? 'unknown'
      throw new FailClosedError(`GitHub API ${method} ${path} failed with HTTP ${response.status}`, { requestId })
    }
    if (response.status === 204) return null
    return response.json()
  }

  getPullRequest(owner, repo, number) {
    return this.request(`${repositoryPath(owner, repo)}/pulls/${Number(number)}`)
  }

  async getBranchHead(owner, repo, branch) {
    if (typeof branch !== 'string' || branch.length === 0) throw new FailClosedError('Missing base branch')
    const encoded = branch.split('/').map(encodeURIComponent).join('/')
    const ref = await this.request(`${repositoryPath(owner, repo)}/git/ref/heads/${encoded}`)
    const sha = ref?.object?.sha
    if (!/^[0-9a-f]{40,64}$/i.test(sha ?? '')) throw new FailClosedError('Live base ref is malformed')
    return sha
  }

  async listReviews(owner, repo, number) {
    const reviews = []
    for (let page = 1; page <= 100; page += 1) {
      const batch = await this.request(
        `${repositoryPath(owner, repo)}/pulls/${Number(number)}/reviews?per_page=100&page=${page}`
      )
      if (!Array.isArray(batch)) throw new FailClosedError('Review list is malformed')
      reviews.push(...batch)
      if (batch.length < 100) return reviews
    }
    throw new FailClosedError('Review pagination limit exceeded')
  }

  async unresolvedReviewConversationCount(owner, repo, number) {
    let cursor = null
    let unresolved = 0
    for (let page = 0; page < 100; page += 1) {
      const data = await this.request('/graphql', {
        method: 'POST',
        body: {
          query: `query($owner:String!,$repo:String!,$number:Int!,$cursor:String) {
            repository(owner:$owner,name:$repo) {
              pullRequest(number:$number) {
                reviewThreads(first:100,after:$cursor) {
                  nodes { isResolved }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
          }`,
          variables: { owner, repo, number: Number(number), cursor }
        }
      })
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        throw new FailClosedError('GitHub review-thread query failed')
      }
      const threads = data?.data?.repository?.pullRequest?.reviewThreads
      if (!Array.isArray(threads?.nodes)) throw new FailClosedError('Review conversation state is malformed')
      unresolved += threads.nodes.filter((thread) => thread?.isResolved !== true).length
      if (!threads.pageInfo?.hasNextPage) return unresolved
      if (typeof threads.pageInfo.endCursor !== 'string') {
        throw new FailClosedError('Review conversation pagination is malformed')
      }
      cursor = threads.pageInfo.endCursor
    }
    throw new FailClosedError('Review conversation pagination limit exceeded')
  }

  createCheckRun(owner, repo, headSha, externalId) {
    return this.request(`${repositoryPath(owner, repo)}/check-runs`, {
      method: 'POST',
      body: {
        name: 'guardrail-v4.2',
        head_sha: headSha,
        external_id: externalId,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        output: { title: 'Guardrail V4.2 evaluation started', summary: `Evaluating exact HEAD ${headSha}` }
      }
    })
  }

  async findCheckRunByExternalId(owner, repo, headSha, externalId) {
    if (typeof externalId !== 'string' || externalId.length === 0) return null
    for (let page = 1; page <= 100; page += 1) {
      const response = await this.request(
        `${repositoryPath(owner, repo)}/commits/${encodeURIComponent(headSha)}/check-runs?check_name=guardrail-v4.2&filter=all&per_page=100&page=${page}`
      )
      if (!Array.isArray(response?.check_runs)) throw new FailClosedError('Check run list is malformed')
      const found = response.check_runs.find((check) => check?.external_id === externalId
        && (this.appId === null || Number(check?.app?.id) === this.appId))
      if (found) return found
      if (response.check_runs.length < 100) return null
    }
    throw new FailClosedError('Check run pagination limit exceeded')
  }

  updateCheckRun(owner, repo, checkRunId, { conclusion, title, summary }) {
    return this.request(`${repositoryPath(owner, repo)}/check-runs/${Number(checkRunId)}`, {
      method: 'PATCH',
      body: {
        status: 'completed',
        conclusion,
        completed_at: new Date().toISOString(),
        output: { title, summary }
      }
    })
  }

  async listOpenPullRequests(owner, repo, base) {
    const encoded = encodeURIComponent(base)
    const pulls = await this.request(`${repositoryPath(owner, repo)}/pulls?state=open&base=${encoded}&per_page=100`)
    if (!Array.isArray(pulls)) throw new FailClosedError('Open pull request list is malformed')
    if (pulls.length === 100) throw new FailClosedError('Open pull request list may be partial')
    return pulls
  }
}
