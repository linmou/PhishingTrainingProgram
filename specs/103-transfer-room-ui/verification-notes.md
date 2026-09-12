# Verification Notes: Transfer Room Lifecycle and UI Integration (component 103)

## Intent

Record the commands actually run on branch `103-transfer-room-ui`, their exit codes and observed
counts, every failure with its cause, and every gate that is deferred. Nothing here is a projected
result: each number was read from the command output recorded in the run logs.

## Environment

- Worktree: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-room-ui`, branch `103-transfer-room-ui`.
- Base: `2fcd0b4` (merge of integration `7f5e979`); reconciliation commit `91e0080` is the first commit of this branch's work.
- `tutor-system/node_modules` was absent at the start of the run and was installed with `npm install --no-audit --no-fund` (exit 0, 1.8G). An earlier attempt failed with `ENOSPC` while the shared disk was full; the retry succeeded once space was free.
- This worktree had no `.env`, so `REACT_APP_SUPABASE_URL` was unset and every suite that transitively constructs the Supabase client failed with `supabaseUrl is required.` A gitignored local `.env` with placeholder values (`http://127.0.0.1:54321`, `local-test-anon-key`) was added so the suite could run at all. It contains no real credential and is not committed (`git check-ignore` matches it; it never appeared in `git status`).
- The filesystem in this environment intermittently returned `ENOENT`/`not found` for files that exist and, twice, discarded newly written untracked files (`src/components/PublicAssessmentQuestion.tsx`, `ChatMessage.transfer.test.tsx`, `PostComment.transfer.test.tsx`, `RoomContext.transferAnswer.test.tsx`, `roomExportBuilder.transfer.test.ts`). Each was recreated and staged immediately. This is recorded because it affected how the work was sequenced, not as an excuse for any result.

## Focused suite (`quickstart.md`, run exactly as listed)

```bash
cd tutor-system
CI=true npx react-scripts test --watchAll=false --runInBand --runTestsByPath \
  src/components/__tests__/AssessmentDraftEditor.test.tsx \
  src/components/__tests__/ChatMessage.transfer.test.tsx \
  src/components/__tests__/PostComment.transfer.test.tsx \
  src/components/__tests__/ChecklistPanel.transfer.test.tsx \
  src/contexts/__tests__/RoomContext.transferDraftLifecycle.test.tsx \
  src/contexts/__tests__/RoomContext.transferAnswer.test.tsx \
  src/contexts/__tests__/transferAssessmentUiAdapter.test.ts \
  src/contexts/__tests__/transferAssessmentUiAdapter.contract.test.ts \
  src/contexts/__tests__/transferAssessmentUiAdapter.lifecycle.test.ts \
  src/contexts/__tests__/RoomContext.transferIngress.test.tsx \
  src/contexts/__tests__/RoomContext.transferConcurrency.test.tsx \
  src/contexts/__tests__/RoomContext.transferModes.test.tsx \
  src/contexts/__tests__/roomExportBuilder.transfer.test.ts \
  src/pages/__tests__/RoomPagePost.transferDraft.test.tsx \
  src/pages/__tests__/RoomPagePost.transferLifecycle.test.tsx \
  src/pages/__tests__/RoomPagePost.transferDecision.test.tsx
```

- Exit code: **0**
- Result: **16 suites passed, 16 total; 100 tests passed, 100 total.**
- Every file named by the gate exists and passes; none was renamed, and the command was not edited
  to match a smaller repository. `PublicAssessmentQuestion.test.tsx` also exists and passes but is
  not part of the gate list.

## Regression

| Run | Exit | Test suites | Tests |
|---|---|---|---|
| Baseline before production edits (with the placeholder `.env`) | 1 | 31 failed, 79 passed, 8 skipped (110 of 118) | 129 failed, 787 passed, 140 skipped (1056) |
| After all 103 work | 1 | 29 failed, 94 passed, 8 skipped (123 of 131) | 129 failed, 870 passed, 140 skipped (1139) |

