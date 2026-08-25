# Guardrail V4.2 — Trusted Control Plane

זהו repository נפרד ומבודד עבור Pilot בלבד. הוא אינו מותקן גלובלית ואינו משנה את `codex-guardrail-pilot` או את ה־Ruleset שלו.

## עיקרון האמון

ה־target PR הוא נתון לא מהימן בלבד. ה־control-plane אינו מריץ קוד, workflow, script, policy או artifact מתוך ה־PR. הוא מביא metadata של Git לתוך bare repository זמני, ללא checkout, ומפעיל רק את evaluator וה־policy שנפרסו מ־repository זה בגרסת commit קבועה.

זרימת evaluation:

1. קריאה חיה של ה־PR ושל HEAD SHA דרך GitHub.
2. קריאה חיה של target branch SHA.
3. יצירת `guardrail-v4.2` במצב `in_progress` על ה־HEAD המדויק.
4. fetch של base/head לתוך bare Git repository זמני עם HTTPS בלבד וללא hooks.
5. `git merge-base` יחיד ו־`git diff --raw -z -M -C --find-copies-harder`.
6. סיווג שני צדדי rename/copy וכל delete מול `config/policy.v4.2.json` המקומי.
7. עבור RED/CONTROL_PLANE: אימות GitHub native reviews בלבד.
8. קריאה חוזרת של HEAD ושל base לפני conclusion. שינוי ref מבטל את ה־evaluation ואוסר SUCCESS.

## רכיבים

- `config/policy.v4.2.json` — policy bundle סמכותי, כולל GREEN/YELLOW/RED/CONTROL_PLANE ורשימת approvers ריקה ב־Pilot.
- `src/trusted-git.mjs` — fetch metadata מבודד; אינו עושה checkout ואינו מריץ תוכן target.
- `src/git-diff.mjs` — merge-base ו־A/M/D/R/C parsing.
- `src/policy.mjs` — classification failure-closed.
- `src/approval.mjs` — אימות review record אנושי על exact HEAD.
- `src/evaluation.mjs` — exact-HEAD check lifecycle ו־TOCTOU re-read.
- `src/webhook.mjs` — signature verification ו־dispatch מאירועי GitHub בלבד.
- `src/github-client.mjs` — REST/GraphQL client עם installation token.
- `src/server.mjs` — endpoint מינימלי `/webhook` עבור deployment עתידי.

## בדיקות

```powershell
npm run lint
npm test
npm run shadow:fixtures
npm run doctor
```

אין dependencies חיצוניות. נדרשים Node.js 20 ומעלה ו־Git CLI.

## מצב נוכחי

הקוד מוכן ל־shadow מקומי בלבד. טרם נוצרה או הותקנה GitHub App, לא קיים App ID, לא פורסם check אמיתי, וה־Ruleset לא שונה. המשך דורש את הפעולות הידניות ב־`GITHUB_APP_SETUP_HE.md`.
