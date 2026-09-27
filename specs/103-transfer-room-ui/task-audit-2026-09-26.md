# Component 103 Task Audit

Intent: reconcile each task against the current branch's source, focused tests, and local gates. An unchecked task may have useful partial implementation; it is not accepted until every clause in its task text has evidence.

Updated: 2026-09-27 (first recorded 2026-09-26). Branch: `103-transfer-room-ui`. Focused command in `quickstart.md`: 17 suites/153 tests passed. Browser and hosted behavior were not run.

| Task | State | Specific evidence or missing clause |
|---|---|---|
| T001 | Complete | `research.md` records the promoted six-operation facade, canonical DTOs, and 101/102 ownership reconciliation. |
| T002 | Complete | `research.md` records SHA-256 `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2` and W7/W8 package references. |
| T003 | Open | `transferRoomFixtures.ts` has public/processed rows and stable IDs, but not the complete retry, terminal, reload, and duplicate-tab fixture set requested. |
| T004 | Complete | `transferPrivacyAssertions.ts` imports `PUBLIC_ASSESSMENT_FORBIDDEN_KEYS` (including `learner_safe_explanation`) and adds `assessment_key`; its recursive/serialized checks are used by adapter/export tests. |
| T005 | Open | `transferAssessmentUiAdapter.test.ts` tests projection and missing identity, but not the full target-learner/teacher/observer control matrix or authorization-negative case. |
| T006 | Open | `transferAssessmentUiAdapter.lifecycle.test.ts` covers passed, retry, failed, deferred, duplicate, and rejected; the two named contract/lifecycle files do not assert every requested field and combination. |
| T007 | Complete | `transferAssessmentUiAdapter.ts` imports 101/102 types and defines UI-only `ReviewStatus`, `PublicQuestionView`, `AnswerLifecycleView`, and `TeacherReviewCandidateView`; no local mutation authority is exposed. |
| T008 | Open | `mergeRoomMessages` now retains public-question and answer-lifecycle view state when polling replaces a projected message; optimistic replacement and legacy pre-populated ordering are not fully demonstrated at every ingress. |
| T009 | Open | Adapter maps public/processed DTOs but no complete typed-envelope-to-view-state test covers all required read-only outcomes. |
| T010 | Complete | `AssessmentDraftEditor.test.tsx` passes 36 cases covering ordered options, key cardinality, explanation, every edit/reconfirmation, review status, and no progress control. |
| T011 | Open | `RoomContext.transferDraftLifecycle.test.tsx` covers prepared scope and one send; explicit review-then-send ordering and all focus identities need stronger assertions. |
| T012 | Open | `RoomPagePost.transferDraft.test.tsx` has three cases; dirty candidate and retryable-send/no-phantom combinations are not all covered there. |
| T013 | Complete | `AssessmentDraftEditor.tsx` edits and validates explanation, invalidates confirmation, distinguishes dirty/validating/confirmed/saving/server-failure, and the 36 editor tests pass. |
| T014 | Open | `classifyAssessmentFailure` exists in the adapter, but all named prepare/send states and raw-output exclusions are not covered end to end. |
| T015 | Open | `RoomContext.transferDraftLifecycle.test.tsx` supports scoped send and one-message merge; progress non-mutation and every focus transition remain unproven together. |
| T016 | Open | `RoomPagePost.transferDecision.test.tsx` proves structured/legacy split, but authorization and all reconfirm/send/discard routes are not fully asserted. |
| T017 | Open | Legacy suggestion behavior is exercised, but no focused evidence establishes every structured candidate and quick-adjust clause in `AISuggestionBox.tsx`. |
| T018 | Complete | `PublicAssessmentQuestion.test.tsx` covers single radios, multiple checkboxes, ordered and labelled options, disabled-before-selection, pending submission, and disabled terminal results. |
| T019 | Complete | Component tests assert the stem once, every option once, no `rendered_text` in the projected DTO or DOM, and no free-text input. |
| T020 | Complete | Tests cover undisclosed retry, terminal passed with null feedback, terminal failed feedback for applied/deferred/duplicate processing, rejected/null outcome, and an already-processed duplicate result. |
| T021 | Complete | `PostComment.transfer.test.tsx` covers controls for the target learner, disabled read-only controls and no submit action for tutor/observer, exact option rendering, ordinary/Guard display, and private-field-name absence in the rendered markup. |
| T022 | Open | `RoomContext.transferAnswer.test.tsx` covers parent ID, privacy, and no progress write; not every processing/outcome combination and duplicate path. |
| T023 | Complete | `PublicAssessmentQuestion.tsx` implements ordered radios/checkboxes, stable selection, explicit submission, canonical option ordering, pending/terminal disabled states, and server lifecycle feedback; the focused component suite passes. |
| T024 | Complete | `PostComment.tsx` passes the distinct question-message and assessment IDs through its submit callback, exposes controls only to the target learner, and keeps teacher/observer controls disabled; mounted tests cover the role behavior. |
| T025 | Complete | `RoomPagePost.tsx` uses a dedicated assessment-submit callback separate from the text composer; its page test verifies canonical `selectedOptionIds`, assessment ID, and distinct persisted parent ID in one submission. |
| T026 | Complete | The context test proves canonical option IDs reach `postMessage`, the persisted answer/assessment identities reach `processMessage`, trusted lifecycle attaches to answer and question, ordinary messages use evidence analysis, and explicit assessment failures never fall back to analysis. |
| T027 | Open | CSS contains editor rules; stable learner controls, feedback layout, responsive geometry, and focus states across both named stylesheets are unverified. |
| T028 | Complete | `RoomContext.transferIngress.test.tsx` holds reconnect catch-up open while a realtime insert arrives, verifies the insert survives catch-up and a later poll, collapses duplicate IDs, and checks ordering. `RoomContext.transferAnswer.test.tsx` verifies reload restoration from an already-processed result with server-owned remaining attempts. |
| T029 | Open | `RoomContext.transferConcurrency.test.tsx` tests retry/already-delivered/focus/resolved answer; simultaneous second submissions and two-tab terminal reread are absent. |
| T030 | Open | `RoomContext.transferModes.test.tsx` covers tutoring delivery, Guard adoption, null item, and invalid pair; manual Guard recovery and all compatibility cases remain unverified. |
| T031 | Complete | `PostComment.transfer.test.tsx` covers default-expanded state and accessible collapse/expand for student, tutor, and observer, participant-local controls, and mounted selection/result preservation. |
| T032 | Open | `RoomPagePost.transferLifecycle.test.tsx` covers preparing/unavailable/superseded/validation; reload/catch-up, remaining chances, and selected-learner preservation are absent. |
| T033 | Open | `RoomContext.tsx` now restores the signed-in learner's persisted lifecycle through the idempotent processor and merge preserves derived state; optimistic replacement still bypasses the helper on legacy paths and the complete ingress matrix is not tested. |
| T034 | Open | Resolved-answer and already-delivered cases exist, but simultaneous/stale terminal retry convergence is not established. |
| T035 | Complete | `PostComment.tsx` uses instance-local expanded-by-default state, an accessible icon control, and keeps the question mounted while hidden; the component test confirms the answer selection and result survive folding. |
| T036 | Open | Page has preparation/refusal states; explicit catch-up and retryable behavior without legacy switching is not fully tested. |
| T037 | Open | Adapter refuses assessment as room participation mode and mode tests pass; complete Guard recovery through `AISuggestionBox` is not demonstrated. |
| T038 | Open | `ChecklistPanel.transfer.test.tsx` covers owner scope, legacy and Guard lock, but the combined role/cross-learner projection matrix is incomplete. |
| T039 | Complete | `roomExportBuilder.transfer.test.ts` covers learner/teacher/observer/other-learner projections, pre-terminal explanation absence, terminal explanation for only the target learner, private-field exclusion, and distinct question-message versus assessment IDs. |
| T040 | Open | `RoomPagePost.transferDecision.test.tsx` checks structured decisions; the named page/context requirement lacks a direct public-projection downstream assertion. |
| T041 | Open | Checklist tests cover server-owned writes and legacy path; full server-provided learner-owned projection across roles is not yet evidenced. |
| T042 | Complete | `roomExportBuilder.ts` allowlists public question and lifecycle fields; only the signed-in target learner receives lifecycle data, terminal explanation is failed-terminal only, and teacher/observer exports do not reuse learner-local lifecycle state. `RoomContext` passes the current role and user ID to both builders. |
| T043 | Open | Page and comment have role logic; complete role-appropriate progress/export and legacy-preservation evidence is missing. |
| T044 | Complete | Exact 17-path focused command in `quickstart.md` exited 0 on 2026-09-27: 17 suites, 153 tests. See current verification notes. |
| T045 | Open | Full regression exited 1: 35 failed, 9 skipped, 90 passed suites; 151 failed, 141 skipped, 952 passed tests. A same-HEAD comparison with only the current export-policy delta removed reported the same failure/skip counts and 951 passing tests; this isolates only that delta and does not close the broader regression gate. |
| T046 | Complete | `npx tsc --noEmit` exited 2 with 506 errors in 41 files. Five diagnostics remain in `roomExportBuilder.test.ts` on lines unchanged from `68a4b54`; none point at the changed call sites, transfer export tests, or production files. `npm run build` exited 0 with existing source-map, lint, and Browserslist warnings. With `CI=true`, those existing warnings are treated as errors and the build exits 1. |
| T047 | Complete | Reviewed `tutor-system/README.md`, `claude_docs/README.md`, and `claude_docs/RoomContext.md`; updated the nearest room doc and added `documentation_update_record_v2026_09_27_transfer_room_export_lifecycle.md`. |
| T048 | Open | Ownership audit of `0c4dfb6..HEAD` found `tutor-system/src/types/index.ts` changed by 103 commit `21915f4`, despite the task boundary assigning that shared barrel to component 101. No other prohibited 101/102/104, SQL/RLS, provider/auth, Promptfoo, or release-browser path appears in that 103 range. The earlier `2fcd0b4..HEAD` tree also includes separate 101/102/104 and orchestration commits, which are not attributed to component 103. |

Twenty-two tasks are checked, 26 remain unchecked. A passing local focused suite does not substitute for the missing clauses above or for a browser/hosted gate.
