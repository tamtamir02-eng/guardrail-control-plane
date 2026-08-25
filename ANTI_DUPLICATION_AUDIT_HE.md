# Anti-Duplication Audit

| יכולת | מקור | custom code שנשאר |
|---|---|---|
| commit identity | Git SHA/ref של GitHub | אין fingerprint או attestation |
| merge relationship | `git merge-base` | wrapper failure-closed בלבד |
| rename/copy/delete | Git raw diff `-M -C` | parser metadata בלבד |
| approvals | GitHub native review records | validator של policy/identity/SHA בלבד |
| merge blocking | GitHub Ruleset | אין custom merge service |
| check identity | GitHub App `app.id` | predicate לבדיקת expected App בלבד |
| sandbox/commands | Codex sandbox/approvals/Rules | אין lifecycle hooks |
| independent review | GitHub human/Codex native review | אין custom Codex reviewer |
| retry/concurrency | GitHub webhooks ו־required-check fail-closed | אין circuit breaker או poller |

custom code נדרש רק במקום שבו GitHub אינו מכיר את policy העסקי: מיפוי paths ל־risk, איסוף Git metadata ללא מגבלת Compare API, ובדיקת allowlist/HEAD עבור approval. לא נוצרו lifecycle hooks, custom subagents, fingerprints, attestations, custom permission reviewers, custom security reviewers או circuit breakers.
