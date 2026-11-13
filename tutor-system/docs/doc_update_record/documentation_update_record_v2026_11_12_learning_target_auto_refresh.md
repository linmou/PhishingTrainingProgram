# Learning target auto-refresh — issue #75

Status: **manual-form preservation and database-stream-readiness repairs pass local and controlled browser verification; PR remains draft**. Both fixes are available on localhost. Historical uninstrumented failures cannot be conclusively attributed to the demonstrated readiness gap. Latest continuation below supersedes historical checkpoints. PR76 is not merged or production released.

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

### Evidence repair and integrated verification — 2026-11-12

PR #79 merged as `4da7cc2741da44419338e40441eb213e371d2dfa` and is integrated in this branch at `b6e5789`. All three required CI checks passed on that integrated head. Render reports that default commit live in deploy `dep-dbr5p9u1egvs73fdt700`; automatic deployment remains enabled. PR76 briefly acquired and released two staging leases without hosted writes while integrating and investigating the evidence defect. No lease was retained during local repair.

The repair preserves existing table RLS/grants. `read_learning_evidence` uses the current API's application UUID identity model, then a service-role-only RPC requires the active checklist's exact learner or owning tutor with an active profile. It explicitly projects evidence fields without private assessment answers. This reuses the existing offline identity boundary; it does not introduce cryptographic authentication. The frontend requests scoped evidence separately, attaches rows only to matching items, and surfaces read failures.

Evidence INSERT/UPDATE touches parent item timestamps under the existing invoker permissions and write guards. Reassignment touches both parents. It does not change progress/status or run judging. Existing checklist-total aggregation still runs after timestamp touches; same-transaction learning events can produce an additional parent update. No concurrency deduplication mechanism is introduced. The browser diagnostic supplies the normal transfer-write context and writes only evidence; it verifies timestamp notification without progress/content changes.

Amended SQL SHA-256: `36760ca5352aae0e3ff1b41a1331e1f7ca667a260605eb095a726ce4f482b9d9`. Fresh-baseline harness **3 passed, 0 skipped**, including real learner/tutor evidence visibility; unrelated actor, wrong room and inactive checklist denial; anon/authenticated RPC denial; INSERT/UPDATE/reassignment timestamp notification; rollback; Guard refusal; and preserved legacy anonymous evidence INSERT. Final disposable clones `scenario-A5Cym0` and `scenario-juUsGi` are cleaned. Full evidence: `/Users/admin/.transfer-assessment-pg17/runs/baseline.wzS4uHcZ/pr76-validation/evidence-read-repair.md`.

Edge suite: **53 passed**, including type checking, with `/Users/admin/.deno/bin/deno test --sloppy-imports --allow-env --allow-net --allow-run --allow-read tutor-system/supabase/functions/assessment-api/index.test.ts`. Frontend focused tests: **36 passed**. Initial full regression exposed 14 failures in two mocks still using anonymous nested evidence. Updating those mocks to the API contract preserved and strengthened chronology, export and item-scope assertions; affected suites **23 passed**. Final full Jest **154 suites / 1,614 tests / 1 snapshot passed**, 5 suites / 93 existing skips, exit 0, 42.798 seconds (execution session `86612`). Production build passed with existing warnings; browser harness **33 passed**. Standalone tsc remains failing on 436 diagnostics in 37 preexisting files, none in the changed frontend files.

Scoped code-smell monitor has zero ESLint errors/warnings across the four changed runtime modules. Existing repeated-read candidates do not establish redundancy in the new scoped evidence request. Several unavailable tools and package-wide type/dependency findings mean incomplete coverage; report retained in ignored `audits/pr76-evidence-code-smell/`. Re-run current-head CI, complete independent repair review, acquire the exact-candidate staging lease, apply amended SQL before the dependent Edge function, and run the selected acceptance journeys. Production gates remain open.

Three independent repair reviewers converged on pass for scoped evidence access,
notification/guard semantics, frontend mapping/failure propagation and local
validation. The strict phase gate accepted round 1 (`pr76_evidence`, `review` to
`staging`). Audit JSON is locally ignored under `audits/`. The reviewers explicitly
bounded untested concurrency interleavings and did not certify hosted delivery.

