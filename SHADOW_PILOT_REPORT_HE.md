# Shadow Pilot Report — V4.2

## סטטוס

Local shadow fixtures: PASS — 36/36 tests

Live GitHub App shadow: BLOCKED ON MANUAL APP REGISTRATION AND DEPLOYMENT

Ruleset cutover: NOT PERFORMED

## Tests A–J

| Test | Expected | Local result | Live result |
|---|---|---|---|
| A — target policy change | CONTROL_PLANE | PASS | NOT RUN |
| B — workflow gate change | CONTROL_PLANE | PASS | NOT RUN |
| C — same-name Actions check | untrusted source | PASS by App-ID predicate | NOT FULLY TESTABLE |
| D — auth → src rename | RED | PASS | NOT RUN |
| E — src → auth rename | RED | PASS | NOT RUN |
| F — delete auth file | RED | PASS | NOT RUN |
| G — main advances | correct merge-base | PASS with real Git fixture | NOT RUN |
| H — stale approval after push | rejected | PASS | NOT RUN |
| I — unauthorized APPROVE | rejected | PASS | NOT RUN |
| J — comment/emoji | not approval | PASS | NOT RUN |

ה־live column לא יקבל PASS לפני שה־check נוצר על ידי ה־GitHub App האמיתי ונקרא בחזרה עם `check_run.app.id`.

בנוסף עברו: base unchanged, PR behind base, multiple PR commits, rename after base movement, RED copy, malformed/partial diff, unrelated histories, exact HEAD invalidation, base ref invalidation, active CHANGES_REQUESTED, unresolved conversations, author/bot/Codex rejection, webhook HMAC ו־RS256 App JWT.
