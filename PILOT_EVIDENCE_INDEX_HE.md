# Autonomous Development Guardrail V4 — אינדקס ראיות Pilot

נוצר ב־2026-08-28 לפני סגירת PRs ומחיקת branches היסטוריים. המסמך מכיל מזהים ו־URLs ציבוריים בלבד. אין בו secrets, tokens, webhook secrets או private keys.

## repositories וגרסאות עיקריות

- Target: [`tamtamir02-eng/codex-guardrail-pilot`](https://github.com/tamtamir02-eng/codex-guardrail-pilot)
- Control Plane: [`tamtamir02-eng/guardrail-control-plane`](https://github.com/tamtamir02-eng/guardrail-control-plane)
- Pilot `main`: `15e21f9580c788f01d835f448f13b71bf5283892`
- Control Plane freeze ראשון: `f9a9fd62c921531a8bfae493b1386e9491950131`
- Control Plane human-approver version: `b30cab28751f988a51a0e40133bc8ef5591d53d9`
- Legacy V4.1 policy commit: `04db32e82d3777c9960a2d60fb151b99f57c403f`

## GitHub identities

- Human approver/merge authority: `tamtamir02-eng`.
- Guardrail App: `Tamir Guardrail V4.2 Local Shadow`, App ID `4719039`, slug `tamir-guardrail-v4-2-local-shadow`.
- Implementer App: `Tamir Codex Implementer V4.2 Pilot`, App ID `4726584`, installation ID `156802426`, slug `tamir-codex-implementer-v4-2-pilot`.
- GitHub Actions integration ID: `15368`.

## PR inventory

| PR | branch / HEAD | purpose | result | status relative to V4.2 |
|---|---|---|---|---|
| [#1](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/1) | `pilot/yellow-happy-path` / `73f3cd975524622c7ccda8e3c6e746817c589fff` | Test A, YELLOW validation | PASS after multiple corrective commits | Historical, superseded |
| [#2](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/2) | `pilot/failing-check` / `b4951287207a462621e894bb1e6e743e30ddae27` | Test B, failing test | Initial failure then PASS after fix | Historical, superseded |
| [#3](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/3) | `pilot/red-auth-policy` / `45be969d4f75ed23e3c12743d032d3db92c0c480` | Test C, synthetic RED auth | RED scenario recorded | Historical, superseded |
| [#4](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/4) | `pilot/v4.1-yellow-policy` / `04db32e82d3777c9960a2d60fb151b99f57c403f` | Introduce V4.1 `guardrail-policy` | `validate` PASS; legacy policy PASS | V4.1 legacy, superseded |
| [#5](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/5) | `pilot/v4.1-red-auth` / `24bb2b5615d2274a2ce56f1caa5ef7844c3f4dae` | Verify V4.1 RED failure | `validate` PASS; legacy policy FAIL as designed | V4.1 legacy, superseded |
| [#6](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/6) | `codex/v4.1-final-yellow` / `e8856223f00224ad74dc1b8eafa2b25ef6c26149` | Final V4.1 YELLOW | both legacy checks PASS; Codex bot COMMENTED on prior SHA | V4.1 legacy, superseded |
| [#7](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/7) | `codex/v4.1-final-red` / `16ab42b6cfbaa4c0ac1a36d5956ec884787dfe6f` | Final V4.1 RED | `validate` PASS; legacy policy FAIL as designed | V4.1 legacy, superseded |
| [#8](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/8) | `shadow/v4.2-yellow` / `f9d91fa05e91c582a779937c0968d9a5aaef3b79` | V4.2 YELLOW live evaluation | Guardrail App SUCCESS on each HEAD | V4.2 evidence |
| [#9](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/9) | `shadow/v4.2-red` / `3a439c2aee41df8422a4422a12db06576ce632d5` | RED without trusted human; comment bypass | `action_required`; comment did not approve | V4.2 evidence |
| [#10](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/10) | `shadow/v4.2-a-control-policy` / `b5257949af689bd6f1fcc42ecb099df77863ea05` | Target policy tampering | CONTROL_PLANE | V4.2 evidence |
| [#11](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/11) | `shadow/v4.2-bc-workflow-spoof` / `1c04ffa6046c39adee6f2c99f89421d84952a1fa` | Workflow tampering and same-name check spoof | Actions check rejected by App-ID binding | V4.2 evidence |
| [#12](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/12) | `shadow/v4.2-d-auth-to-src` / `6055a41d56a3bf80cbc66931fdf85ab77b05f36a` | RED source rename to normal path | RED retained | V4.2 evidence |
| [#13](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/13) | `shadow/v4.2-e-src-to-auth` / `6d13b4370ccaa88aaa9d607edb18c7c7944545cd` | normal source rename to auth | RED detected | V4.2 evidence |
| [#14](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/14) | `shadow/v4.2-f-delete-auth` / `b7c1baed3555db733aef956f049f2cbd2531b332` | delete RED file | RED retained | V4.2 evidence |
| [#15](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/15) | `codex/implementer-identity-pilot` / `befdb289799ad65afb49624390c98ee4193cd398` | Separate Implementer identity | bot-authored PR; checks PASS | V4.2 identity evidence |
| [#16](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/16) | `codex/implementer-wrapper-pilot` / `600ee756597230f6d76e61c19a3408cf8685698a` | Process-scoped wrapper/token | bot-authored PR; checks PASS | V4.2 identity evidence |
| [#17](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/17) | `codex/final-e2e-pilot` / `217eabcaa55e5f146593229cf45b9ad7629fb51f` | Final YELLOW E2E | both checks PASS | V4.2 evidence |
| [#18](https://github.com/tamtamir02-eng/codex-guardrail-pilot/pull/18) | `codex/red-human-approval-pilot` / `97b037b3dd6c45e0624e217bae4f2f84aedcf4c2` | RED human approval, stale invalidation and cutover | PASS; remains OPEN and unmerged | Final cutover evidence |

## V4.1 legacy evidence — PRs #4–#7

| PR | Actions run | validate check | guardrail-policy check | review evidence |
|---|---|---|---|---|
| #4 | [32772936534](https://github.com/tamtamir02-eng/codex-guardrail-pilot/actions/runs/32772936534) | `97577238520` SUCCESS | `97577238163` SUCCESS | none |
| #5 | [32773193416](https://github.com/tamtamir02-eng/codex-guardrail-pilot/actions/runs/32773193416) | `97578069714` SUCCESS | `97578069376` FAILURE expected | none |
| #6 | [32782340261](https://github.com/tamtamir02-eng/codex-guardrail-pilot/actions/runs/32782340261) | `97606907010` SUCCESS | `97606907044` SUCCESS | review `5012939594`, bot COMMENTED on SHA `e8bd2639a57caaaa5a3df1a1149c4fcea0f79950` |
| #7 | [32782160065](https://github.com/tamtamir02-eng/codex-guardrail-pilot/actions/runs/32782160065) | `97606354065` SUCCESS | `97606353833` FAILURE expected | none |

ה־PRs לא מוזגו. ה־commit/PR pages משמרים את ה־diff ואת ה־history גם לאחר סגירתם ומחיקת branch refs.

## V4.2 check evidence

| Scenario | Actions run / check | Guardrail check |
|---|---|---|
| YELLOW #8 | [32904609348](https://github.com/tamtamir02-eng/codex-guardrail-pilot/actions/runs/32904609348), validate `97985785676` | `98148693688`, App `4719039`, SUCCESS |
| RED no approval #9 | [32904805774](https://github.com/tamtamir02-eng/codex-guardrail-pilot/actions/runs/32904805774), validate `97986410101` | `97989935545`, App `4719039`, ACTION_REQUIRED |
| same-name spoof #11 | [32905144825](https://github.com/tamtamir02-eng/codex-guardrail-pilot/actions/runs/32905144825) | Actions `97987471390` rejected as source; App `97987465250` authoritative |
| RED deletion #14 | [32905845729](https://github.com/tamtamir02-eng/codex-guardrail-pilot/actions/runs/32905845729), validate `97989642033` | `97989634813`, App `4719039`, ACTION_REQUIRED |
| Implementer identity #15 | [32998205458](https://github.com/tamtamir02-eng/codex-guardrail-pilot/actions/runs/32998205458), validate `98272860172` | `98272845315`, SUCCESS |
| Wrapper #16 | [33017119347](https://github.com/tamtamir02-eng/codex-guardrail-pilot/actions/runs/33017119347), validate `98338087538` | `98338083810`, SUCCESS |
| Final YELLOW #17 | [33019095137](https://github.com/tamtamir02-eng/codex-guardrail-pilot/actions/runs/33019095137), validate `98344696159` | `98344693815`, SUCCESS |
| Final RED #18 | [33114280293](https://github.com/tamtamir02-eng/codex-guardrail-pilot/actions/runs/33114280293), validate `98664792520` | `98665528866`, App `4719039`, SUCCESS |

## Human approval evidence — PR #18

- Old HEAD: `27266d3dc53ca7a477d1fae14b88748b9eaddfb5`; Actions run [33108566267](https://github.com/tamtamir02-eng/codex-guardrail-pilot/actions/runs/33108566267).
- Review `5045367118` מאת `tamtamir02-eng` נרשם על ה־old HEAD ולאחר push סומן DISMISSED.
- Current HEAD: `97b037b3dd6c45e0624e217bae4f2f84aedcf4c2`.
- Review `5045461558` מאת `tamtamir02-eng`, type User, state APPROVED, קשור ל־current HEAD.
- Current checks: validate `98664792520` SUCCESS; guardrail-v4.2 `98665528866` SUCCESS.
- PR נשאר OPEN, לא בוצע merge ו־`main` נשאר `15e21f9580c788f01d835f448f13b71bf5283892`.

## Control Plane evidence

- Auth/HTTP fix PR version: `ba7705b3436dff4bb62ee8a45fec9db8dbb9d3d2`; CI run [32957887702](https://github.com/tamtamir02-eng/guardrail-control-plane/actions/runs/32957887702).
- Main after that merge: `14d9677041b2ba6531ff41102a09ac1c0dc80d42`; CI run [32959022027](https://github.com/tamtamir02-eng/guardrail-control-plane/actions/runs/32959022027).
- Human reviewer policy PR version: `9f98a358aace1d97421cb796ebb1669ded80cd67`; CI run [33102932527](https://github.com/tamtamir02-eng/guardrail-control-plane/actions/runs/33102932527).
- Current approved main: `b30cab28751f988a51a0e40133bc8ef5591d53d9`; CI run [33104559995](https://github.com/tamtamir02-eng/guardrail-control-plane/actions/runs/33104559995).
- Historical test report: [`SHADOW_PILOT_REPORT_HE.md`](SHADOW_PILOT_REPORT_HE.md).
- Final architecture: [`GUARDRAIL_ARCHITECTURE_FINAL_HE.md`](GUARDRAIL_ARCHITECTURE_FINAL_HE.md).

## Ruleset evidence

- Ruleset: [`Guardrail V4 - main protection`](https://github.com/tamtamir02-eng/codex-guardrail-pilot/rules/21314805), ID `21314805`.
- Phase A: הוסיף `guardrail-v4.2`/`4719039` לצד `validate` ו־`guardrail-policy`.
- Phase B: הסיר רק את `guardrail-policy`/`15368`.
- Final required checks: `validate`/`15368`, ‏`guardrail-v4.2`/`4719039`.
- Snapshots שמורים תחת [`evidence/rulesets/`](evidence/rulesets/).

## Branch inventory

V4.1 legacy branches המיועדים להסרה לאחר שימור מסמך זה:

- `pilot/v4.1-yellow-policy` → `04db32e82d3777c9960a2d60fb151b99f57c403f` → PR #4.
- `pilot/v4.1-red-auth` → `24bb2b5615d2274a2ce56f1caa5ef7844c3f4dae` → PR #5.
- `codex/v4.1-final-yellow` → `e8856223f00224ad74dc1b8eafa2b25ef6c26149` → PR #6.
- `codex/v4.1-final-red` → `16ab42b6cfbaa4c0ac1a36d5956ec884787dfe6f` → PR #7.

V4.2 evidence branches ו־PR #18 נשארים בשלב cleanup זה ואינם נמחקים.

## Ruleset snapshot checksums לפני הכנסת העותקים ל־repository

- Phase A before: `56E8D1BCA9EC65690B35754EF0D82D90EC1966BC3505ECEA07DBD43CFEA33E15`.
- Phase A after: `DDE92B8E82C11C196DC5D1524783A39A0E37D44954A4C58932772BF0A72331CC`.
- Phase B before: `DDE92B8E82C11C196DC5D1524783A39A0E37D44954A4C58932772BF0A72331CC`.
- Phase B after: `3F4EE929EE9D52040AACD61985F3424D36D64E44EFD6849481AC640C350C44FA`.

## שמירת מידע רגיש

לא הוכנסו למסמך או ל־snapshots אסימוני התקנה, PAT, webhook URL, webhook secret, environment values, PEM או private key. ה־credentials נשארים מחוץ ל־Git.
