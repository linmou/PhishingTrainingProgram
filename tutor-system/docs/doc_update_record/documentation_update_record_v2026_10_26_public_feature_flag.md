# Public Assessment Feature Configuration

Intent: replace the assessment enablement secret with readable, administrator-controlled configuration.

Updated: 2026-10-26. Implementation baseline: `60025062117e2731840a5afcf7469409081f5180`. Release owner: Codex root agent. Batch: `public-assessment-flag-20261026`. Status: local tests passed; migration queued; no hosted changes.

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

## Migration Dependency

The one pending migration is `supabase/migrations/20261025034000_enable_message_realtime.sql`; its [release record](documentation_update_record_v2026_10_24_realtime_publication.md) assigns the existing root open-issues release owner and leaves hosted acceptance open. The October 26 production MCP query still reports no messages publication membership. Do not overwrite, combine, archive prematurely or independently release that owner's candidate.

The new SQL is queued at `specs/102-transfer-backend/public-feature-flag.sql`, outside the pending migration directory. Promote it to a dated migration only after the existing migration completes both environments and is archived. Do not merge/deploy the changed Edge handler without the configuration table. A single pending migration is a repository delivery requirement, not a Supabase limitation.

## Hosted Acceptance

Before staging mutation, freeze the candidate commit and SQL/Edge hashes, refresh the hosted baseline and role/catalog parity, then acquire the exact candidate's project lease. Reobserve the legacy flag and verify the seed matches; the current candidate seeds true. Apply SQL before Edge code. Verify public REST reads using anon and real authenticated credentials, denied public writes with unchanged state, and authorized updates.

Run a full affected assessment journey and a staging disable/history-preservation/restore drill under the same lease. Capture persisted question, attempts, grade and saved-history identities/hashes before and after. Verify disabled requests cause no assessment effects, public history stays readable, and re-enabled operations work on the same deployed function. Preserve existing owner-clear behavior without using clear/reset as the drill. Always restore the observed value and verify cleanup. Recheck provider/function dependencies and record deployed IDs/versions/source hashes.

Only after the table-backed function passes acceptance, delete the single legacy `TRANSFER_ASSESSMENT_ENABLED` secret with the Management API, verify its absence, recheck the public flag and run affected requests again. If the function must roll back to old code after removal, restore the known non-sensitive legacy value before that old code is deployed; never restore any unrelated secret from an evidence log.

After staging passes, request the human owner's authorization for the exact reviewed commit to merge into `no_sign_up`. Verify the integrated artifacts on staging, then apply the same SQL and Edge artifacts to production in that order. Production acceptance requires public read/write-boundary checks, the affected assessment lifecycle, persisted result/history, configuration state, legacy-secret absence and fixture cleanup. Record each environment's versions, hashes, commands and results before marking this task complete.

Current blocker: the predecessor migration's hosted release is incomplete. No staging lease, new SQL application, Edge deployment, secret deletion, merge or production verification has occurred for this candidate. The remaining release trigger is predecessor completion followed by this candidate's CI/review, migration validation, staging acceptance and explicit merge authorization.
