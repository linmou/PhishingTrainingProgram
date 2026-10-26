# Public Assessment Feature Configuration

Intent: replace the assessment enablement secret with readable, administrator-controlled configuration.

Updated: 2026-10-26. Implementation baseline: `60025062117e2731840a5afcf7469409081f5180`; current integration base: `dec7c274435bce082a7069c29c39302eecf960d3`; staging candidate: `7d8789dfa2d764ab879d843dca9ad34f3b4b9788`. Release owner: Codex root agent. Batch: `public-assessment-flag-20261026`. Status: staging behavior verified; obsolete-secret removal blocked by credential permissions; merge and production acceptance pending.

## Changed Contract

`public.feature_flags` contains the `TRANSFER_ASSESSMENT_ENABLED` name and a non-null boolean `enabled`. Public clients can read it through REST. Only service-role administrators can update it; public INSERT, UPDATE, DELETE and TRUNCATE are denied. The name constraint prevents this table from being used for provider credentials. No application history is changed by the migration or flag updates.

The Edge handler reads the table per request so warm instances observe changes. There is no environment fallback or implicit enabled default. Missing/malformed configuration and query failures return retryable HTTP 503 `ASSESSMENT_CONFIGURATION_UNAVAILABLE`; explicit false returns `ASSESSMENT_FEATURE_DISABLED`. Owner clear retains its existing exception. Provider credentials remain unchanged. No prompts, models, grading or evaluation rules change.

The deployment workflow no longer creates the flag as a secret, and `.env.example` no longer declares it as an environment variable. Existing hosted secrets have not yet been removed.

## Local Evidence

The checked Deno assessment suite passes 49/49 tests, including a production-adapter HTTP test of public-table reads, opposite legacy environment values, missing/null/string values, query failures, repeated enable/disable/restore on one warm handler, rejected operations without side effects, and the owner-clear exception. Deno checks the modified TypeScript and the default adapter. An initial new test counted both join and post RPCs as writes; it was corrected to count the actual message-write RPC before the passing run.

`supabase/tests/public_feature_flags.sql` ran on disposable clones of `realtime_publication_baseline_20261025_0335` as source-equivalent `postgres`. Red failed because the table does not exist; Green applied the queued SQL and passed public reads, both public-role write denials, service-role disable/restore, invalid-name/null rejection and administrative delete denial. Test mutations rolled back and both databases were cleaned. Clone leases retain command status, baseline comparison and cleanup:

- Red: `/Users/admin/.transfer-assessment-pg17/runs/scenario-hR39px/lease.json`, exit 3, missing relation.
- Green: `/Users/admin/.transfer-assessment-pg17/runs/scenario-prWs6i/lease.json`, exit 0.

This proves behavior on the verified October 25 local baseline, not fresh hosted migration parity. Production MCP inspection on October 26 found no `public.feature_flags` or `public.app_config` table. Earlier read-only staging secret inspection matched the exact boolean `true`; reobserve both target values before seeding either environment.

The browser-runner, historical evidence and assessment privacy/security/result/configuration harness regressions pass 53/53 Node tests. Deployment manifest dry-run succeeds and requires only the two provider secret names. `git diff --check` passes. Historical queued-artifact SHA-256 values (the promoted SQL hash is recorded below):

| Artifact | SHA-256 |
| --- | --- |
| Queued SQL | `3e47714f6b49abd35820900b7c180fafba32c28032a06b7b2c2b7fdf81b73ed3` |
| assessment-api/index.ts | `758bb3d76646dc367114dd647cd33b4fa49b9f8c245532575087def37d23caad` |
| public_feature_flags.sql test | `6763855452ff1006a0df5c37739af1e37cadb9da7385f5fbd0b6f70bfb4a540d` |
| Edge dependency manifest | `a6f3433da869371beebab4b21bf007f6b5e9e09f5a18125933d3aca8318c9523` |

The first `shasum` invocation failed on the host's unsupported `C.UTF-8` locale; rerunning with `LC_ALL=C LANG=C` produced these hashes. Deno updated unrelated workspace dependency metadata during testing; that generated metadata change was removed before commit.

## Migration Dependency Resolution

