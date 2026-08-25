import { spawnSync } from 'node:child_process'

const files = [
  'tests/policy.test.js',
  'tests/git-diff.test.js',
  'tests/approval.test.js',
  'tests/evaluation.test.js',
  'tests/check-identity.test.js',
  'tests/webhook.test.js'
]
const result = spawnSync(process.execPath, ['--test', ...files], {
  encoding: 'utf8',
  shell: false,
  timeout: 180_000,
  maxBuffer: 32 * 1024 * 1024
})
process.stdout.write(result.stdout)
process.stderr.write(result.stderr)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
