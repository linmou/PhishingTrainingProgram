# Issue 96: independent learning tracking

Status: **local candidate verified; hosted acceptance pending**.
Implementation and release owner: Codex (`/root`). Batch: `issue96-independent-learning`.
Issue: https://github.com/linmou/PhishingTrainingProgram/issues/96

## Changed contracts

Learner-owned setup, draft synchronization, trusted message routing and progress no longer depend on assessment switches. Only new assessment preparation/delivery is globally gated. Existing assessment answers, evidence reads and authorized manual edits remain available. Ordinary AI suggestions continue when global assessment creation is disabled.

Removed the browser coverage judge, its prompt/types/writer and exclusive legacy creation/update APIs. Shared AI transport, extraction and prompt-generation functionality remain. Replaced obsolete legacy BDD coverage with owner-scoped setup, replay, trusted-write, failure, historical-entry and export checks; retained shared extraction/prompt tests.

Assessment toggles no longer copy or convert historical targets. Historical rows remain read/export-only, with a separate historical export even when current learner progress exists. Explicit new setup creates separate learner-owned progress; old historical messages are not replayed against it. Export summaries derive from the selected checklist items, including accepted manual edits before aggregate columns refresh. G-24 stays open until production acceptance; unrelated G-37 identity/permission work is not closed.

Pending migration: `supabase/migrations/20261115000000_independent_learning_tracking.sql`. It removes tracking enablement checks, preserves historical records, prevents conversion/reassignment, restricts browser table writes and retires browser-executable legacy write RPCs. Authorized manual edits continue through the existing trusted API.

## Local infrastructure and migration verification

All infrastructure and verification run on the iMac. The MacBook was used only to obtain the missing root `.env`; its value was transferred encrypted, kept at mode `0600`, excluded from Git and never printed. PostgreSQL 17.12 is installed locally under `/Users/admin/Applications/Postgres.app`. `scripts/database/setup_validation_cluster.sh` initializes/reuses the private Unix-socket-only PG17 cluster; repeated setup succeeded. Export client discovery supports standard Homebrew and Postgres.app paths. No Docker was used.

Baseline: `/Users/admin/.transfer-assessment-pg17/runs/baseline.8FzgxsUa` contains fresh configured application/role exports, hashes, Auth/extension dependency export and restore logs. Final baseline database: `issue96_verified_baseline_20261115`. Source and local database owner/ACL, encoding, ICU provider, `en-US` locale and database setting were reproduced. Application schema parity, including definitions, constraints, indexes, grants/default grants and policies, matched after neutral dump-header/role-set/independent-grant-order normalization (`normalized-schema-parity.json`). Source roles/attributes and relevant memberships were reproduced. PG17.12 requires extra explicit ADMIN grants to the already-superuser local `supabase_admin` to replay source grantor provenance; application roles do not receive extra privileges. Source/local ICU patch versions differ (`153.120`/`153.121`); all 570 restored/live target strings have identical normalization hash `7d64969cf6a276cd0ceb9e58499e2cc1`. No candidate schema transformation depends on collation ordering.

Disposable scenarios use `scripts/database/disposable-database.js`, reapply and compare database ACL/settings before execution, and retain ownership-checked cleanup evidence:

- Red: original baseline rejects assessment-off historical/learning context with `FORBIDDEN`; `/tmp/issue96-clone-red.log`, lease `runs/scenario-3lS1hR/lease.json`.
- Green: exact candidate applied under `SET ROLE postgres`; owner-scoped setup, toggle identity, unchanged historical records, skipped historical replay, authorized manual edit and denied browser writes pass. `/tmp/issue96-clone-green-final.log`, lease `runs/scenario-jcXRCR/lease.json`.
- Concurrent setup: two `service_role` sessions return the same checklist and produce one target. `/tmp/issue96-concurrency.log`, lease `runs/scenario-Emq983/lease.json`. Initial test omitted the client contract; corrected before successful rerun.
- Helper checks: 6 deterministic helper tests and 7 real allocation/cleanup integration tests passed (`/tmp/issue96-db-helper-tests.log`, `/tmp/issue96-local-pg-integration.log`).

Earlier exploratory database `issue96_local_baseline_20261114` is not the final parity baseline. Only task-owned disposable databases are cleaned automatically; no unrelated databases or historical hosted data were changed.

## Application and quality evidence

- Full configured Jest run: 154 suites passed, 1,603 tests passed, 52 opt-in tests skipped; `/tmp/issue96-full-jest-final.log`.
- Affected lifecycle suites: `/tmp/issue96-affected-candidate.log`; subsequent historical export/manual-edit regression: 2 suites/14 tests passed in `/tmp/issue96-export-final.log`. Real service-to-hook historical metadata contract passes in `/tmp/issue96-historical-contract.log`.
- Trusted assessment API: 57 Deno tests passed, including global-disable access for existing processing, manual edits and evidence; `/tmp/issue96-edge-final.log`.
- Production build passes; `/tmp/issue96-build-candidate.log` and final reviewed build `/tmp/issue96-build-reviewed.log`.
- code-smell-monitor: same-scope unchanged-baseline comparison; no introduced blocking findings in the changed frontend modules. Owner explicitly limited this issue to new regressions. Local reports stay outside Git.
- review-with-multi-debate: all five blocking criteria converged to pass after the export-summary fix. Local excluded artifacts: `audits/issue96_fixed_review_audit{1,2,3}_iteration{1,2}.json` and iteration summaries. The strict `advance_phase` gate accepted review→publish at iteration 2. Earlier failed audits are retained; no unresolved dispute remains.

## Delivery gates and remaining acceptance

PR targets `no_sign_up`. CI, independent GitHub Codex review, Staging and Production acceptance are pending. No hosted SQL/Edge/secret/fixture mutation has been performed for this candidate. No shared Staging lease has been acquired yet.

After applicable PR checks/review pass, the release owner acquires the project lease for the exact committed candidate, applies and verifies SQL before dependent `assessment-api`, then verifies:

- Phishing and privacy with assessments on/off and both toggle transitions: same owner/checklist/progress, server analysis, idempotent replay/rejoin and no duplicate evidence.
- Global assessment disable: no new assessments; existing answers still grade; ordinary suggestions, Guard, evidence/export and manual edits remain operational.
- Historical entry and explicit new owner setup: unchanged old records, separate current progress, historical exports and no old-message rejudging.
- Cyberbullying tracking/character behavior remains intact.
- Permission boundary and concurrency assertions plus fixture cleanup.

Selected browser workflows: `room-assessment-setup`, `transfer-status-events`, `assessment-configuration`, `assessment-answer`, `assessment-replay`, `learning-progress-realtime`, and affected cyberbullying journey. Add focused switch-off acceptance to the existing workflows as necessary. Use the explicit Staging environment from the browser guide; never use the production-targeted frontend defaults for staging fixtures.

Record exact SQL/function/frontend hashes and deployed versions. After staged acceptance, pass the risk-based merge gate and merge into `no_sign_up`; account for Render's automatic frontend promotion and backend compatibility before merge. Verify integrated artifacts on Staging, then promote matching SQL→Edge→frontend dependencies and run matching Production acceptance/cleanup. Archive SQL and close G-24/issue 96 only after those checks pass. Codex owns repair and continuation through these gates.
