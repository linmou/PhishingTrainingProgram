# Cyberbullying scenarios as room templates

Intent: record the removal of the Situation selector, the template seed, and its staging and production verification.

Updated: 2026-10-23. Candidate commit: `76f9b91357367803f4726815c09abee624f20b9a`. Integrated release: merge commit `acc39879b6a20a554c883f0a3e83100d4a1f81b1` (PR #17 into `no_sign_up`). Batch: `cyberbullying-room-templates`.

Status: production verified and cleanup complete.

## Change

- The Cyberbullying "Situation" selector and the `scenarios.json` loader are removed. Scenarios are global `room_templates` rows (`tutor_id` 00000000-0000-0000-0000-000000000000, `practice_type='cyberbullying'`) in the ordinary Use Template list.
- Four rows: `copilot-1`, `copilot-2` (Copilot commit `89e7fda…`) and `screenshot-1`, `screenshot-2` (transcribed from screenshots; photos and avatars cropped into `public/images/`).
- Data-only migration `20261023000000_seed_cyberbullying_templates.sql`, SHA-256 `7e6b8e6c993f0a825edc726f33cf7991b57508e8f05692796bc1f91850867b16`, fixed UUIDs, `ON CONFLICT (id) DO NOTHING`. No schema, Edge Function or secret change. Archived after production verification.

## Verification

| Stage | Evidence |
| --- | --- |
| Local | `room_template_management.test.tsx` 17 passed; CI `isolation-harness`, `frontend-jest`, `frontend-build` passed on PR #17. Seed applied twice to a disposable local database: four rows, second run no-op. That scratch database lacked the `enforce_practice_identity` trigger and had the two columns added by hand |
| Staging `ciubrzggdqesgvfkpolj` | Preconditions: columns and trigger present, 7 templates, 0 cyberbullying. Seed applied under the project lease; four rows read back (trigger accepted). `test:e2e:staging -- --workflow=cyberbullying` pass, evidence `tmp/browser_demo_runs/staging-template-20261023132841-a1b7314a`; fixture room deleted; lease released |
| Integration | `origin/no_sign_up` `tutor-system/src` and migration identical to the staged candidate; migration hash re-checked at the merged commit |
| Production `zgbufaxooqxeabewktzd` | Preconditions: same columns and trigger, 19 templates, 0 cyberbullying. Exact SQL applied; four rows read back, 23 templates total. `test:e2e:production -- --workflow=cyberbullying` pass, evidence `tmp/browser_demo_runs/production-template-20261023133410-3121ca0a`; fixture room deleted; project lease released |

## Failures and reruns

The first production run (`production-template-20261023133324-0e98b53a`) failed its project-traffic assertion before any workflow ran: a development server left on port 3100 by the staging run served the app against staging, and the runner refused it. No fixtures were created and the lease was released. After stopping that server, the rerun passed.

## Frontend release note

Production seed rows are unused by the previous frontend. The new frontend must not ship to an environment before its seed is applied, or the Cyberbullying template list is empty.
