# TransferLearning Refactor Verification

Intent: record the implementation checks and their limits for the 2026-09-29 transfer refactor.

Date: 2026-09-29. Worktree: `transfer_learning_refactor_plan`. Baseline commit: `d2fb0bed60ac16be953b1e0ef00c6d01f9197f39`. The refactor and analysis-event fix migrations have been applied to staging project `ciubrzggdqesgvfkpolj` and archived.

## Changed factors

- Transfer targets now come from approved learner-scoped room checklist items, with a persisted room capability flag. Template names no longer initialize transfer targets.
- Persisted learner messages receive semantic evidence analysis before assessment preparation. The server applies events to the existing progress pair.
- The prepared assessment is `{ reason, target_item_id, assessment }`. Eligibility routes the next AI-generated response to assessment preparation before the shared tutor, while teacher review and explicit send remain required.
- Reviewed delivery checks current target, learner, Guard, feedback, and assessment state. The public message remains `response_mode=assessment`; private answer material stays server-side.

## Executed checks

| Command and scope | Result | Evidence |
| --- | --- | --- |
| `CI=true npm test -- --watchAll=false --runInBand --silent --testPathPattern='(AssessmentDraftEditor\|transferAssessmentUiAdapter\|RoomContext.transfer\|RoomPagePost.transfer\|transferAssessmentGoldenFixtures\|transferTutorRequestV3\|ChecklistPanel.transfer\|useChecklist.smartGeneration\|transferAssessmentApiContract)'` from `tutor-system/` | Passed: 17 suites, 286 tests. | Includes room routing, answer lifecycle, teacher review, concurrent send, checklist ownership, absent/zero-target setup, and golden fixtures. |
| `npx deno test --allow-run --unstable-sloppy-imports supabase/functions/assessment-api/index.test.ts` from `tutor-system/` | Passed: 16 tests. | The stateful test starts with one approved custom item, applies actual classified learner evidence, prepares a mandatory assessment, sends a reviewed public assessment, processes an answer, and checks provider call count and operation order. |
| `node --test evals/promptfoo/v1/transfer/current-assessment-contract.test.js` from repository root | Passed: 2 tests. | Two different rooms retain their own approved target and evidence IDs; unknown target/evidence IDs are rejected. |
| `npm run build` from `tutor-system/` | Passed with existing lint warnings. | CRA production bundle compiled. |
| `npx tsc --noEmit --pretty false` from `tutor-system/` | Repository check fails on existing tests and types outside the changed production files. | Filtered output for changed production and transfer test paths contained no errors after the refactor fixes. |
| `git diff --check` from repository root | Passed. | No whitespace errors. |

## Staging browser run

- Applied `20260929000000_transfer_learning_refactor.sql` and `20260929000001_transfer_analysis_event_fix.sql` to staging. Deployed the refactored `assessment-api` Edge Function with its provider configuration.
- In Chromium against the staging-backed CRA app, tutor `327a8707-4dc0-4320-a4e3-318fbb0b327a` enabled transfer learning in room `078eaa29-5d28-414c-a215-2248cf41ea93`; learner `646675bd-493c-4092-a5b7-5225e93f6466` joined, posted evidence, and received a tutor-approved target. Semantic analysis advanced the target to `partially_covered/basic`.
- After the assessment prompt was tightened to the validator's exact JSON shape, the real provider generated a bank-email transfer question. The tutor reviewed and sent it; the learner selected C and saw `Correct.`. Staging assessment `e1ab43b4-571c-4a3e-8ca1-d4f9e94c4f89` is `passed`, with one applied attempt and checklist completion `100.00`. The provider attempt log shows two invalid attempts under the former prompt and one valid attempt under the revised prompt.
- The public question message `546d24ed-c3d9-4292-a66e-4966b68e6eba` has `response_mode=assessment` and references the assessment; the answer key and transfer basis reside in `private.transfer_assessments`. Browser console also reported `message_feedback` 406 responses for absent feedback rows; they did not block the assessment flow.

## Remaining limits

- A broad Jest run on 2026-09-29 reported 110 suites passed, 17 failed, 9 skipped; 1,115 tests passed, 62 failed, 141 skipped, 13 todo. Failures include image/storage mocks, stale archived-migration paths, older Promptfoo checks, a local-service assertion that rejects the current application-user header lookup, and local HTTP integration tests that cannot bind `127.0.0.1` under the current sandbox (`listen EPERM`). Five focused transfer suites were rerun afterward: 153 tests passed.
- Frozen Promptfoo v3 suite: 104 of 125 offline tests passed. Its 21 failures come from the old `TRANSFER_V3_SYSTEM_PROMPT` call-site and frozen combined tutor-request manifest, which no longer matches the production assessment-only call. The old manifest and historical run hashes were not rewritten. The current-contract tests above cover the new request boundary but do not constitute a full new Promptfoo quality run.
- Guard replay, feedback/repair sequencing, and concurrent reviewed delivery were not exercised in the browser run.
