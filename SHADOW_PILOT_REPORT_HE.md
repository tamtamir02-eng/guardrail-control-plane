# HISTORICAL / SUPERSEDED — Shadow Pilot Report V4.2

> מסמך זה משמר את תוצאות שלב ה־Shadow. ה־cutover הושלם לאחר מכן: `guardrail-v4.2` הוא required check ו־`guardrail-policy` אינו required. לתיאור המצב הנוכחי ראו `GUARDRAIL_ARCHITECTURE_FINAL_HE.md`.

## סטטוס

Local shadow fixtures: PASS — 36/36 tests

Live GitHub App shadow: PASS WITH LIMITATIONS — ה־App האמיתי רץ מקומית דרך Smee על repository הניסוי בלבד

Ruleset cutover: NOT PERFORMED

## Tests A–J

| Test | Expected | Local result | Live result |
|---|---|---|---|
| A — target policy change | CONTROL_PLANE | PASS | PASS — PR #10, App ID 4719039 |
| B — workflow gate change | CONTROL_PLANE | PASS | PASS — PR #11, App ID 4719039 |
| C — same-name Actions check | untrusted source | PASS by App-ID predicate | PASS — PR #11 יצר checks זהים בשם עם App IDs 15368 ו־4719039; רק זהות ה־App הייעודית מהימנה |
| D — auth → src rename | RED | PASS | PASS — PR #12, final HEAD `6055a41d56a3bf80cbc66931fdf85ab77b05f36a` |
| E — src → auth rename | RED | PASS | PASS — PR #13, HEAD `6d13b4370ccaa88aaa9d607edb18c7c7944545cd` |
| F — delete auth file | RED | PASS | PASS — PR #14, HEAD `b7c1baed3555db733aef956f049f2cbd2531b332` |
| G — main advances | correct merge-base | PASS with real Git fixture | NOT RUN — אסור היה לשנות או למזג ל־main |
| H — stale approval after push | rejected | PASS | PARTIAL — PR #8 הוכיח check חדש לכל HEAD; approval אנושי ישן לא ניתן לבדיקה ללא reviewer מורשה נפרד |
| I — unauthorized APPROVE | rejected | PASS | PARTIAL — GitHub דחה self-approval של מחבר PR #9; לא קיים חשבון reviewer שני לבדיקת unauthorized human |
| J — comment/emoji | not approval | PASS | PASS — comment שנראה כמו approval ב־PR #9 לא שינה `action_required` לאחר reevaluation |

## Evidence נוסף מה־Live Shadow

- PR #8: שינוי YELLOW עבר עם `guardrail-v4.2=success` על HEAD `32eab92c9bfce85367bf379113a0b911135b0ecf` ועל HEAD חדש `f9d91fa05e91c582a779937c0968d9a5aaef3b79`. ה־check הישן לא הועתק ל־SHA החדש.
- PR #9: שינוי permissions סווג RED ונשאר `action_required` ללא Human Security Approver.
- כל תוצאות ה־Guardrail החיות נוצרו על ידי GitHub App ID `4719039` (`tamir-guardrail-v4-2-local-shadow`).
- `validate` החי נוצר על ידי GitHub Actions App ID `15368`.
- במהלך Shadow D נמצא ותוקן ב־PR הניסוי פער CRLF/תיקיות ריקות בין Windows ל־Linux; ה־HEAD הסופי עבר `validate`.
- `main` נשאר `15e21f9580c788f01d835f448f13b71bf5283892`. Ruleset `21314805`, required checks, bypass actors וה־repository visibility לא שונו.

## תיקון Control Plane שנדרש להפעלה חיה

ה־fetch הראשוני נכשל משום ש־Git smart HTTP קיבל `Authorization: Bearer`. התיקון משתמש ב־HTTP Basic עם username `x-access-token` ואסימון ההתקנה כסיסמה, כשהערך מועבר דרך environment זמני של תהליך Git ואינו נוסף ל־URL או ללוג. נוספה בדיקת regression שמוודאת שאין Bearer או raw token בכותרת שנבנית.

ה־live column מקבל PASS רק כאשר ה־check נוצר על ידי ה־GitHub App האמיתי, נקרא בחזרה עם `check_run.app.id` הצפוי ומקושר ל־HEAD המדויק.

בנוסף עברו: base unchanged, PR behind base, multiple PR commits, rename after base movement, RED copy, malformed/partial diff, unrelated histories, exact HEAD invalidation, base ref invalidation, active CHANGES_REQUESTED, unresolved conversations, author/bot/Codex rejection, webhook HMAC ו־RS256 App JWT.
