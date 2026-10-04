# Database Migration Workflow Documentation Update

Intent: record the agreed process for refreshing disposable local data, testing database upgrades, and handing off online migration application to a human.

Date: 2026-09-28
Repository baseline commit: `b956cf1`.

## Changes

- Added the workflow now at `../supabase-release-workflow.md` with the PG17 cluster location, snapshot refresh sequence, complete-file SQL execution examples, required database dependencies, and migration test coverage.
- Added a progress record template that distinguishes local validation, human online application, and subsequent online verification.
- Linked the guide from `../README.md` and refreshed its intent and metadata.
- Expanded the guide after user feedback with direct/session connection setup, configured credential loading, additional-schema and full `pg_dump` exports, archive checks, disposable database reset commands, and an existing SQL catalog test command.
- Explained snapshot scope and the roles, extensions, and external services that a database export does not reproduce automatically.
- Clarified agent prerequisites: run the configured exporters without requesting connection details; stop and report helper errors.
- Corrected restores to preserve source ownership and grants. Added role metadata export/reconciliation, mandatory environment and baseline comparisons, migration executor parity, application-role assertions, and current-target preflight checks.
- Established blocked/failed statuses and concrete run-record locations. Local success requires all relevant validation gates; an online success percentage requires observed deployment outcomes.
- Made snapshot and restore command blocks stop on errors, defined role and database setup before restore, and expanded the run record into a resumable evidence package.
- Documented the human-only online handoff and target-project review.
- Clarified that isolated PostgreSQL is the default migration test environment. Version differences require an impact assessment, and Docker-backed Supabase requires an explicit user request.
- Removed snapshot-specific claims, fixed migration examples, and source-dependent setup SQL from the reusable workflow. Each run now derives these details from the current source and candidate migration.
- Replaced the fixed disposable database name and unconditional drop with a unique per-run database name after a local trial found the fixed name already in use.
- Clarified that migration SQL is written directly and validated against the isolated PostgreSQL database without a TDD phase.
- Aligned delivery with `AGENTS.md`: one pending script derived from the hosted schema, human execution in the Supabase website, and archival after confirmed success.
- Added a per-scenario gate to reapply and compare database ACLs and `ALTER DATABASE` settings after template-based creation and before migration execution.

## Evidence

Configured exporter refinement: `pd_dump.sh` now retains metadata flags and stops on exporter failure. The dedicated shell/process integration suite passes 6/6 cases, including overwrite, private new files, exported/default/alternate-file credentials, missing credentials, and exact child failure propagation. `sh -n pd_dump.sh` passes. Tests use a controlled local exporter and do not claim a live Supabase export.

Shared export helpers: `scripts/database/connection.sh` supplies one configured source to the application and role exporters; root `pd_dump.sh` delegates to the folder entry. The guide now uses those commands without `$MIGRATION_SOURCE_CONNECTION`. The dedicated shell/process suite passes 17/17 cases, including identical source settings, role-export arguments, default/alternate env files, permission metadata, overwrite, and failed exporter status. Shell syntax passes for all four scripts. No live snapshot or migration was run as part of this refinement.

The guide incorporates the user's disposable-data preference and the stated MCP permission boundary: a human must apply online migrations. Local path and port details come from the cluster's saved startup options; repository migration, configuration, helper, and SQL test files were inspected during the discussion.

Documentation refinement: reviewed the command and handoff paths against the configured helpers. The guide requires fail-fast exports/restores, role reconciliation before restore, unique per-run evidence, and human review of the target project and pending script. No online command, snapshot, restore, or migration was executed during that refinement.

This update documents a workflow. No database migration was executed as part of the documentation change, and no online application is claimed. Documentation links and patch whitespace were checked locally.

Local workflow trial on 2026-09-28: source PostgreSQL 17.4, isolated PostgreSQL 17.11, unique database `migration_trial_20260928_1255`. The configured application export (`bash ./pd_dump.sh`), role export (`sh ./scripts/database/pg_dump_roles.sh`), archive read (`pg_restore --file=/dev/null`), source-derived database creation and dependency setup, and transactional `pg_restore --clean --if-exists --exit-on-error --single-transaction` each exited 0 without Docker. The restored `public` and `private` schemas matched the source catalog counts for 18 tables, 62 indexes, 2 views, 23 functions, and 34 policies. Basic authenticated JWT-function and anon-read probes exited 0. No candidate migration or migration-specific assertions ran because none was present in the worktree. The trial database remains for inspection; no hosted write occurred.
