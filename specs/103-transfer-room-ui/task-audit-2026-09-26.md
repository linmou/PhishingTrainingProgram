# Component 103 Task Audit

Intent: reconcile each task against the current branch's source, focused tests, and local gates. An unchecked task may have useful partial implementation; it is not accepted until every clause in its task text has evidence.

Date: 2026-09-26. Branch: `103-transfer-room-ui`. Focused command in `quickstart.md`: 17 suites/127 tests passed. Browser and hosted behavior were not run.

| Task | State | Specific evidence or missing clause |
|---|---|---|
| T001 | Complete | `research.md` records the promoted six-operation facade, canonical DTOs, and 101/102 ownership reconciliation. |
| T002 | Complete | `research.md` records SHA-256 `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2` and W7/W8 package references. |
| T003 | Open | `transferRoomFixtures.ts` has public/processed rows and stable IDs, but not the complete retry, terminal, reload, and duplicate-tab fixture set requested. |
| T004 | Complete | `transferPrivacyAssertions.ts` imports `PUBLIC_ASSESSMENT_FORBIDDEN_KEYS` (including `learner_safe_explanation`) and adds `assessment_key`; its recursive/serialized checks are used by adapter/export tests. |
| T005 | Open | `transferAssessmentUiAdapter.test.ts` tests projection and missing identity, but not the full target-learner/teacher/observer control matrix or authorization-negative case. |
| T006 | Open | `transferAssessmentUiAdapter.lifecycle.test.ts` covers passed, retry, failed, deferred, duplicate, and rejected; the two named contract/lifecycle files do not assert every requested field and combination. |
| T007 | Complete | `transferAssessmentUiAdapter.ts` imports 101/102 types and defines UI-only `ReviewStatus`, `PublicQuestionView`, `AnswerLifecycleView`, and `TeacherReviewCandidateView`; no local mutation authority is exposed. |
| T008 | Open | Stable-ID `mergeRoomMessages` is in the adapter and called by `RoomContext.tsx`; optimistic replacement and legacy pre-populated ordering are not fully demonstrated at every ingress. |
| T009 | Open | Adapter maps public/processed DTOs but no complete typed-envelope-to-view-state test covers all required read-only outcomes. |
| T010 | Complete | `AssessmentDraftEditor.test.tsx` passes 36 cases covering ordered options, key cardinality, explanation, every edit/reconfirmation, review status, and no progress control. |
| T011 | Open | `RoomContext.transferDraftLifecycle.test.tsx` covers prepared scope and one send; explicit review-then-send ordering and all focus identities need stronger assertions. |
| T012 | Open | `RoomPagePost.transferDraft.test.tsx` has three cases; dirty candidate and retryable-send/no-phantom combinations are not all covered there. |
| T013 | Complete | `AssessmentDraftEditor.tsx` edits and validates explanation, invalidates confirmation, distinguishes dirty/validating/confirmed/saving/server-failure, and the 36 editor tests pass. |
| T014 | Open | `classifyAssessmentFailure` exists in the adapter, but all named prepare/send states and raw-output exclusions are not covered end to end. |
| T015 | Open | `RoomContext.transferDraftLifecycle.test.tsx` supports scoped send and one-message merge; progress non-mutation and every focus transition remain unproven together. |
| T016 | Open | `RoomPagePost.transferDecision.test.tsx` proves structured/legacy split, but authorization and all reconfirm/send/discard routes are not fully asserted. |
| T017 | Open | Legacy suggestion behavior is exercised, but no focused evidence establishes every structured candidate and quick-adjust clause in `AISuggestionBox.tsx`. |
| T018 | Open | `PublicAssessmentQuestion.test.tsx` has three tests, only single radios and disabled-before-selection; multiple, submission-pending, and terminal disabled states lack tests. |
| T019 | Open | The public component test covers ordered options and key absence, but does not assert no `rendered_text`, exact-once DOM count, and no free-text input together. |
| T020 | Open | Retry/passed/failed/deferred UI branches exist in `PublicAssessmentQuestion.tsx`; the named component test has no lifecycle feedback cases. |
| T021 | Open | `PostComment.transfer.test.tsx` covers one learner render and ordinary/Guard messages, but lacks teacher/observer read-only and target-learner controls. |
| T022 | Open | `RoomContext.transferAnswer.test.tsx` covers parent ID, privacy, and no progress write; not every processing/outcome combination and duplicate path. |
| T023 | Open | `PublicAssessmentQuestion.tsx` implements radios/checkboxes and submit, but local test coverage and all upstream feedback states remain incomplete. |
| T024 | Open | `PostComment.tsx` gates `canAnswer` by role and target ID; teacher/observer and exact-once/no-duplication behavior lack complete mounted tests. |
| T025 | Open | `RoomPagePost.tsx` routes assessment submissions; a page test for separation from free text plus canonical IDs/parent in one flow is missing. |
| T026 | Open | `RoomContext.tsx` calls post/process and merges lifecycle; the exact-once and no-evidence-fallback paths need stronger coverage across explicit submissions. |
| T027 | Open | CSS contains editor rules; stable learner controls, feedback layout, responsive geometry, and focus states across both named stylesheets are unverified. |
| T028 | Open | `RoomContext.transferIngress.test.tsx` tests realtime-before-fetch, duplicate, and reconnect; polling overlap, reload restoration, and remaining chances are absent. |
| T029 | Open | `RoomContext.transferConcurrency.test.tsx` tests retry/already-delivered/focus/resolved answer; simultaneous second submissions and two-tab terminal reread are absent. |
| T030 | Open | `RoomContext.transferModes.test.tsx` covers tutoring delivery, Guard adoption, null item, and invalid pair; manual Guard recovery and all compatibility cases remain unverified. |
| T031 | Open | `PostComment.transfer.test.tsx` has no folding/collapse cases. |
| T032 | Open | `RoomPagePost.transferLifecycle.test.tsx` covers preparing/unavailable/superseded/validation; reload/catch-up, remaining chances, and selected-learner preservation are absent. |
| T033 | Open | `RoomContext.tsx` uses `mergeRoomMessages`; authoritative reload/reconnect attempt restoration across all ingress paths is unproven. |
| T034 | Open | Resolved-answer and already-delivered cases exist, but simultaneous/stale terminal retry convergence is not established. |
| T035 | Open | `PostComment.tsx` has no participant-local expanded/collapsed control. |
| T036 | Open | Page has preparation/refusal states; explicit catch-up and retryable behavior without legacy switching is not fully tested. |
| T037 | Open | Adapter refuses assessment as room participation mode and mode tests pass; complete Guard recovery through `AISuggestionBox` is not demonstrated. |
| T038 | Open | `ChecklistPanel.transfer.test.tsx` covers owner scope, legacy and Guard lock, but the combined role/cross-learner projection matrix is incomplete. |
| T039 | Open | `roomExportBuilder.transfer.test.ts` covers private-field exclusion and teacher/learner separation; observer and terminal explanation disclosure are absent. |
| T040 | Open | `RoomPagePost.transferDecision.test.tsx` checks structured decisions; the named page/context requirement lacks a direct public-projection downstream assertion. |
| T041 | Open | Checklist tests cover server-owned writes and legacy path; full server-provided learner-owned projection across roles is not yet evidenced. |
| T042 | Open | Export builder allowlists fields; terminal-only explanation and observer projection are not fully asserted. |
| T043 | Open | Page and comment have role logic; complete role-appropriate progress/export and legacy-preservation evidence is missing. |
| T044 | Complete | Exact 17-path focused command in `quickstart.md` exited 0: 17 suites, 127 tests. See current verification notes. |
| T045 | Open | `npm run test:regression -- --runInBand` ran; 35 suites/151 tests fail. Counts match the recorded pre-edit exception, but legacy failure-name attribution has not been completed. |
| T046 | Complete | `npx tsc --noEmit` exited 2 with 508 errors in 43 files; `npm run build` exited 0 with warnings after fixture repair. Both outcomes are recorded in verification notes. |
| T047 | Open | `tutor-system/README.md` and `claude_docs/README.md` were reviewed; nearest room/service docs and required owner-routed update disposition remain to be documented. |
| T048 | Open | Current three-file diff is component-local, but the full branch-diff ownership audit against the allocated baseline is not recorded. |

Eight tasks are checked, 40 remain unchecked. A passing local focused suite does not substitute for the missing clauses above or for a browser/hosted gate.
