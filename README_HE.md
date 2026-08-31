# Guardrail V4.2 — Trusted Control Plane

זהו ה־Control Plane החיצוני של Autonomous Development Guardrail V4.2 עבור `tamtamir02-eng/codex-guardrail-pilot`. הוא אינו מותקן גלובלית ואינו מריץ קוד מתוך Pull Request.

## מצב נוכחי

- `guardrail-v4.2` הוא required check פעיל ב־Ruleset `21314805` של `main`.
- ה־check חייב להגיע מ־GitHub App ID `4719039`. שם ה־App הקיים עדיין כולל את המילים `Local Shadow`; זהו display name היסטורי בלבד ולא מקור הסמכות.
- `validate` נדרש מ־GitHub Actions App ID `15368`.
- `guardrail-policy` של V4.1 אינו required ואינו חלק מה־enforcement הפעיל.
- המאשר האנושי המורשה הוא `tamtamir02-eng`, ורק review מסוג `APPROVED` על HEAD הנוכחי יכול לספק approval נדרש.
- ה־runtime תומך כעת בתפקידי Cloud Run נפרדים: ingress ציבורי ו־worker פרטי דרך Cloud Tasks. לא בוצע עדיין deployment, והנתיב הפעיל נשאר Windows/Smee עד cutover מאושר.

הארכיטקטורה הסמכותית מתועדת ב־[`GUARDRAIL_ARCHITECTURE_FINAL_HE.md`](GUARDRAIL_ARCHITECTURE_FINAL_HE.md). אינדקס הראיות נמצא ב־[`PILOT_EVIDENCE_INDEX_HE.md`](PILOT_EVIDENCE_INDEX_HE.md).

## עיקרון האמון

ה־target PR הוא נתון לא מהימן בלבד. ה־Control Plane אינו מריץ workflow, script, policy או artifact מתוך ה־PR. הוא מביא metadata של Git לתוך bare repository זמני, ללא checkout, ומפעיל רק את evaluator וה־policy שנפרסו מ־repository זה בגרסת commit מקובעת.

זרימת evaluation:

1. קריאה חיה של ה־PR, ה־base וה־HEAD דרך GitHub.
2. יצירת `guardrail-v4.2` במצב `in_progress` על ה־HEAD המדויק.
3. fetch של base/head לתוך bare Git repository זמני עם HTTPS בלבד וללא hooks.
4. חישוב merge-base ו־diff מסוג A/M/D/R/C.
5. סיווג שני צדדי rename/copy וכל delete מול `config/policy.v4.2.json` המקומי.
6. עבור RED/CONTROL_PLANE: אימות GitHub native review של המאשר המורשה על אותו HEAD.
7. קריאה חוזרת של HEAD ושל base לפני conclusion. שינוי ref מבטל את ה־evaluation ואוסר SUCCESS.

## רכיבים סמכותיים

- `config/policy.v4.2.json` — GREEN/YELLOW/RED/CONTROL_PLANE והמאשר האנושי המורשה.
- `src/trusted-git.mjs` — fetch metadata מבודד ללא checkout או הרצת תוכן target.
- `src/git-diff.mjs` — merge-base ו־A/M/D/R/C parsing.
- `src/policy.mjs` — classification failure-closed.
- `src/approval.mjs` — אימות review אנושי על exact HEAD.
- `src/evaluation.mjs` — check lifecycle ו־TOCTOU re-read.
- `src/webhook.mjs` — signature verification ו־dispatch מאירועי GitHub.
- `src/github-client.mjs` — GitHub API client עם Installation Access Token זמני.
- `src/server.mjs` — endpoint מינימלי `/webhook`.

## בדיקות

```powershell
npm run lint
npm test
npm run shadow:fixtures
npm run doctor
```

שם הפקודה `shadow:fixtures` נשמר כ־alias לתאימות היסטורית; `regression:fixtures` הוא השם המועדף. `integration:local` בודק webhook → ingress → local task adapter → worker → policy evaluation.

אין dependencies חיצוניות ב־Node. נדרשים Node.js 20 ומעלה ו־Git CLI. `npm run preflight` מאמת secrets חיצוניים, repository יעד, commit מקובע, working tree נקי ו־port זמין.

## Runtime production

`GUARDRAIL_RUNTIME_ROLE` מקבל `ingress`, `worker` או `local`. production מאזין כברירת מחדל על `0.0.0.0:$PORT`; ה־local wrapper נשאר על loopback. פרטי הארכיטקטורה נמצאים ב־`../CLOUD_RUN_RUNTIME_ARCHITECTURE_HE.md`, ותבניות review בלבד נמצאות ב־`deploy/cloud-run/`.
