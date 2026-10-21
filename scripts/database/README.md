# Database Export Helpers

Intent: identify the configured source and commands used to create disposable local migration baselines.

Updated: 2026-10-21
Repository baseline commit: `c2fe276` (PR #7 review fixes for connection isolation and allocation-time cancellation).

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

## Disposable Scenario Databases

After restoring and verifying a local baseline using the release workflow, run each scenario in its own database:

```sh
rtk proxy node scripts/database/disposable-database.js --template <verified-local-baseline> -- psql -X -v ON_ERROR_STOP=1 -f <scenario.sql>
```

The manager reuses the running validation cluster's Unix socket at `~/.transfer-assessment-pg17/migration-validation/socket`, port `55433`, bootstrap user `local_bootstrap`. It creates a random database, clones the selected baseline, reapplies effective database grants (including grant options), database and per-role database settings, and compares owner, locale, encoding, connection limit, grants and settings before starting the command. Roles and extension installations already belong to the shared cluster; the manager never changes global roles or starts a cluster. `PG_VALIDATION_HOST`, `PG_VALIDATION_PORT`, `PG_VALIDATION_USER` and `PG_VALIDATION_PSQL` can select an existing local validation connection. Network hosts are rejected.

The command receives `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `MIGRATION_TEST_DB` and `PG_VALIDATION_LEASE_FILE`. The manager and command discard inherited `PGHOSTADDR`, `PGSERVICE` and `PGSERVICEFILE` so libpq cannot redirect them away from the selected connection; the host must be one absolute socket directory, without comma-separated fallbacks. Cleanup runs after success, nonzero exit, spawn error, SIGINT or SIGTERM. Termination handling covers allocation: a signal received while synchronous PostgreSQL commands run is handled after allocation returns, before any scenario starts, then the owned database is removed. It checks the cluster identity, database identity and random ownership marker before dropping only the allocated database. Concurrent runs get distinct database names and private lease directories under `PG_VALIDATION_RUN_ROOT` (default `~/.transfer-assessment-pg17/runs`). Lease JSON retains source/clone metadata, command result and cleanup timestamps; failed runs retain errors.

After a hard kill or host crash, stop any surviving scenario command, then use the retained lease:

```sh
rtk proxy node scripts/database/disposable-database.js --cleanup <run-directory>/lease.json
```

Recovery refuses cleanup while the original owner PID is alive or ownership has changed. An interruption between database creation and its ownership comment leaves explicit allocation evidence and requires operator inspection; an unmarked database is never automatically removed. Never use a different run's lease. Clone parity proves equivalence to the selected **local** baseline; hosted snapshot/role/ACL/restore parity and migration executor/Red-Green checks remain required.

Offline checks run in PR CI. Run the opt-in integrated checks against the existing local cluster:

```sh
rtk proxy node --test scripts/database/disposable-database.test.js
rtk proxy env PG_DISPOSABLE_INTEGRATION=1 node --test scripts/database/disposable-database.integration.test.js
```

The integrated test creates its own small baseline and verifies simultaneous allocation, baseline data isolation, grant/settings parity, nonzero exits, command startup failure and signal cleanup. It also supplies conflicting libpq service/address settings and sends SIGINT/SIGTERM during allocation, checking the actual command target, unchanged baseline and cleanup before exit. It removes only its own databases and preserves lease evidence.