- The failing test count is unchanged at **129** in both runs; the passing count rose by **83**, which is the sixteen 103 suites plus the editor, lifecycle and checklist tests added in this branch.
- The only difference between the baseline and final failing-suite lists is the two empty-suite entries below; every other failing suite is identical.
- The two failing suites that disappeared (`src/__tests__/fixtures/transferRoomFixtures.ts` and `src/__tests__/helpers/transferPrivacyAssertions.ts`, both collected as empty suites by this repository's Jest `testMatch`) were mine and were moved to `src/test-support/`. That is why the failing suite count drops from 31 to 29 while the failing test count stays at 129.
- `RoomContext`, `RoomContext.avatar` and `RoomContext.roleBasedExport` fail before and after: the diff of failing test names between the baseline log and the final log is **empty** (13 names each side). These are the known pre-existing failures on room creation, image upload, and AI-config loading.

## Type check

- `npx tsc --noEmit` → exit **2**, **516** `error TS` lines, byte-identical to the pre-change baseline (516).
- One new error was introduced during US3 (`TS7022` in `RoomContext.transferIngress.test.tsx`) and fixed by annotating the mocked channel type; the re-run is identical to the baseline.
- The repository therefore still has 516 pre-existing type errors, none of them in a file this branch owns.

## Production build

- `npm run build` → exit **1**: `Failed to compile. TS2339: Property 'getUser' does not exist on type 'SupabaseAuthClient'` at `src/services/checklistService.ts:114`.
- Attribution: `checklistService.ts` is untouched by this branch, and the same error class (`getUser` on `SupabaseAuthClient`) is present in the pre-change `tsc` baseline. A pre-change `npm run build` was **not** run, so this is attributed by file ownership and error class, not by a before/after build comparison. The build gate is **not** green.

## Deferred gates

- Hosted SQL/RLS acceptance, trusted-principal authorization, live provider behaviour, Promptfoo, deployment, and release-browser evidence remain owned by components 102/105.
- `TRANSFER_ASSESSMENT_ENABLED` stays backend-controlled; nothing in this component enables transfer behaviour when the capability is unavailable.
- Migration `045_persist_assessment_selection_type.sql` is authored on integration and **not applied on hosted**. The adapter and its fixtures treat `assessment_selection_type` as `'single' | 'multiple' | null`, and the null path is tested without depending on the column being live.
- No browser-rendered screenshot or manual UI walkthrough was produced.

## Upstream change consumed

- Integration `191348d` changed component 102's `ProcessedMessageDTO` to return `message_id` (the key
  `process_assessment_message_v1` actually sends) plus `code`, `clarification_required`, and
  `already_processed`. This branch consumes that shape: `answerLifecycleFromProcessed` maps it to
  `graded | clarification | already_processed | unresolved`, still accepting the older `question_id`
  key so a not-yet-promoted facade cannot break the learner view, and `RoomContext` merges the result
  onto the learner's answer message. `ChatMessage` and `PostComment` render the neutral clarification
  request; no selection, grade, or failure is invented in the browser. Component 102's file was not
  edited.

## TDD evidence per slice

The `fast-multi-agent-tdd` skill's full start gate (dedicated monitor, authenticated `pre_red`
snapshot, three-reviewer Red debate, provenance gate) was **not** executed. The owner's instruction
for this run was to follow the skill's Red-Green-Refactor sequence honestly while keeping
sub-delegation to at most three concurrent agents, and the request map records that the full
ceremony was reserved for the reviewed-send slice (US1). The request map itself lives at
`audits/103_room_ui_request_map.md` (git-excluded in this repository). No monitor or reviewer pass
is claimed.

