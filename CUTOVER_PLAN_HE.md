# HISTORICAL / SUPERSEDED — תוכנית Cutover של V4.2

מסמך זה נשמר כראיה היסטורית בלבד. הוא אינו מתאר את ה־enforcement הנוכחי ואסור להשתמש בו כ־runbook פעיל.

## התוצאה שבוצעה

- Ruleset: `Guardrail V4 - main protection`, ID `21314805`.
- Phase A הוסיף את `guardrail-v4.2` עם integration ID `4719039` לצד ה־checks הקיימים.
- Phase B הסיר את `guardrail-policy` הישן עם integration ID `15368`.
- required checks הסופיים הם `validate`/`15368` ו־`guardrail-v4.2`/`4719039` בלבד.
- PR נדרש, approval אחד נדרש, approval של ה־push האחרון נדרש, stale approvals נדחים, conversations חייבות להיפתר, strict checks ו־non-fast-forward פעילים.
- Restrict updates נשאר פעיל וה־bypass נשאר Repository Admin במצב Pull Request only.

ה־snapshots המלאים של Phase A ו־Phase B שמורים תחת `evidence/rulesets/`, וההקשר נמצא ב־[`PILOT_EVIDENCE_INDEX_HE.md`](PILOT_EVIDENCE_INDEX_HE.md).

## התכנון ההיסטורי

התכנון המקורי דרש observation window שבו `validate`, ‏`guardrail-policy` ו־`guardrail-v4.2` היו required במקביל. שלב זה הושלם. לאחר verification נפרד הוסר `guardrail-policy` מרשימת ה־required checks ללא שינוי אחר ב־Ruleset.

## Rollback עתידי

Rollback אינו מוגדר עוד על ידי ההוראות הישנות של V4.1. כל rollback עתידי הוא שינוי security-sensitive חדש שדורש snapshot, diff, אישור מפורש ואימות נפרד. אין להסיר checks, App, logs או evidence על בסיס המסמך ההיסטורי הזה.
