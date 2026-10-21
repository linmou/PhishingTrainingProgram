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

Role export can be rejected by hosted database permissions. Such a failure blocks role-parity validation until the necessary metadata is obtained through read-only catalog access. The schema-filtered application dump excludes dependencies in other schemas. Check [the release workflow](../../tutor-system/docs/supabase-release-workflow.md) before treating local migration tests as predictive of online application.

## Concurrent Agent Exports (No Docker)

For concurrent migration work **do not call fixed-path exporters directly**. From the repository root:

```sh
SNAPSHOT_DIR="$(sh ./scripts/database/export_validation_baseline.sh)"
export SNAPSHOT_DIR
(cd "$SNAPSHOT_DIR" && shasum -a 256 -c SHA256SUMS)
```

The wrapper invokes the same configured `pg_dump.sh` / `pg_dump_roles.sh` with `PG_DUMP_DIR` set to a unique private subdirectory of `~/.transfer-assessment-pg17/runs/`. Override the parent with `PG_VALIDATION_RUN_ROOT` when needed. Each successful export has a hash manifest and an `.exported` marker; a failure leaves `.incomplete`. The legacy exporters still overwrite fixed filenames and must be reserved for a single release owner when no other run depends on them.

An exported archive is **not yet a validated migration baseline**: compare source role/extension/ACL/database settings, prove that the archive restores successfully, and run Red/Green assertions as required by the release workflow. Source exports may contain sensitive user data; keep them out of Git and never share across unrelated Agent environments.
