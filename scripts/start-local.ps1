param(
    [string]$EnvFile = (Join-Path $env:LOCALAPPDATA 'GuardrailV4.2\guardrail.env')
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$resolvedEnvFile = [System.IO.Path]::GetFullPath($EnvFile)
$allowedVariables = @(
    'GITHUB_APP_ID',
    'GITHUB_PRIVATE_KEY_PATH',
    'GITHUB_WEBHOOK_SECRET',
    'GUARDRAIL_TARGET_REPOSITORY',
    'GUARDRAIL_EXPECTED_COMMIT',
    'HOST',
    'PORT'
)

if (-not (Test-Path -LiteralPath $resolvedEnvFile -PathType Leaf)) {
    throw "Local environment file was not found. Create it from .env.example outside the repository."
}

foreach ($line in Get-Content -LiteralPath $resolvedEnvFile) {
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0 -or $trimmed.StartsWith('#')) {
        continue
    }

    $separator = $trimmed.IndexOf('=')
    if ($separator -lt 1) {
        throw 'The local environment file contains a malformed line.'
    }

    $name = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()
    if ($name -notmatch '^[A-Z][A-Z0-9_]*$') {
        throw 'The local environment file contains an invalid variable name.'
    }
    if ($name -notin $allowedVariables) {
        throw "The local environment file contains an unapproved variable: $name"
    }
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
}

Push-Location -LiteralPath $repositoryRoot
try {
    & node scripts/preflight.mjs
    if ($LASTEXITCODE -ne 0) {
        throw 'Local shadow preflight failed; the server was not started.'
    }
    & node src/server.mjs
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
