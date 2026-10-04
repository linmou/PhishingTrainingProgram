# Supabase Release Workflow

Intent: validate database migrations and Edge Function changes locally, then release and verify them on staging before production.

Updated: 2026-10-03

## Local Database Setup

The local PostgreSQL clusters are under `/Users/admin/.transfer-assessment-pg17/`:

| Item | Location or value |
| --- | --- |
| Shared cluster | `data/`, socket `socket/`, port `55432`, log `server.log` |
| Isolated validation cluster | `migration-validation/data/`, socket `migration-validation/socket/`, port `55433`, log `migration-validation/server.log` |
| Custom-format dump output | `phishingtutor.dump` |

The shared cluster may contain unrelated databases and roles. Use the isolated cluster for validation. The dump name does not establish the database name; inspect its archive header before choosing a target. Replace the dump with a fresh export before each run.

Check `supabase/config.toml` and the target database for their current PostgreSQL versions. The Supabase CLI's Docker-backed stack is separate from this custom cluster and is not required for local SQL validation. Use a fresh hosted export as the local baseline.

## Upgrade Sequence

1. **Inspect online state.** Use Supabase MCP to inspect staging (`ciubrzggdqesgvfkpolj`) and production (`zgbufaxooqxeabewktzd`), including migration history and relevant tables, constraints, functions, roles, extensions, and policies. Resolve material differences before applying the same script to both.
2. **Capture the baseline.** Run the configured `pd_dump.sh` and `scripts/database/pg_dump_roles.sh`; both load the same connection settings. Inspect whether the archive includes every dependency of the changed objects. Obtain additional schema exports through the configured connection when needed. MCP schema inspection is not itself a restorable snapshot.
3. **Refresh locally.** Create a new disposable database for each scenario. Reapply and verify its source database ACLs and `ALTER DATABASE` settings, then restore source ownership, grants, policies, data, and dependencies. Pass the baseline comparison below before applying a candidate migration. Resolve missing dependencies in the local setup; incomplete setup blocks validation.
4. **Establish Red, then implement.** Keep at most one pending SQL file under `supabase/migrations/`. Write behavior and permission assertions for the requested change, run them against a disposable database restored from the unmodified hosted baseline, and record the expected missing-behavior failure. Write the candidate migration from the current hosted schema and requirements, not from local or archived migration files. Follow this Red-Green sequence without invoking the `fast-multi-agent-tdd` skill.
5. **Validate Green locally.** Apply the exact candidate SQL to a fresh disposable baseline under the online migration executor's role and transaction strategy. Rerun the same assertions under the actual application roles, including relevant edge cases and unaffected behavior. Repeat from the same baseline for success and failure scenarios. Record commands, exit codes, assertions, and resulting catalog changes. A parser or `EXPLAIN` check alone is not a migration test.
6. **Apply and test on staging.** Recheck staging preconditions, apply the exact tested SQL through a verified Supabase MCP or Management API project connection, and verify schema, permissions, RPC behavior, and the matching application or Edge Function workflow. Stop on a failed check.
7. **Apply and verify on production.** Recheck production preconditions and compare them with the tested baseline. Refresh and retest if they changed materially. Apply the same SQL through a verified project connection, verify schema, permissions, and behavior, then archive the script only after both projects are verified.

Local snapshots do not need to be retained after the cycle. Keep baseline metadata and test evidence in the migration record so the result can still be understood. Credentials and exported user data belong outside Git.

## Edge Function Release

Use this sequence for an Edge Function change. If it needs SQL, complete the local Red-Green checks in the upgrade sequence above first. For an Edge-only change, start with the function tests; there is no SQL migration to apply or archive.

1. **Test locally.** Run the changed Edge Function's Deno tests, including request validation, permission boundaries, provider failure, and the affected database contract. Record the command and result. Mocked provider tests do not replace a live provider check.
2. **Release to staging.** Apply and verify any required SQL on staging first. Check that the function's required Edge secrets are configured without recording their values. Deploy the function to staging using an API-based path that does not start Docker, then run the relevant database assertions and live application or browser workflow against staging. Confirm expected function responses, provider-attempt outcome, visible application result, and test-data cleanup. Stop and fix failures before production.
3. **Release to production.** Recheck schema and required Edge secret names. Apply and verify the same SQL on production if needed, then deploy the same function source there. Run the matching live workflow against a dedicated test fixture and verify its cleanup. A successful deployment or HTTP response alone does not establish that the workflow passed.
4. **Record and close.** Record both project refs, SQL hash when applicable, function version or hash, test commands and results, provider and application evidence, cleanup results, and any failures and reruns in a dated `claude_docs/doc_update_record/` file. Archive the SQL only after both projects pass. Keep browser setup and commands in [browser-e2e-testing.md](browser-e2e-testing.md).

