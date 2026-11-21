# Issue #101: PR #97 release preparation

Owner: Codex in `release-pr-97-learning-target-changes-sql-edge-a`.
Trigger: issue #101 explicitly requests the staging-to-production release. Resume when the current staging owner releases/hands off its lease, configured database export succeeds, and Render deployment identity is accessible.
Status: **local setup blocked; release incomplete**. No hosted writes performed. Do not close #101.

## Candidate and decisions

Baseline integrated commit: `43068d0f53adf0b540c270760bfca3f81d8f84e1` (PR #97). This worktree was fast-forwarded from `ecee681` before editing. The additional migration/CI changes remain local and must be committed, reviewed and integrated before production.

One pending migration: `supabase/migrations/20261115000000_task_label_template_seed.sql`, SHA-256 `d02480d32bd483c5ee102a6c00f87461d0c330e88c10fe699f49122db2bbe8d0`. It updates six system-owned template inventories and their generated prompt inventory sections to exact source strings, including approved Nintendo wording. It checks unique template identity, scenario/config shape and prompt boundaries and updates only changed configurations. Existing template settings and room content are preserved.

Existing rooms and learner checklists are intentionally not rewritten: these are saved teaching/progress snapshots, including versioned cyberbullying targets protected by database triggers. The five cyberbullying `What to understand:` points remain in their existing version; changing them requires a separately tested version transition. The mixed-label reader explicitly supports legacy labels in `src/services/learningAnalysisPrompt.ts`; no prompt edit is needed for that compatibility. New phishing/privacy rooms will inherit the updated catalog after SQL deployment. Custom tutor templates are outside this six-template seed.

The test discovers the latest SQL `$catalog$` seed across pending and archived migrations, compares each point exactly, and checks scenario coverage. No `.replace` normalization remains. CI explicitly runs this test. Historical migration bytes are unchanged; archival of the pending migration waits for both hosted projects to pass.

## Read-only hosted observations (2026-11-15)

Supabase MCP inspected both projects directly:

| Observation | Staging `ciubrzggdqesgvfkpolj` | Production `zgbufaxooqxeabewktzd` |
| --- | --- | --- |
| Templates containing `What to notice:` | 6 | 6 |
| Templates containing `Observation task:` | 0 | 0 |
| Versioned cyberbullying function has `What to understand:` | true | true |
| assessment-api version | 84 | 23 |
| assessment-api bundle hash | `428061a222e385ff49c31437dd3d43c48f07f77aac9cf73aaeec8caec56f9864` | `2187c077aeec9fb5c4016b92a3b6389bf33cb34ceed13baeca66739cd866276c` |
| Latest migration | `20261115071903 independent_learning_tracking` | `20261113045519 enable_learning_progress_realtime` |

Staging has an independent-learning-tracking dependency absent from production. Reconcile its owner/source and deployed behavior before promoting this candidate; do not overwrite staging's function with an older source blindly.

Public Render site returned HTTP 200. HTML Last-Modified: `Fri, 13 Nov 2026 05:19:38 UTC`. Bundle `/static/js/main.87b0558c.js` SHA-256 `081ecf2d313be4da9f11316d1adf7f4c5bd51cb85731db49d8746408f36f8b32`; it contains no literal `Observation task:`. This suggests the new frontend has not auto-deployed. Exact Render commit/deploy time remains unverified; no rollback/pause was performed because no mismatch requiring it was established. GitHub deployments returned an empty list and merged-commit status had no Render status. No Render API key is configured; browser host is unavailable.

Staging reference `tags/verification-locks/ciubrzggdqesgvfkpolj` is owned by another candidate: operation `staging-release`, commit `1780bb7981489b5d4fe96bc29ca5cdda33aec7ee`, run `f0066930-64e9-43c5-9f8c-041cd7650d2a`, start `2026-11-15T08:53:41.910Z`. Do not delete/reclaim that owner's lease. This is a separate write blocker.

## Local evidence and blockers

- `bash ./pd_dump.sh` exited 1: configured `connection.sh` requires `PGPASSWORD` in this worktree's `.env` or environment. No fallback/stale dump was used. Per release workflow, no restore, SQL Red/Green, role/baseline parity or hosted application can be claimed. Credentials must remain outside Git and chat.
- Dependencies provisioned with `bash scripts/tdd_provision_node_modules.sh` (existing shared dependency tree).
- `OAI_MODEL=ci-test-model CI=true npm run test:regression -- --runInBand --watchman=false --runTestsByPath src/services/__tests__/detectionTemplates.test.ts src/services/__tests__/learningAnalysisPrompt.test.ts src/services/__tests__/assessmentGrading.test.ts src/services/__tests__/learningProgressTransitions.test.ts src/services/__tests__/assessmentAnswerParser.test.ts` from `tutor-system/`: exit 0, **5 suites / 62 tests passed**. These are deterministic checks, not live grading/eligibility/lifecycle acceptance.
- `git diff --check`: exit 0. Deno executable unavailable; Edge Deno checks remain pending.
- Source hashes at baseline: assessment-api/index.ts `ca1efb516d7b6d9c25f965fd0f006a8b20a53ac829281d98927bffad971cf735`; learningAnalysisPrompt.ts `d9238857d644c226714334e374bf99d3d2f2e6a17feda005820305ade7ea5e60`. These are individual file hashes, not a complete deployed artifact manifest.

## Resume and acceptance

The named owner resumes after credentials/Render access and lease ownership are resolved. First re-inspect both live projects and Render; coordinate the independent-learning-tracking dependency. Export a fresh configured baseline, restore and compare disposable database parity, then run unchanged behavior/permission assertions Red/Green against this exact SQL, including idempotence and atomic failure on missing/duplicate/malformed catalog entries. No SQL test pass is claimed here.

Commit the reviewed candidate and acquire its exact staging lease. Apply SQL, verify zero legacy labels in saved standard templates and exact inventories, deploy the matching assessment-api artifact, and run the affected live grading, eligibility and complete lifecycle journeys plus new-room label checks and cleanup under that lease. Record full artifact manifests and provider evidence. Merge/integrate into `no_sign_up`, reverify integrated artifacts together on staging, then promote production SQL, Edge and frontend in that order. Verify matching production journeys, Render commit, artifact identity and cleanup. Only then archive the exact SQL and close #101. Both environments' acceptance remains open.

## Configuration recovery after user guidance

Copied the ignored `tutor-system/.env` and root `.env` from the default-branch worktree at `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram`, with mode 0600. No values were printed. `git check-ignore .env tutor-system/.env` confirms both remain ignored. The missing-password configuration blocker is resolved; database connectivity has not yet been tested.

Retried `PG_DUMP_ENV_FILE="$PWD/tutor-system/.env" bash ./pd_dump.sh`: exit 127, `PostgreSQL 17 pg_dump is unavailable: /opt/homebrew/opt/postgresql@17/bin/pg_dump`. No `pg_dump` is on PATH or at the checked standard PostgreSQL/Homebrew paths. This runtime reports Darwin x86_64 and does not contain the documented Homebrew installation. No existing dump was treated as a fresh export. Resume requires the PostgreSQL 17 client tools and validation cluster tooling in this execution environment (or the existing configured environment restored), before export/restore validation can proceed.

Rechecked the staging lease: it still references `dbb934e389958bf83eda599a354538fd56f52040`, the other owner's recorded lease. Hosted writes remain blocked independently of local tool setup. Render deployment identity remains unverified.

## Working-session comparison and corrected setup

Compared the issue #100 Codex session (`01a1dea6-5ab7-7030-9dc2-7b09c6ab8683`) with its worktree release record and private exporter. That session encountered the same missing-env and incorrect fixed-tool-path problems, then resolved them. PostgreSQL 17.12 is installed at `/Users/admin/Applications/Postgres.app/Contents/Versions/17/bin`; `pg_dump --version` succeeds and `pg_isready` confirms the isolated port 55433 cluster accepts connections. Earlier claims that tools were unavailable were based on an incomplete path search and are superseded.

The issue #100 maintainer clarification identifies the copied PGPASSWORD as local-only. Do not combine it with the export helper's hosted Supabase defaults. Existing `SUPABASE_ACCESS_TOKEN` authorizes a read-only Management API logical export; its workflow is documented in the sibling issue #100 release record. Copied its exporter into a separate private run directory, changing only the output directory, without overwriting the sibling evidence. Fresh staging export succeeded (25 tables, 69 functions, 1,078 rows). Resume package: `/Users/admin/.transfer-assessment-pg17/runs/issue101-20261115/`. Export success alone does not claim restore/parity or migration test success; those remain to run.

Orca's built-in browser works through the documented CLI. The earlier CUA browser-host failure was specific to that tool, not proof that all browser access was unavailable. Render opened in Orca page `d76b3956-8fd7-4502-8572-94c93a9674d1` and redirected to `https://dashboard.render.com/login-next`; this browser session is not signed in. No settings were changed.

## Issue #96 worktree checked directly

Orca resolves `remove-browser-side-learning-judging-and-decoupl` to issue #96 / PR #99, current clean head `974e93d01f95708a4a28e76533545281025d87f7`. Its authoritative record is `tutor-system/docs/doc_update_record/documentation_update_record_v2026_11_14_issue96.md` in that worktree. This explains the previously unexplained staging difference:

- Its PostgreSQL client discovery patch searches both Homebrew prefixes and user/system Postgres.app. Its `setup_validation_cluster.sh` safely reuses the existing Unix-socket-only PG17 cluster. These helpers are pending in PR #99, absent from this baseline. Reuse their paths/workflow rather than reporting tools missing.
- Fresh configured application/role/dependency exports and normalized restored-schema parity are recorded under `/Users/admin/.transfer-assessment-pg17/runs/baseline.8FzgxsUa`; final baseline `issue96_verified_baseline_20261115`. Those are evidence of its release, not automatically fresh baselines for #101.
- Issue #96 owns the staging lease at candidate `1780bb7`; its SQL is already applied and Edge v84 already contains PR #97's learningAnalysisPrompt/majority-vote modules. Thus #101's original statement that tracing is not deployed is stale for staging (production remains unchanged).
- Its setup and assessment-configuration journeys passed with cleanup. Assessment-delivery failed twice because actual analyzer events differed from strict expectations against old saved targets. Its attribution to inherited PR #97 behavior is based on source comparison, not a baseline live run. This is exactly the integrated dependency to resolve in #101.

Correction to resumption plan: coordinate #101's catalog migration and acceptance with the #96 release owner; preserve its SQL and complete 16-file Edge source manifest (`a2189ecf0d95482eb6c3ac3c2a151bb4e5b9a4f35a1f7c2b6af7424041640e59`). Do not redeploy this worktree's older assessment-api over v84. Shared staging writes must remain under that owner's exact-candidate lease until it explicitly hands off. PR #99 is open, not merged; integrated production release still requires both branches' appropriate merge/verification gates. No messages were sent to the other agent and no hosted state was changed during this inspection.

## Reused issue #100 validation approach

Rechecked issue #100 at `7612074` and its latest validation record. Fresh issue #101 staging and production catalog JSON sections and every table's data match issue #100's exported snapshots exactly (zero changed sections/tables on both projects). Its verified local baselines can therefore be reused without importing issue #100's candidate migration. Baselines: `issue100_staging_baseline_20261115` and `issue100_production_baseline_20261115`. Their initial restored parity records are `catalog-diff.json` and `production-catalog-diff.json` in the issue #100 private package; both contain no differences. The candidate databases are distinct from those baseline databases.

Executed our exact pending migration through `scripts/database/disposable-database.js`, using the Postgres.app `psql` path, with source-equivalent `postgres` as migration executor. Both staging and production scenarios exited 0: expected Red (`LEGACY_LABELS_REMAIN`, psql exit 3), successful migration, zero legacy template labels, exactly six canonical templates, unchanged complete room and checklist-item snapshots, unchanged public table ACL/RLS snapshots, and idempotent second application (including unchanged template updated_at). Both helpers passed clone database ACL/settings parity and cleaned their owned database.

Private test runner and SQL: `/Users/admin/.transfer-assessment-pg17/runs/issue101-20261115/scenario.cjs` and `check.sql`. Logs: `staging-scenario.log` and `production-scenario.log` (contain private baseline rows; do not commit). Helper evidence: `scenario-Tp67Fw/lease.json` for staging and `scenario-SA2IgD/lease.json` for production under the shared private runs directory. These focused checks do not yet cover atomic failure, explicit application-role boundaries, new-room browser inheritance, or hosted lifecycle acceptance. Those gates remain pending before release.

## Combined-release ownership agreement

Current combined release owner: issue #100 Codex session `codex_8fa71715_2ff6_4c9b_b170_3bb7600439e4`, workspace `decouple-enable-in-room-assessment-from-learning`; issue #101 remains template patch/evidence owner. #96 Claude session `claude_45480caa_e769_4ff4_a97a_2f79e9b93071` explicitly agrees and retains its lease without further writes until #100 signals ready to acquire. Do not reclaim the lease.

Agreed dependency proposal supplied to #100: #96 already on staging -> apply #101 template SQL -> rerun assessment-delivery, assessment-answer and assessment-configuration -> integrate and validate #100 on top. Combined owner must recheck actual source/RPC hashes and production differences; #100's guarded transformations are not freely reorderable with #96. Never replace staging v84 with the older baseline Edge. #96 PR #99 head `974e93d`; deployed Edge source matches `6f4e75b`, 16-file manifest `a2189ecf0d95482eb6c3ac3c2a151bb4e5b9a4f35a1f7c2b6af7424041640e59`; its SQL hash `44432e68bd7eaafdfe0922ae0af72fa1a5fcdd8de4823bee4d4731967d59725c`. Its production release remains pending. Claude confirms cleanup passed and feature flag restored true; assessment-delivery 0/2 is still open. Task-label changes alone are not proof of corrected analyzer behavior.

#100 owns integration, one-pending-migration artifact ordering, review/CI, staging acceptance, merge and production promotion. Preserve component SQL order and hashes; do not archive an unverified component merely to satisfy the pending-file count. Actual combined release remains incomplete.

Added atomic-failure coverage to the private local scenario: rename the final expected template, apply exact migration expecting psql exit 3, and prove all template rows (including timestamps) match the pre-failure snapshot. Earlier updates in the migration roll back. Restore the fixture name, then run normal Red/Green, preservation and idempotence checks. Staging and production both exit 0 and clean their owned databases. New evidence leases: `scenario-ENmfVc/lease.json` and `scenario-HtTcyh/lease.json`. No hosted writes were made by #101.
