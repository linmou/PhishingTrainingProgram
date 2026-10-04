# Unified Room Progress V2

Intent: record the implementation evidence and database validation status for the shared room progress and single learner seat change.

Updated: 2026-10-04. Parent commit: `73c6e2d`. The implementation is validated locally and remains undeployed.

## Migration

- Pending SQL: `supabase/migrations/20261005000000_unified_room_progress.sql`
- SHA-256: `abc57d1336a8a632df1b16a5ba912d5ecb347db1a5a2fcf1fdd488edbb4ac7d1`
- Status: `local validation passed`; the migration applies successfully and the complete unified room progress SQL assertion rolls back cleanly after all checks pass.
- No staging or production deployment was performed.

## Hosted Baseline Review

- Projects reviewed: staging `ciubrzggdqesgvfkpolj` and production `zgbufaxooqxeabewktzd` are the repository's configured targets.
- Supabase MCP schema inspection confirmed `users`, `rooms`, `sessions`, `session_checklists`, `checklist_items`, `checklist_updates`, `private.learning_event_inbox`, and `private.transfer_assessments` exist with the expected legacy columns.
- The hosted schema has no `sessions_one_active_learner_per_room` index and no `join_room_v1` or `edit_room_checklist_v1` function, so this migration remains pending.

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
- Browser E2E was not run in this validation cycle; the checked-in `room-assessment-setup` workflow now creates a room, enables in-room assessment, and verifies target generation remains available.

## Next Release Gate

Apply the exact migration to staging first, verify the room join, shared checklist, observer read-only, tutor edit, assessment event, and cleanup scenarios, then repeat against production. Do not archive this migration until both hosted projects pass.