## Acceptance Gates

Every gate must pass before applying a migration to staging or production:

| Gate | Evidence required |
| --- | --- |
| Environment | Record target and local PostgreSQL versions, encoding/collation, relevant extension versions/settings, schemas, roles, role attributes/memberships, and migration executor. Reproduce migration-relevant behavior; justify any difference shown to be immaterial to the candidate SQL and its tests |
| Scenario database | For every database created from a template, reapply source database grants and `ALTER DATABASE` settings, then compare its ACLs and database-level role settings with the source before applying any migration |
| Baseline | Restored ownership, grants/default grants, RLS policies, function definitions, constraints, indexes, and required source data match the target snapshot |
| Execution | The exact SQL succeeds under the intended executor and transaction strategy; a failed step stops the cycle |
| Behavior | Required positive, negative, permission, rollback, and concurrency assertions pass under the relevant roles |
| Current target | Staging and production schema and data preconditions are checked before each application; material differences are resolved before the same SQL is used |

Treat missing parity evidence as `local setup blocked`, not a passing test. Preserve restore errors and resolve their causes. Tests must exercise the same SQL and permission boundary that online execution will use.

The intended outcome is high predictive confidence. A measured 99% success rate requires records of actual online applications; local testing alone cannot establish that percentage. Concurrent writes, lock contention, resource limits, and hosted platform changes between the snapshot and application remain factors to check at deployment.

## Create a Fresh Snapshot

### Agent Prerequisites

Use the repository's configured exporters. `pd_dump.sh` writes `/Users/admin/.transfer-assessment-pg17/phishingtutor.dump`; `scripts/database/pg_dump_roles.sh` writes `/Users/admin/.transfer-assessment-pg17/source-roles.sql`. Both use `scripts/database/connection.sh` and its existing credentials. Run them from the repository root without requesting connection details again. Replacing both local outputs each cycle is expected.

```sh
set -eu
export PG_DUMP_DIR=/Users/admin/.transfer-assessment-pg17
rtk proxy bash ./pd_dump.sh
rtk proxy pg_restore --list /Users/admin/.transfer-assessment-pg17/phishingtutor.dump
rtk proxy pg_restore --file=/dev/null /Users/admin/.transfer-assessment-pg17/phishingtutor.dump
rtk proxy shasum -a 256 /Users/admin/.transfer-assessment-pg17/phishingtutor.dump
```

Export and hash roles separately so a hosted role-export restriction does not hide a successful application dump:

```sh
set -eu
export PG_DUMP_DIR=/Users/admin/.transfer-assessment-pg17
rtk proxy sh ./scripts/database/pg_dump_roles.sh
rtk proxy shasum -a 256 /Users/admin/.transfer-assessment-pg17/source-roles.sql
```

The application dump must pass archive checks and an actual restore. If role export is denied, use the authorized catalog fallback below and keep role parity blocked until it is established. Read configuration without exposing passwords or connection strings containing credentials in logs or replies.

If `pd_dump.sh` fails, stop and report its status and error; do not use an existing archive. Do not request connection details or substitute another source when using the configured helpers. Use a human-provided dump only if the application exporter cannot be used.

The configured helpers use `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGSSLMODE`, and `PGPASSWORD`. `PG_DUMP_ENV_FILE` selects another credential/configuration file; `PGCLIENT_BIN_DIR` and `PG_DUMP_DIR` select the client and output directories.

### Manual Export Commands

Use manual export commands only when extending the configured public/private export to cover additional dependencies.

Use direct or session mode for dumps, not the transaction pooler. Inspect `scripts/database/connection.sh` for the configured connection mode and values without exposing credentials.

The HTTP Supabase URL, anon key, and MCP access do not supply the PostgreSQL password. The configured helpers load it from `PGPASSWORD` or the selected local env file. Do not put it in commands or evidence logs.

For an additional export, source the same configured connection, then invoke the configured PostgreSQL client:

