# HISTORICAL / SUPERSEDED — הכנת GitHub App ל־Local Live Shadow ב־Windows

> מסמך זה נשמר כדי לתעד את שלב ההקמה המקומי שכבר בוצע. הוא אינו runbook למצב הפעיל. לתצורה הנוכחית ראו `GUARDRAIL_ARCHITECTURE_FINAL_HE.md`; לתכנון hosting עתידי ראו `GITHUB_APP_SETUP_HE.md`.

## גבולות הניסוי

- חשבון בעלים: `tamtamir02-eng`.
- repository יעד יחיד: `tamtamir02-eng/codex-guardrail-pilot`.
- control plane מקומי: `guardrail-control-plane`.
- endpoint מקומי: `POST http://127.0.0.1:3000/webhook`.
- ה־App פרטי וניתן להתקנה בחשבון זה בלבד.
- אין להתקין על `guardrail-control-plane`, על repository אחר או על `All repositories`.
- אין לשנות Ruleset, required checks או merge policy בשלב ההכנה/Shadow.

## שלב 0 — תנאי עצירה

לפני יצירת משאב חיצוני, ודא שאושר commit חדש הכולל את מסמך ההכנה וה־preflight. ה־baseline שהיה מאושר לפני ההכנה הוא `f2409a4dcde81766eda1dd50f3bf7e8e8f440e64`; השינויים המקומיים הנוכחיים אינם חלק ממנו. Live Shadow אסור עם working tree מלוכלך או עם SHA שאינו תואם ל־`GUARDRAIL_EXPECTED_COMMIT`.

אם GitHub מבקש הרשאה שאינה ברשימה המאושרת להלן, עצור. אל תרחיב הרשאה כדי "לנסות".

## שלב 1 — יצירת ערוץ Smee עתידי

רק לאחר אישור מפורש, פתח ידנית `https://smee.io`, צור ערוץ ושמור את כתובת `https://smee.io/<CHANNEL_ID>` מקומית. אל תפרסם אותה ואל תכניס אותה ל־Git.

Smee הוא relay צד שלישי: payloads של ה־webhook עוברים בשירות שלו וערוץ פתוח ניתן לצפייה למי שמחזיק בכתובת. לכן שלב זה מיועד רק ל־repository הניסוי הציבורי, אין להשתמש בו ל־repository אמיתי או ל־payloads רגישים, ויש למחוק/להפסיק את הערוץ בסוף הניסוי.

כתובת ה־Webhook שתוזן ב־GitHub App היא כתובת ערוץ Smee עצמה:

```text
https://smee.io/<CHANNEL_ID>
```

Smee יעביר אותה אל `http://127.0.0.1:3000/webhook`. ב־GitHub השאר SSL verification פעיל. אין להוסיף secret לכתובת ה־URL.

## שלב 2 — רישום GitHub App בחשבון האישי

1. GitHub → תמונת פרופיל → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**.
2. הזן שם ייחודי, למשל `Tamir Guardrail V4.2 Local Shadow`.
3. Homepage URL: `https://github.com/tamtamir02-eng/guardrail-control-plane`.
4. Webhook: פעיל.
5. Webhook URL: `https://smee.io/<CHANNEL_ID>`.
6. צור webhook secret אקראי באורך 32 bytes לפחות והזן אותו גם ב־GitHub וגם בקובץ המקומי החיצוני. אל תשלח אותו בצ׳אט ואל תדפיס אותו למסוף.
7. SSL verification: פעיל.
8. OAuth/user authorization, callback URLs ו־Device Flow: כבויים/ריקים.
9. **Where can this GitHub App be installed?** בחר **Only on this account**. ה־App אינו ציבורי.
10. Repository permissions בלבד:
    - Metadata: Read-only.
    - Contents: Read-only.
    - Pull requests: Read-only.
    - Checks: Read and write.
11. ודא `No access` לכל הרשאה אחרת, ובפרט: Administration, Actions, Workflows, Secrets, Environments, Deployments, Rulesets, Branch protection, Contents write, Pull requests write ו־Merge.
12. Subscribe to events בלבד:
    - Pull request.
    - Pull request review.
    - Push.
13. צור את ה־App ורשום מקומית את ה־App ID המספרי.

`Checks: Read and write` היא הרשאת הכתיבה היחידה. היא דרושה כדי לפרסם את ה־Check Run בשם `guardrail-v4.2`. אם GitHub דורש permission נוספת, עצור ותעד את הפעולה המדויקת שנכשלה; אין להרחיב scope ללא Audit ואישור.

