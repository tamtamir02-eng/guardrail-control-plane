# תוכנית Cutover — לא לביצוע ללא אישור חדש

## תנאי סף

- GitHub App רשום ומותקן רק על `codex-guardrail-pilot`.
- App permissions וה־webhooks תואמים בדיוק ל־manifest.
- deployment מקובע ל־control-plane commit SHA/image digest.
- `guardrail-v4.2` רץ ב־shadow על PRs אמיתיים ומציג App ID צפוי.
- Shadow Tests A–J הושלמו live, כולל same-name Action check.
- קיים human security approver אמיתי ונפרד לפני מעבר RED ל־SUCCESS.
- בוצע audit נפרד להגנת repository ה־control-plane עצמו.

## שינוי Ruleset עתידי מדויק — Phase 1

אם יאושר cutover, השינוי היחיד בשלב הראשון יהיה הוספת:

```text
context: guardrail-v4.2
integration_id: <GUARDRAIL_GITHUB_APP_ID>
```

ל־required status checks של Ruleset `21314805` לצד `validate` ו־`guardrail-policy` הקיימים. אין לשנות target, enforcement, bypass actors, PR requirements, approvals, strict mode, stale dismissal, conversation resolution או non-fast-forward.

`guardrail-policy` הישן יישאר required בזמן cutover הראשוני. הסרתו תהיה שינוי נפרד, לאחר observation window ואישור מפורש נוסף.

## Rollback

Rollback מוגבל להסרת `guardrail-v4.2` מרשימת required checks תוך השארת `validate` ו־`guardrail-policy`. אין למחוק App, logs או evidence לפני תחקור.