```sh
set -eu
DATABASE_DIR="$PWD/scripts/database"
. "$DATABASE_DIR/connection.sh"
rtk proxy "$PGCLIENT_BIN_DIR/pg_dump" --version
rtk proxy "$PGCLIENT_BIN_DIR/psql" -w -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -v ON_ERROR_STOP=1 -c 'SELECT current_database(), current_user, version();'
```

To export an additional schema, adapt the schema filters while keeping the configured source. This example writes a separate custom-format archive; it does not replace the application's snapshot:

```sh
set -eu
rtk proxy "$PGCLIENT_BIN_DIR/pg_dump" -w -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" --format=custom --schema=extensions --file=/Users/admin/.transfer-assessment-pg17/extra-schema.dump
rtk proxy pg_restore --list /Users/admin/.transfer-assessment-pg17/extra-schema.dump
rtk proxy date -u '+%Y-%m-%dT%H:%M:%SZ'
```

Record the export time, archive hash, target project, server version, and any migration history observed through MCP. `pg_dump` captures a consistent database snapshot. Repeat the export if its baseline no longer matches the intended migration starting point; never test against a failed export.

Schema filters do not automatically include dependencies outside those schemas. Inspect the export helper's filters and the affected objects' dependency chain, then export or reproduce the referenced schemas, functions, extensions, and settings. Required dependencies must match before validation can pass. Preserve the source grants and ownership in the archive and restore.

For a full logical database export, omit the schema filters:

```sh
rtk proxy "$PGCLIENT_BIN_DIR/pg_dump" -w -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" --format=custom --file=/Users/admin/.transfer-assessment-pg17/supabase-full.dump
```

This full export still excludes cluster-wide role definitions, external Storage files, and Edge Function deployments. Restore only the Supabase-managed schemas, roles, and extensions needed by the candidate migration and its tests in the isolated cluster. Choose the export scope based on those dependencies and record that scope with the results.

### Roles and Baseline Comparison

The earlier export writes cluster role definitions and memberships without passwords. Treat `source-roles.sql` as input, not as a replay-ready local script. Compare it with the disposable cluster, then write `local-role-setup.sql` containing needed source-equivalent roles, attributes, settings, and memberships without duplicates or unrelated managed roles. Use catalog fallback only for permission denial; resolve other export errors first. Capture `pg_roles`, `pg_auth_members` (including grant options), `pg_db_role_setting`, and relevant database settings through authorized read-only access. If any relevant role cannot be reproduced, stop with `local setup blocked`.

Use a separate local bootstrap administrator to apply role setup and restore the dump. Run migrations and application assertions under the source-equivalent executor and application roles, including relevant `SUPERUSER`, `BYPASSRLS`, `INHERIT`, memberships, and settings.

Before migration execution, capture comparable source and local catalogs for the affected objects and dependencies: PostgreSQL/extension versions, database owner/encoding/locale/ACL/settings, role settings, schema and object owners/ACLs, `pg_default_acl`, `pg_policies`, RLS flags, function definitions/security settings, constraints, and indexes. Compare row counts and migration-specific data preconditions against the exported baseline. Save queries, results, and differences in the run record. Resolve every migration-relevant difference before proceeding.

Use the isolated PostgreSQL cluster by default. A PostgreSQL or extension version difference alone does not require another environment: record the difference and explain, with evidence, why it does not affect the candidate migration's execution, catalog result, permissions, data behavior, or test assertions. If that impact cannot be ruled out, or a required dependency cannot be reproduced, record `local setup blocked` with the specific gap. Start a Docker-backed Supabase environment only when the user explicitly requests it; do not infer that request from a version mismatch or this workflow.

## Restore and Apply Locally

Initialize the isolated cluster once. Its Unix socket accepts local connections; TCP connections are rejected:

```sh
set -eu
rtk proxy mkdir -p /Users/admin/.transfer-assessment-pg17/migration-validation/socket
rtk proxy initdb -D /Users/admin/.transfer-assessment-pg17/migration-validation/data --username=local_bootstrap --encoding=UTF8 --locale-provider=icu --icu-locale=en-US --auth-local=trust --auth-host=reject
rtk proxy pg_ctl -D /Users/admin/.transfer-assessment-pg17/migration-validation/data -l /Users/admin/.transfer-assessment-pg17/migration-validation/server.log -o "-k /Users/admin/.transfer-assessment-pg17/migration-validation/socket -p 55433" start
```

