# מדריך Least Privilege לזהות Codex

לא מבוצע שינוי credentials בשלב זה.

## פרופיל יעד

יש ליצור credential נפרד, מוגבל רק ל־repository הרלוונטי, עם:

- Metadata: read.
- Contents: read/write לצורך branch commits בלבד.
- Pull requests: read/write לצורך פתיחת PR ועדכון תיאורו.
- Actions ו־Checks: read בלבד, רק אם נדרש לצפייה בתוצאות.

אין להעניק:

- Administration או repository settings.
- Rulesets או branch-protection write.
- Checks write או Statuses write.
- Secrets, Actions secrets או workflow administration.
- Workflows write.
- bypass actor ב־Ruleset.
- review approval identity או הרשאת security approver.

## מגבלת GitHub חשובה

GitHub אינו מספק תמיד permission נפרד בשם "merge" עבור זהות שיכולה לכתוב תוכן/PR. לכן אי־יכולת merge אינה נשענת רק על token scopes: ה־Ruleset חייב לדרוש PR, checks מהמקורות הצפויים ו־human gate, וזהות Codex לא תופיע ב־bypass actors. אין להשתמש ב־owner PAT בלתי מוגבל.

## דרך מעבר עתידית

1. צור fine-grained credential או GitHub App ייעודי ל־Codex, מוגבל ל־repository אחד.
2. בחר רק את ההרשאות לעיל; אל תשתמש ב־classic PAT.
3. שמור את ה־credential ב־secret store של סביבת Codex/CI, לא בקובץ repository ולא בצ׳אט.
4. נתק את `gh` מזהות owner/admin בתוך סביבת Codex והתחבר עם הזהות המוגבלת.
5. אמת באמצעות API שלזהות אין Administration, Checks write, Secrets או Workflows.
6. בצע negative tests: Ruleset update, check creation, secret read ו־direct main push חייבים להיכשל.
7. השאר human owner credential מחוץ לסביבת ה־agent.

ה־control-plane App וה־Codex identity הן זהויות שונות לחלוטין. Codex אינו מקבל את מפתח ה־App או את webhook secret.
