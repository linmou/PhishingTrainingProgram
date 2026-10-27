# Supabase Release Workflow

Intent: match verification cost to changed behavior, verify integrated releases on staging, and promote committed batches to production with evidence.

Updated: 2026-10-27. Release repair and PR approval policy baseline commit: `dec7c27`.

## Task Completion

[Mandatory Server Delivery](../../AGENTS.md#mandatory-server-delivery) makes this workflow part of every Supabase server behavior change, including Edge-only changes and inherited dependencies. Record the changed behavior, verification scope and release acceptance criteria before implementation. Ordinary features may accumulate after staging verification; production verification remains required for completion unless the user explicitly sets a narrower endpoint.

Use the existing dated release record to track the following evidence for the exact SQL and function source being delivered:

| Stage | Evidence required to advance |
| --- | --- |
| Local validation | Applicable function/domain tests and SQL behavior/permission tests pass against the required baseline; commands and results are recorded |
| Staging deployed | Project ref, application time, exact SQL hash when applicable, and deployed function version/source hash are recorded; SQL dependencies are verified before dependent functions deploy |
| Staging verified | The selected live application/API/browser checks pass; relevant provider results, persisted state and fixture cleanup are recorded |
| Awaiting production release | Batch name, member changes, release owner, merge status, exact artifacts, outstanding checks and release trigger are recorded; feature production acceptance stays open |
| Integrated release verified | Deployable changes and dependencies are merged into `no_sign_up`; release commit and artifact manifest are recorded; staging evidence is valid for those integrated artifacts |
| Production deployed | Production preconditions are rechecked and the same tested SQL/function source is applied; resulting versions are recorded |
| Production verified | The selected production checks and cleanup pass for the exact promoted batch; final state and evidence are recorded |

Report `staging verified — awaiting production release` when a feature is waiting for its recorded batch. Mark it complete only after every applicable release stage passes. A failed stage blocks promotion; record the failure, correct it and rerun affected checks. An external blocker remains incomplete with its exact action, evidence and next step recorded. Preserve failed runs when a rerun passes; a passing rerun alone does not establish that an intermittent failure was fixed. Record any user-directed narrower endpoint.

### Failure repair loop

The named release owner continues automatically within recorded authorization: detect failure → preserve evidence and inspect the exact environment/artifacts → diagnose → repair → run affected local checks → verify on staging → merge under the PR policy → promote the exact integrated artifacts → verify production and cleanup. Reporting the failure is an intermediate update. CI, review and staging defects return to the current PR. A production defect gets a corrective PR linked to the original release; the failure does not authorize editing production from an unmerged worktree. Harness repairs retain failed evidence and must preserve the acceptance contract.

At each transition, update the existing release record and PR with deployed versions, application versus acceptance status, failure/report path, current owner and next action. A resumed agent reads that record, checks for another active owner/lease, and reconciles it with current target evidence before continuing. SQL applied, catalog correct and production verified are distinct states. Once acceptance and cleanup pass, archive the exact SQL, update release/PR evidence and close resolved issues before reporting completion.

Pause only for an explicit user pause or a concrete access, external-service, coordination or human-decision blocker. Investigate and attempt available remedies first; do not repeatedly retry the same failed action without new evidence. Leave a named owner, exact blocker, attempts and concrete resumption action. Material decisions go to the corrective PR under the [PR approval policy](../../.github/pr-approval-policy.md); routine repairs do not require renewed permission. These instructions govern the active agent, not a persistent GitHub repair worker.

## Multi-Agent Verification and Shared Resource Ownership

For concurrent coding agents, run deterministic tests in parallel but explicitly own or serialize all mutable shared resources. Root `AGENTS.md` links the verification entry points, prohibits Docker, and requires reuse of the existing PostgreSQL validation cluster.

- **Worktrees and files:** each Agent owns an isolated worktree/branch and unique temporary/evidence directories. One run must not delete another run's files.
- **Database validation:** reuse the local validation cluster (port `55433`), allocating disposable databases per concurrent SQL test run rather than a new cluster/container per Agent. Use [disposable-database.js](../../scripts/database/README.md#disposable-scenario-databases) with an explicitly verified local baseline for automatic allocation, database ACL/settings parity and ownership-checked cleanup. Do not bypass hosted baseline, role, ACL, executor or Red/Green parity checks.
- **Snapshots:** use the root `scripts/database/export_validation_baseline.sh` wrapper for parallel work to avoid clobbering fixed dump/role-export filenames. Record its private run path and hashes. The legacy exporter is single-owner only, and source dumps can contain real user data.
- **Browser E2E:** the entrypoint holds both its same-host fixture lock and the [cross-machine project lease](agent-coordination.md) through cleanup. Fixed fixtures are serialized across machines; distinct room IDs do not isolate shared code.
- **Staging code/schema:** do not allow individual coding Agents to deploy their private candidate branches to the shared staging project while other Agents are verifying. The named release owner must acquire the same project lease for SQL, Edge, secrets and acceptance checks, including direct MCP/Management API work. The deployment workflow and local assessment deployer take that lease; Actions concurrency remains an additional guard. Record deployed source hashes and invalidate affected evidence after changes. Raw clients with write credentials can bypass the protocol and must not be used outside the owned lease.
- **Production:** PR verification runs do not deploy production. The existing production release owner and acceptance gates apply to authorized releases, not independent feature verification runs.

After combining PRs, verify the **combined** SQL/Edge/frontend artifacts and affected journeys, since individually passing PR tests do not prove compatibility. Keep at most one pending migration in `tutor-system/supabase/migrations/` and one candidate in the shared staging deployment queue. Order and revalidate interdependent migrations before any promotion.

## Verification Scope

Select checks from observable behavior, consumer contracts and affected dependencies, rather than lines changed or feature count. Record the selection and why it covers the change in the task/release record. When several rows apply, take their combined scope. If the affected scope is uncertain, broaden verification.

| Change | Local and staging acceptance | Production acceptance |
| --- | --- | --- |
| Documentation or tests only | Relevant document/harness checks | No deployment required |
| Isolated UI behavior | Focused component tests and the affected staging browser interaction | Affected browser smoke check when the frontend is released |
| Server behavior within an existing contract | Focused deterministic unit/integration tests, failure cases and affected live staging API/application check | Affected behavior, persisted result and cleanup |
| Eligibility, grading, lifecycle, identity or permissions | Relevant deterministic lifecycle/permission cases and full affected staging journey | Full affected live journey and permission/state assertions |
| Database migration | Fresh-baseline Red/Green migration, existing-data, permission and atomicity checks; affected staging API/application journey | Recheck baseline/preconditions, apply exact SQL, verify objects/permissions/data and affected live journey |
| Interacting changes or shared orchestration | Combined integration checks and complete affected staging journeys across changed components | Combined affected journeys; run the broader workflow suite if shared behavior cannot be isolated |

Use controlled provider responses for routine branching, retries, gates and lifecycle regressions. Use real-provider checks when provider requests, prompts, decoding or model behavior change, and for lifecycle journeys that depend on the provider. Add relevant semantic evaluation cases when learner judgments or tutoring behavior change; transport/schema tests alone cannot validate those judgments. Display-copy changes with unchanged behavior may use focused UI checks. Full-inventory real-model E2E is required when target scheduling or cooperation across targets changes; it is not the default for unrelated edits. Select existing commands/workflows in [browser-e2e-testing.md](browser-e2e-testing.md#select-the-release-checks).

Reuse successful evidence for unchanged artifacts and dependencies within the batch. Before promotion, recheck deployed source, configuration and relevant database preconditions. Any relevant change invalidates the corresponding evidence and requires rerunning those checks. Do not repeat broad unchanged suites solely because another independent feature was added.

## Production Batches

Use a dated release record under `docs/doc_update_record/` for each active batch. Record its member task/commit IDs, release owner, merge status and integrated release commit, changed contracts, combined verification scope, exact SQL/function/frontend artifacts, staging evidence, outstanding production checks and concrete release trigger. Ordinary features may wait only with this record and open production acceptance criteria; an unspecified future release is not a handoff.

Release when the named batch passes the [merge-before-production gate](#merge-before-production) and its integrated features and dependencies are verified together on staging. This is the default trigger, without a fixed feature-count threshold; record a user-requested milestone or schedule when applicable. At promotion, deploy the frozen artifacts, preserving unrelated production configuration/data. Recheck target preconditions, including production fixes made while the batch waited. Do not copy a staging database wholesale or treat a different per-project Edge version counter as source divergence.

Production incident fixes, security fixes and explicit release requests follow the same integration and staging gates promptly. A change that requires coordinated SQL, Edge and frontend rollout must ship those dependencies together in the required order. A failed member blocks the batch; narrowing the batch requires verifying that the remaining artifact set is independently deployable and rerunning affected checks. Keep at most one pending migration in `tutor-system/supabase/migrations/` and one candidate in the shared staging deployment queue. Release the pending migration before introducing another; validate combined order and dependencies before release. Preserve staged SQL hashes and archive only after production verification.

The release record's production evidence closes acceptance for each included feature. Until then, those features remain staging-verified and awaiting release. These rules govern agent execution; existing browser commands remain manually invoked.

## Merge Before Production

This is the **Supabase release agent's handoff sequence**, not an implementation of GitHub CI or code review. GitHub Actions owns the deterministic PR checks; reviewers own review findings. The release agent uses their recorded results and performs the environment-specific steps below. Do not treat an open PR, passing CI, or a review comment as Staging/Production acceptance.

1. **Open PR after local validation.** Commit the candidate SQL/Edge/frontend changes and required dependencies to a topic branch, then open a PR targeting `no_sign_up` using [the PR template](../../.github/PULL_REQUEST_TEMPLATE.md). Link the issue, affected contracts, local results and existing release record. Staging verification is **not** a prerequisite for opening the PR.
2. **Check PR CI and review.** Check the actual results of [Verify PR (no hosted state)](../../.github/workflows/verify-pr.yml) in GitHub's PR **Checks** tab and inspect the applicable code-review findings/decision. This CI does not deploy Staging or Production and does not run an AI reviewer; review is a separate process. Fix blocking defects, push corrections to the same PR and wait for the affected checks to pass. If verification or review is pending, keep the PR open; do not call it approved.
3. **Verify on Staging.** After the current candidate has passed its applicable PR checks and review blockers are addressed, the named release owner selects the combined candidate and verifies it on the shared Staging project. Acquire the existing [project lease](agent-coordination.md), apply SQL before dependent Edge code and run the [selected acceptance checks](#verification-scope). Record the PR head, tested integration base/dependencies, exact deployed artifact hashes, results and cleanup in the existing batch record. A new relevant commit, base/dependency drift or Staging mutation invalidates affected evidence and requires rechecking it. No PR CI job may write hosted state.
4. **Resolve PR risk approval.** Codex on GitHub classifies the actual diff under the base branch's [PR approval policy](../../.github/pr-approval-policy.md). The required `pr-approval-policy` check requires a current head/base/policy assessment, completed current code review without unresolved findings, and human PR approval for a material decision. The coding/release agent may merge the automatic path within recorded authorization once required CI/review and applicable combined staging acceptance pass. A material or uncertain decision is presented on the PR with current evidence and concrete alternatives; the human approves there. New relevant commits or changed risk assessments require affected re-review and approval. Before merging, account for [Render's automatic production frontend deployment from `no_sign_up`](cyberbullying-cutover.md#preconditions): verify compatibility with currently deployed Production SQL/Edge contracts and coordinate or pause Render deployment if ordered promotion requires it. Record the integrated release commit and confirm currently released changes to affected components remain included. A failed staging check or unresolved blocker prevents merging; open issues awaiting production acceptance remain open after merge.
5. **Compare and verify.** Freeze a manifest of SQL, function source including imported dependencies, required frontend artifacts, and relevant runtime configuration. Every deployed source file must match the recorded release commit; record frontend build inputs and artifact hashes. Compare the integrated manifest with the staging-tested artifacts. A fast-forward or merge with identical relevant artifacts may reuse staging evidence while dependencies, configuration and target preconditions remain valid. Conflict resolutions or other integration changes require affected local checks and staging deployment/verification; changed SQL or baseline also requires the applicable migration validation.
6. **Promote.** Recheck staging source/configuration and production preconditions immediately before production mutations, then promote the exact integrated artifacts in dependency order. Changes after the freeze require a new manifest and affected verification before promotion.
7. **Verify, repair and close.** Run the selected production behavior and cleanup checks. On failure, enter the repair loop above and keep production acceptance open. On success, record both environments' evidence, archive verified SQL and close the resolved issues. A merge, deployment or SQL success alone never closes release acceptance.

Before deploying, check active batch records and coordinate with their named release owner. That owner coordinates shared staging deployments and the production batch through verification and cleanup. Other worktrees hand off artifact versions and evidence. Deployments touching the batch or its dependencies wait until the active checks finish or the owner records a handoff. An intervening deployment requires a fresh comparison and invalidates evidence for any changed artifacts, dependencies, configuration or relevant state. Record the active owner and handoff in the existing batch record.

## Local Database Setup

The local PostgreSQL clusters are under `/Users/admin/.transfer-assessment-pg17/`:

| Item | Location or value |
| --- | --- |
| Shared cluster | `data/`, socket `socket/`, port `55432`, log `server.log` |
| Isolated validation cluster | `migration-validation/data/`, socket `migration-validation/socket/`, port `55433`, log `migration-validation/server.log` |
| Run-specific dump | `runs/baseline.*/phishingtutor.dump` (and `source-roles.sql`) |

The shared cluster may contain unrelated databases and roles. Use the isolated cluster for validation. The dump name does not establish the database name; inspect its archive header before choosing a target. Capture a fresh export per migration-validation cycle. Reuse that verified baseline for disposable Red/Green/scenario databases within the cycle; refresh it if migration-relevant source preconditions change. Edge-only, UI, documentation and test changes do not require an export/restore.

Check `supabase/config.toml` and the target database for their current PostgreSQL versions. The Supabase CLI's Docker-backed stack is separate from this custom cluster and is not required for local SQL validation. Use a fresh hosted export as the local baseline.

## Upgrade Sequence

1. **Inspect online state.** Use Supabase MCP to inspect staging (`ciubrzggdqesgvfkpolj`) and production (`zgbufaxooqxeabewktzd`), including migration history and relevant tables, constraints, functions, roles, extensions, and policies. Resolve material differences before applying the same script to both.
2. **Capture the baseline.** For concurrent runs, invoke `scripts/database/export_validation_baseline.sh` to run the configured exporters into a unique directory; both load the same connection settings. Inspect whether the archive includes every dependency of the changed objects. Obtain additional schema exports through the configured connection when needed. MCP schema inspection is not itself a restorable snapshot.
3. **Refresh locally.** Create a new disposable database for each scenario. Reapply and verify its source database ACLs and `ALTER DATABASE` settings, then restore source ownership, grants, policies, data, and dependencies. Pass the baseline comparison below before applying a candidate migration. Resolve missing dependencies in the local setup; incomplete setup blocks validation.
4. **Establish Red, then implement.** Keep at most one pending SQL file under `supabase/migrations/` and one candidate queued for shared staging deployment. Reconcile dependencies and validate the ordered, combined SQL before deployment. Write behavior and permission assertions for the requested change, run them against a disposable database restored from the unmodified hosted baseline, and record the expected missing-behavior failure. Write the candidate migration from the current hosted schema and requirements, not from local or archived migration files. Follow this Red-Green sequence without invoking the `fast-multi-agent-tdd` skill.
5. **Validate Green locally.** Apply the exact candidate SQL to a fresh disposable baseline under the online migration executor's role and transaction strategy. Rerun the same assertions under the actual application roles, including relevant edge cases and unaffected behavior. Repeat from the same baseline for success and failure scenarios. Record commands, exit codes, assertions, and resulting catalog changes. A parser or `EXPLAIN` check alone is not a migration test.
6. **Apply and test on staging.** Recheck staging preconditions, apply the exact tested SQL through a verified Supabase MCP or Management API project connection, and verify schema, permissions, RPC behavior, and the matching application or Edge Function workflow. Stop on a failed check.
7. **Integrate the release.** Pass the merge-before-production gate, recording the `no_sign_up` release commit, exact SQL hash and validity of staging evidence after integration. Revalidate affected changes before promotion.
8. **Apply and verify on production.** Recheck production preconditions and compare them with the tested baseline. Refresh and retest if they changed materially. Apply the same integrated SQL through a verified project connection, verify schema, permissions, and behavior, then archive the script only after both projects are verified.

Local snapshots do not need to be retained after the cycle. Keep baseline metadata and test evidence in the migration record so the result can still be understood. Credentials and exported user data belong outside Git.

## Edge Function Release

Use this sequence for an Edge Function change with the selected verification scope and production batch above. If it needs SQL, complete the local Red-Green checks in the upgrade sequence first. For an Edge-only change, start with the function tests; inspect its live database contract as needed, without an export/restore or migration archive step.

1. **Test locally.** Run applicable Edge Function/domain tests, including affected request validation, permission, provider failure and database-contract cases. Record commands and results. Controlled provider tests cover branches; add real-provider verification where required by the scope above.
2. **Release to staging.** Apply and verify required SQL first. Check required Edge secret names without recording values. Deploy through the API, then run the selected database and live application/API/browser checks. Record expected responses, relevant provider outcomes, persisted/visible results and cleanup. Stop and fix failures. An ordinary feature may now wait in its recorded production batch with production acceptance open.
3. **Integrate the release.** Pass the merge-before-production gate, recording the `no_sign_up` release commit and function source with imported dependencies. Confirm the combined staging scope remains valid for the integrated artifacts; revalidate affected changes.
4. **Release the production batch.** Recheck production schema, configuration and secret names. Apply and verify the same integrated SQL if needed, then deploy the frozen function source. Run the selected production checks against dedicated fixtures and verify cleanup. Deployment or HTTP success alone does not establish workflow acceptance.
5. **Record and close.** Record the integrated release commit, both project refs, SQL hash when applicable, function version or hash, test commands and results, provider and application evidence, cleanup results, and any failures and reruns in a dated `docs/doc_update_record/` file. Archive the SQL only after both projects pass. Keep browser setup and commands in [browser-e2e-testing.md](browser-e2e-testing.md).

## Acceptance Gates

The environment, scenario database, baseline, execution, behavior and current-target gates apply before staging and production migrations. Production also requires the integration gate:

| Gate | Evidence required |
| --- | --- |
| Environment | Record target and local PostgreSQL versions, encoding/collation, relevant extension versions/settings, schemas, roles, role attributes/memberships, and migration executor. Reproduce migration-relevant behavior; justify any difference shown to be immaterial to the candidate SQL and its tests |
| Scenario database | For every database created from a template, reapply source database grants and `ALTER DATABASE` settings, then compare its ACLs and database-level role settings with the source before applying any migration |
| Baseline | Restored ownership, grants/default grants, RLS policies, function definitions, constraints, indexes, and required source data match the target snapshot |
| Execution | The exact SQL succeeds under the intended executor and transaction strategy; a failed step stops the cycle |
| Behavior | Required positive, negative, permission, rollback, and concurrency assertions pass under the relevant roles |
| Current target | Staging and production schema and data preconditions are checked before each application; material differences are resolved before the same SQL is used |
| Production integration | Before production mutations, the batch's deployable changes and dependencies are merged into `no_sign_up`; the recorded release commit and frozen manifest match valid staging evidence |

Treat missing parity evidence as `local setup blocked`, not a passing test. Preserve restore errors and resolve their causes. Tests must exercise the same SQL and permission boundary that online execution will use.

The intended outcome is high predictive confidence. A measured 99% success rate requires records of actual online applications; local testing alone cannot establish that percentage. Concurrent writes, lock contention, resource limits, and hosted platform changes between the snapshot and application remain factors to check at deployment.

## Create a Fresh Snapshot

### Agent Prerequisites

Use the existing configured database exporters but isolate each Agent's output. From the repository root:

```sh
set -eu
SNAPSHOT_DIR="$(sh ./scripts/database/export_validation_baseline.sh)"
export SNAPSHOT_DIR
rtk proxy pg_restore --list "$SNAPSHOT_DIR/phishingtutor.dump"
rtk proxy pg_restore --file=/dev/null "$SNAPSHOT_DIR/phishingtutor.dump"
(cd "$SNAPSHOT_DIR" && rtk proxy shasum -a 256 -c SHA256SUMS)
```

Keep `SNAPSHOT_DIR` in the environment and record its absolute path in the run evidence. The wrapper writes private, non-overlapping `runs/baseline.*` directories, preserving an `.incomplete` marker if either configured exporter fails. Its `.exported` marker **only certifies completed exports and recorded hashes**: a successful restore, Supabase roles, extensions, ACL parity and actual migration behavior still must pass subsequent gates. Never use failed or incomplete exports.

The older `pd_dump.sh` / `pg_dump_roles.sh` commands overwrite fixed paths under `/Users/admin/.transfer-assessment-pg17/`; use them only for explicitly serialized manual release-owner work. `scripts/database/connection.sh` supplies source credentials and, by default, points to the production database. Verify authorization, source identity and safe handling of sensitive data before export. Do not display credentials. `PG_VALIDATION_RUN_ROOT` can change the private output root without changing the configured source.

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

Use the isolated PostgreSQL cluster by default. A PostgreSQL or extension version difference alone does not require another environment: record the difference and explain, with evidence, why it does not affect the candidate migration's execution, catalog result, permissions, data behavior, or test assertions. If that impact cannot be ruled out, or a required dependency cannot be reproduced, record `local setup blocked` with the specific gap. Do not start Docker-backed Supabase: root `AGENTS.md` prohibits Docker. Record an explicit parity blocker rather than substituting a Docker environment.

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
rtk proxy pg_restore --clean --if-exists --exit-on-error --single-transaction -h /Users/admin/.transfer-assessment-pg17/migration-validation/socket -p 55433 -U local_bootstrap -d "$MIGRATION_TEST_DB" "$SNAPSHOT_DIR/phishingtutor.dump"
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

After staging passes, complete the merge-before-production gate, recheck production against the tested preconditions and apply the same integrated script there. Verify the resulting objects, permissions, and behavior. Deploy a dependent Edge Function to production only after the SQL is applied there. Record the MCP or Management API operation and result for each project. An observed SQL execution does not by itself establish a Supabase CLI migration-history entry; report one only if observed. Move the script to `supabase/archived_migrations/` after both projects are verified.

## Test Coverage

Migration tests must execute against local PostgreSQL with the target dependencies. Run the same assertions before and after applying the migration to separate disposable databases, recording the expected Red failure and Green pass. Test schema changes, existing data, RPC behavior, constraints, permissions, and failure atomicity as applicable. Mocked frontend tests and `EXPLAIN` do not establish that SQL migrations work. Rerun the relevant database assertions and an integrated application or Edge Function workflow on staging before any production application.

Execute permission assertions under the actual `anon`, `authenticated`, and `service_role` roles as applicable, with the same JWT claim settings used by Supabase SQL functions. Assert both permitted and forbidden operations, including SQLSTATE and absence of unintended mutations. Privileged catalog assertions supplement these tests. Generate migration-specific setup and assertion SQL files and run them with `psql -X -v ON_ERROR_STOP=1 -f`; record every command and result. For concurrency scenarios, identify the participating sessions, enforce their ordering, and check the final committed state.

Standalone PostgreSQL needs the relevant Supabase roles, schemas, functions, and extensions for equivalent SQL behavior. When the migration or its required assertions depend on Auth, REST APIs, Storage, Realtime, or Edge Functions, test those interactions with the corresponding services; if they are unavailable, record the specific untested dependency as `local setup blocked`. Frontend unit tests remain useful alongside database tests.

Derive success, failure, and unaffected-row scenarios from the candidate migration's intended behavior. Use valid fixtures so unrelated constraints cannot masquerade as the intended assertion. Roll back test mutations or recreate the disposable database between scenarios. Inspect any relevant SQL files under `supabase/tests/` for setup requirements; tests split across multiple database sessions need their prescribed ordering and concurrent execution.

## Migration Progress Record

The agent must write `docs/doc_update_record/documentation_update_record_vYYYY_MM_DD_<migration_name>.md` for each upgrade and link evidence under `/Users/admin/.transfer-assessment-pg17/runs/<migration_name>/<run_id>/`. Use a unique run ID and keep the current dump at its configured path until the run closes; it may then be replaced.

| Field | Required content |
| --- | --- |
| Migration | Pending SQL filename and tested Git commit or file hash, identical for staging and production |
| Integration | Target branch `no_sign_up`, merge status, integrated release commit, frozen artifact manifest and post-merge staging evidence comparison |
| Release owner | Named owner of shared deployments, active batch and any handoff through verification/cleanup |
| Baseline | Staging and production project IDs, export time, PostgreSQL versions, relevant schema comparison, and observed migration history |
| Local target | Cluster, port, database name for each scenario, migration executor, provisioned dependencies, database ACL and `ALTER DATABASE` settings comparison, baseline comparison and resolved differences |
| Intended change | Affected schema objects, data transformations, permissions, and preconditions |
| Resume package | Dump/role-export paths and hashes; role/database setup SQL; restore log and catalog comparison; migration/test SQL; command logs with exit codes; assertions with expected/observed results; exact next action or blocker |
| Status | `draft`, `local setup blocked`, `local testing`, `local tests failed`, `local tests passed`, `staging applied`, `staging verified`, `production applied`, or `production verified` |
| Hosted application | MCP or Management API operation, project ID, script hash, time, execution result, and errors for each project |
| Hosted verification | Staging and production inspection times, observed objects/permissions, behavior tests, and remaining issues |

Keep the resume package outside Git and omit credentials and unnecessary row data. Report `local tests passed` only after all local gates pass. Record separate staging and production application and verification states. Archive only after production is verified, and record the archived path and actual outcomes so predictive accuracy can be measured.
