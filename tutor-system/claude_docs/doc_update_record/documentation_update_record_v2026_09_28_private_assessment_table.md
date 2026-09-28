# Private Assessment Table Migration Record

Intent: record the isolated PostgreSQL validation and human handoff for the private assessment storage migration.

Date: 2026-09-28

## Migration

- Archived script: `tutor-system/supabase/archived_migrations/20260928000000_private_transfer_assessment_storage.sql`
- SHA-256: `cc23e87c413320c273d9d6913d6a81be6b0fbf7061a7de0602683e5c7130eabe`
- Repository HEAD during validation: `b956cf1`
- Scope: create `private.transfer_assessments` with RLS and service-role-only table grants; add nullable `messages.assessment_student_id`; revoke execution of the two obsolete key-dependent RPCs; delete the two approved test messages and their one dependent feedback row; drop `messages.assessment_key`.
- The source baseline contained only the two approved keyed test messages and no other transfer-assessment messages. No legacy-incomplete records needed reconciliation. The new private table is therefore empty after this migration; no key or explanation is fabricated.

## Baseline And Local Target

- Supabase project reference: `zgbufaxooqxeabewktzd`
- Source export time: 2026-09-28 13:07 EDT
- Source PostgreSQL: 17.4; source database and migration executor: `postgres`
- Application dump: `/Users/admin/.transfer-assessment-pg17/phishingtutor.dump`, SHA-256 `9104cd5ebd1b5445d19dc9dd2c7cbfb02c2f6a2ef5b918069451e43050f08a7c`
- Role export: `/Users/admin/.transfer-assessment-pg17/source-roles.sql`, SHA-256 `43c96b1f3876df027c77868083fd187057f3eedd2a1cef44ff6dead8e0002e81`
- Isolated server: `/Users/admin/.transfer-assessment-pg17/migration-validation`, port `55433`, PostgreSQL 17.11
- Restored baseline: `migration_validation_20260928_170652`; owner `supabase_admin`; UTF8 / ICU `en-US`
- Parity-matched local scenario clones: `private_assessment_failure_v2_20260928_175714`, `private_assessment_rollback_v2_20260928_175714`, and `private_assessment_success_v2_20260928_175714`
- Restore row counts match the source. Relevant schemas, RLS policies, functions, constraints, indexes, role flags/memberships/settings, extensions, `auth.uid()`, and database settings were compared; evidence is in `/Users/admin/.transfer-assessment-pg17/runs/private_assessment_table/20260928T170652Z/`.
- The final clone comparison reports matching database owner, encoding, locale/provider/collation version, ACL, and `app.settings.jwt_exp` in all three v2 scenario databases. The initial clones omitted database ACL/settings and were not accepted; their logs remain preserved as superseded evidence. Role attributes/settings match the source export.
- Remaining source/local environment differences: PostgreSQL 17.4 vs 17.11, ICU collation version 153.120 vs 153.136, and grantor metadata for some source role/database ACLs. The candidate relies on UUID equality/order, ordinary FK checks, JSONB, and fixed text checks; it performs no locale-dependent text ordering or collation-sensitive index work. Missing `pg_graphql` and `supabase_vault` are not referenced by the migration or assertions. Effective privileges and role attributes used by the migration were reproduced and exercised.

## Validation

- Success migration command, executed as `postgres` on `private_assessment_success_v2_20260928_175714`:
  `rtk proxy psql -h /Users/admin/.transfer-assessment-pg17/migration-validation/socket -p 55433 -U postgres -d private_assessment_success_v2_20260928_175714 -X -v ON_ERROR_STOP=1 -f tutor-system/supabase/migrations/20260928000000_private_transfer_assessment_storage.sql`
- Success migration exit: `0`; log: `/Users/admin/.transfer-assessment-pg17/runs/private_assessment_table/20260928T175714Z/success_migration_v2.log`
- Postcondition and `service_role` assertion script: `tutor-system/supabase/tests/private_transfer_assessment_storage_migration.sql`, SHA-256 `6516a14a63cfe7a0762cf1a7f53c809081999ce14b6ebfe0fb497a18295b45ed`; exit `0`. Valid insert/read/update/delete ran as `service_role` inside a transaction and rolled back. Invalid key shape, attempt count, required private fields, and terminal state each raised SQLSTATE `23514`; no test rows remained.
- Client-role checks: `anon` and `authenticated` each received SQLSTATE `42501` for direct private-table `SELECT` and `INSERT`; all four probes exited `1`, with no mutation. Logs end in `_v2.log` in the run directory above.
- Changed-data preflight on the v2 failure clone: one unrelated keyed message was injected. Migration exited `3` with `ASSESSMENT_TEST_FIXTURES_CHANGED`; follow-up assertions exited `0`, confirming three keyed messages remained, no new table/column appeared, and RPC grants remained. Migration log: `preflight_failure_migration_v2.log`; setup/assertion SQL: `preflight_failure_setup.sql`, `preflight_failure_assertions.sql`.
- Late DDL failure on the v2 rollback clone: a temporary view depending on `messages.assessment_key` forced `DROP COLUMN` to fail after cleanup. Migration exited `3`; follow-up rollback assertions exited `0`, confirming the new table/column were absent, both approved messages and the feedback row were restored, and RPC grants remained. Migration log: `late_failure_migration_v2.log`; setup/assertion SQL: `late_failure_setup.sql`, `late_failure_assertions.sql`.
- Final v2 commands, logs, and reproducible setup/assertion SQL are indexed in `/Users/admin/.transfer-assessment-pg17/runs/private_assessment_table/20260928T175714Z/commands-and-results.md`; baseline catalog and restore evidence is under `/Users/admin/.transfer-assessment-pg17/runs/private_assessment_table/20260928T170652Z/`.
- `rtk git diff --check` exited `0`.

## Status And Handoff

- Status: `applied online`; hosted post-application verification is pending.
- The user confirmed successful execution in the Supabase website on 2026-09-28. The exact execution time and operator identity were not provided. No independent hosted schema or data verification was run for this record update.
- The static migration test now reads the archived SQL file; `claude_docs/database-schema.md` describes the reported applied schema and removes the superseded pending-migration claims.
- The isolated PostgreSQL server remains running on port `55433`; scenario databases are retained as disposable evidence. The v2 rollback clone retains the dependent view used to trigger failure.
- This migration prepares private storage and removes the legacy public key field; the private table remains empty until the trusted delivery backend writes assessment rows. Full backend operations and hosted deployment gates are separate work.