After initialization, provision roles from the current role export. Reconcile them again when source role metadata changes:

```sh
set -eu
rtk proxy psql -h /Users/admin/.transfer-assessment-pg17/migration-validation/socket -p 55433 -U local_bootstrap -d postgres -X -v ON_ERROR_STOP=1 -f /Users/admin/.transfer-assessment-pg17/migration-validation/local-role-setup.sql
```

On later runs, start the cluster only if it is stopped:

```sh
rtk proxy pg_ctl -D /Users/admin/.transfer-assessment-pg17/migration-validation/data -l /Users/admin/.transfer-assessment-pg17/migration-validation/server.log -o "-k /Users/admin/.transfer-assessment-pg17/migration-validation/socket -p 55433" start
```

Create a new database with a unique run-specific name for each scenario. If the name already exists, choose another; do not drop an existing database to make room. Derive the `createdb` owner, encoding, and locale options from the source database catalog and record the exact command used. A template does not supply the source database's grants or `ALTER DATABASE` settings. Generate `local-database-setup.sql` for that database name from the source database ACLs and settings, and apply it after creation. Keep `MIGRATION_TEST_DB` set in the shell used for the later commands:

```sh
set -eu
export MIGRATION_TEST_DB="migration_test_$(rtk proxy date -u +%Y%m%d_%H%M%S)"
rtk proxy createdb -h /Users/admin/.transfer-assessment-pg17/migration-validation/socket -p 55433 -U local_bootstrap --template=template0 "$MIGRATION_TEST_DB"
rtk proxy psql -h /Users/admin/.transfer-assessment-pg17/migration-validation/socket -p 55433 -U local_bootstrap -d postgres -X -v ON_ERROR_STOP=1 -f /Users/admin/.transfer-assessment-pg17/migration-validation/local-database-setup.sql
```

Add the source-derived owner, encoding, and locale options to `createdb` before running this example; a default that differs from the source fails the baseline comparison. For each new scenario database, compare effective database grants by role and privilege and `pg_db_role_setting` values by role name with the source after running `local-database-setup.sql`; raw object IDs are not comparable across clusters. Resolve missing grants or settings and save the comparison before restoring or applying any migration.

Inspect the fresh source and dump for dependencies outside the exported schemas. Create a run-specific SQL file with only the required schemas, extensions, functions, and grants, using definitions and versions observed from the source. Apply it before restoring and save the file and command result in the run record.

Restore as the local bootstrap administrator. `--clean --if-exists` handles the `public` schema created by `template0`; `--single-transaction` ensures a failed restore leaves no partial application schema:

```sh
set -eu
rtk proxy pg_restore --clean --if-exists --exit-on-error --single-transaction -h /Users/admin/.transfer-assessment-pg17/migration-validation/socket -p 55433 -U local_bootstrap -d "$MIGRATION_TEST_DB" /Users/admin/.transfer-assessment-pg17/phishingtutor.dump
```

To refresh from a new snapshot or repeat a scenario, create another unique database, reapply and verify its database ACLs and `ALTER DATABASE` settings, then repeat dependency setup before restoring. Preserve extension schema grants and function ACLs from the source. Execute commands sequentially and stop on any nonzero exit status. A successful restore is not migration-ready until the baseline comparison passes.

Confirm the online executor and transaction strategy through MCP. Set `MIGRATION_EXECUTOR` to that role and `MIGRATION_FILE` to the candidate SQL file. Use this command when the migration should run in one transaction:

```sh
rtk proxy psql -h /Users/admin/.transfer-assessment-pg17/migration-validation/socket -p 55433 -U "$MIGRATION_EXECUTOR" -d "$MIGRATION_TEST_DB" -X -v ON_ERROR_STOP=1 --single-transaction -f "$MIGRATION_FILE"
```

Run this command from the repository root. For a migration that already contains `BEGIN` and `COMMIT`, use its own transaction boundaries instead of `--single-transaction`. Statements such as `CREATE INDEX CONCURRENTLY` require a separate execution approach because they cannot run inside a transaction block.

Execute complete SQL files with `psql -f`; splitting SQL on semicolons breaks function bodies and `DO` blocks. Put test `DO $$ ... $$` blocks in SQL files as well: double-quoted shell arguments can expand `$$` to the shell process ID.