| Slice | Red command | Observed failure | Green |
|---|---|---|---|
| Phase 2 adapter | `transferAssessmentUiAdapter.test.ts` | exit 1, `Cannot find module '../transferAssessmentUiAdapter'`, `Tests: 0 total` | exit 0, 20 tests |
| Phase 2 contract | `transferAssessmentUiAdapter.contract.test.ts` | exit 1, same missing module | exit 0 (same run) |
| US1 editor | `AssessmentDraftEditor.test.tsx` | exit 1, 4 failed / 5 passed; after correcting my own selectors: 2 failed / 7 passed on exactly the new behaviours (`reports its own review state`, `discards the candidate`) | exit 0, 9 tests |
| US1 context | `RoomContext.transferDraftLifecycle.test.tsx` | exit 1, 4 failed / 3 passed: `sendReviewed` received `itemId: null` for an assessment turn; a second in-flight send reached `sendReviewed` twice; the delivered message did not survive the 2s poll | exit 0, 7 tests |
| US1 page | `RoomPagePost.transferDraft.test.tsx` | exit 1, 1 failed / 2 passed: no discard control existed | exit 0, 3 tests |
| US2 rendering | the three component suites | exit 1, `Cannot find module '../PublicAssessmentQuestion'`, `Tests: 0 total` (the missing learner question surface) | exit 0, 9 tests |
| US2 answer | `RoomContext.transferAnswer.test.tsx` | exit 1, 3 failed / 3 passed: `Private assessment material leaked into browser-facing state: assessment_key at $[2].assessment_key`, plus a stored-row-is-raw assertion | exit 0, 6 tests |
| US3 ingress | `RoomContext.transferIngress.test.tsx` | exit 1, 1 failed / 4 passed: a realtime room update with `active_response_mode: 'assessment'` was adopted as the room mode while a legitimate `guard` change worked | exit 0, 5 tests |
| US4 export | `roomExportBuilder.transfer.test.ts` | exit 1, 2 failed / 3 passed: a delivered question exported only its stem, with no instruction and no options | exit 0, 5 tests (13 with the existing export suite) |

## Upstream gaps reported, not worked around

1. `messages.assessment_selection_type` did not exist when this component started; rows delivered before migration 045 cannot carry the canonical instruction. The adapter reports `selectionType: null` and the UI states that the answer type is not recorded rather than inferring it from `assessment_key`. Migration 045 is the owner's chosen fix and is consumed once present.
2. `ProcessedMessageDTO.question_id` in component 102's facade reads `question_id`, while `process_assessment_message_v1` returns `message_id`. Component 102 owns that mapping; it is reported here and was not edited.
3. `assessment_key` is readable from `public.messages` by a crafted request (recorded owner tradeoff). This component's obligation — that the browser never retains or renders it — is asserted in `transferPrivacyAssertions` across UI state, props, and exports.

## Unresolved blockers in this component

- The production build gate is red (`npm run build` exit 1, re-run on the final tree): the same
  pre-existing `SupabaseAuthClient.getUser` type error at `src/services/checklistService.ts:114`, a
  file this branch does not touch. It is the only blocker left in this component.
- Nothing else in the component's own scope is outstanding: T025/T037 are implemented and tested,
  and the page-level lifecycle states (preparing, unavailable, validation, superseded) are
  implemented and tested.

## Behaviour delivered in the closure round

| Requirement | Change | Suite |
|---|---|---|
| T025/T037 owner-scoped, read-only transfer progress | `useChecklist.updateItem` refuses `status` and `understanding_level` writes for a `transfer_v1` checklist and reports a server-owned error; owner-scoped read per role; legacy edits unchanged | `ChecklistPanel.transfer.test.tsx` (9 tests) |
| US2 scenario 4 neutral clarification | `answerLifecycleFromProcessed` + `withAnswerLifecycle` + `readAnswerLifecycle`; `RoomContext` merges the processed result onto the answer; `ChatMessage`/`PostComment` render the clarification request | `transferAssessmentUiAdapter.lifecycle.test.ts` (9), `RoomContext.transferAnswer.test.tsx` (7) |
| Retry, duplicate tab, focus identity | Retry after a timeout converges to one message; already-open adds nothing; focus identity survives another learner speaking; a resolved answer is not reprocessed | `RoomContext.transferConcurrency.test.tsx` (4) |
| Room versus turn modes | Assessment delivery leaves the room in tutoring; Guard is adopted from the server; a tutoring turn sends a real `null` item id; incompatible mode/instruction pairs are refused before delivery | `RoomContext.transferModes.test.tsx` (5) |
| Page-level lifecycle states | `RoomPagePost` renders preparing and the classified refusal (unavailable, validation, superseded), clears it on a new attempt, and keeps the open candidate | `RoomPagePost.transferLifecycle.test.tsx` (6) |
| Structured decision consumption | Candidate rendered as structured fields; a structured `TutorDecisionV3` is forwarded; the copy-only legacy path is preserved | `RoomPagePost.transferDecision.test.tsx` (4) |
