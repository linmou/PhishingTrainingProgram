# Wave 105 acceptance continuation

Intent: preserve reproducible SQL and staging acceptance evidence for PR #29 and issue #28.

Updated: 2026-10-26. Source baseline: `bfaa92661c29b6606be16ec25dc21b08d7e1fd22`.

## SQL fixture corrections

Actual execution exposed an unquoted reserved `current_role` identifier in the direct-role fixture, removed `active_response_mode`/`mode_change_source` columns in the lifecycle/result fixtures, and the current client-contract gate intercepting authenticated event-forgery checks. Quote the identifier, use `guard_mode`/`guard_mode_change_source`, and provide the explicit `cyberbullying-v2` request contract. Runtime code and migrations are unchanged.

## Disposable database results

Baseline: `realtime_publication_baseline_20261025_0335`, whose export/restore and catalog parity are recorded in the realtime-publication worktree's `documentation_update_record_v2026_10_24_realtime_publication.md`. This is an October 25 production-schema snapshot, not current staging acceptance. Each scenario uses the existing PG17 validation cluster and an independently allocated disposable clone. Execute as source-equivalent `postgres`; bootstrap execution initially exposed temporary-table ownership differences after a test's explicit role reset.

From the repository root, for each SQL file below:

```sh
rtk proxy env PG_VALIDATION_PSQL=/opt/homebrew/opt/postgresql@17/bin/psql \
  node scripts/database/disposable-database.js \
  --template realtime_publication_baseline_20261025_0335 -- \
  /opt/homebrew/opt/postgresql@17/bin/psql -X -v ON_ERROR_STOP=1 \
  -c 'SET ROLE postgres' -f tutor-system/supabase/tests/<file>.sql
```

| File | Observed result |
| --- | --- |
| `transfer_assessment_direct_roles.sql` | Exit 0; all 14 anon/authenticated checks return `42501`; authority/progress comparisons pass; transaction rolls back. |
| `final_assessment_after_understanding.sql` | Exit 0; all 17 lifecycle scenarios and anon/authenticated RPC permission assertions pass; transaction rolls back. |
| `assessment_result_messages.sql` | Exit 0; 16 saved-result cases pass, including write-fault atomicity, replay, terminal disclosure, Guard recovery and event forgery; transaction rolls back. |

Full command output, SQL SHA-256 hashes and exit codes: `output/pr29-resume-20261026/{sql-results.json,*.log}` in the `pr-29-resume` worktree. Allocator lease files named in each log confirm owned clone cleanup. Initial failed runs also cleaned their clones. No baseline/global-role changes were made.

## Local verifier results

`npm run test:assessment:audit`: 20 passed. `npm run test:e2e:unit`: 22 passed, including actual local HTTP/WebSocket instrumentation and browser interactions, with installed Playwright Chromium. Historical checksum checks pass. These checks do not establish hosted privacy or authorization.

## Staging acceptance

Intended target: `ciubrzggdqesgvfkpolj`. Selected checks: opt-in `assessment-security` and `assessment-privacy`, under the shared staging lease, with fixture cleanup and deployed Edge version observations. Read-only Management API key-access preflight returned HTTP 200. The available Supabase MCP connection targets production (`zgbufaxooqxeabewktzd`); it is not a staging connection.

Candidate `b549a8c69506e02253c98a7919e4ed08a3e62e4a` was exercised against `assessment-api` v77 and `ai-api` v7. Reports below are under `tmp/browser_demo_runs/` in the `pr-29-resume` worktree.

| Run | Observed result |
| --- | --- |
| `staging-template-20261026200035-f6be7a1e` | Security preflight failed on Management API SQL HTTP 502 before browser/fixture work; lease released. |
| `staging-template-20261026200039-3b1159f5` | Privacy failed before its first checkpoint. Initial cleanup hit HTTP 502 and retained the lease. Recovery under that exact lease verified all fixture tables empty and Guard fields restored, then released the lease; `output/pr29-resume-20261026/cleanup-recovery.json`. |
| `staging-template-20261026200146-0b3ec1c7` | Real security workflow completed: cross-learner, cross-room and legacy RPC passed; forged identity, direct writes and stale question failed. Both room cleanups, outsider profile cleanup and real Auth account/profile cleanup passed; lease released. |
| `staging-template-20261026200317-be441f93` | Privacy again failed before its first checkpoint; room cleanup passed and lease released. The original privacy catch hid the failing prerequisite, so the continuation adds a safe stage identifier without copying private exception bodies. |

The forged tutor `read_review` request returned HTTP 200 to an anonymous caller. Anon REST PATCHes changed persisted question result, lifecycle, selected options and public options; before/after state hashes differ. Authenticated-role variants also returned HTTP 200, while the trusted-event field checks were denied. Because successive probes target the same question, later no-change hashes do not independently establish protection for fields already changed by the anon probe. Both legacy RPC roles were denied. The stale-question response was not an accepted denial reason and remains a failing check. Full per-case/subcheck evidence is `assessment-security.json`, containing status codes and hashes rather than private review bodies. These are observed weaknesses, not acceptance passes or runtime fixes.

Operational flag-value observation and a configuration rollback drill remain open. Secret-name observation encountered HTTP 502; no value or operational state is inferred from it. Issue #28 remains open; no merge or release verdict is implied by local SQL success.

## Base integration

The PR base advanced to `ed572109f39af61f1d674df768eaa07de2f90416`. Resolve the sole merge conflict in `browser-e2e.test.js` by retaining both PR #29's cleanup/privacy cases and the base's room-setup cases. Revalidate the integrated harness and staging candidate; earlier-head CI is not current-head evidence.

Integrated candidate `50f0aa5` passes all 29 combined browser-runner checks and all 20 audit checks. SQL artifact hashes still match the passing clone runs. Staging security run `staging-template-20261026200442-7a94e1b2` reproduces the same three passing/three failing cases; identities and both rooms clean up and the lease releases. Privacy run `staging-template-20261026200628-d0935153` stops at `private_canary`, before any learner privacy checkpoint; room cleanup passes and the lease releases. A follow-up records only HTTP status and a bounded failure category to diagnose the prerequisite without preserving private exception bodies.

Read-only secret-name observation subsequently succeeds: `TRANSFER_ASSESSMENT_ENABLED` exists, but its value is unavailable through that API. Successful assessment operations establish effective enabled behavior during the runs, not the secret's exact value. Evidence: `output/pr29-resume-20261026/staging-flag-observation.json`.
