---

description: "Dependency-ordered W7-W8 tasks for transfer room lifecycle and teacher/learner UI integration"
---

# Tasks: Transfer Room Lifecycle and UI Integration

**Input**: Design documents from `specs/103-transfer-room-ui/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Implementation boundary**: These tasks cover only browser/UI integration. Component 101 owns shared assessment/progress type exports in `tutor-system/src/types/assessment.ts`, `src/types/learningProgress.ts`, and `src/types/index.ts`. Component 102 owns `tutor-system/src/services/transferAssessmentService.ts`, its typed DTO/envelope exports, all operation mapping, and service contract tests. Do not edit those files or add SQL/RLS, trusted authentication, provider logic, prompt changes, Promptfoo, deployment, or release-browser evidence here.

**Test policy**: Tests are required by the component request. For every story, write the focused tests first, confirm the missing behavior fails, then implement and refactor using the repository's required `fast-multi-agent-tdd` workflow during implementation. Reuse existing production modules; every new test begins with a responsibility comment and covers negative and edge cases.

## Phase 1: Setup (Shared Planning and Contract Fixtures)

**Purpose**: Establish the upstream boundary and focused test fixtures without changing production behavior.

- [ ] T001 Review `specs/103-transfer-room-ui/spec.md`, `plan.md`, `data-model.md`, `contracts/room-ui-contracts.md`, and `quickstart.md` against component 101's shared assessment/progress exports and component 102's promoted six-operation facade (`initializeChecklist`, `postMessage`, `prepareTurn`, `sendReviewed`, `processMessage`, `analyzeMessage`) with its `PublicAssessmentDTO`, `PublicMessageDTO`/`PUBLIC_MESSAGE_DTO_KEYS`, `ReviewedDeliveryDTO`, `ProcessedMessageDTO`, `AssessmentApiEnvelope`/`AssessmentApiError`, and `PUBLIC_ASSESSMENT_FORBIDDEN_KEYS` exports; record the reconciliation and any incompatible upstream shape in `specs/103-transfer-room-ui/research.md` without editing upstream shared type or service files.
- [ ] T002 [P] Freeze the original-plan SHA-256 and W7/W8 ownership references in `specs/103-transfer-room-ui/research.md` without editing `plan/transfer_assessment_implementation_plan.md`.
- [ ] T003 [P] Extend shared fixtures for single/multiple selection, first-incorrect retry, correct terminal, second-incorrect terminal, already-terminal replay, reload, and duplicate-tab state in `tutor-system/src/test-support/transferRoomFixtures.ts`.
- [ ] T004 [P] Extend the forbidden-field helper to assert that the learner-safe explanation is absent before terminal disclosure, alongside answer keys, basis, rationale, and raw model output, in `tutor-system/src/test-support/transferPrivacyAssertions.ts`.

## Phase 2: Foundational (Typed Boundary and UI State Primitives)

**Purpose**: Establish the explicit consumer boundary before story-specific UI work.

- [ ] T005 [P] Add React adapter contract tests that import component 102's exported DTO/envelope types and cover target-learner identity, teacher-private versus learner-public projection, persisted attempts used/remaining, terminal disclosure, and fail-closed state mapping in `tutor-system/src/contexts/__tests__/transferAssessmentUiAdapter.test.ts`.
- [ ] T006 [P] Add UI adapter tests for retry, correct-terminal, incorrect-terminal, already-processed, stale, mode mismatch, missing selection type, and exact-once stem/options projection in `tutor-system/src/contexts/__tests__/transferAssessmentUiAdapter.contract.test.ts` and `tutor-system/src/contexts/__tests__/transferAssessmentUiAdapter.lifecycle.test.ts`.
- [ ] T007 Add the React-only review-candidate/public-question/answer-presentation view-state definitions in `tutor-system/src/contexts/transferAssessmentUiAdapter.ts`, importing component 101/102 exports unchanged and exposing no local attempt, terminal, disclosure, progress, or mastery mutation.
- [ ] T008 Implement a single stable-identity merge helper for persisted messages, optimistic replacement, realtime inserts, and reconnect catch-up in `tutor-system/src/contexts/RoomContext.tsx`, preserving pre-populated legacy messages and chronological ordering.
- [ ] T009 Implement the envelope-to-view-state mappings in `tutor-system/src/contexts/transferAssessmentUiAdapter.ts`, consuming component 101 domain exports and component 102 DTO/envelope exports without redeclaring shared types or API operations; persisted attempts, terminal state, and disclosure are read-only values.

**Checkpoint**: The browser boundary is typed, private/public projections are testable, and no component consumes a raw backend record.

## Phase 3: User Story 1 - Teacher Reviews and Sends a Transfer Question (Priority: P1)

**Goal**: Deliver one reviewed, confirmed, non-stale structured assessment without phantom messages or progress writes.

**Independent Test**: Prepare a candidate for learner A and source message A, edit it, reconfirm it, send it, and verify the request identities, public delivered message, room tutoring mode, and superseded/refused behavior.

### Tests for User Story 1

- [ ] T010 [P] [US1] Add `AssessmentDraftEditor` tests for rendering four ordered options, single/multiple key cardinality, learner-safe explanation editing and validation, dirty-edit confirmation reset for every editable field, explicit reconfirmation, and no direct progress controls in `tutor-system/src/components/__tests__/AssessmentDraftEditor.test.tsx`.
- [ ] T011 [P] [US1] Add RoomContext integration tests for focus student/message/checklist/item identity, the confirmed-payload delivery identity sent to `sendReviewed`, review-then-send ordering, and room tutoring mode in `tutor-system/src/contexts/__tests__/RoomContext.transferDraftLifecycle.test.tsx`.
- [ ] T012 [P] [US1] Add page integration tests for discarding an unconfirmed candidate, dirty candidate state, a superseded (already-open) delivery refused by the server, retryable send failure, and no phantom learner message in `tutor-system/src/pages/__tests__/RoomPagePost.transferDraft.test.tsx`.

### Implementation for User Story 1

- [ ] T013 [US1] Update `tutor-system/src/components/AssessmentDraftEditor.tsx` to edit and validate the learner-safe explanation, clear confirmation on explanation changes, and expose explicit dirty, validating, confirmed, saving, and server-failure states while preserving structured validation.
- [ ] T014 [US1] Update `tutor-system/src/contexts/transferAssessmentUiAdapter.ts` to map component 102's `prepareTurn` projection and thrown `sendReviewed` failures into ready, dirty, superseded, validation, unavailable, unauthorized, duplicate, and retryable React states without recreating operation mapping or exposing raw provider output.
- [ ] T015 [US1] Update `tutor-system/src/contexts/RoomContext.tsx` to retain selected learner/message/checklist/item focus (with `itemId` kept `string | null`), clear confirmation after edits, send the confirmed decision with its scope identity, merge persisted send results once, and keep progress untouched.
- [ ] T016 [US1] Update `tutor-system/src/pages/RoomPagePost.tsx` to show the structured teacher editor only for an authorized transfer candidate, route reconfirm/send/discard actions, and preserve the legacy `AISuggestionBox` path for legacy rooms.
- [ ] T017 [US1] Update `tutor-system/src/components/AISuggestionBox.tsx` only where needed to avoid treating a structured transfer candidate as copy-only text or as a room-mode toggle; preserve existing non-transfer quick-adjust behavior.

**Checkpoint**: A teacher can review and send one confirmed structured candidate; edited, discarded, or server-refused candidates remain unsent.

## Phase 4: User Story 2 - Learner Sees and Answers a Public Question (Priority: P1)

**Goal**: Render one public question with selection-type-appropriate controls and display only server-authoritative retry or terminal feedback.

**Independent Test**: Exercise single and multiple questions through first incorrect, reload/duplicate tab, correct terminal, and second-incorrect terminal outcomes; verify exact-once rendering, no free-text assessment input, no third submission, and no browser grade or progress write.

### Tests for User Story 2

- [ ] T018 [P] [US2] Add component tests for single-answer radios, multiple-answer checkboxes, ordered options, accessible labels, explicit Submit answer, and disabled states before selection, during submission, and after terminal outcome in `tutor-system/src/components/__tests__/PublicAssessmentQuestion.test.tsx`.
- [ ] T019 [P] [US2] Add component tests proving the stem and each structured option render exactly once even when legacy `rendered_text` contains an option list, and proving no free-text assessment input exists in `tutor-system/src/components/__tests__/PublicAssessmentQuestion.test.tsx`.
- [ ] T020 [P] [US2] Add feedback tests for first-incorrect retry without answer/explanation disclosure, correct terminal, second-incorrect terminal with answer/explanation, server error, and already-terminal render in `tutor-system/src/components/__tests__/PublicAssessmentQuestion.test.tsx`.
- [ ] T021 [P] [US2] Add message integration tests for learner-only controls, teacher/observer read-only views, exact-once options, ordinary tutoring and Guard display, and private-field absence in `tutor-system/src/components/__tests__/PostComment.transfer.test.tsx`.
- [ ] T022 [P] [US2] Add context tests for canonical option-ID serialization, `assessment_id`, persisted `parent_message_id`, authoritative lifecycle mapping, duplicate request handling, and zero direct progress writes in `tutor-system/src/contexts/__tests__/RoomContext.transferAnswer.test.tsx`.

### Implementation for User Story 2

- [ ] T023 [US2] Update `tutor-system/src/components/PublicAssessmentQuestion.tsx` to render radio controls for `single`, checkbox controls for `multiple`, an explicit Submit answer button, stable local selection, and upstream lifecycle feedback supplied through props.
- [ ] T024 [US2] Update `tutor-system/src/components/PostComment.tsx` to render the interactive question only for its target learner, pass submit/result state without duplicating stem or options, and keep teacher/observer views read-only.
- [ ] T025 [US2] Update `tutor-system/src/pages/RoomPagePost.tsx` to route assessment selection submission separately from the free-text composer and call the existing room path with canonical option IDs, assessment identity, and persisted parent ID.
- [ ] T026 [US2] Update `tutor-system/src/contexts/RoomContext.tsx` to submit the canonical selection, process the persisted answer once, merge component 102's authoritative retry/terminal state, and never fall back to evidence analysis for an explicit assessment submission.
- [ ] T027 [US2] Update `tutor-system/src/components/RoomPagePost.css` and `tutor-system/src/components/PostComment.css` for stable control dimensions, focus states, feedback layout, and responsive text without changing surrounding message geometry.

**Checkpoint**: Learners can submit displayed choices only; component 102 decides attempts, terminal state, disclosure, and progress.

## Phase 5: User Story 3 - Room Lifecycle Survives Reload, Reconnect, and Duplicate Tabs (Priority: P2)

**Goal**: Converge persisted room state and realtime events without duplicate messages, lifecycle records, answer effects, or incorrect parent links.

**Independent Test**: Exercise fetch/realtime ordering, reconnect, reload, timeout retry, optimistic replacement, and two-tab stale operations against one fixture room and compare the final visible state with a clean reload.

### Tests for User Story 3

- [ ] T028 [P] [US3] Add RoomContext ingress tests for realtime-before-fetch, duplicate realtime insert, polling/realtime overlap, reconnect catch-up, reload persistence, authoritative remaining-chance restoration, and stable chronological merge in `tutor-system/src/contexts/__tests__/RoomContext.transferIngress.test.tsx`.
- [ ] T029 [P] [US3] Add concurrency tests for simultaneous second submissions, already-terminal replay, exactly one accepted terminal transition, timeout retry, and identical reread state across tabs in `tutor-system/src/contexts/__tests__/RoomContext.transferConcurrency.test.tsx`.
- [ ] T030 [P] [US3] Add mode compatibility tests for tutoring, Guard, assessment turn delivery, manual Guard change, Guard recovery, invalid mode/instruction pairs, and no assessment room mode in `tutor-system/src/contexts/__tests__/RoomContext.transferModes.test.tsx`.
- [ ] T031 [P] [US3] Add message tests for expanded-by-default state, accessible collapse/expand controls for every role, participant-local toggles, and selection/result preservation in `tutor-system/src/components/__tests__/PostComment.transfer.test.tsx`.
- [ ] T032 [P] [US3] Add page tests for reload/catch-up UI states, persisted remaining chances, unavailable capability, stale conflict messaging, and preserving the current selected learner in `tutor-system/src/pages/__tests__/RoomPagePost.transferLifecycle.test.tsx`.

### Implementation for User Story 3

- [ ] T033 [US3] Update `tutor-system/src/contexts/RoomContext.tsx` to route initial fetch, realtime, polling, optimistic replacement, and reconnect catch-up through the stable-ID merge helper and to restore component 102's persisted attempt and terminal state without any reset path.
- [ ] T034 [US3] Update `tutor-system/src/contexts/RoomContext.tsx` to use upstream idempotency and stale/terminal outcomes for retry rather than appending another local answer or reprocessing a resolved question.
- [ ] T035 [US3] Update `tutor-system/src/components/PostComment.tsx` and `tutor-system/src/components/PostComment.css` to keep expanded state participant-local and true by default, expose an accessible icon control, and preserve mounted answer selection/result state while collapsed.
- [ ] T036 [US3] Update `tutor-system/src/pages/RoomPagePost.tsx` to render explicit loading, unavailable, stale, retryable, and catch-up states without switching legacy rooms to transfer behavior.
- [ ] T037 [US3] Update `tutor-system/src/contexts/RoomContext.tsx` and `tutor-system/src/components/AISuggestionBox.tsx` so assessment turn decisions cannot be coerced into `RoomParticipationMode`, and Guard recovery remains a reviewed tutoring action.

**Checkpoint**: A reload, reconnect, retry, or duplicate tab converges to one persisted lifecycle view with correct focus and mode semantics.

## Phase 6: User Story 4 - Role-Appropriate Progress and Exports (Priority: P2)

**Goal**: Keep teacher review visibility and learner/public privacy correct in progress panels and downloads.

**Independent Test**: Build the same room as teacher, learner, and observer and assert each projection contains only role-authorized fields and the selected learner's progress.

### Tests for User Story 4

- [ ] T038 [P] [US4] Add checklist view tests for owner-scoped transfer progress, legacy/transfer separation, Guard lock display, and absence of cross-learner progress in `tutor-system/src/components/__tests__/ChecklistPanel.transfer.test.tsx`.
- [ ] T039 [P] [US4] Add export projection tests for learner, observer, and teacher downloads, including pre-terminal explanation absence, terminal learner-safe explanation presence, and absence of key/basis/rationale/raw decision/private interaction fields in `tutor-system/src/contexts/__tests__/roomExportBuilder.transfer.test.ts`.
- [ ] T040 [P] [US4] Add page/context tests proving structured decisions and public projections are consumed downstream rather than flattened into copied suggestion text in `tutor-system/src/pages/__tests__/RoomPagePost.transferDecision.test.tsx`.

### Implementation for User Story 4

- [ ] T041 [US4] Update `tutor-system/src/components/ChecklistPanel.tsx` and `tutor-system/src/hooks/useChecklist.ts` to select the server-provided learner-owned transfer projection and prevent direct status/understanding writes for `transfer_v1`.
- [ ] T042 [US4] Update `tutor-system/src/contexts/roomExportBuilder.ts` and `tutor-system/src/contexts/RoomContext.tsx` to build public and teacher exports from separate allowlisted projections, include learner-safe explanation only when component 102 discloses it terminally, and exclude private assessment fields from learner/observer outputs.
- [ ] T043 [US4] Update `tutor-system/src/pages/RoomPagePost.tsx` and `tutor-system/src/components/PostComment.tsx` to expose only role-appropriate lifecycle and progress details while retaining existing legacy room exports.

**Checkpoint**: Teacher and learner views/exports are role-scoped, transfer progress is read-only, and no private field reaches a learner projection.

## Phase 7: Polish and Cross-Cutting Verification

**Purpose**: Verify integration without claiming upstream or release gates.

- [ ] T044 Run the focused W7-W8 suite from `specs/103-transfer-room-ui/quickstart.md` and record exit status and test counts in `specs/103-transfer-room-ui/verification-notes.md`.
- [ ] T045 Run existing room/component regression tests and inspect any legacy tutoring/Guard failures in `tutor-system/src/__tests__/`, `tutor-system/src/components/__tests__/`, `tutor-system/src/contexts/__tests__/`, and `tutor-system/src/pages/__tests__/`.
- [ ] T046 Run `npx tsc --noEmit` and `npm run build` from `tutor-system/`; record failures as unresolved rather than changing configuration or adding fallbacks in `specs/103-transfer-room-ui/verification-notes.md`.
- [ ] T047 Review `tutor-system/README.md`, `tutor-system/claude_docs/README.md`, and nearest room/service documentation for required behavior updates; update only documentation owned by this component and record any deferred integration-owner update in `specs/103-transfer-room-ui/verification-notes.md`.
- [ ] T048 Confirm no SQL/RLS, auth/provider, prompt, Promptfoo, component 101/102/104-owned code, or release-browser files were changed by component 103 in `specs/103-transfer-room-ui/verification-notes.md`.

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 has no implementation dependency and freezes the upstream fixture boundary.
- Phase 2 depends on Phase 1 and component 102's exported typed service contract; it blocks all user stories because every story consumes those DTO/envelope types through the React adapter and identity merge primitives.
- User Story 1 and User Story 2 depend on Phase 2 and can proceed in parallel after the boundary is stable.
- User Story 3 depends on the message/review paths from User Stories 1 and 2, because it hardens their persisted/realtime convergence.
- User Story 4 depends on the typed public/private projections from Phase 2 and the delivered-message shape from User Stories 1 and 2.
- Phase 7 depends on all desired stories and is the local handoff checkpoint; it does not close backend or release gates.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; establishes teacher structured delivery.
- **US2 (P1)**: Starts after Phase 2; requires the public delivered-message shape from US1 but can test rendering with fixtures independently.
- **US3 (P2)**: Depends on US1 and US2 lifecycle identities; hardens reload/reconnect/retry behavior.
- **US4 (P2)**: Depends on the public/private projections and owner-scoped checklist read path; can run its projection tests independently once Phase 2 exists.

### Parallel Opportunities

- T003-T004 can run in parallel with T002.
- T005-T006 can run in parallel; T007 follows those adapter contract tests, T009 follows T007's adapter-local view-state definitions, and T008 is the separate stable-identity merge primitive.
- T010-T012 are independent red tests for US1.
- T018-T022 are independent red tests for US2.
- T028-T032 are independent red tests for US3.
- T038-T040 are independent red tests for US4.
- T044-T048 are sequential verification/documentation checks after implementation.

## Traceability

| Requirement group | Tasks |
|---|---|
| FR-001, FR-003, FR-004, FR-005, FR-006 | T010-T017 |
| FR-002, FR-007, FR-008, FR-009, FR-019 | T001, T003-T009, T018-T027 |
| FR-010, FR-011, FR-012, FR-016, FR-017, FR-020 | T008-T009, T028-T037 |
| FR-013, FR-014, FR-015 | T004, T038-T043 |
| FR-018 and SC-001 through SC-009 | T003-T004, T010-T012, T018-T022, T028-T032, T038-T048 |

FR-005 and FR-006 are the restated forms recorded in `research.md` Decisions 2026-09-12b and 2026-09-12c; the withdrawn revisions/hashes and reject/regenerate paths map to no task by design.

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 teacher review/send and US2 learner public answer flow.
3. Stop at the US2 checkpoint and run the focused identity/privacy/mode tests.

### Incremental Delivery

1. Add US3 convergence and concurrency behavior without changing the public DTO contract.
2. Add US4 role-scoped progress and export projections.
3. Run cross-cutting verification and hand off the local evidence plus unresolved upstream/downstream gates.

### Required Handoff Notes

- The backend capability remains disabled until the initiative release gates pass.
- Component 101 owns shared assessment/progress type files and exports; component 103 consumes them without editing `src/types/assessment.ts`, `src/types/learningProgress.ts`, or `src/types/index.ts`.
- Component 102 owns `transferAssessmentService.ts`, typed API DTO/envelope declarations, the six-operation mapping, and service contract tests; component 103 consumes them without edits.
- The reviewed-send path has no expected revision and no expected hash, and the promotion contains no reject or regenerate operation; component 103 must not reintroduce either.
- Component 102 must promote persisted attempts used/remaining, terminal state, retry versus terminal feedback, terminal answer/explanation disclosure, selection type after reload, and stem-only message content. Component 103 does not add a compatibility fallback if those fields are absent or incompatible.
- Missing trusted auth, hosted SQL/RLS evidence, provider/evaluation evidence, or browser release evidence is a named external blocker, not a UI fallback.
- Root agent context update is deferred to the integration owner; do not run `update-agent-context.sh` from this component worktree.
