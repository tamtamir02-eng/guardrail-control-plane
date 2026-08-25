export function isTrustedGuardrailCheck(checkRun, expectedAppId) {
  return checkRun?.name === 'guardrail-v4.2'
    && Number.isInteger(Number(expectedAppId))
    && Number(checkRun?.app?.id) === Number(expectedAppId)
}
