# Learning target auto-refresh — issue #75

Status: **frontend and fresh-baseline SQL validation passed; hosted acceptance pending shared staging availability**. Current continuation below supersedes historical blockers. This record does not certify a release.

- Issue: https://github.com/linmou/PhishingTrainingProgram/issues/75
- Draft PR: https://github.com/linmou/PhishingTrainingProgram/pull/76
- Reviewed implementation commit: `b4e5dcb` (runtime artifact hashes in the candidate manifest).
- Batch: `learning-target-auto-refresh-2026-11-12`.
- Release and repair owner: **Codex, learning-target-auto-refresh workspace**, `/Users/admin/orca/workspaces/PhishingTrainingProgram/learning-target-auto-refresh`.
- Base: `878ed465823959517bb68398b05ee08b90958b24`; topic: `linmou/learning-target-auto-refresh`; integration target: `no_sign_up`.
- Authorization: owner approved automatic refresh, the database release and learner visibility trade-off, then requested issue → requirement refinement → implementation → review → PR in the prior session; continuation explicitly requests finishing that work. Standing AGENTS instructions authorize release after all gates pass.
- Merge: not merged. Integrated release commit: none. Production acceptance remains open.

## Changed contracts and dependency ownership

FR-23 and NFR-8 now require automatic target/progress/evidence display for the room owner and learner, with draft preservation, live recovery and visible failure. FR-53 already requires both viewers; current source only mounted the tutor panel, so this change supplies the read-only learner view. Root constitution unchanged. Requirement refinement has high confidence; the pedagogical timing trade-off has medium confidence and explicit owner acceptance.

Notifications invalidate reads; they do not judge messages, grade assessments or retry failed saves. The source revealed that learner ownership and waiting UI were polled. A room-filtered `sessions` subscription is an inherited setup dependency: a tutor waiting with local target drafts must learn that the learner joined even before a message is sent. Publication candidate therefore covers `sessions`, `session_checklists`, `checklist_items` and `coverage_evidence`. Codex owns all four through release. Existing Edge functions and SQL writers are dependencies to inspect and exercise, not redeploy blindly.

The migration only adds missing memberships to the existing `supabase_realtime` publication. It refuses missing INSERT/UPDATE publication settings, missing tables/primary keys, or pre-existing restricted memberships. It preserves rows, grants, policies, replica identities, publication options and unrelated members. Published rows and role permissions must be inspected directly through MCP before any application; filters do not establish authorization. No private assessment table is added.

## Environment and candidate evidence

| Environment | Target | Applied source/version | Verification |
|---|---|---|---|
| Local source | Topic worktree above | Candidate commit/hash manifest recorded after review | Focused checks below |
| Staging | `ciubrzggdqesgvfkpolj` | Not inspected or changed by this task | Blocked; no lease acquired |
| Production | `zgbufaxooqxeabewktzd` | Not inspected or changed by this task | Blocked; no deployment attempted |

Candidate SQL: `tutor-system/supabase/migrations/20261112180000_enable_learning_progress_realtime.sql`. Keep pending until both projects pass; do not archive now. SHA-256 values and dependency files are recorded in `docs/evidence/learning-target-auto-refresh/candidate-artifacts.json`. No Edge source changed.

## Verification scope and acceptance

Combined scope: isolated UI behavior + publication migration + interacting room membership/read lifecycle. Live outcomes must be inspected against the exact candidate; mocked tests do not prove publication delivery or RLS.

For **both** staging and production, use dedicated tagged fixtures and record commit, app URL, project, deployed function versions, publication catalog, timestamps/latency and cleanup before/after:

1. Owner and learner in separate browsers: set targets after learner entry; verify waiting → saved targets without Refresh. Also save targets before entry and verify automatic learner binding and chronological early-message catch-up, with no duplicate judgment.
2. Change status/note/text/priority in another owner tab. Both eligible viewers update within about two seconds of commit, while an unsaved note/text, expanded card and evidence view survive. The learner sees no mutation controls; a non-owner tutor/observer gets none.
3. Judge a learner message in phishing and cyberbullying; verify persisted progress/evidence appears without manual Refresh. Use `checklist-coverage`, `early-message-recheck` and `cyberbullying` workflows as baselines; supplement their assertions with two-viewer automatic-refresh checks.
4. Exercise `guard-mode` and `assessment-answer` (staging also `exit-assessment`): held changes do not advance while Guard is active; replay and terminal assessment progress display afterward; refresh never changes attempt counts or exposes open assessment material.
5. Collapse panel, change progress, reopen; disconnect one viewer, change state, reconnect without reload. Verify catch-up and warnings when feed or reads fail, retained content, manual fallback, room/identity isolation and no background polling.
6. Verify narrow/desktop layout, owner composer access, fixtures removed/restored, no residual rows or owned leases. Existing workflow commands alone are insufficient unless the added auto-refresh assertions above are observed and recorded.

Before staging: inspect both projects through Supabase MCP, capture fresh catalogs/roles/executor/publication, export with `scripts/database/export_validation_baseline.sh`, restore in the existing local validation cluster, compare ownership/RLS/ACL/settings/rows and publication membership (not included in schema-filtered dump). Do not use Docker.

Run the candidate with source-equivalent executor and the opt-in harness after parity passes:

```sh
PG_LEARNING_REALTIME_VERIFIED_BASELINE=<verified-local-baseline> \
PG_LEARNING_REALTIME_EXECUTOR=<verified-executor> \
PG_VALIDATION_PSQL=<configured-psql-path> \
node --test scripts/database/learning-progress-realtime.integration.test.js
```

The harness removes only candidate memberships on owned disposable clones to establish Red, then tests Green, idempotence, unrelated membership/row/policy/ACL preservation, browser-role read and forbidden DDL/private reads, and atomic failure with the last table absent. These are supplemental to actual source role/RLS parity, role-specific row visibility and hosted websocket delivery. A skipped harness does not pass migration validation.

Acquire the cross-machine staging lease at the committed candidate before SQL/fixture writes; hold it through acceptance and cleanup. After staging passes, obtain required CI/review, merge into `no_sign_up`, freeze the integrated manifest and compare it with staging evidence. Revalidate changed dependencies, then promote the exact SQL, verify the frontend release and repeat selected production checks. Archive SQL and close #75 only after production acceptance.

## Local checks and review

- Tool discovery: no Supabase tools in enabled tool inventory; MCP resource and template inventories both empty. No alternative read path was used to bypass the repository's MCP inspection requirement.
- Runtime: Node absent from shell PATH. Downloaded official Node `v22.23.5` darwin-x64 into `/tmp/ptp-node-20261112/`; SHA-256 verified against nodejs.org (`c53383238206b9ae4db23c5d8a63645e2e753bec8ab51a49cc81939aa64e9422`). No project dependency changed for this runtime.
- `node --check scripts/database/learning-progress-realtime.integration.test.js`: passed.
- `node --test scripts/database/learning-progress-realtime.integration.test.js`: **skipped (1)** because no verified hosted baseline/executor exists. No SQL was executed.
- Initial focused hook/panel/page run: **13 suites / 155 tests passed**; learner rendering follow-up **6 tests passed**. Production build passed with existing lint warnings. Logs `/tmp/ptp-refresh-focused-tests.log`, `/tmp/ptp-refresh-learner-panel-test.log`, `/tmp/ptp-refresh-build.log`.
- First full Jest run: **4 failed, 150 passed, 5 skipped suites; 4 failed, 1590 passed, 93 skipped tests**. Preserved `/tmp/ptp-refresh-full-jest.log`. Failures exposed outdated fixtures: chat tests selected the first channel rather than the messages channel; room discovery lacked optional-auth mock needed by learner panel; transfer BDD's panel mock did not emit setup state. Fixtures were updated without weakening their assertions. Targeted reruns: chat/discovery **3 suites / 36 tests passed**; transfer BDD **18 tests passed**. Intermediate test-repair mistakes (mock hoisting and empty-list setup detection) are preserved in `/tmp/ptp-refresh-bdd-repair.log` and `/tmp/ptp-refresh-transfer-bdd-repair.log`; final transfer rerun `/tmp/ptp-refresh-transfer-bdd-final.log` passed.
- Full `tsc --noEmit` is not green: existing test typing errors remain (including Blob mocks), recorded in `/tmp/ptp-refresh-tsc-final.log`. CRA production build is the required build check; do not report standalone tsc as passed.
- Three independent review passes (blind/adversarial, edge-path and acceptance) ran before PR creation. Initial findings are preserved under `docs/evidence/learning-target-auto-refresh/review-*-initial.*`. Fixes and final checks are recorded below once verified.
- Browser preview: actual modified panel with simulated hook/auth inputs, desktop note preserved across status/priority changes; read-only learner on 390px viewport. Screenshots and limitations in `docs/evidence/learning-target-auto-refresh/README.md`. This is local component evidence, not real-room/staging acceptance. Preview tab and HTTP process were closed after capture.