Run the SQL assertions relevant to the candidate after applying it to the restored hosted baseline. Catalog checks supplement behavioral, permission, and concurrency tests.

## Hosted Application

Prefer Supabase MCP for hosted application when it targets the intended project and has DDL permission. If it cannot select that project or lacks DDL permission, use the authenticated Supabase Management API with the explicit project ref and exact SQL file. Confirm the project ID, current schema, and tested script hash before each execution. If neither route can reach staging, stop rather than applying to production first. Apply to staging first, then run database and application tests against staging. A dependent Edge Function must be deployed to staging only after its SQL is applied there. Stop if the migration or any required staging test fails; inspect the hosted state and revise and retest the pending script before another attempt.

After staging passes, recheck production against the tested preconditions and apply the same script there. Verify the resulting objects, permissions, and behavior. Deploy a dependent Edge Function to production only after the SQL is applied there. Record the MCP or Management API operation and result for each project. An observed SQL execution does not by itself establish a Supabase CLI migration-history entry; report one only if observed. Move the script to `supabase/archived_migrations/` after both projects are verified.

## Test Coverage

Migration tests must execute against local PostgreSQL with the target dependencies. Run the same assertions before and after applying the migration to separate disposable databases, recording the expected Red failure and Green pass. Test schema changes, existing data, RPC behavior, constraints, permissions, and failure atomicity as applicable. Mocked frontend tests and `EXPLAIN` do not establish that SQL migrations work. Rerun the relevant database assertions and an integrated application or Edge Function workflow on staging before any production application.

Execute permission assertions under the actual `anon`, `authenticated`, and `service_role` roles as applicable, with the same JWT claim settings used by Supabase SQL functions. Assert both permitted and forbidden operations, including SQLSTATE and absence of unintended mutations. Privileged catalog assertions supplement these tests. Generate migration-specific setup and assertion SQL files and run them with `psql -X -v ON_ERROR_STOP=1 -f`; record every command and result. For concurrency scenarios, identify the participating sessions, enforce their ordering, and check the final committed state.

Standalone PostgreSQL needs the relevant Supabase roles, schemas, functions, and extensions for equivalent SQL behavior. When the migration or its required assertions depend on Auth, REST APIs, Storage, Realtime, or Edge Functions, test those interactions with the corresponding services; if they are unavailable, record the specific untested dependency as `local setup blocked`. Frontend unit tests remain useful alongside database tests.

Derive success, failure, and unaffected-row scenarios from the candidate migration's intended behavior. Use valid fixtures so unrelated constraints cannot masquerade as the intended assertion. Roll back test mutations or recreate the disposable database between scenarios. Inspect any relevant SQL files under `supabase/tests/` for setup requirements; tests split across multiple database sessions need their prescribed ordering and concurrent execution.

## Migration Progress Record

The agent must write `claude_docs/doc_update_record/documentation_update_record_vYYYY_MM_DD_<migration_name>.md` for each upgrade and link evidence under `/Users/admin/.transfer-assessment-pg17/runs/<migration_name>/<run_id>/`. Use a unique run ID and keep the current dump at its configured path until the run closes; it may then be replaced.

| Field | Required content |
| --- | --- |
| Migration | Pending SQL filename and tested Git commit or file hash, identical for staging and production |
| Baseline | Staging and production project IDs, export time, PostgreSQL versions, relevant schema comparison, and observed migration history |
| Local target | Cluster, port, database name for each scenario, migration executor, provisioned dependencies, database ACL and `ALTER DATABASE` settings comparison, baseline comparison and resolved differences |
| Intended change | Affected schema objects, data transformations, permissions, and preconditions |
| Resume package | Dump/role-export paths and hashes; role/database setup SQL; restore log and catalog comparison; migration/test SQL; command logs with exit codes; assertions with expected/observed results; exact next action or blocker |
| Status | `draft`, `local setup blocked`, `local testing`, `local tests failed`, `local tests passed`, `staging applied`, `staging verified`, `production applied`, or `production verified` |
| Hosted application | MCP or Management API operation, project ID, script hash, time, execution result, and errors for each project |
| Hosted verification | Staging and production inspection times, observed objects/permissions, behavior tests, and remaining issues |

Keep the resume package outside Git and omit credentials and unnecessary row data. Report `local tests passed` only after all local gates pass. Record separate staging and production application and verification states. Archive only after production is verified, and record the archived path and actual outcomes so predictive accuracy can be measured.
