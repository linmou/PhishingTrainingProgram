# Intent
Record the one-student-per-room capacity enforcement and its verification evidence.

## Date
- 2026-09-27

## Scope
- Documented the active student session limit, observer exclusion, and duplicate-data preflight in `claude_docs/database-schema.md`.
- Added the partial unique index migration and updated StudentView occupancy, re-entry, and join-conflict behavior.
- Updated room-list mocks and feature examples to use current session rows and room labels.

## Evidence
- Focused UI regression: 4 suites passed, 29 tests passed.
- Production build exited 0 with existing dependency source-map and lint warnings.
- Native PostgreSQL 17.11 scratch database accepted the clean migration and enforced one active student per room; null-student and completed sessions remained insertable.
- Duplicate occupancy migration preflight exited with SQLSTATE `23505`; the two duplicate rows remained and no unique index was created.
- `npx tsc --noEmit` remains red on repository-wide diagnostics; no diagnostics point to the changed StudentView or test files.

## Limitations
- No migration was run against live Supabase.
