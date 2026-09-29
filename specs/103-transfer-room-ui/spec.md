# Feature Specification: Transfer Room Lifecycle and UI Integration

**Feature Branch**: `103-transfer-room-ui`  
**Created**: 2026-09-11  
**Status**: Planned  
**Input**: Component 103 ownership for W7-W8 room lifecycle and teacher/learner UI integration.

## Scope

This specification is the source of truth for the teacher and learner room experience: question review and delivery, answer selection and submission, room-state continuity, progress visibility, and role-appropriate exports. The room consumes the approved domain rules and trusted-service results; it does not decide identity, grading, attempts, or progress. Supporting plans and contracts define the exact service fields and local view state. Database, authorization, provider, evaluation, and release-browser behavior remain separate capabilities.

## Clarifications

### Session 2026-09-21

- Q: How should learners select answers? → A: Single-answer questions allow one choice, multiple-answer questions allow multiple choices, and both require an explicit submission action. The detailed control choice is recorded in the [implementation plan](plan.md).
- Q: What submissions consume one of the learner's two chances? → A: Submission is unavailable until the required choice is selected; answers use displayed choices and do not accept free text, so the normal flow cannot submit an empty or malformed answer.
- Q: What explanation should learners receive after a second incorrect answer? → A: Prepare a dedicated learner-safe correct-answer explanation with the question; show it in the teacher review UI, allow the teacher to edit it, and reveal it to the learner only after the second incorrect answer.
- Q: How should transfer-assessment message folding behave for room participants? → A: Each message starts expanded, and every participant can independently collapse or expand it; one participant's toggle does not affect anyone else's view.

### Session 2026-09-22

- Q: Must the learner's two-chance lifecycle persist across page restarts and duplicate tabs? → A: Yes. The backend owns and persists the two-attempt lifecycle; reloads, remounts, reconnects, and duplicate tabs render the same authoritative attempts-used, attempts-remaining, and terminal state.

## User Scenarios & Testing

### User Story 1 - Teacher Reviews and Sends a Transfer Question (Priority: P1)

As a teacher, I need to review a structured transfer-assessment draft for the selected learner and send it only after I confirm the content, so that the learner receives the intended question and the private answer key remains available only to the authorized review path.

**Why this priority**: Delivery is the boundary that turns a prepared candidate decision into a learner-visible assessment. A candidate that was never confirmed and sent must never affect the learner or progress.

**Independent Test**: Review a question for a selected learner, edit its content and answer, confirm it, and send it. Observe that the confirmed question is delivered to the selected learner and private answer material is not included in the learner view.

**Acceptance Scenarios**:

1. **Given** a teacher has prepared a question for a selected learner and source message, **When** the teacher opens it for review, **Then** the review shows the target, four ordered options, answer type, correct answer, learner-safe explanation, learner preview, and confirmation state without exposing unrelated learners' private data.
2. **Given** the teacher edits the stem, options, selection type, key, or learner-safe explanation, **When** the draft is submitted, **Then** the prior confirmation is cleared and a new explicit confirmation is required.
3. **Given** a confirmed question, **When** the teacher sends it, **Then** it is delivered exactly once and the room remains in tutoring even though that turn presents an assessment.

### User Story 2 - Learner Sees and Answers a Public Question (Priority: P1)

As a learner, I need to see the public assessment question in the ordinary tutoring room and submit a deterministic answer through the existing chat, so that my answer can be resolved without seeing the answer key or private transfer basis.

**Why this priority**: The learner-visible path is the product behavior that the teacher review flow is intended to deliver.

**Independent Test**: Open a delivered question, submit incorrect answers across reload and duplicate-tab boundaries, and observe the remaining chance and terminal result. Confirm the answer stays private until the second incorrect answer, no third answer is accepted, and the room does not change progress on its own.

**Acceptance Scenarios**:

1. **Given** a delivered assessment, **When** the learner opens or reloads the room before resolution, **Then** the learner sees the structured stem without an embedded option list, followed by the instruction and exactly one rendering of options A-D in order, and does not receive the correct option IDs, learner-safe explanation, transfer basis, teacher rationale, raw model output, or private key.
2. **Given** a single-answer question, **When** the learner selects one choice and explicitly submits it, **Then** the answer is associated with the delivered question and is not graded locally or used to change progress in the room.
3. **Given** a multiple-answer question, **When** the learner selects one or more choices and explicitly submits them, **Then** the result is independent of selection order and is resolved by the trusted answer-processing service.
4. **Given** a question is awaiting an answer, **When** the learner has not made the required selection, **Then** submission is unavailable and the answer surface provides no free-text input.
5. **Given** a learner submits an incorrect first selection, **When** the server returns the persisted retry result, **Then** the UI says only that the answer is incorrect, displays the server-reported one remaining chance, and allows another selection without revealing the correct answer or learner-safe explanation.
6. **Given** a learner submits a correct selection on either chance, **When** the server returns the attempt result, **Then** the UI resolves the question as correct and permits no further answer submission.
7. **Given** a learner submits an incorrect second selection, **When** the server returns the persisted terminal result, **Then** the UI reveals the role-safe correct answer and learner-safe explanation and permits no third submission in any reload or tab.
8. **Given** a learner submits another answer after the question has resolved, **When** the message is processed, **Then** it cannot earn another grade or create another progress transition for that question.
9. **Given** a transfer-assessment message is visible to any room participant, **When** it first renders or the participant toggles its disclosure control, **Then** it starts expanded and can be collapsed or expanded without changing another participant's view or the assessment answer state.
10. **Given** a learner has submitted answers to a question, **When** the learner views its assessment message, **Then** each saved submission appears within that question with its selected options and server feedback; left and right controls switch between submissions, and those submissions do not appear as separate learner chat comments.

### User Story 3 - Room Lifecycle Survives Reload, Reconnect, and Duplicate Tabs (Priority: P2)

As a teacher or learner, I need the room to show the same state after reloads, reconnects, and activity in another tab, so that questions, answers, message relationships, and room modes are not duplicated or lost.

**Why this priority**: Room information arrives from saved history, live updates, and local interaction. Incorrect reconciliation can duplicate a question or attach an answer to the wrong learner or message.

**Independent Test**: Join and reconnect to a room while messages and delivery results arrive late, repeat, or come from another tab. Observe that the room shows each question once, keeps it associated with the original learner and message, and surfaces delivery conflicts.

**Acceptance Scenarios**:

1. **Given** a room with saved messages and question state, **When** a user joins, reconnects, or reloads, **Then** the room catches up to the saved history and shows each message once in the correct order.
2. **Given** a teacher focuses a particular learner message, **When** a later message arrives from another learner or tab, **Then** any reviewed delivery remains associated with the originally selected learner, message, checklist, and parent.
3. **Given** a delivery times out before its result is known, **When** the teacher retries, **Then** the original result appears once and the room does not append a duplicate question.
4. **Given** a room is in Guard, **When** an assessment draft is generated or delivered, **Then** assessment is represented as a turn-level mode, the room remains or returns to its server-authoritative participation mode, and no progression lock is bypassed.
5. **Given** an invalid combination of room mode, instruction, or question data, **When** it is received, **Then** the room rejects it instead of coercing it into another mode or sending an incompatible answer.
6. **Given** a learner has used one chance for a delivered question, **When** the learner fully reloads or remounts the page, reconnects, or opens another tab, **Then** every page renders the same persisted one-chance-remaining state and none can reset or bypass the attempt limit.
7. **Given** a learner reloads the room while their stored identity is still being restored, **When** identity restoration finishes, **Then** the room joins with that learner identity and replays their persisted answers before showing completed question outcomes and remaining chances; an unanswered question remains available.

### User Story 4 - Teacher and Learner See Role-Appropriate Progress and Exports (Priority: P2)

As a room participant, I need progress and exports scoped to my role and learner, so that teachers can review the lifecycle while learners receive only public conversation and question data.

**Why this priority**: The UI must preserve the privacy boundary through local views, reloads, and downloads, not only in the primary message surface.

**Independent Test**: View the same room as teacher, learner, and observer, then inspect each role's progress and downloaded room data. Confirm that learner-specific progress and private assessment information appear only to roles allowed to see them.

**Acceptance Scenarios**:

1. **Given** a transfer-policy checklist owned by learner A, **When** the teacher views the room, **Then** the teacher sees the selected learner's structured progress; learner B does not receive learner A's progress through the room UI.
2. **Given** a learner downloads room data, **When** the export is built, **Then** it contains public messages and public assessment rendering only, without keys, rationale, transfer basis, raw decisions, or teacher-only interaction metadata.
3. **Given** a teacher downloads room data, **When** the export is built, **Then** teacher-only metadata is included only in the authorized teacher projection and is not copied into the learner projection.
4. **Given** legacy room-shared checklist data, **When** it is displayed beside transfer-policy data, **Then** legacy values remain legacy and are not displayed as transfer verification.

### Edge Cases