### Staging application and first acceptance — 2026-11-12

Candidate `9a4da2e077542f7ce292817beceaf495773e749d` passed all required CI in run
`43341064957`. Under its owned staging lease, Supabase MCP applied the exact
amended SQL successfully. Catalog readback shows seven publication members
(four additions plus the original three), the evidence trigger, denied RPC
execution for anon/authenticated, and allowed execution for service_role.
Assessment-api then deployed as **v83**, bundle
`cb53eee4fe5ecfc4f252ac6e08d9fa9bdf69ac7c398f7443f46beffba1fc1514`, transitive source
manifest `4eab5fa629fa0f2327321c44b54447cf8aae27f33323064ec119119aa01b68ce`.
Application observed by 2026-11-13 00:59:48 UTC. ai-api was not changed.

The first `learning-progress-realtime` run failed after the tutor entered targets:
the learner remained at the waiting-for-targets view for 90 seconds. This occurs
before priority/evidence/reconnect checks; none of those are certified. Failed
screenshots/report remain in
`tmp/browser_demo_runs/staging-template-20261113005948-20e3693e/`. Its one created
room and related data were cleaned successfully, and the parent lease was then
released for diagnostic candidate preparation. Staging remains on SQL + v83;
production is untouched by PR76. Added request and final-state capture to the
workflow to distinguish failed draft promotion from event/read delivery on the
next run. Harness syntax and 33 unit tests pass. Release owner remains Codex in
`pr-76-local`; next action is diagnose and repair this setup failure, then complete
all selected staging checks before merge.

Diagnostic candidate `7296222` retained the exact deployed runtime. Run
`staging-template-20261113010748-c6decd51` passed target setup, both-viewer priority
(826ms), status (841ms), evidence-only delivery (1752ms), evidence modal refresh
(1577ms), draft/card preservation and reopen (816ms). It then failed in the test
probe: `window.__progressTestSockets` was undefined because `addInitScript` was
installed after the runner loaded the app and hash-only navigation did not run it.
The harness now reloads the learner page before the journey to install the probe.
Cleanup passed and the lease was released. The earlier setup failure remains
unexplained; a successful diagnostic setup alone does not close that uncertainty.
The next complete run and repeated setup will retain request/state evidence.

### Staging behavioral checks — 2026-11-12

Runtime/SQL remain identical to `9a4da2e`; harness head `33aaeec` passed all three
required CI checks. Reports under `tmp/browser_demo_runs/`:

| Run suffix | Workflow | Result |
| --- | --- | --- |
| `20261113011105-40df66f9` | learning-progress-realtime | Pass; both setup orders, draft/card/evidence retention, learner readonly, offline catch-up and fresh subscribed delivery |
| `20261113011154-75a4f674` | learning-progress-realtime repeated | Pass; all same checks |
| `20261113011243-bf2126cb` | checklist-management | Pass |
| `20261113011257-85c1dcba` | checklist-coverage | Pass |
| `20261113011322-e4ac0954` | early-message-recheck | Pass |
| `20261113011350-fff29592` | guard-mode | Failed in harness: rating submission auto-sent the message, then old test clicked disabled Send again |
| `20261113011537-aedd3918` | assessment-answer | Failed in shared login before room fixtures: route wait used page load rather than DOM readiness |
| `20261113011747-d12d0d26` | cyberbullying | Pass |
| `20261113011938-4aa77e4b` | exit-assessment | Pass |

Every created/used room cleanup passed. Realtime observed latencies across the
two complete runs: priority/status 1058–1682ms; evidence-only 1244–1286ms;
reconnect catch-up 804–1309ms; a subsequent mutation after fresh channel
acknowledgement 503–504ms. These checks do not involve manual Refresh.