The predecessor `20261025034000_enable_message_realtime.sql` has now passed staging and production acceptance as an independently bounded SQL release from integrated `dec7c27`. Its [release record](documentation_update_record_v2026_10_24_realtime_publication.md#independent-prerequisite-release-on-october-26) preserves fresh baseline parity, actual channel/recovery checks, exact SQL application, data/permission readbacks and both lease releases. The archived bytes retain the original hash. No unrelated PR #30 application or prompt changes were promoted.

The sole pending migration is now `supabase/migrations/20261026223000_public_assessment_feature_flag.sql`, promoted from the queued candidate. Its only source change is replacing the queued-artifact comment; SHA-256 is `5640033e764919d351ed6d9c01b4ae5e324dfc7e86e11f8d931c8ec86e3ea880`. A fresh hosted restore and catalog/role/data parity cycle passes; the promoted artifact passes its permission/disable/restore tests in `scenario-WlB24B`, with owned database cleanup. Both hosted legacy flags were read-only observed as exact `true` at 22:20 UTC, matching the seed. Do not deploy the changed Edge handler before the table.

The opt-in staging-only `assessment-configuration` workflow now tests public reads and denied writes using both anonymous and real authenticated-role credentials. It saves and grades a fixed assessment, disables all nine assessment operations, verifies readable history and identical message/attempt/authority/progress hashes, restores the exact original boolean in a `finally` block and verifies normal private-review behavior afterward. Focused tests cover restoration on failure, both original booleans, unreadable configuration, restoration failure requiring lease retention, and rejection of production before fixture access.

## Hosted Acceptance

Before staging mutation, freeze the candidate commit and SQL/Edge hashes, refresh the hosted baseline and role/catalog parity, then acquire the exact candidate's project lease. Reobserve the legacy flag and verify the seed matches; the current candidate seeds true. Apply SQL before Edge code. Verify public REST reads using anon and real authenticated credentials, denied public writes with unchanged state, and authorized updates.

Run a full affected assessment journey and a staging disable/history-preservation/restore drill under the same lease. Capture persisted question, attempts, grade and saved-history identities/hashes before and after. Verify disabled requests cause no assessment effects, public history stays readable, and re-enabled operations work on the same deployed function. Preserve existing owner-clear behavior without using clear/reset as the drill. Always restore the observed value and verify cleanup. Recheck provider/function dependencies and record deployed IDs/versions/source hashes.

Only after the table-backed function passes acceptance, delete the single legacy `TRANSFER_ASSESSMENT_ENABLED` secret with the Management API, verify its absence, recheck the public flag and run affected requests again. If the function must roll back to old code after removal, restore the known non-sensitive legacy value before that old code is deployed; never restore any unrelated secret from an evidence log.

After staging passes, request the human owner's authorization for the exact reviewed commit to merge into `no_sign_up`. Verify the integrated artifacts on staging, then apply the same SQL and Edge artifacts to production in that order. Production acceptance requires public read/write-boundary checks, the affected assessment lifecycle, persisted result/history, configuration state, legacy-secret absence and fixture cleanup. Record each environment's versions, hashes, commands and results before marking this task complete.

## Staging Results And Access Blocker

Candidate `7d8789dfa2d764ab879d843dca9ad34f3b4b9788` passed all three required [GitHub CI checks](https://github.com/linmou/PhishingTrainingProgram/actions/runs/40411860284): isolation-harness, frontend-jest and frontend-build. PR #37 contains the public-configuration change and the PR #29 candidate; both remain unmerged. Human review and exact-head merge authorization remain pending.

Under the candidate's shared project lease, the exact promoted SQL was applied to staging `ciubrzggdqesgvfkpolj` before deploying assessment-api. The hosted SQL permission suite passed. The observed legacy value was true, matching the seed. assessment-api advanced from v77 to v78; all downloaded runtime file hashes match the candidate, including unchanged imported dependencies. No ai-api deployment occurred.

| Deployed artifact | Value |
| --- | --- |
| Function ID | `1a47f58e-5451-422c-b9d3-26cba3b20faa` |
| Version | `78` |
| Bundle SHA-256 | `50474c5705db85f002f70ab3f59cabe02b3710cd970d4d01ce17ab0551dd607c` |
| SQL SHA-256 | `5640033e764919d351ed6d9c01b4ae5e324dfc7e86e11f8d931c8ec86e3ea880` |
| Edge source manifest SHA-256 | `a6f3433da869371beebab4b21bf007f6b5e9e09f5a18125933d3aca8318c9523` |

The configuration drill passed at `tmp/browser_demo_runs/staging-template-20261026225919-5342f25e/report.json`. Anonymous and real authenticated reads returned HTTP 200; writes returned 401 and 403 respectively, both SQLSTATE 42501. All nine assessment operations returned HTTP 503 `ASSESSMENT_FEATURE_DISABLED` while false. Existing history stayed readable. Messages, attempts, assessment authority and progress retained SHA-256 `5c10354e0046416b9a5f48f6c0f95f288319587d319fdb1ef40445955add1990` before, during and after the drill, with one saved attempt and its passing grade preserved. Restoration to true and normal private review (HTTP 200) passed. The temporary Auth account/profile and room fixtures were cleaned.

The privacy browser workflow passed both assessment outcomes in `tmp/browser_demo_runs/staging-template-20261026225940-cad9a3a3/report.json`: 231 network, Realtime, DOM, actual JSON/TXT download and error observations across eight checkpoints, with zero violations. Both room cleanups passed. A repeated configuration run at `tmp/browser_demo_runs/staging-template-20261026230052-88303ed3/report.json` also passed; it ran with the legacy secret still present and is not evidence of operation after removal.

Deleting only `TRANSFER_ASSESSMENT_ENABLED` through `DELETE /v1/projects/ciubrzggdqesgvfkpolj/secrets` returned HTTP 403: `Missing required permission(s): edge_functions_secrets_write`. The configured credential can deploy the SQL and Edge source but cannot perform this deletion. The available Browser runtime has no browser session. This is a credential-access blocker; the table-backed function already ignores the old secret.

The final readback at 23:04 UTC confirmed the public boolean is true, v78 and all deployed source hashes are unchanged, and the obsolete secret remains present. All three live runs had passed cleanup and their fixture processes had stopped. The exact owned staging lease was released. Detailed deployment, failing deletion and safe checkpoint evidence is retained under `output/public-assessment-flag-20261026/staging-flag-release-1793055525309/`; the permission response is `output/public-assessment-flag-20261026/secret-delete-diagnostic.json`. These generated outputs are local evidence, not committed artifacts.

Next action: provide a configured management credential with `edge_functions_secrets_write`, acquire a fresh exact-candidate staging lease, recheck deployed source/configuration and existing evidence validity, delete the single obsolete secret, rerun the configuration drill and verify cleanup. Then complete human review and request authorization to merge the current head. Any later changes require affected-scope revalidation. Production still uses the old flag implementation; production SQL, dependent Edge deployment, secret removal and all selected production acceptance checks remain open.
