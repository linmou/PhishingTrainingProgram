# Staging Schema Bootstrap Update

Intent: record the schema-only production snapshot prepared to bring the empty staging database to the app's current schema.

Date: 2026-09-29

## Changes

- Filled the existing pending `20260929035556_remote_schema.sql` with current `public` and `private` schema definitions, without production rows.
- Removed `pg_dump` psql-only directives, made schema declarations safe when `public` already exists, and omitted `supabase_admin` default ACL statements that the `postgres` executor cannot change.
- Recorded that the live production assessment RPCs reference the absent `messages.assessment_key` column. This exact-schema sync does not fix that existing mismatch.

## Run Evidence

Full snapshot hashes, source/target metadata, local apply output, and permission checks are recorded outside Git at `/Users/admin/.transfer-assessment-pg17/runs/staging_schema_bootstrap/20260929T0745Z/run.md`.

The script applied successfully to both an isolated PostgreSQL 17 database and hosted staging (`ciubrzggdqesgvfkpolj`) on 2026-09-29. Independent hosted checks confirmed 17 public tables, 2 private tables, the question-message foreign key, and the absence of `messages.assessment_key`. The applied script is archived. Assessment E2E still requires the active Edge Function's missing v2/v4 routines; the production snapshot contains older routines.