The Guard workflow now reuses the existing tested learner-send helper. Login
waits for DOM-ready route navigation and reports the actual route/login error on
failure; the earlier timeout had no such diagnostic, so its exact cause is not
established. The realtime harness now captures GET responses as well as POSTs
and checks the actual learner panel at 390px. Supabase analytics inspection was
attempted for the first setup timeout; the current logs endpoint returned a
backend error even for a basic latest-five query. No platform-cause claim is
made. Keep the first failure explicit and repeat setup with diagnostics before
the merge decision. Lease `pr76-staging-33aaeec` released after fixture cleanup;
the next diagnostic commit requires a new lease. Staging stays on SQL + API v83.

Independent harness follow-up found two test-isolation gaps: the mobile viewport
was not restored, and response listeners could survive diagnostic failure. Both
are repaired in finally cleanup; diagnostic failures retain the original journey
error. Browser harness unit suite passes 33 tests and modified scripts pass syntax
checks. These are harness-only changes; deployed runtime hashes are unchanged.

### Completed staging runs and merge decision — 2026-11-12

Candidate `f56390666e4e724d0d75271c034a8c416efcdb51` passed all three required
checks in GitHub run `43344711827`. Under its exact-candidate staging lease:

| Run suffix | Workflow | Result |
| --- | --- | --- |
| `20261113012713-07ef06ec` | guard-mode | Pass after duplicate-send harness repair |
| `20261113012809-2c652734` | assessment-answer | Pass: pass/fail/retry, recovery, cancellation and real-provider follow-up |
| `20261113013054-e1f4b0bb` | learning-progress-realtime | Pass, including GET/request diagnostics and actual 390px learner layout |
| `20261113013148-accc9243` | learning-progress-realtime repeated | Pass with the same checks |

Reports and screenshots are retained under `tmp/browser_demo_runs/staging-template-<suffix>/`.
All fixture cleanup entries passed. The latest lease was released after cleanup.
Staging MCP readback still reports assessment-api v83 with bundle
`cb53eee4fe5ecfc4f252ac6e08d9fa9bdf69ac7c398f7443f46beffba1fc1514`;
SQL and runtime artifacts are unchanged from the earlier complete passes.
All eight selected workflow types have now passed, with four complete realtime
passes on unchanged runtime code. The first new realtime run measured remote
priority/status 1160/1579ms, evidence-only 1126ms, reconnect catch-up 800ms and
post-rejoin new mutation 517ms. This is evidence of observed successful behavior,
not proof that the initial timeout was repaired.

Independent follow-up inspected membership null-to-learner transitions, scope
cleanup, local draft promotion, serialized reads and subscription catch-up. No
deterministic indefinite race was established. The first failure retained no
request/storage/database snapshot, and available platform logs could not be
retrieved. Its screenshots cannot distinguish unpromoted local targets from
persisted targets missed by the learner. The initial setup timeout remains
unexplained; no speculative runtime patch was made.

The latest base `43a15d8e9c59f62689eff1e2e3837158574b84c1` only records the
analyzer release's production acceptance. It is integrated without runtime or
SQL changes; current-head CI must still pass after this evidence commit.
Per the PR template risk gate, accepting this unresolved verification uncertainty
requires an explicit maintainer decision. Codex owns resumption: after that
decision and current-head checks, recheck deployment/source preconditions,
coordinate Render, merge, promote SQL then Edge/frontend, and run production
acceptance. Production has no PR76 changes; issue #75 remains open.

### Further setup investigation and repair — 2026-11-12

The maintainer explicitly chose to keep PR76 draft and investigate further.
Current-head CI passed on `3af5389` before the following repair. The diagnostic
`tmp/pr76-setup-stress.cjs` drives real UI target setup in both entry orders,
varies tutor membership-response delay from 0 to 1500ms, and records requests,
session/checklist state, local draft and both panels. It reuses the existing
runner's environment/lease/fixture ownership and cleanup checks; its own SHA-256
is recorded in `setup-stress.json` because it overrides the selected workflow.

First stress run `20261113014024-07fb266e` passed ten cases before a diagnostic
route callback failed during navigation. All eleven recorded rooms were cleaned
by the owned recovery script, documented in `recovery.json`; the maintainer
authorized removal of that stopped run's stale local fixture lock. The harness
now awaits route completion and retains navigation-related route errors.

