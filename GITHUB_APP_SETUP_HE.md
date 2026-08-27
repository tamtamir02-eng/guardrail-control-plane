# HOSTING REFERENCE — GitHub App deployment עתידי

> מסמך זה הוא reference ל־productionization עתידי ואינו הוראה לבצע hosting כעת. הארכיטקטורה הסמכותית נמצאת ב־`GUARDRAIL_ARCHITECTURE_FINAL_HE.md`. מסמך ה־Local Live Shadow הוא היסטורי בלבד.

רישום App דורש פעולה שלך בממשק GitHub ו־deployment HTTPS נגיש ל־webhooks. אין לשלוח private key או webhook secret בצ׳אט.

## לפני הרישום

1. בחר hosting שמספק Node.js 20+, Git CLI, HTTPS public endpoint ו־secret store.
2. פרוס commit SHA קבוע של repository זה. אל תפרוס branch נע.
3. הגדר endpoint חיצוני שממפה אל `POST /webhook`.

## רישום App

1. GitHub → Settings → Developer settings → GitHub Apps → New GitHub App.
2. Name: שם ייחודי כגון `Tamir Guardrail V4.2 Pilot`.
3. Homepage URL: כתובת ה־repository `guardrail-control-plane`.
4. Webhook URL: `https://<deployment-host>/webhook`.
5. צור webhook secret אקראי ישירות ב־secret manager והזן אותו בממשק. אל תשמור אותו ב־repository.
6. השאר user authorization callback ו־OAuth כבויים.
7. בחר Private / Only on this account.
8. Repository permissions בלבד:
   - Metadata: Read-only.
   - Contents: Read-only.
   - Pull requests: Read-only.
   - Checks: Read & write.
9. ודא במפורש שכל אלה הם No access: Administration, Actions, Workflows, Secrets, Deployments, Environments, Issues, Commit statuses וכל הרשאה אחרת.
10. Subscribe to events בלבד: Pull request, Pull request review, Push.
11. צור את ה־App ורשום לעצמך את App ID. אין לשלוח אותו יחד עם secret כלשהו; App ID לבדו אינו סודי.
12. Generate private key. שמור את קובץ ה־PEM ישירות ב־secret store או secret-mounted file מחוץ ל־repository.

## התקנה מוגבלת

1. Install App.
2. בחר Only select repositories.
3. בחר רק `tamtamir02-eng/codex-guardrail-pilot`.
4. אל תבחר `guardrail-control-plane` ואל תבחר All repositories.
5. רשום את Installation ID מתוך כתובת/ממשק ההתקנה.

## Environment של ה־deployment

- `GITHUB_APP_ID` — App ID המספרי.
- `GITHUB_PRIVATE_KEY_PATH` — absolute path לקובץ PEM שמוזרק כ־secret mount.
- `GITHUB_WEBHOOK_SECRET` — secret מה־secret manager.
- `PORT` — אופציונלי; ברירת מחדל 3000.
- `HOST` — השאר `127.0.0.1` מאחורי reverse proxy מקומי; השתמש ב־`0.0.0.0` רק אם פלטפורמת container דורשת זאת.

לאחר מכן עצור ובקש בדיקת permissions, App source ו־shadow checks לפני כל Ruleset cutover.