- The selected learner, source message, checklist, or parent is missing, belongs to another room, or is not available; preparation is blocked instead of guessing from message text or using the latest message as a fallback.
- A live update arrives before saved history, arrives twice, or arrives after a reconnect; the room still shows one record in chronological order.
- A candidate is dirty, invalid, discarded, or superseded by a delivery from another tab; no unconfirmed candidate becomes a delivered question.
- A stale or tampered answer reaches the room; answer controls cannot create it, and validation rejects it without consuming an attempt.
- A participant collapses an assessment while an answer selection or result is present; expanding it restores the same local selection and server-authoritative result without consuming a chance or changing another participant's view.
- A learner fully reloads or remounts the page, reconnects, or opens another tab after an incorrect attempt; all clients re-read the persisted attempt count, remaining chances, outcome, and disclosure state, and none can reset the lifecycle.
- A reviewed question or delivery result has an invalid room mode, missing instruction, or invalid target; the room rejects it without coercion.
- Guard mode is manually changed while an assessment is pending; assessment cannot bypass the room participation lock and recovery remains a reviewed tutoring action.
- Browser exports, local state, realtime payloads, errors, and rendered learner content must not contain the assessment key, transfer basis, rationale, or raw model output.

## Requirements

### Functional Requirements

- **FR-001**: The room MUST preserve the association among the selected learner, focused message, checklist, target item, and parent message from preparation through review, delivery, answer submission, reload, and reconnect.
- **FR-002**: The room MUST consume the approved assessment and progress information without redefining shared behavior. It MUST accept only documented role-appropriate information, reject missing or invalid required data, and prevent unknown or private fields from entering learner views, updates, or exports. The exact upstream fields and local view-state shapes are defined in the [room UI contract](contracts/room-ui-contracts.md) and upstream [assessment API contract](../102-transfer-backend/contracts/assessment-api.md).
- **FR-003**: The teacher review MUST show the selected target, four ordered options, answer type, correct answer, learner-safe explanation, learner preview, and confirmation state. It MUST NOT imply that an unsent question is a saved draft or claim a saved revision or review record.
- **FR-004**: The teacher MUST be able to edit question content, answer, and learner-safe explanation; any edit MUST clear prior confirmation and require reconfirmation before delivery.
- **FR-005**: Delivery MUST use the confirmed question with its original room, learner, checklist, target, and source-message context. Validation, scope, and conflict failures MUST appear as explicit unsent states without creating a learner-visible question. Review MUST NOT imply a saved draft revision or content version.
- **FR-006**: Discarding, replacing, or preparing another unconfirmed question MUST NOT create a delivered assessment, progress change, duplicate message, or saved draft. The flow has no separate reject or regenerate action; its exact service boundary is defined in the [upstream API contract](../102-transfer-backend/contracts/assessment-api.md).
- **FR-007**: The learner MUST see only the public question stem, selection instruction, and options A-D. A single-answer question MUST allow one choice and a multiple-answer question MUST allow multiple choices; the specific controls are recorded in the [implementation plan](plan.md).
- **FR-008**: Answer submission MUST require an explicit action and a required displayed choice, use the existing room message flow with the correct question and parent relationship, and accept no free-text answer. The room MUST NOT grade answers or change progress directly.
- **FR-009**: The room MUST display the two-attempt lifecycle only from the authoritative service result. The target learner's assessment message MUST show each saved answer selection and its feedback in navigable answer history instead of separate answer comments. After the first incorrect answer it MUST show only that result and the remaining chance; after a second incorrect answer it MUST show the authorized correct answer and learner-safe explanation and disable further submission. The room MUST NOT increment, reset, infer, or decide attempts, terminal state, or disclosure.
- **FR-010**: Room participation MUST remain tutoring or Guard; an assessment is limited to one tutor turn and delivery returns the room to tutoring unless the trusted service rejects it.
- **FR-011**: Saved history, live updates, retry results, and reconnect catch-up MUST converge on one room view without duplicate messages or question states.
- **FR-012**: The room MUST wait for stored identity restoration before its initial room join and restore the question, answer, attempt count, remaining chance, terminal result, and disclosure state after reload. Duplicate-tab submissions MUST use the authoritative result and reread current state; no page lifecycle may reset the attempt limit.
- **FR-013**: Progress views MUST show transfer checklist information only for the selected learner and MUST leave legacy room-shared checklist behavior unchanged.
- **FR-014**: Learner-facing views and exports MUST exclude the answer key, transfer basis, rationale, raw model output, and teacher-only interaction information.
- **FR-015**: Teacher-only exports MAY include authorized review information but MUST preserve the public/private boundary and MUST NOT become a second source of progress authority.
- **FR-016**: Invalid combinations, missing identity links, malformed public questions, and unauthorized information MUST produce an explicit error or unavailable state, never a silent fallback.
- **FR-017**: Existing tutoring and Guard behavior for legacy rooms, including Multi-agent draft review, staged message playback, and learner response gating, MUST continue to work. Transfer behavior MUST remain unavailable when the trusted capability is disabled.
- **FR-018**: Learner, message, checklist, and parent associations MUST remain correct through catch-up, reconnect, review edits, reconfirmation, delivery conflict, mode mismatch, reload, retry, and duplicate-tab activity.
- **FR-019**: The question stem MUST appear once and each structured option MUST appear once in learner and preview views. The room MUST NOT alter question text to hide or remove a duplicated option list.
- **FR-020**: Every transfer question MUST start expanded and provide an accessible way for each participant to collapse or expand it. That choice MUST affect only that participant's view and MUST NOT change shared room state, answer selections, attempts, or results.

