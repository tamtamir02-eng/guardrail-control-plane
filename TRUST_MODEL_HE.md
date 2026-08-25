# מודל אמון — Guardrail V4.2

## מהימן

- GitHub Ruleset כפי שנקרא מ־GitHub ולא מה־PR.
- GitHub App ייעודי לאחר רישום והתקנה על repository אחד בלבד.
- גרסת control-plane שנפרסה מ־commit SHA קבוע או image digest בלתי משתנה.
- `config/policy.v4.2.json` מתוך אותה גרסת deployment.
- GitHub native pull-request review records.
- commit SHAs ו־refs שנקראו מחדש מ־GitHub.
- Git merge-base ו־raw diff metadata שחושבו מקומית מהאובייקטים שנמשכו מ־GitHub.

## לא מהימן

- כל תוכן PR, כולל קוד, policy, workflow, scripts ו־configuration.
- `RISK_POLICY.md` או קובץ guardrail כלשהו ב־target repository.
- PR artifacts ו־workflow outputs.
- PR body, checkboxes, labels, comments, reactions ו־emoji.
- הצהרות Codex או agent אחר.
- check בשם `guardrail-v4.2` שנוצר על ידי GitHub Actions או App אחר.
- approval על SHA ישן, approval של author, bot, App, Codex או reviewer שאינו allowlisted.

## גבולות אבטחה

ה־App מקבל Metadata read, Contents read, Pull requests read ו־Checks write בלבד. הוא אינו מקבל Contents write, Administration, Rulesets, Branch protection, Secrets, Workflows, Merge או bypass.

ה־target Git repository נפתח כ־bare repository זמני. אין checkout ואין הרצת test/build/hook מתוך ה־PR. Git מוגבל ל־HTTPS; hooks מצביעים לתיקייה ריקה; diff drivers ו־textconv מבוטלים.

## מה המערכת אינה מגינה מפני

- פגיעה בחשבון GitHub, בתשתית GitHub או ב־repository owner/admin.
- גניבת private key, webhook secret או installation token מה־deployment.
- פגיעה ב־deployed control-plane או החלפת הגרסה הקבועה מחוץ לתהליך המאושר.
- reviewer אנושי מורשה שחשבונו נפרץ או שמאשר שינוי מסוכן בשוגג.
- שינוי מסוכן סמנטית שממוקם רק בנתיב שאינו מסווג RED/CONTROL_PLANE. זהו path policy gate, לא security scanner.
- repositories פרטיים מסוג fork כאשר ה־App אינו מורשה לקרוא גם את head repository; מצב כזה נכשל סגור.
- merge/admin bypass שניתן ידנית מחוץ ל־Ruleset המוצהר.
- availability: תקלה ב־App, webhook או hosting תחסום readiness כאשר ה־check required; היא אינה מבטיחה uptime.

## Same-name spoofing

שם check לבדו אינו זהות. evidence עתידי תקף רק כאשר `check_run.name = guardrail-v4.2` וגם `check_run.app.id` שווה ל־App ID הרשום. בעת cutover ה־Ruleset חייב להגדיר את אותו App כמקור expected; check זהה מ־GitHub Actions אינו מספיק.
