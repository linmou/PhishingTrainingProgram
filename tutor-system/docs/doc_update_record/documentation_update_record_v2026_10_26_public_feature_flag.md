# Public Assessment Feature Configuration

Intent: replace the assessment enablement secret with readable, administrator-controlled configuration.

Updated: 2026-10-26. Implementation baseline: `60025062117e2731840a5afcf7469409081f5180`; current integration base: `dec7c274435bce082a7069c29c39302eecf960d3`. Release owner: Codex root agent. Batch: `public-assessment-flag-20261026`. Status: local tests passed; predecessor production verified and archived; flag staging deployment pending.

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

The browser-runner, historical evidence and assessment privacy/security/result harness regressions pass 49/49 Node tests (32 runner/history plus 17 assessment tests). Deployment manifest dry-run succeeds and requires only the two provider secret names. `git diff --check` passes. Artifact SHA-256 values:

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

The predecessor blocker is resolved. Current remaining gates are this candidate's CI/review, staging table and Edge deployment, live configuration/privacy acceptance and legacy-secret removal, followed by explicit authorization to merge the exact candidate and promote its integrated artifacts. No flag-table SQL application, changed Edge deployment or flag-secret deletion has occurred yet; production flag behavior remains on the old implementation.
