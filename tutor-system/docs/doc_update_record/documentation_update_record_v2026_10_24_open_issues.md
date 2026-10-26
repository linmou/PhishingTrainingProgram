# Open Issues Integration Record

Intent: preserve the acceptance evidence and delivery state for GitHub issues #2 and #19-22.

Updated: 2026-10-26. Plan baseline commit: `7762cbb`; initial integrated implementation: `79496b6`; reconnect repair: `f5f38a5`. Release/integration owner: root Codex agent.

## Candidate and Scope

Batch: `open-issues-20261024`. Integration branch: `integration/open-issues-20261024`; target: `no_sign_up`.

The baseline merges local `2caa4ae` with upstream `8a92391` (integration merge `7667ba5`). Unrelated changes remain in the primary checkout. Four isolated agents use `gpt-6.1-sol`, medium reasoning; #22 follows the P1 changes. The [execution plan](../../../plan/open-issues-20261024/execution-plan.md) assigns ownership and acceptance.

Changed contracts: message synchronization/recovery, feedback loading/cache, assessment display ordering performance, authoritative learner progress supplied to tutor generation, and RoomContext responsibility ownership. Delivery includes the three-table Realtime publication prerequisite and exact assessment-api dependency promotion recorded below. Existing backend authorization, learner progress transitions and assessment readiness remain dependencies.

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
| Staging acceptance | in progress | SQL applied and assessment-api76 deployed; all eleven selected browser workflows passed on matching runtime artifacts; reconnect repair and complete performance acceptance remain open |
| Merge into no_sign_up | pending | Merge tested integrated candidate preserving unrelated working-tree edits |
| Production acceptance | pending | Root owns SQL and exact assessment-api promotion after current-candidate authorization and merge; production remains unchanged |
| GitHub issue completion | pending | Close only with the issue's acceptance evidence |

## Combined Verification Progress

The initial integrated candidate `79496b6` builds successfully with existing unrelated ESLint warnings. Full Jest initially found 10 failing suites (71 tests): older query mocks did not implement the new bounded/cancellable read chain and one AI-call expectation omitted the new focus identity/preparation fields. These failures remain part of the record. Commit `26f0130` repairs nine affected integration suites and a related room configuration suite without changing production logic: 10 suites / 118 tests pass. The remaining RoomContext expectation was updated to assert the complete new call contract and its 27-test suite passes.

The four CI isolation-harness test files pass: 13 tests. The first local attempt failed in the host Perl locale with `C.UTF-8`; explicit `LC_ALL=C LC_CTYPE=C LANG=C` resolves that execution prerequisite. No application code changed for it. The independent [integrated review](documentation_update_record_v2026_10_24_open_issues_review.md) found no concrete implementation defect; its AI acceptance verdict remains incomplete pending broader semantic and live persisted-lifecycle evidence.

The latest `no_sign_up` workflow and PR-template changes are included. GitHub PR checks are `isolation-harness`, `frontend-jest`, and `frontend-build`; their live results must be inspected before staging acceptance. Root will open the combined PR after local validation, then retain current-head CI, review, staging and compatibility evidence for the owner's final merge decision under the updated release workflow. Frontend production deployment follows Render's `no_sign_up` integration.