Run `20261113014404-c0dfaa03` passed twenty cases, then reproduced a real form-loss
bug with a 500ms membership response delay. The tutor had typed targets, but the
manual form disappeared before Submit could execute. Captured evidence shows
one valid learner session, no initialize-checklist request, no stored local
draft and no checklist. All twenty-one fixture cleanups passed and the owned
lease was released. This differs from the original post-submit failure, whose
tutor screenshot already displayed target cards; it does not establish that
failure's cause.

Controlled real-hook/real-panel tests reproduced four failures: same-room learner
resolution resets the open form, and successful/pending/failed reads discard its
typed values. The repair separates setup-form identity (room/account/mode) from
learner-read scope, preserves the form during loading/error states, and keeps
read errors and Retry visible. Room/account changes still clear the form.
Independent review caught hidden errors in the first repair; a new failing
assertion confirmed that gap before it was corrected. Final focused validation:
**3 suites / 57 tests passed**, including fifteen timing probes, exact submitted
targets/learner, visible errors and successful Retry without losing input.

Before the final warning adjustment, full frontend regression passed **155
suites / 1629 tests / 1 snapshot**, with 5 suites / 93 existing skips; production
build passed with existing warnings. Affected panel regressions were rerun after
that adjustment; final build/current-head CI and hosted setup validation must
complete for this new frontend candidate. SQL and assessment-api remain unchanged
on staging. The original post-submit timeout remains open and production is
untouched. Keep PR76 draft as directed.

### Localhost and post-submit reproduction — 2026-11-12

The maintainer requested a localhost for manual testing, followed by continued
investigation. `http://localhost:3106` serves the current local frontend against
staging; it compiled successfully and returned HTTP 200. Application source was
held unchanged during this diagnostic pass. The fifteen local setup regressions
pass; nineteen test-file lint findings remain outstanding, so no clean quality
gate or merge readiness is claimed.

Run `20261113020833-ffadc717` reproduced the original waiting symptom after
submission. A controlled membership response was released after manual text entry;
the form retained its text and submitted successfully. Database and tutor HTTP
reads confirm the active learner checklist and both target items. The local draft
was cleared. The learner's last checklist read was empty before the commit, and
it made no later read while waiting twenty seconds. The tutor displayed saved
targets; the learner still displayed the waiting view. This rules out failed
target persistence in this reproduction. It does not yet distinguish a missing
subscription/event from a missed client invalidation, or prove the same underlying
cause as the first historical failure.

Websocket event capture was then added only to the untracked diagnostic script.
Run `20261113021020-cc174b77` passed 24 cases with full page transitions;
`20261113021255-23b9fd1d` passed 24 with ordinary hash navigation retaining the
same realtime client. Eight fresh-browser first-entry runs also passed:
`20261113021555-199b0d18`, `20261113021607-5a26416f`,
`20261113021619-0f757070`, `20261113021630-d2d85877`,
`20261113021641-a0f60b7f`, `20261113021652-f18da536`,
`20261113021706-990ca660`, `20261113021720-770677ca`.
These successful retries do not repair or explain the captured failure. Reports
are under `tmp/browser_demo_runs/staging-template-<suffix>/`; diagnostic records
include actual uncommitted runtime hashes. All 57 rooms across these eleven
reports were cleaned and the diagnostic staging lease released. The localhost
server remains available for manual testing. Next investigation boundary:
capture channel acknowledgement, PostgreSQL readiness and notification events
during a failing first-entry run. No additional runtime patch was made in this pass.

### Readiness-gap repair — 2026-11-12

The maintainer requested fixing the remaining learner waiting behavior. Twenty
ordinary first-entry repetitions passed without reproducing a natural failure.
Captured websocket traffic and the installed SDK show channel `SUBSCRIBED`
arrives before the separate `system` event reporting PostgreSQL readiness. The
hook previously reread on channel join but ignored successful database readiness.
A write in that interval can therefore remain absent from the learner projection
when its notification is missed.

