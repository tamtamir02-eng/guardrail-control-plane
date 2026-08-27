# Autonomous Development Guardrail V4.2 — ארכיטקטורה נוכחית

## גבול המערכת

המערכת הפעילה מוגבלת כרגע ל־`tamtamir02-eng/codex-guardrail-pilot`. היא מפרידה בין כתיבת שינוי, אימות policy, אישור אנושי ומיזוג:

```text
Tamir מגדיר משימה ומדיניות
  → Codex מופעל דרך Implementer wrapper
  → GitHub App נפרד יוצר feature branch ו־Pull Request
  → GitHub Actions מריץ validate על HEAD המדויק
  → Guardrail App חיצוני מריץ guardrail-v4.2 על אותו HEAD
  → Tamir מאשר review אנושי על אותו HEAD כאשר נדרש
  → Ruleset מאמת checks, review ו־branch policy
  → רק Tamir מחזיק בסמכות ה־merge
```

## הפרדת זהויות

| זהות | תפקיד | סמכות עיקרית | אינה רשאית |
|---|---|---|---|
| `tamtamir02-eng` | Human approver ו־merge authority | APPROVE על exact HEAD; merge דרך PR כ־PR-only bypass actor | האישור אינו תקף ל־HEAD ישן או כאשר הוא מחבר ה־PR |
| `tamir-codex-implementer-v4-2-pilot[bot]` | Implementer | branch, commit, push ופתיחת PR ב־repository הניסוי | direct push/merge ל־main, bypass, trusted approval |
| `Tamir Guardrail V4.2 Local Shadow` — App ID `4719039` | Guardrail verifier | קריאת metadata/PR ויצירת `guardrail-v4.2` check | כתיבת קוד, merge, human approval או bypass |
| GitHub Actions — App ID `15368` | repo-native validation | יצירת `validate` | סיפוק `guardrail-v4.2` משום שמקור ה־check שונה |

שם ה־Guardrail App עדיין כולל `Local Shadow` מטעמי תאימות היסטורית. ה־Ruleset קושר את ה־check ל־App ID ולא לשם התצוגה בלבד.

## Least privilege

Implementer App ID `4726584` מותקן רק על `codex-guardrail-pilot` עם Metadata read, Contents read/write, Pull requests read/write, Actions read, Checks read ו־Commit statuses read. אין לו Administration, Workflows, Secrets, Environments, Deployments, Rulesets או branch-protection permissions.

Guardrail App ID `4719039` משתמש ב־Metadata read, Contents read, Pull requests read ו־Checks write. הוא מותקן רק על repository הניסוי. ה־Control Plane אינו מקבל write permission לתוכן ה־repository.

## מודל Implementer wrapper ואסימון זמני

ה־wrapper המקומי מקובע ל־repository, ל־origin, לענפי `codex/**`, ל־App ול־installation המאושרים. הוא יוצר Installation Access Token קצר־חיים בזיכרון, מעביר אותו רק לסביבת התהליך, מבטל credential helpers ו־interactive fallback ואינו משנה `gh auth`, ‏Git Credential Manager, ‏PATH או remote URL. עם סיום התהליך האסימון מוסר מהזיכרון ואינו נשמר בקובץ.

## סיווג סיכון

ה־policy הסמכותי נמצא ב־`config/policy.v4.2.json` של ה־Control Plane, לא בתוך ה־PR:

- GREEN — תיעוד ושינוי קוסמטי מוגבל.
- YELLOW — קוד אפליקטיבי, tests ותלויות רגילות.
- RED — auth, permissions, secrets, crypto, payments, database, migrations, infrastructure וגבולות אבטחה.
- CONTROL_PLANE — workflows, Rules, AGENTS, CODEOWNERS, policy, guardrail files ו־deployment controls.

שינוי יכול לקבל את הסיווג המחמיר ביותר מבין כל paths, כולל שני צדדי rename/copy וקובץ שנמחק.

## exact HEAD binding

`validate` עושה checkout ל־PR HEAD ומוודא ש־`git rev-parse HEAD` שווה ל־SHA שגרם ל־workflow.

ה־Guardrail App:

1. קורא את base ו־HEAD החיים מ־GitHub.
2. יוצר check על HEAD זה.
3. מחשב diff ב־bare repository זמני ללא checkout או hooks.
4. עבור RED/CONTROL_PLANE, מקבל רק `APPROVED` מאת `tamtamir02-eng`, מסוג User, כאשר `review.commit_id` שווה ל־HEAD הנוכחי וה־reviewer אינו מחבר ה־PR.
5. קורא מחדש את base ו־HEAD לפני SUCCESS.

push חדש משנה SHA, מפעיל מחדש את שני ה־checks, מבטל stale approval לפי ה־Ruleset ומונע שימוש בראיה מה־HEAD הישן.

## required checks ו־Ruleset

Ruleset `21314805`, בשם `Guardrail V4 - main protection`, פעיל על `refs/heads/main` ודורש בדיוק:

- `validate`, integration ID `15368`.
- `guardrail-v4.2`, integration ID `4719039`.

בנוסף הוא דורש PR, approval אחד, approval של ה־push האחרון, dismissal של stale approvals, resolution של conversations ו־strict status checks; הוא מפעיל Restrict updates וחוסם non-fast-forward. ה־bypass היחיד הוא Repository Admin במצב Pull Request only. ה־Implementer App וה־Guardrail App אינם bypass actors.

## Codex Rules

ה־repository כולל Rules מקומיים לפעולות בעלות blast radius גבוה, למשל `git reset --hard`, force push, destructive infrastructure commands ו־production publishing. Rules ו־native sandbox/approvals מגנים על סביבת הביצוע; הם אינם תחליף ל־GitHub merge gates.

## Fail-closed

חוסר ב־credentials, signature שגויה, repository לא מורשה, policy לא תקין, Git fetch כושל, diff חלקי, ref שהשתנה, reviewer לא מורשה, approval על SHA ישן או מקור check שגוי אינם יכולים להפיק SUCCESS. כאשר ה־Guardrail service אינו זמין, required check חדש אינו מתקבל ולכן GitHub חוסם merge.

## Source of truth

1. GitHub Ruleset `21314805` — merge enforcement.
2. `config/policy.v4.2.json` ב־Control Plane המקובע — classification ו־authorized reviewer.
3. קוד ה־Control Plane המקובע ו־tests שלו — evaluation semantics.
4. workflow‏ `guardrail-v4-ci.yml` ב־target repository — `validate` בלבד.
5. GitHub check runs ו־native reviews על HEAD — evidence.
6. project-local Codex Rules ו־`AGENTS.md` — execution policy.

PR-authored labels, comments, checkboxes, files, attestations או checks ממקור לא מורשה אינם source of truth.

## מגבלות אמון ותפעול

- יש reviewer אנושי מורשה יחיד, שהוא גם repository owner וה־merge authority.
- ההפעלה הנוכחית תלויה במחשב Windows מקומי, בשרת על loopback וב־Smee relay; זו נקודת כשל תפעולית ואינה always-on.
- ה־GitHub App display name, גרסת package/policy וחלק משמות ה־fixtures עדיין מכילים `shadow`; אין להסתמך על המיתוג הזה לצורך החלטת trust.
- אין עדיין production hosting, TLS endpoint ישיר, secret manager מנוהל, monitoring, durable logs, automated restart או immutable deployment artifact.
- המערכת עדיין מוגבלת ל־repository ניסויי ואינה מאשרת rollout אוטומטי לפרויקט אחר.