Combined [PR #30](https://github.com/linmou/PhishingTrainingProgram/pull/30) is open. Frozen implementation `5f11a1c` passed the full command above with `--silent`: 149 suites, 1,487 tests and one cost snapshot pass, 5 suites/93 tests skipped, 39.876 seconds. Build passes with the same inherited warnings. Independently reviewed performance harness requires stronger realtime provenance, complete response-byte capture and valid bounded feedback follow-up checks before live execution. These are verification-tool corrections; the application implementation remains unchanged.

## Live Preconditions and Recovery Correction

All three actual GitHub checks passed for PR head `5f11a1c` (Actions run `40157280627`). Subsequent harness/recovery changes require fresh affected checks. Harness correction `6d6fefa` passes seven tests and independent review: complete fixed-window HTTP captures, executable healthy scan bounds, matching incoming websocket events, and bounded one-message feedback refreshes.

Read-only project-scoped MCP inspection on both staging and production found no `public.messages`, `public.message_feedback` or `public.rooms` membership in any publication. Staging's `supabase_realtime` exists but has no public tables. Staging assessment/AI function versions observed: assessment-api 75 (`c2d1c3ef1d0127853c2048dff006101e4a371eab474b9e5a50282f24f5bd6347`), ai-api 7 (`3bd3415490bed08a5992b2fff8db135b897bd1f02c45f5fd249de3bb1f4ab519`). No deployment performed.

A read-only staging subscription first reported `SUBSCRIBED`, then emitted the structured system payload `status=error`, `extension=postgres_changes`, message `Unable to subscribe to changes with given parameters. Please check Realtime is enabled ...`. This proves socket join alone is insufficient for healthy database-stream classification. Fix `ae8798a` handles that error, immediately reconciles and retains five-second degraded recovery until a genuine reconnect. Root reran hook/scheduler/provider-ingress integration: 3 suites/22 tests pass; agent also reports 9 focused hook/scheduler and 42 provider/assessment tests with unchanged cost snapshot.

The intended single-channel subscription requires all three public tables. A minimal publication-membership artifact is being validated separately before any hosted application. Existing RLS/ACLs and readable row contracts must remain unchanged, with no private schema publication. Membership gates and local Red/Green validation, then staging websocket/browser acceptance, apply under the updated server workflow. Root remains the sole hosted release owner.

The configured Dashscope endpoint initially timed out from both evaluator and independent root HTTPS probe. Failed attempts are retained in the independent review package. A later root probe returned HTTP/2 404 in 0.72 seconds, so the reviewer resumed fresh calibration with identical scoped cases/settings. Semantic acceptance remains open until actual results are recorded; transport recovery alone is not a model-quality result.

Select the combined browser scope from the execution plan and release workflow: shared orchestration requires affected lifecycle, Guard, feedback, learner-status and role workflows. Staging/production project refs are `ciubrzggdqesgvfkpolj` / `zgbufaxooqxeabewktzd`. Provider replay evidence must retain full input/output pairs and explicit model/prompt settings outside Git. Any missing live evidence remains open.

## 2026-10-26 Acceptance Checkpoint

Required GitHub checks passed at `ee5da9e`, run `40251428142`. Subsequent repair `f5f38a5` requires current-head CI and coordinated live verification. The candidate app is served at `http://127.0.0.1:3116`, with source tree `5b9593826fe4c27c2be5f7cef9713b73020f8b9b` and explicit staging configuration. No production mutation has occurred.

The full selected browser run on matching pre-repair runtime artifacts passed ten workflows; the corrected room-assessment-setup workflow then passed at `c8222a9`. Its evidence is `tmp/browser_demo_runs/staging-template-20261026004303-8a4aae47/report.json`, including persisted answer/result identity and cleanup. Together these cover all eleven selected workflows; affected evidence will be revalidated for the reconnect repair. The scoped semantic comparison and its native-condition failures remain disclosed in the independent review record; no full historical AI benchmark is claimed.

The actual baseline run `output/playwright/room-performance-1792976244929-727fe825/report.json` passed against app `7762cbb8eaeccf8c92360dc8eb335219651cd4b1` on port3115, using harness `ee5da9e`. In 60-second healthy windows it observed 30 message reads / 2,531,640 response-body bytes at100 messages and 30 reads / 25,376,640 bytes at1,000 messages. Initial feedback reads were200 and2,159 respectively, with join durations1,962ms and16,531ms. The larger count includes actual duplicate legacy requests. Both rooms, dependent rows and both named users were removed and verified absent. This is a measured baseline; candidate comparisons remain pending.

Candidate run `output/playwright/room-performance-1792976102901-12d608cf/report.json` confirmed all five subscription bindings, one message audit /8,418 bytes and zero feedback reloads over60seconds for ten messages, plus matching WebSocket and visible INSERT/UPDATE/room/feedback events. Missed INSERT and old UPDATE recovered through HTTP in5,680ms, but the replacement socket did not rejoin its room channel within30seconds. The run correctly failed; all fixture cleanup passed and its lease was released. A deterministic installed-SDK reproduction identified reconnect teardown cancelling the channel rejoin timer. The [recovery record](documentation_update_record_v2026_10_26_realtime_channel_recovery.md) documents the focused repair,39 passing checks and independent review. Complete live performance acceptance is still open.

## Imported Edge Dependencies

On 2026-10-25 root downloaded deployed function sources through project-scoped Supabase MCP and compared each file with the integration candidate. Staging assessment-api75 and production assessment-api17 contain identical source files despite different project bundle hashes. Both differ from the candidate in two imported files: `src/services/prompts/activeTutorAgentPrompt.ts` (candidate SHA-256 `53f677542d22e541443c44cf807d4035509836b29763df7945491e250ae23b83`) and `src/services/assessmentRendering.ts` (`7801710bbdff219a43a50bf29448f525bfe1b3793a5f6b429e2ae3a2d4464985`). The entrypoint and its other deployed dependencies match. Staging ai-api7 source matches the candidate.

Although the changed prompt is used by the ecological client builder and the changed ordering function is not called by the handler, the assessment-api bundle includes these shared files. Root will promote its exact dependency closure under the server release workflow, after the publication SQL, and verify deployed files against the frozen candidate. This corrects the earlier frontend-only scope assumption. There is no identified server request/response contract change; focused handler tests and the full affected staging/production lifecycle journeys remain required. ai-api is an unchanged dependency and will be inspected rather than redeployed.

Raw MCP source/metadata, candidate manifest and local command results are retained under `output/open-issues-release-20261025/`. The existing Docker-free `scripts/deploy-assessment-api.js` builds a transitive source manifest and uses the Management API. Root's dry-run succeeded; the initial bare `deno` test command failed because Deno was absent from PATH. The failed log is preserved while the implementation agent resolves the local executable and completes focused handler validation. No hosted deployment has occurred.

The follow-up audit resolved the executable as `/Users/admin/.deno/bin/deno` (2.9.7). Handler tests passed 45/45 with `test --allow-env --allow-net --allow-run supabase/functions/assessment-api/index.test.ts`; explicit cached Deno checking passed. Five focused Jest suites passed 135/135: ecologicalTutorCall, transferTutorRequestV3, assessmentRendering, assessmentOrdering.regression and transferAssessmentGoldenFixtures. The initial cached-only Deno attempt lacked the esm.sh Supabase import; the network-enabled run completed successfully. Raw logs are `/tmp/assessment-dependency-deno-network-20261025.log` and `/tmp/assessment-dependency-deno-check-20261025.log`, with copies retained in the batch evidence directory.

The 15-file assessment-api dry-run source manifest SHA-256 is `acb482c2f55a6d7b36ee95cea85d757e73b388473388f48e872b6d9a8ad0b024`. Independent dependency review found no code defect: the handler uses canonical transfer-context/request builders rather than the ecological chat builder, and parse/render/validation rather than message ordering. Its assessment-generation system prompt is independent. Required CI run `40215054409` passed all three checks at `335fd48`; subsequent evidence-only commits require current-head checks before hosted writes. Root will bundle-check under the exact lease, apply SQL, promote this source closure, compare live per-file hashes and run the full selected browser scope.
