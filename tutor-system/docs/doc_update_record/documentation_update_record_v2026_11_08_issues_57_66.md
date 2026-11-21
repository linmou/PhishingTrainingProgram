<!-- Intent: preserve integration, review and release evidence for issues #57 through #66.
Updated: 2026-11-08. Baseline commit: a69b836. Locally reviewed candidate: 1b045b9. -->

# Issues #57–#66 delivery record

- Owner: root Codex agent; four coding sub-agents own isolated worktrees.
- Authorization: maintainer requested implementation, PR proposal and automatic merge unless blocked by high-risk operations on 2026-11-08.
- Original base: remote `no_sign_up`, `a69b836`; synchronized through `c74694b` (PRs #69/#70) in integration merge `9e38b79`. Primary checkout's two local commits and pre-existing untracked files are outside this batch.
- Type: frontend implementation and documentation; no SQL, Edge or server configuration changes planned.
- Status: implementation, staging acceptance, synchronized-head local review and CI passed; final documentation commit and merge pending. Production release remains blocked by #68.

## Changed contracts and ownership

| Issues | Owner | Observable change |
| --- | --- | --- |
| #57, #61 | ai_requests | One suggestion-owned room snapshot; only the selected history serializer runs |
| #58, #65 | retire_alternatives | Active AI/context and checklist facade have explicit ownership; historical source preserved separately |
| #59, #60 | checklist_state | Persisted manual result is authoritative; complete progress recomputation after trusted edits |
| #62, #63 | root | Existing evidence action opens current learner evidence; dashboard errors no longer drive network lifecycle |
| #64, #66 | images_timers | Stable unchanged timer state and operation cleanup; one tutor-image service implementation |

## Verification selection

Use focused orchestration, hook and component integration tests for every issue's edge cases, combined deterministic Jest, React production build, TypeScript baseline comparison and required CI (`isolation-harness`, `frontend-jest`, `frontend-build`). Mypy does not analyze these TypeScript/React files; no Python source is changed.

Staging acceptance: combined candidate against `ciubrzggdqesgvfkpolj`, including tutor-response, checklist-management and checklist-coverage journeys, with dashboard/evidence/image interactions as applicable. Keep full history, learner readiness and existing authorization boundaries intact. Shared hosted mutations require the project lease. Provider request packaging is structurally covered locally; live tutor generation exercises the integrated path. No model/prompt policy change is intended.

Production acceptance after approved merge: confirm Render's deployed commit, then affected dashboard, evidence, checklist and image/tutor smoke checks against `zgbufaxooqxeabewktzd`. Existing backend artifacts are dependencies; this batch does not promote different SQL/Edge versions. Failed checks remain open and block completion.

## Evidence

- Root focused run: six suites, 55 tests passed using explicit CI placeholder Supabase variables. The initial invocation omitted these variables and stopped two suites at client initialization; no application failure was established by that invocation.
- New root lifecycle cases: initial failure/recovery, bounded retry, persistent join error, both realtime event types, refresh failure recovery, user changes, unmount and overlapping stale results.
- New evidence cases: detection/verification selection, close/reopen, empty refreshed history, removed/reappearing item and room/learner/checklist/visibility/loading changes.
- Raw local integration evidence: ignored `output/issues-57-66/` in the integration worktree. Baseline full Jest and TypeScript runs are retained separately from candidate results.
- Source refs, final test totals, review disposition, artifact versions, hosted acceptance and cleanup will be recorded as observed.

## Review and baseline

- Untouched remote baseline: 148 suites / 1,510 tests passed, five suites / 93 tests skipped; one snapshot passed. TypeScript reports 439 existing diagnostics.
- Sub-agent source commits: #57/#61 `065e114`, #58/#65 `745b8e0`, #59/#60 `7605c66`, #64/#66 `0a4aa49`. Integration cherry-picks preserve their changes under new commit identities.
- Independent checklist_state review of `065e114`: no blocking findings; independently ran two suites / 30 tests.
- Independent retire_alternatives review of root `742e6a0`: found retained-checklist reopening after learner/room change and late unsubscribed callbacks. Root added checklist owner/room validation and disposed-callback guards, with regression coverage; re-review pending.
- Re-review cleared both stale-scope fixes (two suites / 17 tests). The reviewer also identified missing keyboard handling in the now-active evidence dialog; root added local focus, Tab, Escape and focus-return handling with a regression case.
- Independent images_timers review cleared checklist `7605c66` and retirement `745b8e0`; independently verified archived blobs and unchanged evals. Independent ai_requests review cleared image/timer `0a4aa49` and reran five suites / 92 tests.
- Current Render inspection: service `srv-d1pjtjnfte5s73ce0opg` follows `fix/temporary-grade4-tutor`, live commit `21906cf`, deployment `dep-dblloa08v5cc739fscog`. This differs from documented `no_sign_up` deployment. Production branch configuration is preserved; this batch cannot claim automatic production deployment from its target-branch merge.

## Staging acceptance and remaining release

- Required CI run `42473142100` passed all three jobs on `f9f62e2`. Full combined local Jest passed 152 suites / 1,576 tests (five suites / 93 tests skipped); production build passed. The later focused UI run passed two suites / 18 tests. TypeScript comparison: 439 baseline vs 436 candidate diagnostics, no added normalized diagnostics; three existing test diagnostics fixed.
- Staging tutor-response: `tmp/browser_demo_runs/staging-template-20261108105045-6ac53a83/report.json`, pass with persisted tutor feedback/provider content and cleanup.
- Staging checklist-management: `tmp/browser_demo_runs/staging-template-20261108105126-78ec175e/report.json`, pass with persisted manual checklist/status/priority/text edits, reload and cleanup.
- Staging checklist-coverage: `tmp/browser_demo_runs/staging-template-20261108105205-529145f5/report.json`, pass with real coverage analysis, persisted target progress, subsequent tutor progress context and cleanup.
- Controlled staging UI smoke: `output/issues-57-66/ui-1794135466108/report.json`, pass with persisted evidence, close/reopen, keyboard focus/Escape, persistent dashboard join error, zero implicit reloads, explicit retry and both image-upload rejection paths. No image/avatar mutation occurred. These offline identities are rejected by the existing authenticated upload service; success/storage/database behavior is covered by the focused integration suites, not claimed as live upload success.
- Earlier smoke attempts are preserved: missing client contract header blocked fixture insertion; a text-node locator and asynchronous request-count assertion needed harness corrections; the tutor form had to be opened before locating upload controls. Every attempt verified fixture cleanup and released its lease. These were harness failures, not accepted application defects.
- Visual inspection of the passing evidence screenshot identified the room container constraining the overlay. Root moved the modal into a document-body portal and added explicit full-viewport browser assertions; affected checks are being repeated for this final source change.
- GitHub Codex completed code/security review. Its only code finding requested removing test shebangs. Root and independent images_timers reviewer adjudicated it non-actionable: direct maintainer instructions require them; these tests are outside the application module graph, and exact-head required build/Jest pass. The rationale is recorded in review thread `4505947641`, resolved. All actual independent review findings were fixed and rechecked. No approval requirement was changed.
- Production remains incomplete under [release issue #68](https://github.com/linmou/PhishingTrainingProgram/issues/68), owned by the main integration/release agent. Reconcile Render's selected branch with PR #56's live temporary prompt before releasing this frontend batch; then run matching production acceptance. Do not change deployment composition silently.

## Default-branch synchronization

The maintainer requested importing the new default-branch merges on 2026-11-08. Fetched and merged `c74694b58a68529ccd7755039028e0a5366f25c1` (PRs #69/#70) into this integration branch as `9e38b79`, without conflicts. All 21 incoming files are baseline planning documents; runtime source, dependencies, CI, browser harness and hosted artifacts are unchanged by the merge.

Reviewed the changed product constitution, PRD, architecture and affected learning-progress/AI/conversation epics against this batch. C3/C5 are retired IDs; C2 and R3 carry the relevant values, and NFR-2/AD-1/AD-2 retain server authority. This batch introduces no new progress writer, grading policy, permission rule or model/prompt change. FR-23 still requires current learner evidence; the modal satisfies it through the existing learner-owned projection. The rating auto-send and saved-scenario requirements are existing behavior and remain covered by their current suites. No runtime adaptation was necessary. Earlier dated code-sweep observations remain historical evidence.

Portal candidate `7bb4caa` passed the staging UI smoke in `output/issues-57-66/ui-1794135572186/report.json`: evidence overlay x/y zero and width/height equal the viewport, persisted evidence and keyboard lifecycle, dashboard error/retry, both existing offline upload rejections, zero image/avatar mutations and fixture cleanup. Independent portal review found no actionable findings and reran two suites / 18 tests successfully. Documentation-only synchronization does not invalidate these unchanged frontend/backend artifacts.

Two compact screenshots are retained in `docs/evidence/issues-57-66/` for PR review; full provider input/output, persisted IDs, command logs and failed-attempt evidence remain in the ignored run directories above.

Post-synchronization targeted verification passed seven suites / 101 tests: evidence/dialog, dashboard lifecycle, checklist progress, AI room/history ownership, full conversation context, rating auto-send and saved AI settings. Log: `output/issues-57-66/post-default-merge-jest.log`. `git diff --check` passed. No application artifact changed during synchronization.

## Authorized local final review

The final GitHub Codex review could not start because the account exhausted its review allowance. The maintainer explicitly instructed: “if GitHub Codex review could not start—the account has exhausted its review allowance, you review locally”. This authorizes the local replacement for this PR; repository approval rules are not edited.

Reviewed the full diff from default `c74694b58a68529ccd7755039028e0a5366f25c1` to candidate `1b045b9ced19b59af5eaa6f2cd86791acad53c29` using the local `bmad-code-review` workflow. Three fresh reviewers ran independently without conversation history: `local_blind` received only the diff; `local_edges` inspected the diff and project; `local_acceptance` checked the ten issue bodies, ownership records, source, tests and staging evidence. All three returned no actionable findings. No review layer failed. Root also inspected the changed request, checklist, evidence, dashboard and timer ownership paths and found no concrete regression.

The acceptance reviewer independently reran eight focused suites / 125 tests successfully. A hypothetical upload-success callback synchronously unmounting its component was investigated and dismissed as unsupported by the production callers; it does not establish an application defect. No runtime patch or weakened verification was needed.

Required CI passed on reviewed candidate `1b045b9`: `isolation-harness`, `frontend-jest`, `frontend-build`, run `42475122392`. A fresh fetch confirmed no additional default commits were missing, and `git diff --check` passed. The only subsequent changes record this review. Main integration agent owns final documentation-head CI, merge and the #68 production handoff. No production release or issue completion is claimed from merge alone.
