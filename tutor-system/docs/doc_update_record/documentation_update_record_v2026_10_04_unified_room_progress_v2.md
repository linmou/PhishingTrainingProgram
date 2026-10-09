# Unified Room Progress V2

Intent: record the implementation evidence and database validation status for the shared room progress and single learner seat change.

Updated: 2026-10-04. Implementation commit: `3573cea`. The migration and assessment API are deployed to staging and production.

## Migration

- Pending SQL: `supabase/migrations/20261005000000_unified_room_progress.sql`
- SHA-256: `abc57d1336a8a632df1b16a5ba912d5ecb347db1a5a2fcf1fdd488edbb4ac7d1`
- Status: staging and production applied successfully; the complete unified room progress SQL assertion passed on both hosted projects.
- Staging and production `assessment-api` deployments passed smoke validation. Staging version: `50`, hash: `d015ce1735c39936aaa0cc4f0de37e9e86946b5ada3e7a6df341a02cf4f2cd61`. Production version: `8`, hash: `93c6d3ee11c81de0bc7c9a9d5771e87d809b4dcb9dd41715eaca76ae82b88a2f`.

## Hosted Baseline Review

- Projects reviewed: staging `ciubrzggdqesgvfkpolj` and production `zgbufaxooqxeabewktzd` are the repository's configured targets.
- Supabase MCP schema inspection confirmed `users`, `rooms`, `sessions`, `session_checklists`, `checklist_items`, `checklist_updates`, `private.learning_event_inbox`, and `private.transfer_assessments` exist with the expected legacy columns.
- Hosted verification confirmed `sessions_one_active_learner_per_room`, `join_room_v1`, `edit_room_checklist_v1`, `initialize_transfer_checklist_v1`, and `apply_learning_event_v1` on both projects.

## Local Validation

- Cluster: `/Users/admin/.transfer-assessment-pg17/migration-validation/`, PostgreSQL 17.11, socket port 55433.
- Baseline template: `direct_status_green_20261004_01`.
- Disposable databases: `unified_room_progress_20261004_01` through `_05`; `_05` was the final candidate run.
- The exact migration applied to `_05` with `BEGIN`, index creation, four function replacements, grants, and `COMMIT` completing successfully.
- Function ownership was aligned to the local `postgres` definer for the SQL assertion run.
- `supabase/tests/unified_room_progress.sql` passed on `unified_room_progress_20261004_05` with `BEGIN`, `DO`, and `ROLLBACK`. The run covered room-seat arbitration, observer write denial, shared checklist initialization, tutor edits, assessment events, actor history, Guard mode, assessment-off evidence, and idempotent migration behavior.

## Application Verification

- Focused local regression: 23 tests passed.
- Room-context transfer regressions: 40 tests passed.
- Production build: passed with existing ESLint warnings.
- Full Jest suite: 113 suites passed, 26 failed, and 7 skipped. Remaining failures are unrelated storage, image-upload, room-discovery, provider, and environment/mock suites; the room-context failures caused by an unsupported feedback mock were made non-fatal and then passed.
- Staging browser E2E `room-assessment-setup` passed at `tmp/browser_demo_runs/staging-template-20261004233302-b1dba8ad`, including room creation, assessment enablement, existing checklist promotion, learner assessment delivery, observer read-only behavior, and cleanup.

## Next Release Gate

Release gate complete: staging and production migration assertions passed, hosted functions were verified, the assessment API smoke envelope was correct in both environments, and the staging browser workflow passed with cleanup.
