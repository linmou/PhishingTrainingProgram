# Learning target auto-refresh — issue #75

Status: **frontend implemented and locally verified; pre-PR review passed; local setup blocked for migration and hosted acceptance**. This record does not certify a release.

- Issue: https://github.com/linmou/PhishingTrainingProgram/issues/75
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