### Key Entities

- **Room participation**: The room's tutoring or Guard state, separate from a question presented during one tutor turn.
- **Tutor decision**: The structured choice to tutor, use Guard, or present an assessment, with compatible instructions and target.
- **Teacher review question**: A prepared question shown to the teacher with its target, answer, editable explanation, learner preview, and confirmation state. It is not a saved draft.
- **Public question**: The learner-visible stem, selection instruction, choices, and routing information, without private grading material. Its exact field shape is defined by the [upstream API contract](../102-transfer-backend/contracts/assessment-api.md).
- **Terminal failure explanation**: The correct answer and learner-safe explanation shown only to the authorized learner after the second incorrect answer.
- **Answer message**: A learner's room message associated with the delivered question and its original parent/source.
- **Answer view**: Participant-local selection and submission state alongside the authoritative attempts, remaining chance, result, and permitted feedback. Local selection may reset on reload; authoritative lifecycle state may not.
- **Transfer progress view**: A read-only view of the selected learner's transfer checklist information.
- **Room update identity**: Stable identity, event order, and duplicate-result information needed to merge saved history, live updates, and retry results without showing a message twice or changing authoritative assessment state.
- **Question disclosure state**: A participant's local expanded or collapsed view for a question; it does not alter shared room or assessment state.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The same selected learner, focused message, checklist, target item, and parent remain associated with the question from preparation through delivery and answer submission.
- **SC-002**: Every edit clears confirmation; rejected deliveries remain unsent; and no unconfirmed or rejected question becomes visible to the learner or changes progress.
- **SC-003**: Learner views and exports contain only authorized public question information and expose none of the private answer, transfer basis, rationale, raw model output, or teacher-only information.
- **SC-004**: Every answer outcome reflects the trusted service result, causes no direct room progress change, reveals no answer after the first incorrect selection or a pass, reveals answer and explanation only after the second incorrect selection, accepts no third attempt, and provides no empty, free-text, or malformed answer path.
- **SC-005**: After joining, reconnecting, reloading, retrying a timed-out delivery, or using duplicate tabs, the room converges on one question, answer, and attempt state per identity, with no duplicate delivery or history and the same remaining chance and terminal state across views.
- **SC-006**: Room participation remains tutoring or Guard, assessment remains turn-level, invalid combinations are rejected, and Guard recovery behavior is preserved.
- **SC-007**: Teachers can review, edit, reconfirm, and send a question in one uninterrupted flow; learners can select an answer with the appropriate one-choice or multiple-choice interaction and explicitly submit without receiving private information.
- **SC-008**: Every learner and teacher view displays each question stem and each structured option exactly once.
- **SC-009**: Every question starts expanded; participants can independently collapse and expand it; this changes no shared room, answer-selection, attempt, or result state.

## Assumptions

- The trusted assessment service supplies the existing six actions, role-appropriate question and result information, authorization, grading, attempt lifecycle, terminal feedback, and progress outcomes. The exact action names and response fields are defined by the [upstream API contract](../102-transfer-backend/contracts/assessment-api.md); this feature consumes them without redefining their meaning.
- The approved domain and transfer plans define progress outcomes, assessment lifecycle, answer semantics, and the separation between room participation and one assessment turn. The room consumes those decisions without creating a second authority.
- The existing room experience and its established interaction patterns remain the application surface; concrete components and test conventions are recorded in the [implementation plan](plan.md).
- Transfer capability remains controlled by the trusted service and unavailable until release gates pass; the room shows an unavailable state when the capability is disabled.
- Legacy checklist and tutoring/Guard paths must remain operational and are tested as regression behavior.
- The integration owner updates shared agent guidance after this planning package; this component does not update shared project guidance. The ownership detail is recorded in the [implementation plan](plan.md).

## Out of Scope

- Database schema and access control, trusted identity implementation, provider credentials and prompts, evaluation policy, hosted deployment, and release-browser evidence.
- New authentication, a separate quiz application, client-side grading, direct progress changes, a room-level Assessment Mode, or a new mastery field.
