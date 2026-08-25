import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const roots = ['src', 'scripts', 'tests']
const codeExtensions = new Set(['.js', '.mjs'])
const codeFiles = []
const failures = []

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) collect(path)
    if (entry.isFile() && codeExtensions.has(extname(entry.name))) codeFiles.push(path)
  }
}

for (const root of roots) collect(root)

for (const file of codeFiles.sort()) {
  const text = readFileSync(file, 'utf8').replaceAll('\r\n', '\n')
  if (!text.endsWith('\n')) failures.push(`${file}: missing final newline`)
  text.split('\n').forEach((line, index) => {
    if (/[ \t]+$/.test(line)) failures.push(`${file}:${index + 1}: trailing whitespace`)
    if (line.includes('\t')) failures.push(`${file}:${index + 1}: tab character`)
  })
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', shell: false })
  if (syntax.status !== 0) failures.push(`${file}: ${syntax.stderr.trim()}`)
}

for (const file of ['package.json', 'config/policy.v4.2.json', 'config/github-app-manifest.example.json']) {
  try {
    JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    failures.push(`${file}: invalid JSON: ${error.message}`)
  }
}

if (failures.length > 0) {
  failures.forEach((failure) => console.error(failure))
  process.exitCode = 1
} else {
  console.log(`LINT PASSED (${codeFiles.length} code files)`)
}