## Blocker and concrete resumption handoff

**Blocking capability: Supabase MCP is not connected to this session.** AGENTS.md requires direct MCP inspection of target schema; neither saved SQL nor local mocks can satisfy that gate. This prevents live contract validation, fresh-baseline parity, staging acceptance and release. Both environments' current deployed versions remain unknown to this task. No hosted fixtures, secrets, SQL or deployments were mutated; hosted cleanup is not needed for this session.

Resumption owner: Codex in the named workspace (or a designated release agent accepting this record). Next action: enable Supabase MCP for the staging and production refs above, inspect actual tables/publication/policies/executor and compare with this candidate. If the candidate assumption differs, repair it and rerun affected local/review checks before taking the shared staging lease. Concrete release trigger: verified exact integrated artifacts, required CI/review and complete staging acceptance. Do not merge or deploy production while these gates are open.

## Review disposition — resolved locally

Confirmed findings: collapsed initial errors hidden; unbounded debounce starvation; unscoped old learner ID on room change; overlapping membership requests; background reads clearing failed-save errors; async failed saves losing editor drafts; hung reads blocking all subsequent reconciliation. All are within the approved fail-visible, scope-isolation and draft-preservation intent; they require code/tests rather than new product authorization. All seven confirmed gaps were repaired and covered by focused regressions. Follow-up blind, edge and acceptance reviews reported no remaining actionable local findings; final reports are preserved beside the initial findings.

