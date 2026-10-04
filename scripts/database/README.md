# Database Export Helpers

Intent: identify the configured source and commands used to create disposable local migration baselines.

Updated: 2026-10-04
Repository baseline commit: `3c02349`.

From the repository root:

```sh
rtk proxy sh ./pd_dump.sh
rtk proxy sh ./scripts/database/pg_dump_roles.sh
```

`pd_dump.sh` delegates to `scripts/database/pg_dump.sh`. It overwrites `~/.transfer-assessment-pg17/phishingtutor.dump` with a custom-format export of `public` and `private`, including ownership and grants. The roles helper overwrites `~/.transfer-assessment-pg17/source-roles.sql` with role definitions and memberships but no password hashes. Both use `connection.sh` for the same PG17 client path, host, port, user, database, SSL mode, and password loading. No `MIGRATION_SOURCE_CONNECTION` variable is needed.

If `PGPASSWORD` is exported, it takes precedence. Otherwise, the helpers load the repository root `.env`, or `PG_DUMP_ENV_FILE` when provided. Source settings can be overridden with `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, and `PGSSLMODE`; `PGCLIENT_BIN_DIR` and `PG_DUMP_DIR` override the client and output directories. Keep credentials outside Git. The scripts return nonzero on exporter failure and print success only after the tool exits successfully.

Role export can be rejected by hosted database permissions. Such a failure blocks role-parity validation until the necessary metadata is obtained through read-only catalog access. The schema-filtered application dump excludes dependencies in other schemas. Check [the release workflow](../../tutor-system/claude_docs/supabase-release-workflow.md) before treating local migration tests as predictive of online application.
