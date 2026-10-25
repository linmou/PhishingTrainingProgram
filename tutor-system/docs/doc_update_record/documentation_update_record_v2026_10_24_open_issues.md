# Open Issues Integration Record

Intent: preserve the acceptance evidence and delivery state for GitHub issues #2 and #19-22.

Updated: 2026-10-24. Plan baseline commit: `7762cbb`; initial integrated implementation: `79496b6`. Release/integration owner: root Codex agent.

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
| #19 | integrated locally | `e00a4fa`; deterministic recovery checks pass; real-network/browser evidence pending |
| #20 | integrated locally | `5e91f54`; 10/100/1,000-message reads fall from 20/200/2,000 to 1/1/10 in controlled service measurements; browser checks pending |
| #21 | integrated locally | `e0102ca`; 5,000-message assessment-heavy median 82.437 to 17.498 ms; exact output parity and 129 focused tests pass |
| #2 | integrated locally | `79496b6`; actual provider replay confirms acknowledgment stays partial and tutor retains URL follow-up; independent review records remaining evidence gaps |
| #22 | integrated locally | `5f11a1c`; membership/realtime ownership extraction; 23 suites/247 focused tests and exact before/after cost snapshot pass |
| Combined deterministic/build verification | pass | Frozen `5f11a1c`: 149 suites/1,487 tests/1 snapshot pass; 5 suites/93 tests skipped; production build pass |
| Staging acceptance | pending | Exact committed candidate, artifact hashes, selected full affected browser journeys and owned project lease required |
| Merge into no_sign_up | pending | Merge tested integrated candidate preserving unrelated working-tree edits |
| Production acceptance if server changes | pending scope decision | Root owns any required exact-artifact release; no production mutation performed |
| GitHub issue completion | pending | Close only with the issue's acceptance evidence |

## Combined Verification Progress

The initial integrated candidate `79496b6` builds successfully with existing unrelated ESLint warnings. Full Jest initially found 10 failing suites (71 tests): older query mocks did not implement the new bounded/cancellable read chain and one AI-call expectation omitted the new focus identity/preparation fields. These failures remain part of the record. Commit `26f0130` repairs nine affected integration suites and a related room configuration suite without changing production logic: 10 suites / 118 tests pass. The remaining RoomContext expectation was updated to assert the complete new call contract and its 27-test suite passes.

The four CI isolation-harness test files pass: 13 tests. The first local attempt failed in the host Perl locale with `C.UTF-8`; explicit `LC_ALL=C LC_CTYPE=C LANG=C` resolves that execution prerequisite. No application code changed for it. The independent [integrated review](documentation_update_record_v2026_10_24_open_issues_review.md) found no concrete implementation defect; its AI acceptance verdict remains incomplete pending broader semantic and live persisted-lifecycle evidence.

The latest `no_sign_up` workflow and PR-template changes are included. GitHub PR checks are `isolation-harness`, `frontend-jest`, and `frontend-build`; their live results must be inspected before staging acceptance. Root will open the combined PR after local validation, then retain current-head CI, review, staging and compatibility evidence for the owner's final merge decision under the updated release workflow. Frontend production deployment follows Render's `no_sign_up` integration.

Combined [PR #30](https://github.com/linmou/PhishingTrainingProgram/pull/30) is open. Frozen implementation `5f11a1c` passed the full command above with `--silent`: 149 suites, 1,487 tests and one cost snapshot pass, 5 suites/93 tests skipped, 39.876 seconds. Build passes with the same inherited warnings. Independently reviewed performance harness requires stronger realtime provenance, complete response-byte capture and valid bounded feedback follow-up checks before live execution. These are verification-tool corrections; the application implementation remains unchanged.

Select the combined browser scope from the execution plan and release workflow: shared orchestration requires affected lifecycle, Guard, feedback, learner-status and role workflows. Staging/production project refs are `ciubrzggdqesgvfkpolj` / `zgbufaxooqxeabewktzd`. Provider replay evidence must retain full input/output pairs and explicit model/prompt settings outside Git. Any missing live evidence remains open.
