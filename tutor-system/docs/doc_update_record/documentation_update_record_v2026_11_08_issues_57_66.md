<!-- Intent: preserve integration, review and release evidence for issues #57 through #66.
Updated: 2026-11-08. Baseline commit: a69b836. -->

# Issues #57–#66 delivery record

- Owner: root Codex agent; four coding sub-agents own isolated worktrees.
- Authorization: maintainer requested implementation, PR proposal and automatic merge unless blocked by high-risk operations on 2026-11-08.
- Base: remote `no_sign_up`, `a69b836`; primary checkout's two local commits and pre-existing untracked files are outside this batch.
- Type: frontend implementation and documentation; no SQL, Edge or server configuration changes planned.
- Status: local implementation and verification; review, CI and browser acceptance pending.

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
