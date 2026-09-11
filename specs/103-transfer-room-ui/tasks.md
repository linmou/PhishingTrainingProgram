---

description: "Dependency-ordered W7-W8 tasks for transfer room lifecycle and teacher/learner UI integration"
---

# Tasks: Transfer Room Lifecycle and UI Integration

**Input**: Design documents from `specs/103-transfer-room-ui/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Implementation boundary**: These tasks cover only browser/UI integration. Do not add SQL/RLS, trusted authentication, provider logic, prompt changes, Promptfoo, deployment, or release-browser evidence here.

**Test policy**: Tests are required by the component request. For every story, write the focused tests first, confirm the missing behavior fails, then implement and refactor using the repository's required `fast-multi-agent-tdd` workflow during implementation.

## Phase 1: Setup (Shared Planning and Contract Fixtures)

**Purpose**: Establish the upstream boundary and focused test fixtures without changing production behavior.

- [ ] T001 Review `specs/103-transfer-room-ui/spec.md`, `plan.md`, `data-model.md`, `contracts/room-ui-contracts.md`, and `quickstart.md` against component 101 domain contracts and component 102 DTO fixtures; record any incompatible upstream shape in `specs/103-transfer-room-ui/research.md`.
- [ ] T002 [P] Freeze the original-plan SHA-256 and W7/W8 ownership references in `specs/103-transfer-room-ui/research.md` without editing `plan/transfer_assessment_implementation_plan.md`.
- [ ] T003 [P] Add shared room/message/draft/public-assessment fixtures with multiple learners and stable IDs in `tutor-system/src/__tests__/fixtures/transferRoomFixtures.ts`.
- [ ] T004 [P] Add a test helper that asserts forbidden private fields are absent from learner DTOs, message projections, exports, and browser-facing state in `tutor-system/src/__tests__/helpers/transferPrivacyAssertions.ts`.

## Phase 2: Foundational (Typed Boundary and UI State Primitives)

**Purpose**: Establish the explicit consumer boundary before story-specific UI work.

- [ ] T005 [P] Define typed success/error envelopes, teacher draft DTOs, public assessment DTOs, lifecycle outcomes, and stable error categories in `tutor-system/src/services/transferAssessmentService.ts` using the allowlist in `specs/103-transfer-room-ui/contracts/room-ui-contracts.md`.
- [ ] T006 [P] Add contract tests for private teacher versus public learner projections and unknown-field rejection in `tutor-system/src/services/__tests__/transferAssessmentService.test.ts`.
- [ ] T007 [P] Add tests for assessment/room mode compatibility, missing instructions, unknown targets, and public rendering shape in `tutor-system/src/services/__tests__/transferRoomContract.test.ts`.
- [ ] T008 Implement a single stable-identity merge helper for persisted messages, optimistic replacement, realtime inserts, and reconnect catch-up in `tutor-system/src/contexts/RoomContext.tsx`, preserving pre-populated legacy messages and chronological ordering.
- [ ] T009 [P] Add the typed draft/public-question/lifecycle view-state definitions used by the room context in `tutor-system/src/types/index.ts` without introducing a progress or mastery field.

**Checkpoint**: The browser boundary is typed, private/public projections are testable, and no component consumes a raw backend record.

## Phase 3: User Story 1 - Teacher Reviews and Sends a Transfer Question (Priority: P1)

**Goal**: Deliver one reviewed, confirmed, non-stale structured assessment without phantom messages or progress writes.

**Independent Test**: Prepare a draft for learner A and source message A, edit it, reconfirm it, send it, and verify the request identities, public delivered message, room tutoring mode, and stale/rejected behavior.

### Tests for User Story 1

- [ ] T010 [P] [US1] Add `AssessmentDraftEditor` tests for rendering four ordered options, single/multiple key cardinality, validation failure, dirty-edit confirmation reset, explicit reconfirmation, and no direct progress controls in `tutor-system/src/components/__tests__/AssessmentDraftEditor.test.tsx`.
- [ ] T011 [P] [US1] Add RoomContext integration tests for focus student/message/checklist/item identity, expected revision/hash, review-then-send ordering, and room tutoring mode in `tutor-system/src/contexts/__tests__/RoomContext.transferDraftLifecycle.test.tsx`.
- [ ] T012 [P] [US1] Add page integration tests for reject, regenerate, dirty draft, stale revision, stale hash, retryable send failure, and no phantom learner message in `tutor-system/src/pages/__tests__/RoomPagePost.transferDraft.test.tsx`.

### Implementation for User Story 1

- [ ] T013 [US1] Update `tutor-system/src/components/AssessmentDraftEditor.tsx` to expose explicit dirty, validating, confirmed, stale, rejected, and saving states while preserving structured edits and server validation.
- [ ] T014 [US1] Update `tutor-system/src/services/transferAssessmentService.ts` to return typed prepare/review/send and upstream-defined draft suppression/regeneration lifecycle results, mapping stale, validation, unavailable, duplicate, and retryable errors without exposing raw provider output.
- [ ] T015 [US1] Update `tutor-system/src/contexts/RoomContext.tsx` to retain selected learner/message/checklist/item focus, clear confirmation after edits, pass expected revision/hash, merge persisted send results once, and keep progress untouched.
- [ ] T016 [US1] Update `tutor-system/src/pages/RoomPagePost.tsx` to show the structured teacher editor only for an authorized transfer draft, route reject/regenerate/reconfirm/send actions, and preserve the legacy `AISuggestionBox` path for legacy rooms.
- [ ] T017 [US1] Update `tutor-system/src/components/AISuggestionBox.tsx` only where needed to avoid treating a structured transfer draft as copy-only text or as a room-mode toggle; preserve existing non-transfer quick-adjust behavior.

**Checkpoint**: A teacher can review and send one current structured draft; edited, rejected, regenerated, or stale drafts remain unsent until explicitly valid and confirmed.

## Phase 4: User Story 2 - Learner Sees and Answers a Public Question (Priority: P1)

**Goal**: Render only the public question and attach learner answers to the delivered assessment through ordinary chat without local grading or progress writes.

**Independent Test**: Render a public single and multiple question as learner, submit labels through chat, reload, and verify assessment/parent identity plus zero browser progress writes.

### Tests for User Story 2

- [ ] T018 [P] [US2] Add learner-view tests for stem, canonical instruction, A-D order, public assessment identity, and absence of key/basis/reason/raw model data in `tutor-system/src/components/__tests__/ChatMessage.transfer.test.tsx`.
- [ ] T019 [P] [US2] Add post-style room rendering tests for public assessment messages, ordinary tutoring display, Guard display, and no teacher-only metadata in `tutor-system/src/components/__tests__/PostComment.transfer.test.tsx`.
- [ ] T020 [P] [US2] Add chat submission tests for `assessment_id`, actual `parent_message_id`, ordinary-message separation, ambiguous/content-help/empty outcomes, duplicate answer identity, and no progress service invocation in `tutor-system/src/contexts/__tests__/RoomContext.transferAnswer.test.tsx`.
- [ ] T021 [P] [US2] Add service adapter tests for public projection stripping and server-result preservation in `tutor-system/src/services/__tests__/transferAssessmentService.test.ts`.

### Implementation for User Story 2

- [ ] T022 [US2] Update `tutor-system/src/components/ChatMessage.tsx` and `tutor-system/src/components/PostComment.tsx` to render a public assessment projection attached to a delivered message, using only `PublicAssessmentDTO` and never a private draft/key object.
- [ ] T023 [US2] Update `tutor-system/src/contexts/RoomContext.tsx` and `tutor-system/src/pages/RoomPagePost.tsx` to forward learner answer content, delivered assessment identity, and persisted question parent ID through the existing chat send path.
- [ ] T024 [US2] Update `tutor-system/src/services/transferAssessmentService.ts` to preserve structured server lifecycle outcomes for first-valid-answer, duplicate, ambiguous, assisted, stale, and invalidated cases without parsing or grading in React.
- [ ] T025 [US2] Update `tutor-system/src/components/ChecklistPanel.tsx` and `tutor-system/src/hooks/useChecklist.ts` so transfer-policy progress is displayed owner-scoped and remains read-only, while legacy checklist controls retain their explicit legacy path.

**Checkpoint**: Learners see and answer a public question in the tutoring room, while the browser performs no answer-key comparison and no direct progress mutation.

## Phase 5: User Story 3 - Room Lifecycle Survives Reload, Reconnect, and Duplicate Tabs (Priority: P2)

**Goal**: Converge persisted room state and realtime events without duplicate messages, lifecycle records, answer effects, or incorrect parent links.

**Independent Test**: Exercise fetch/realtime ordering, reconnect, reload, timeout retry, optimistic replacement, and two-tab stale operations against one fixture room and compare the final visible state with a clean reload.

### Tests for User Story 3

- [ ] T026 [P] [US3] Add RoomContext ingress tests for realtime-before-fetch, duplicate realtime insert, polling/realtime overlap, reconnect catch-up, reload persistence, and stable chronological merge in `tutor-system/src/contexts/__tests__/RoomContext.transferIngress.test.tsx`.
- [ ] T027 [P] [US3] Add retry/idempotency tests for timeout-then-retry, duplicate send result, duplicate answer, and stale draft from a second tab in `tutor-system/src/contexts/__tests__/RoomContext.transferConcurrency.test.tsx`.
- [ ] T028 [P] [US3] Add mode compatibility tests for tutoring, Guard, assessment turn delivery, manual Guard change, Guard recovery, invalid mode/instruction pairs, and no assessment room mode in `tutor-system/src/contexts/__tests__/RoomContext.transferModes.test.tsx`.
- [ ] T029 [P] [US3] Add page tests for reload/catch-up UI states, unavailable capability, stale conflict messaging, and preserving the current selected learner in `tutor-system/src/pages/__tests__/RoomPagePost.transferLifecycle.test.tsx`.

### Implementation for User Story 3

- [ ] T030 [US3] Update `tutor-system/src/contexts/RoomContext.tsx` to route initial fetch, realtime, polling, optimistic replacement, and reconnect catch-up through the stable-ID merge helper and to retain focus/draft state across reload-safe responses.
- [ ] T031 [US3] Update `tutor-system/src/contexts/RoomContext.tsx` to use upstream idempotency and stale outcomes for send/retry rather than appending a second local message or reprocessing a resolved answer.
- [ ] T032 [US3] Update `tutor-system/src/pages/RoomPage.tsx` and `tutor-system/src/pages/RoomPagePost.tsx` to render explicit loading, unavailable, stale, retryable, and catch-up states without switching legacy rooms to transfer behavior.
- [ ] T033 [US3] Update `tutor-system/src/contexts/RoomContext.tsx` and `tutor-system/src/components/AISuggestionBox.tsx` so assessment turn decisions cannot be coerced into `RoomParticipationMode`, and Guard recovery remains a reviewed tutoring action.

**Checkpoint**: A reload, reconnect, retry, or duplicate tab converges to one persisted lifecycle view with correct focus and mode semantics.

## Phase 6: User Story 4 - Role-Appropriate Progress and Exports (Priority: P2)

**Goal**: Keep teacher review visibility and learner/public privacy correct in progress panels and downloads.

**Independent Test**: Build the same room as teacher, learner, and observer and assert each projection contains only role-authorized fields and the selected learner's progress.

### Tests for User Story 4

- [ ] T034 [P] [US4] Add checklist view tests for owner-scoped transfer progress, legacy/transfer separation, Guard lock display, and absence of cross-learner progress in `tutor-system/src/components/__tests__/ChecklistPanel.transfer.test.tsx`.
- [ ] T035 [P] [US4] Add export projection tests for learner, observer, and teacher downloads, including absence of key/basis/rationale/raw decision/private interaction fields in `tutor-system/src/contexts/__tests__/roomExportBuilder.transfer.test.ts`.
- [ ] T036 [P] [US4] Add page/context tests proving structured decisions and public projections are consumed downstream rather than flattened into copied suggestion text in `tutor-system/src/pages/__tests__/RoomPagePost.transferDecision.test.tsx`.

### Implementation for User Story 4

- [ ] T037 [US4] Update `tutor-system/src/components/ChecklistPanel.tsx` and `tutor-system/src/hooks/useChecklist.ts` to select the server-provided learner-owned transfer projection and prevent direct status/understanding writes for `transfer_v1`.
- [ ] T038 [US4] Update `tutor-system/src/contexts/roomExportBuilder.ts` and `tutor-system/src/contexts/RoomContext.tsx` to build public and teacher exports from separate allowlisted projections, excluding private assessment fields from learner/observer outputs.
- [ ] T039 [US4] Update `tutor-system/src/pages/RoomPagePost.tsx`, `tutor-system/src/components/ChatMessage.tsx`, and `tutor-system/src/components/PostComment.tsx` to expose only role-appropriate lifecycle and progress details while retaining existing legacy room exports.

**Checkpoint**: Teacher and learner views/exports are role-scoped, transfer progress is read-only, and no private field reaches a learner projection.

## Phase 7: Polish and Cross-Cutting Verification

**Purpose**: Verify integration without claiming upstream or release gates.

- [ ] T040 [P] Run the focused W7-W8 suite from `specs/103-transfer-room-ui/quickstart.md` and record exit status and test counts in `specs/103-transfer-room-ui/verification-notes.md`.
- [ ] T041 [P] Run existing room/component regression tests and inspect any legacy tutoring/Guard failures in `tutor-system/src/__tests__/`, `tutor-system/src/components/__tests__/`, `tutor-system/src/contexts/__tests__/`, and `tutor-system/src/pages/__tests__/`.
- [ ] T042 [P] Run `npx tsc --noEmit` and `npm run build` from `tutor-system/`; record failures as unresolved rather than changing configuration or adding fallbacks in `specs/103-transfer-room-ui/verification-notes.md`.
- [ ] T043 Review `tutor-system/README.md`, `tutor-system/claude_docs/README.md`, and nearest room/service documentation for required behavior updates; update only documentation owned by this component and record any deferred integration-owner update in `specs/103-transfer-room-ui/verification-notes.md`.
- [ ] T044 Confirm the original-plan SHA-256 remains `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2` and confirm no SQL/RLS, auth/provider, prompt, Promptfoo, or release-browser files were changed by this component in `specs/103-transfer-room-ui/verification-notes.md`.

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 has no implementation dependency and freezes the upstream fixture boundary.
- Phase 2 depends on Phase 1 and blocks all user stories because every story consumes the typed DTO and identity merge primitives.
- User Story 1 and User Story 2 depend on Phase 2 and can proceed in parallel after the boundary is stable.
- User Story 3 depends on the message/draft paths from User Stories 1 and 2, because it hardens their persisted/realtime convergence.
- User Story 4 depends on the typed public/private projections from Phase 2 and the delivered-message shape from User Stories 1 and 2.
- Phase 7 depends on all desired stories and is the local handoff checkpoint; it does not close backend or release gates.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; establishes teacher structured delivery.
- **US2 (P1)**: Starts after Phase 2; requires the public delivered-message shape from US1 but can test rendering with fixtures independently.
- **US3 (P2)**: Depends on US1 and US2 lifecycle identities; hardens reload/reconnect/retry behavior.
- **US4 (P2)**: Depends on the public/private projections and owner-scoped checklist read path; can run its projection tests independently once Phase 2 exists.

### Parallel Opportunities

- T003-T004 can run in parallel with T002.
- T005-T007 and T009 can run in parallel before T008 integration.
- T010-T012 are independent red tests for US1.
- T018-T021 are independent red tests for US2.
- T026-T029 are independent red tests for US3.
- T034-T036 are independent red tests for US4.
- T040-T044 are separate verification/documentation checks after implementation, with T044 required before commit.

## Traceability

| Requirement group | Tasks |
|---|---|
| FR-001, FR-003, FR-004, FR-005, FR-006 | T010-T017 |
| FR-002, FR-007, FR-008, FR-009 | T005-T007, T018-T025 |
| FR-010, FR-011, FR-012, FR-016, FR-017 | T008, T026-T033 |
| FR-013, FR-014, FR-015 | T025, T034-T039 |
| FR-018 and SC-001 through SC-007 | T003-T004, T010-T012, T018-T021, T026-T029, T034-T044 |

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
- Missing trusted auth, hosted SQL/RLS evidence, provider/evaluation evidence, or browser release evidence is a named external blocker, not a UI fallback.
- Root agent context update is deferred to the integration owner; do not run `update-agent-context.sh` from this component worktree.
