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

## Focused suite (`quickstart.md`, corrected to existing files)

```bash
cd tutor-system
CI=true npx react-scripts test --watchAll=false --runInBand --runTestsByPath \
  src/components/__tests__/AssessmentDraftEditor.test.tsx \
  src/components/__tests__/ChatMessage.transfer.test.tsx \
  src/components/__tests__/PostComment.transfer.test.tsx \
  src/components/__tests__/PublicAssessmentQuestion.test.tsx \
  src/contexts/__tests__/RoomContext.transferDraftLifecycle.test.tsx \
  src/contexts/__tests__/RoomContext.transferAnswer.test.tsx \
  src/contexts/__tests__/RoomContext.transferIngress.test.tsx \
  src/contexts/__tests__/transferAssessmentUiAdapter.test.ts \
  src/contexts/__tests__/transferAssessmentUiAdapter.contract.test.ts \
  src/contexts/__tests__/roomExportBuilder.transfer.test.ts \
  src/pages/__tests__/RoomPagePost.transferDraft.test.tsx
```

- Exit code: **0**
- Result: **11 suites passed, 11 total; 65 tests passed, 65 total.**
- All eleven suites report `PASS`.

## Regression

| Run | Exit | Test suites | Tests |
|---|---|---|---|
| Baseline before production edits (with the placeholder `.env`) | 1 | 31 failed, 79 passed, 8 skipped (110 of 118) | 129 failed, 787 passed, 140 skipped (1056) |
| After all 103 work | 1 | 29 failed, 88 passed, 8 skipped (117 of 125) | 129 failed, 832 passed, 140 skipped (1101) |

- The failing test count is unchanged at **129**; the passing count rose by **45**, which is the 103 suites plus the editor tests added in this branch.
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

## Planned focused files that do not exist

These are deferred, not silently dropped; `quickstart.md` was corrected so the command and the
repository agree:

| Planned file | Status |
|---|---|
| `src/contexts/__tests__/transferAssessmentUiAdapter.lifecycle.test.ts` | Deferred. Its intended content (answered lifecycle, distinct server lifecycle variants) is covered by `transferAssessmentUiAdapter.test.ts` and `RoomContext.transferAnswer.test.tsx`. |
| `src/contexts/__tests__/RoomContext.transferConcurrency.test.tsx` | Deferred. Refused-delivery, no-phantom-message and single-in-flight-delivery cases are covered in `RoomContext.transferDraftLifecycle.test.tsx`. |
| `src/contexts/__tests__/RoomContext.transferModes.test.tsx` | Deferred. Mode compatibility is covered by `transferAssessmentUiAdapter.contract.test.ts` and the participation-mode cases in `RoomContext.transferIngress.test.tsx`. |
| `src/components/__tests__/ChecklistPanel.transfer.test.tsx` and the read-only transfer progress work (T025, T037) | Deferred. `ChecklistPanel`/`useChecklist` were not modified; transfer-policy items keep their existing behaviour and were not made read-only in this run. |
| `src/pages/__tests__/RoomPagePost.transferLifecycle.test.tsx` | Deferred. Catch-up/loading/unavailable page states were not implemented as page-level UI. |
| `src/pages/__tests__/RoomPagePost.transferDecision.test.tsx` | Deferred. Structured-decision consumption is covered by `RoomPagePost.transferDraft.test.tsx` and `AssessmentDraftEditor.test.tsx`. |

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

- The production build gate is red (pre-existing, not attributable to this branch, not fixed here).
- `ChecklistPanel`/`useChecklist` transfer read-only behaviour (T025, T037) is not implemented.
- Page-level lifecycle states (loading/unavailable/stale/catch-up) beyond the discard and error states are not implemented.
