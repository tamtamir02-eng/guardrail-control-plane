import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { loadPolicy } from '../src/policy.mjs'

const requiredFiles = [
  '.gitignore',
  'README_HE.md',
  'TRUST_MODEL_HE.md',
  'CODEX_LEAST_PRIVILEGE_GUIDE_HE.md',
  'GITHUB_APP_SETUP_HE.md',
  'GITHUB_APP_MANUAL_SETUP_HE.md',
  'SHADOW_PILOT_REPORT_HE.md',
  'CUTOVER_PLAN_HE.md',
  'ANTI_DUPLICATION_AUDIT_HE.md',
  'config/policy.v4.2.json',
  'config/github-app-manifest.example.json',
  '.env.example',
  'scripts/preflight.mjs',
  'Dockerfile',
  'package-lock.json',
  'deploy/cloud-run/README_HE.md',
  'deploy/cloud-run/guardrail-ingress.service.yaml.template',
  'deploy/cloud-run/guardrail-worker.service.yaml.template',
  'deploy/cloud-run/cloud-tasks-queue.yaml.template',
  'scripts/start-local.ps1',
  'src/approval.mjs',
  'src/evaluation.mjs',
  'src/github-client.mjs',
  'src/trusted-git.mjs',
  'src/webhook.mjs',
  'src/ingress.mjs',
  'src/worker.mjs',
  'src/task-contract.mjs',
  'src/task-queue.mjs',
  'src/logging.mjs',
  'tests/git-diff.test.js',
  'tests/approval.test.js',
  'tests/evaluation.test.js',
  'package.json',
  'VERSION'
]
const forbiddenDirectories = ['hooks', 'agents', '.codex/hooks', '.codex/agents']
const forbiddenNameParts = ['fingerprint', 'attestation', 'receipt', 'circuit_breaker']
const secretPatterns = [
  /-----BEGIN [^-]*PRIVATE KEY-----/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/
]
const failures = []

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`missing ${file}`)
}
for (const directory of forbiddenDirectories) {
  if (existsSync(directory)) failures.push(`forbidden duplicate component ${directory}`)
}

function inspect(directory = '.') {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      inspect(path)
      continue
    }
    const lower = entry.name.toLowerCase()
    if (forbiddenNameParts.some((part) => lower.includes(part))) {
      failures.push(`forbidden duplicate component name ${path}`)
    }
    const content = readFileSync(path, 'utf8')
    if (secretPatterns.some((pattern) => pattern.test(content))) failures.push(`credential-like content in ${path}`)
  }
}
inspect()

try {
  const policy = loadPolicy()
  if (JSON.stringify(policy.authorized_reviewers) !== JSON.stringify(['tamtamir02-eng'])) {
    failures.push('Authorized reviewers differ from the approved human identity')
  }
} catch (error) {
  failures.push(error.message)
}

if (existsSync('config/github-app-manifest.example.json')) {
  const manifest = JSON.parse(readFileSync('config/github-app-manifest.example.json', 'utf8'))
  const expectedPermissions = {
    metadata: 'read',
    contents: 'read',
    pull_requests: 'read',
    checks: 'write'
  }
  if (JSON.stringify(manifest.default_permissions) !== JSON.stringify(expectedPermissions)) {
    failures.push('GitHub App permissions differ from the approved minimum')
  }
  const expectedEvents = ['pull_request', 'pull_request_review', 'push']
  if (JSON.stringify(manifest.default_events) !== JSON.stringify(expectedEvents)) {
    failures.push('GitHub App webhook events differ from the approved set')
  }
  if (manifest.public !== false || manifest.request_oauth_on_install !== false) {
    failures.push('GitHub App registration is not private/install-token-only')
  }
}

if (existsSync('.gitignore')) {
  const ignore = readFileSync('.gitignore', 'utf8')
  for (const marker of ['.env', '.env.*', '!.env.example', '*.pem', '*.key', '*.p12', '*.pfx', '*.jks', 'secrets/']) {
    if (!ignore.includes(marker)) failures.push(`.gitignore lacks ${marker}`)
  }
}

if (existsSync('.env.example')) {
  const example = readFileSync('.env.example', 'utf8')
  const configuredValues = example.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.slice(line.indexOf('=') + 1))
  if (configuredValues.some((value) => !/^<[A-Z0-9_]+>$/.test(value))) {
    failures.push('.env.example contains a non-placeholder value')
  }
  if (!example.includes('GUARDRAIL_TARGET_REPOSITORY=<EXACT_TARGET_REPOSITORY>')) {
    failures.push('.env.example target repository is not a placeholder')
  }
  if (!example.includes('GUARDRAIL_EXPECTED_COMMIT=<FULL_APPROVED_CONTROL_PLANE_COMMIT_SHA>')) {
    failures.push('.env.example commit is not a placeholder')
  }
  if (!example.includes('HOST=<LOCAL_LOOPBACK_HOST>') || !example.includes('PORT=<LOCAL_PORT>')) {
    failures.push('.env.example endpoint values are not placeholders')
  }
}

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`))
  process.exitCode = 1
} else {
  console.log('DOCTOR PASSED: V4.2 control-plane contract is intact and fail-closed')
}
