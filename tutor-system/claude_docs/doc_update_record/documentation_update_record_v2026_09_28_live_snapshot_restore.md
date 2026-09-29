# Database Migration Workflow Update

Intent: record the live snapshot and restore run and correct workflow steps exposed by it.

Date: 2026-09-28

## Changes

- The workflow now uses an isolated PG17 cluster because the shared cluster's roles differ from the source roles.
- The restore uses `--clean --if-exists --exit-on-error --single-transaction`, recreates the disposable database, and provisions the dump's `auth.uid()` and extension dependencies with source ACLs.
- The restore examples now use the isolated cluster for migration and catalog checks.

## Run Evidence

Evidence is stored outside Git at `/Users/admin/.transfer-assessment-pg17/runs/snapshot_restore/20260928T152940Z/run.md`.

- Fresh application dump and role export completed using the configured helpers.
- The first restore attempts exposed the pre-existing `public` schema and omitted `extensions` and `auth` dependencies; the resolved command restored the archive successfully.
- All 18 included application tables and 2,001 rows restored. The per-table row-count fingerprint matched the source query.
- Source/local catalog counts matched for 20 relations, 34 RLS policies, 87 constraints, and 62 indexes; migration-specific definition and ACL comparisons remain required.
- `auth.uid()` returned the expected UUID under `authenticated` with a JWT subject claim.
- The source is PostgreSQL 17.4; the isolated local server is 17.11. The source also has Supabase-managed extensions unavailable in this standalone cluster. Snapshot and restore passed, but migration validation remains blocked until applicable environment and catalog parity gates pass.
- Supabase MCP returned no migration-history entries. No candidate migration was applied locally or online.