Conditional DELETE concern: accepted triggers are setup and committed progress/evidence updates. The client listens to INSERT/UPDATE only and does not claim physical DELETE synchronization. No target/evidence deletion controls are added. Actual hosted writer behavior must be confirmed during MCP inspection; if a supported in-scope writer uses DELETE without a notifying parent update, resolve that dependency before release. Room deletion behavior is not changed by this feature. Supabase documents different delete/filter behavior depending on replica identity; the candidate deliberately leaves replica identities unchanged ([Realtime reference](https://supabase.com/docs/guides/realtime/postgres-changes)). Publication membership checks use PostgreSQL's expanded table view ([PostgreSQL 17 reference](https://www.postgresql.org/docs/17/view-pg-publication-tables.html)).

## Final local verification before PR

All commands ran in `tutor-system/` with Node v22.23.5 and explicit `REACT_APP_SUPABASE_URL=http://127.0.0.1:54321`, `REACT_APP_SUPABASE_ANON_KEY=local-placeholder`; no live Supabase target was used.

- `CI=true npm run test:regression -- --runInBand`: exit 0, **154 passed / 5 skipped suites; 1,602 passed / 93 skipped tests; 1 snapshot passed**, 79.333 seconds. Log `/tmp/ptp-refresh-full-jest-final.log`. Skips are existing opt-in cases, not newly disabled tests.
- `CI=false npm run build`: exit 0, compiled with existing lint warnings in ImageUpload, RoomPagePost's join effect and imageUpload service. Log `/tmp/ptp-refresh-build-final.log`.
- Review-fix focus run: **163 tests passed**; final route-scope refinement: **30 page tests passed** (`/tmp/ptp-refresh-review-fixes-tests.log`, `/tmp/ptp-refresh-review-page-tests.log`).
- `git diff --check`: passed.
- SQL harness remains **skipped / not validated**; no baseline, restore, role parity or hosted websocket check is certified.
- Runtime candidate hashes in `docs/evidence/learning-target-auto-refresh/candidate-artifacts.json`; reviewed diff baselines in the topic history. Backend versions and integrated release commit remain unknown/unassigned until the release gates run.

The PR remains a draft for a concrete reviewable handoff. It must not auto-close issue #75 on merge; close the issue only after production acceptance. GitHub CI is separate and must be read from actual PR checks.

## Local review repair — 2026-11-12

Intent: record the PR #76 draft-promotion race repair and its local verification.

The user requested pulling the branch and modifying it locally. Worktree: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/pr-76-local`; branch: `linmou/learning-target-auto-refresh`. Remote candidate `e09e93822e234f7c003dea35709c9b7cef0bd7ba` was merged locally with `no_sign_up` at `0d4428843c2a7aaba9d11c491bfdb770167d3ab5`, producing merge commit `3d1a1dd0b6ce2e7be0af0bb962321ff0def1ea39`. The repair remains an uncommitted local diff on that merge.

The review identified that keeping the panel mounted during draft promotion allowed a tutor to save a newer draft while the older snapshot was being persisted. Completion then deleted the newer local draft. The hook now rejects draft mutations while its promotion request owns the current scope. A disabled fieldset keeps the draft visible while preventing edits until synchronization succeeds or fails. Persisted background refreshes remain editable.

Verification used Node v22.12.0 with `REACT_APP_SUPABASE_URL=http://127.0.0.1:54321` and `REACT_APP_SUPABASE_ANON_KEY=local-placeholder`:

- Regression sensitivity: removing both guards produced **3 failures / 23 passes** across the two focused suites. Failures showed draft mutation returning true and enabled controls in both the mocked panel and actual panel-plus-hook integration. Restored both guards before final validation.
- `CI=true npm test -- --watchAll=false --runInBand --silent --testPathPattern='useChecklist|ChecklistPanel|RoomPagePost.transfer'`: **11 suites / 159 tests passed**, exit 0. New cases cover pending promotion, successful transition to persisted editing, failed-promotion recovery, and actual panel/hook control disabling.
- `CI=false npm run build`: exit 0, compiled with existing lint warnings in ImageUpload, RoomPagePost, imageUpload and parameterConfig. This supplies the application TypeScript build check; mypy does not apply to these TypeScript-only edits.
- `git diff --check`: passed.
- A clean `npm ci` failed with ENOSPC. The user authorized removal of that incomplete 768 MB install. Tests/build reused a symlink to the existing `transfer-assessment-ui-upgrade/integration/tutor-system/node_modules`. Lockfile comparison found matching shared package versions, with three candidate-only nested entries absent from that installation: mongoose/gcp-metadata, promptfoo/@types/node and promptfoo/undici-types. This is local verification, not a clean-install CI claim.

The preceding review successfully queried both live projects through Supabase MCP: none of the four required tables was in `supabase_realtime`. MCP availability is therefore no longer the blocker recorded earlier. Migration validation, staging acceptance, production rollout and current-head GitHub checks remain outstanding. This local repair did not apply SQL, deploy, push, or merge the PR.

### Local follow-up verification — 2026-11-12

The user reiterated local-worktree repair. The draft race guards and current-default integration were rechecked. Full integrated frontend regression, `CI=true npm run test:regression -- --runInBand --silent`, passed **154 suites / 1,608 tests / 1 snapshot**, with 5 suites / 93 existing tests skipped (46.943 seconds, exit 0). It used the same explicit loopback environment and reused dependencies described above.

Read-only Supabase MCP inspection confirmed both targets use executor/publication owner `postgres`, publication INSERT/UPDATE enabled, all four target tables owned by postgres with RLS and `PRIMARY KEY (id)`, default replica identity, and no target publication memberships. Existing publication members are `messages`, `message_feedback`, and `rooms`. Staging runs PostgreSQL 17.11; production runs 17.4; local client is 17.11.

A fresh configured production export completed at `/Users/admin/.transfer-assessment-pg17/runs/baseline.KUXU9J4q`; both SHA-256 checks passed. That export has not been restored or compared and is not a verified baseline.

Additional SQL diagnostics ran the exact candidate as `postgres` on two owned clones of retained `issue73_baseline_20261112_fresh`. The local diagnostic runner `tmp/pr76-publication-diagnostic.cjs` establishes the observed publication membership on each clone before invoking the existing harness scenario:

- Red/Green: expected missing-membership failure, successful migration, unchanged rows/policies/ACLs/replica identities/options, unrelated member preservation, idempotence, browser-role reads and forbidden DDL/private-read checks all passed. Evidence: `/Users/admin/.transfer-assessment-pg17/runs/scenario-DRbC28/lease.json` and `learning-realtime-evidence.json` in that directory.
- Atomic failure: removing the last required table caused the expected migration failure and rolled back earlier additions. Evidence: `/Users/admin/.transfer-assessment-pg17/runs/scenario-fcnYGK/lease.json` and its SQL evidence JSON.
- Both scenarios exited 0 and their leases confirm cleanup. The retained baseline was untouched. The local cluster reports insufficient `wal_level` for logical streaming; these checks exercise SQL/catalog behavior only.

These diagnostics do not replace fresh-baseline parity or hosted websocket acceptance. No new SQL defect was found. Remaining merge gates are fresh-baseline validation, staging two-viewer acceptance, current-head CI/review, and coordinated production rollout. The user's local-only scope remains in effect.

### Independent repair review and lint follow-up — 2026-11-12

Three independent reviewers converged on pass for four blocking criteria: same-viewer mutation rejection, UI disabling/recovery, regression evidence and accurate release scope. The deterministic phase gate accepted round 1; audit artifacts are locally ignored under `audits/pr76_fix_review_*`. The review rerun passed 11 suites / 159 tests.

The requested scoped code-smell monitor found five new test lint violations. These are repaired by destructuring `rerender` and replacing CSS-selector access with accessible-role queries for both Edit buttons, retaining explicit count and disabled/enabled assertions. The two focused suites passed 26/26 tests after cleanup; `git diff --check` passed. Runtime source is unchanged since the independent review; the small test-query cleanup was not independently re-reviewed.

The same four-file monitor scope reduced ESLint errors from 24 to 19, with zero in the repaired runtime modules or new test block. Remaining errors predate the repair. Before/after reports: `audits/pr76-fix-code-smell/` and `audits/pr76-fix-code-smell-after/`. Coverage remains incomplete because Knip, jscpd, madge, depcheck and Gitleaks are unavailable; package-wide standalone TypeScript failures and dependency advisories remain explicitly recorded. No push, deployment or PR merge occurred.

### PR update handoff — 2026-11-12

The user subsequently authorized updating PR #76. The repair, regression tests, requirement status and verification notes are being committed on the topic branch, based on local integration commit `3d1a1dd0b6ce2e7be0af0bb962321ff0def1ea39`. The candidate manifest now reflects both repaired runtime hashes and current default baseline `0d4428843c2a7aaba9d11c491bfdb770167d3ab5`. Earlier references to uncommitted/local-only status describe the state before this handoff. Hosted deployment remains outside this update; the PR stays draft until fresh-baseline and staging gates pass. Release resumption owner: Codex in `pr-76-local`, accepting the earlier workspace's handoff. Current-head GitHub CI must be checked after push.

### Full merge/release continuation — 2026-11-12

The user explicitly requested the whole merge workflow and a merge attempt. Codex in `pr-76-local` owns staging, merge and production acceptance. Earlier local-only limits are superseded. Candidate `b31861de81a7e6001af968de8d808a92d89e8ac0` passed all three GitHub checks in run `43337108718`; new harness commits require their own current-head checks.

Fresh production export `baseline.wzS4uHcZ` restored into `pr76_baseline_20261113_fresh` in the existing local validation cluster. Dump hash: `bf4bbaa4cea125969ab4922b8e1887c8d37313465d3b0ac6ba7999760b779ccf`. Catalog parity and all 25 public/private table counts and row digests passed. The exact unchanged SQL hash `6ba89bb65b730c02d3b9a1174888587a15a215447e254789d4e30b4b5220cd7a` passed **3 tests, 0 skips**: expected Red, Green, idempotence/preservation, browser-role permission boundaries and missing-table atomic rollback. Clones `scenario-cYD8aD` and `scenario-k44XXP` are verified cleaned. Full commands, comparison normalization, initial mismatch evidence and results: `/Users/admin/.transfer-assessment-pg17/runs/baseline.wzS4uHcZ/pr76-validation/README.md`. The failed staging-password export is retained in `baseline.rzRqsWpy`; production provided the fresh source baseline. This SQL evidence does not establish hosted row visibility or websocket delivery.

Added `learning-progress-realtime` browser acceptance for the two-viewer/draft/membership/reconnect contract, including an isolated evidence INSERT with no parent item update. This explicitly tests the observed `coverage_evidence` auth.uid-restricted policy against the application's anonymous reads; a successful empty SELECT is insufficient. Updated `early-message-recheck` to observe learner lookup at room entry because the lookup now starts while the panel is hidden. Browser harness unit suite: **33 passed** after registering the new workflow; initial registry expectation failure retained in session output. No runtime source or SQL changed in this continuation.

Selected staging checks: new realtime workflow, checklist-management, checklist-coverage, early-message-recheck, guard-mode, assessment-answer, cyberbullying and exit-assessment. Production requires matching affected checks and the deployed frontend, per the acceptance list above. No hosted acceptance has run for this candidate.

Independent harness review found that the browser `online` event's HTTP reconciliation could falsely satisfy the reconnect check. The test now requires a fresh checklist channel acknowledgement and a new remote mutation delivered while continuously online. Read-only MCP inspection independently confirmed an evidence-visibility defect: staging has 49 transfer-evidence rows, while `SET LOCAL ROLE anon` with `auth.uid() IS NULL` sees 0. The existing transfer policy requires auth.uid; browser reads use the anonymous client. This blocks evidence acceptance until repaired without silently broadening data permissions.

Read-only inspection found staging assessment-api v82 (bundle `97d00565fb94cc2775338e8dbac3e4869d80c583f4d9cf1c7ca3d568bbdd6929`) and production v21 (bundle `3421ec777c8316f3e3fca32e847f4e6159ba0c6e7d39dde685c5f9e493a9b037`); ai-api staging v8 and production v6. Source comparison identifies the concurrent analyzer Candidate01 release and already-merged shared tutor prompt as differing inherited dependencies; do not overwrite that release. Shared staging lease at inspection belongs to candidate `fd1ec70a9ee54cb4e728e3d0d327e0efdc26e6bc`, operation `staging-release`, run `d213e20f-f621-4d6f-8d80-bb950f72fcd6`, owner `fix/learning-progress-candidate01`. Next action: obtain staging availability after that owner's cleanup/release, refresh dependency/default-branch state, acquire our exact-candidate lease and apply the validated migration before browser acceptance. No PR76 hosted mutation or production deployment has occurred.