Added a real-hook regression with an initially empty learner read, channel join,
saved targets and later PostgreSQL readiness without a row event. Before repair:
**1 failed / 16 passed** (session `69269`). A controlled real-browser run delayed
the database-ready message five seconds and withheld four intervening row events:
`20261113034155-be3af0c9` failed after twenty seconds despite a persisted checklist
and released readiness. This fault injection reproduces the failure mechanism;
it is not a captured causal trace of the earlier natural failures.

The small hook repair invalidates the current projection on successful PostgreSQL
readiness using the existing bounded debounce. Stale-generation and database-error
guards remain in place; writes and polling behavior are unchanged. Regression
suite now **17 passed** (session `14285`), including stale-room readiness rejection.
Controlled browser Green `20261113034252-f1e809ee`: readiness released at
03:43:02.419Z, learner checklist read at 03:43:02.793Z returned the saved checklist,
and the target displayed automatically. Repeated controlled cases before/after
learner entry both passed in `20261113034350-1dc427b1`. The ordinary full realtime
workflow passed in `20261113034445-5930022d`. All fixture cleanup entries passed.

Final frontend regression: **155 suites / 1630 tests / 1 snapshot passed**, with
5 suites / 93 existing skips (session `41369`). Production build passed with
existing warnings (session `93046`). Setup timing regressions remain **15 passed**;
the nineteen introduced test lint findings were fixed. Three independent reviews
converged on all three blocking readiness criteria; strict phase gate accepted
(`audits/pr76_readiness_review_iteration1_summary.json`). Review certifies the
demonstrated gap and preserves uncertainty about historical attribution.

Runtime modifications are limited to setup-form preservation in the existing
hook/panel and the readiness event handler. No new SQL or Edge artifact is
required. The latest source is served at localhost:3106 for manual testing. Keep
PR76 draft as instructed; production is unchanged.

Scoped code-smell follow-up reports zero ESLint errors/warnings across the three
changed runtime modules and new setup timing tests. Broader coverage is incomplete:
unavailable duplication/dead-code/security tools, existing package advisory
findings and standalone type errors remain recorded in
`audits/pr76-readiness-code-smell/`. The owned diagnostic staging lease was
released after cleanup; localhost remains running.

### Follow-up: preserve manual text when saved targets arrive (2026-11-13)

Intent: close the successful-background-read case missed by the earlier setup-form repair.
Reviewed baseline: `0395dc94d0d41d7b7f14a90ce0c058f8d6895309`.
Three independent reviewers reproduced a remaining P2: after an empty read, type
manual targets, then deliver a populated checklist through a database notification.
The panel switched branches and unmounted the textboxes. The preservation test
failed with the textbox absent (session `3395`).

The panel now keeps the manual form mounted while open. When a saved nonempty
checklist arrives, it preserves both text fields and explains that the tutor can
copy the text or Cancel to view/edit the saved targets. Creation is disabled,
including keyboard submission, so the conflict cannot silently replace saved
targets. Local draft promotion and conversion from a legacy checklist remain available.

`useChecklist.reviewRemoteSetup.test.tsx` checks both database notifications and
database-ready events using the real hook/panel, retains both fields, rejects
submission without an API call or local draft write, and checks Cancel reveals
the saved targets. Full frontend verification: **156 suites / 1632 tests / 1
snapshot passed**, with 5 suites / 93 existing skips (session `28233`). Production
build passed with existing warnings (session `16359`). This is local frontend
verification; no new hosted staging acceptance or production release is claimed.
Updated runtime hashes are recorded in the candidate manifest. PR76 remains draft.

Three independent repair reviews passed all criteria; the strict review gate
accepted `audits/pr76_remote_setup_fix_review_iteration1_summary.json`. Scoped
ESLint is clean after replacing an empty test `act` with an accessible async
query and documenting the direct form-submit check. The two regression cases
passed again after that test-only cleanup. Broader smell-monitor coverage remains
incomplete because optional analyzers are unavailable; existing standalone type
errors and dependency advisories are outside this frontend repair.