## שלב 3 — private key ו־secrets מחוץ ל־Git

הכן תיקייה מקומית שאינה בתוך repository:

```powershell
$guardrailLocalDir = Join-Path $env:LOCALAPPDATA 'GuardrailV4.2'
New-Item -ItemType Directory -Path $guardrailLocalDir -Force
Copy-Item -LiteralPath '.\.env.example' -Destination (Join-Path $guardrailLocalDir 'guardrail.env')
```

במסך ה־App בחר **Generate a private key**. העבר את קובץ ה־PEM שהורד אל:

```text
%LOCALAPPDATA%\GuardrailV4.2\guardrail-v4.2.pem
```

ערוך מקומית את `%LOCALAPPDATA%\GuardrailV4.2\guardrail.env` ומלא:

- `GITHUB_APP_ID` — המספר מה־App.
- `GITHUB_PRIVATE_KEY_PATH` — absolute path ל־PEM שמחוץ ל־repository.
- `GITHUB_WEBHOOK_SECRET` — אותו secret אקראי שהוגדר ב־GitHub.
- `GUARDRAIL_TARGET_REPOSITORY` — חייב להישאר `tamtamir02-eng/codex-guardrail-pilot`.
- `GUARDRAIL_EXPECTED_COMMIT` — full SHA של commit control-plane שאושר לפריסה.
- `HOST` — חייב להישאר `127.0.0.1`.
- `PORT` — `3000`.

אין צורך ב־Installation ID. השרת לוקח אותו רק מתוך webhook payload שעבר אימות HMAC. אל תשמור PEM, secret או installation token ב־Git, ב־repository, ב־log או בצ׳אט. `.env`, `.env.*`, `*.pem`, `*.key` ו־`secrets/` חסומים גם ב־`.gitignore`; `.env.example` מכיל placeholders בלבד.

## שלב 4 — התקנה על repository יחיד

1. במסך GitHub App בחר **Install App**.
2. בחר את החשבון `tamtamir02-eng`.
3. בחר **Only select repositories**.
4. בחר רק `codex-guardrail-pilot`.
5. אמת שלא נבחר `guardrail-control-plane`, שלא נבחר repository אחר ושלא נבחר **All repositories**.
6. אל תשנה permissions לאחר ההתקנה.

## שלב 5 — preflight והפעלה בשני חלונות PowerShell

Terminal A — שרת מקומי. הסקריפט טוען secrets מהקובץ החיצוני, מריץ preflight, ואינו מפעיל שרת אם בדיקה כלשהי נכשלת:

```powershell
Set-Location (Join-Path $env:USERPROFILE 'Downloads\codex-guardrail-lab\guardrail-control-plane')
powershell.exe -NoProfile -File .\scripts\start-local.ps1
```

ה־preflight בודק בפועל: Node.js 20+, Git, משתני חובה, RSA PEM קריא, webhook secret באורך 32+, loopback בלבד, port 3000 פנוי, repository יעד מדויק, policy bundle סמכותי, full commit SHA תואם ו־working tree נקי.

Terminal B — Smee client. הפקודה המדויקת העתידית היא:

```powershell
npx smee -u https://smee.io/<CHANNEL_ID> -t http://127.0.0.1:3000/webhook
```

הרצה ראשונה של `npx` עשויה לבקש להוריד את Smee client; בדוק שהחבילה והמקור תואמים להוראות GitHub לפני אישור. אין צורך בהתקנה גלובלית. אל תפעיל פקודה זו לפני שנוצר ערוץ ידנית ולפני אישור תחילת Live Shadow.

## התנהגות failure-closed

- חתימת `X-Hub-Signature-256` נבדקת לפני parsing והרשאת App.
- webhook מ־repository שאינו היעד נדחה לפני בקשת installation token.
- PEM לא תקין, secret קצר, port תפוס, Node ישן, policy חסר, SHA שונה או working tree מלוכלך מונעים את עליית השרת.
- השרת מאזין ל־loopback בלבד ואינו נחשף לרשת המקומית.
- התוכן מה־target repository אינו מורץ; הניתוח נעשה ב־bare Git repository וללא checkout או hooks.

## נקודת העצירה הבאה

הפעולה הידנית הראשונה לאחר אישור נוסף היא לאשר commit חדש של הכנת ה־Local Shadow ולרשום את ה־SHA המלא המאושר. רק לאחר מכן ניתן ליצור ידנית ערוץ Smee ו־GitHub App לפי המסמך. אין cutover ואין שינוי Ruleset בשלב זה.
