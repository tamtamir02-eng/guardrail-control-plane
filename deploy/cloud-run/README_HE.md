# תבניות Cloud Run של Guardrail V4.2

התיקייה מכילה templates בלבד. אין להריץ אותן לפני אישור deployment נפרד.

## רכיבים

- `guardrail-ingress.service.yaml.template` — שירות ציבורי שמקבל `POST /webhook`, מאמת HMAC ומכניס Cloud Task.
- `guardrail-worker.service.yaml.template` — שירות פרטי שמקבל `POST /tasks/evaluate` רק דרך Cloud Run IAM/OIDC.
- `cloud-tasks-queue.yaml.template` — חוזה queue, retry ו־rate limits לצורך review. יש לתרגם להגדרת `gcloud tasks queues create/update` מאושרת; הקובץ אינו מיועד ל־`kubectl`.

לפני שימוש מחליפים את כל ה־placeholders, מקבעים secret versions מספריים ו־image digest, ומריצים `rg '[A-Z][A-Z0-9_]{3,}' deploy/cloud-run` כדי לאתר placeholders שנותרו. אין להשתמש ב־image tag לצורך deploy.

גם build של ה־Dockerfile מחייב `NODE_BASE_IMAGE` מלא בפורמט Node 20 image עם `@sha256:<digest>` ו־`VCS_REF` שהוא commit SHA מלא. אין ל־Dockerfile base-image default מכוון, כדי למנוע build production לא מקובע.

ה־ingress runtime SA צריך Secret Accessor על webhook secret, Cloud Tasks Enqueuer, ו־Service Account User רק על Task Caller SA לצורך OIDC. ה־worker runtime SA צריך Secret Accessor רק על GitHub App private key. ה־Task Caller SA מקבל Cloud Run Invoker רק על worker.

`/health` מחזיר metadata לא־סודי. ה־worker private; גם header מסוג `X-CloudTasks-TaskName` נדרש ב־production כהגנת עומק, אך אינו תחליף ל־IAM.
