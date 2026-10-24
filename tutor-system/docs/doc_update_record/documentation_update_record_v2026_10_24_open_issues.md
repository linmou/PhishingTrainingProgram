# Open Issues Integration Record

Intent: preserve the acceptance evidence and delivery state for GitHub issues #2 and #19-22.

Updated: 2026-10-24. Plan baseline commit: `7762cbb`. Release/integration owner: root Codex agent.

## Candidate and Scope

Batch: `open-issues-20261024`. Integration branch: `integration/open-issues-20261024`; target: `no_sign_up`.

The baseline merges local `2caa4ae` with upstream `8a92391` (integration merge `7667ba5`). Unrelated changes remain in the primary checkout. Four isolated agents use `gpt-6.1-sol`, medium reasoning; #22 follows the P1 changes. The [execution plan](../../../plan/open-issues-20261024/execution-plan.md) assigns ownership and acceptance.

Changed contracts under investigation: message synchronization/recovery, feedback loading/cache, assessment display ordering performance, authoritative learner progress supplied to tutor generation, and RoomContext responsibility ownership. Schema and hosted function changes are not yet proposed. Existing backend authorization, learner progress transitions and assessment readiness remain dependencies.

## Baseline Evidence

On committed combined baseline `7762cbb`, from `tutor-system/`:

```sh
rtk proxy env CI=true REACT_APP_SUPABASE_URL=http://127.0.0.1:54321 REACT_APP_SUPABASE_ANON_KEY=ci-placeholder npm run test:regression -- --runInBand
```

Exit 0: 143 suites passed, 4 skipped; 1,449 tests passed, 92 skipped; 50.525 seconds. No snapshots. Existing React act/deprecation warnings are present. This check used mocked services and does not establish live behavior.

## Acceptance and Delivery

| Gate | State | Evidence or next step |
| --- | --- | --- |
| Existing baseline deterministic suite | pass | Counts and exact command above |
| #19 | implementing | Before/after request/byte/latency measurements and recovery integration checks pending |
| #20 | implementing | Batched feedback and isolation/concurrency checks pending |
| #21 | implementing | Before/after ordering measurements and lifecycle regressions pending |
| #2 | investigating/implementing | Authoritative learner progress context mismatch identified; actual-flow replay and independent audit pending |
| #22 | waiting for #19/#20 | Refactor after P1 integration, using their coherent boundaries |
| Combined deterministic/build verification | pending | Run after integration and conflict resolution |
| Staging acceptance | pending | Exact committed candidate, artifact hashes, selected full affected browser journeys and owned project lease required |
| Merge into no_sign_up | pending | Merge tested integrated candidate preserving unrelated working-tree edits |
| Production acceptance if server changes | pending scope decision | Root owns any required exact-artifact release; no production mutation performed |
| GitHub issue completion | pending | Close only with the issue's acceptance evidence |

Select the combined browser scope from the execution plan and release workflow: shared orchestration requires affected lifecycle, Guard, feedback, learner-status and role workflows. Staging/production project refs are `ciubrzggdqesgvfkpolj` / `zgbufaxooqxeabewktzd`. Provider replay evidence must retain full input/output pairs and explicit model/prompt settings outside Git. Any missing live evidence remains open.
