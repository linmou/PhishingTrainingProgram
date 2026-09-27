# Feature Specification: Transfer Room Lifecycle and UI Integration

**Feature Branch**: `103-transfer-room-ui`  
**Created**: 2026-09-11  
**Status**: Planned  
**Input**: Component 103 ownership for W7-W8 room lifecycle and teacher/learner UI integration.

## Scope

This component connects the existing room experience to the transfer-assessment contracts from upstream components. It covers room ingress and catch-up, teacher review and delivery, learner question rendering and answer submission, participation-mode preservation, and role-scoped exports. It does not define database schema, row-level security, trusted identity, provider behavior, prompts, evaluation, or release-browser execution.

Component 101 owns the shared assessment/progress domain type exports, including their exports through `tutor-system/src/types/index.ts`. Component 102 owns `tutor-system/src/services/transferAssessmentService.ts`, its operation mapping, and its typed API DTO/envelope exports. This component consumes those 101/102 exports unchanged and may define only React view-state types in UI-owned files. The promoted upstream contracts expose the server-authoritative attempt outcome, persisted attempt count and remaining chances, terminal state, and role-safe terminal feedback. The UI renders those fields but never resets, increments, or decides them. A reload, remount, reconnect, or separate tab re-reads the same persisted attempt lifecycle. This component never derives correctness from private browser data and never treats browser role, display name, local storage, or client-side progress state as authorization or as the source of truth for learning progress.

## Clarifications

### Session 2026-09-21

- Q: How should the selective answer control map to single- and multiple-answer questions? → A: Use radio buttons for single-answer questions and checkboxes for multiple-answer questions, with an explicit Submit answer action.
- Q: What submissions consume one of the learner's two chances? → A: Submit answer is disabled until the required selection exists, and assessment answers accept only displayed options, not free text; therefore empty or malformed submissions cannot occur through the normal UI.
- Q: What explanation should learners receive after a second incorrect answer? → A: Prepare a dedicated learner-safe correct-answer explanation with the question; show it in the teacher review UI, allow the teacher to edit it, and reveal it to the learner only after the second incorrect answer.
- Q: How should transfer-assessment message folding behave for room participants? → A: Each message starts expanded, and every participant can independently collapse or expand it; one participant's toggle does not affect anyone else's view.

### Session 2026-09-22

- Q: Must the learner's two-chance lifecycle persist across page restarts and duplicate tabs? → A: Yes. The backend owns and persists the two-attempt lifecycle; reloads, remounts, reconnects, and duplicate tabs render the same authoritative attempts-used, attempts-remaining, and terminal state.

## User Scenarios & Testing

### User Story 1 - Teacher Reviews and Sends a Transfer Question (Priority: P1)

As a teacher, I need to review a structured transfer-assessment draft for the selected learner and send it only after I confirm the content, so that the learner receives the intended question and the private answer key remains available only to the authorized review path.

**Why this priority**: Delivery is the boundary that turns a prepared candidate decision into a learner-visible assessment. A candidate that was never confirmed and sent must never affect the learner or progress.

**Independent Test**: Provide a structured candidate decision and a selected learner focus, edit the stem, options, key, and learner-safe explanation, confirm it, send it, and assert the reviewed-send request carries the confirmed decision with the prepared scope identity while the resulting learner message contains only the public assessment projection.

**Acceptance Scenarios**:

1. **Given** a teacher has one prepared candidate decision for a selected learner and source message, **When** the teacher opens the review surface, **Then** the editor shows the target, four ordered options, selection type, correct answer, learner-safe correct-answer explanation, rendered learner preview, and confirmation state without exposing unrelated learners' private data.
2. **Given** the teacher edits the stem, options, selection type, key, or learner-safe explanation, **When** the draft is submitted, **Then** the prior confirmation is cleared and a new explicit confirmation is required.
3. **Given** a confirmed candidate decision, **When** the teacher sends it, **Then** exactly one reviewed delivery is requested and the room participation state remains tutoring even though the tutor turn is assessment.

### User Story 2 - Learner Sees and Answers a Public Question (Priority: P1)

As a learner, I need to see the public assessment question in the ordinary tutoring room and submit a deterministic answer through the existing chat, so that my answer can be resolved without seeing the answer key or private transfer basis.

**Why this priority**: The learner-visible path is the product behavior that the teacher review flow is intended to deliver.

**Independent Test**: Load a delivered assessment, render its public projection, and submit two incorrect selections across reload and duplicate-tab boundaries; assert the server persists each accepted attempt while the UI withholds the key and learner-safe explanation until the terminal second-incorrect result, permits no third submission from any page, and makes no client-side progress write.

**Acceptance Scenarios**:

1. **Given** a delivered assessment, **When** the learner opens or reloads the room before resolution, **Then** the learner sees the structured stem without an embedded option list, followed by the instruction and exactly one rendering of options A-D in order, and does not receive the correct option IDs, learner-safe explanation, transfer basis, teacher rationale, raw model output, or private key.
2. **Given** a single-answer question, **When** the learner selects one radio option and explicitly submits it, **Then** the message carries the delivered assessment identity and the UI does not locally grade or write progress.
3. **Given** a multiple-answer question, **When** the learner selects one or more checkbox options and explicitly submits them, **Then** the submission remains deterministic regardless of selection order and is delegated to the server-authoritative answer-processing path.
4. **Given** an assessment question is awaiting an answer, **When** the learner has not made the required selection, **Then** Submit answer remains disabled and the assessment answer surface provides no free-text answer input.
5. **Given** a learner submits an incorrect first selection, **When** the server returns the persisted retry result, **Then** the UI says only that the answer is incorrect, displays the server-reported one remaining chance, and allows another selection without revealing the correct answer or learner-safe explanation.
6. **Given** a learner submits a correct selection on either chance, **When** the server returns the attempt result, **Then** the UI resolves the question as correct and permits no further answer submission.
7. **Given** a learner submits an incorrect second selection, **When** the server returns the persisted terminal result, **Then** the UI reveals the role-safe correct answer and learner-safe explanation and permits no third submission in any reload or tab.
8. **Given** a learner submits another answer after the question has resolved, **When** the message is processed, **Then** it cannot earn another grade or create another progress transition for that question.
9. **Given** a transfer-assessment message is visible to any room participant, **When** it first renders or the participant toggles its disclosure control, **Then** it starts expanded and can be collapsed or expanded without changing another participant's view or the assessment answer state.

### User Story 3 - Room Lifecycle Survives Reload, Reconnect, and Duplicate Tabs (Priority: P2)

As a teacher or learner, I need the room to converge on persisted state after reloads, realtime reconnects, and duplicate-tab activity, so that drafts, questions, answers, parent links, and room modes are not duplicated or lost.

**Why this priority**: Room state is distributed across persisted records, realtime events, and local React state. Incorrect convergence can create duplicate delivery or attach an answer to the wrong learner/message.

**Independent Test**: Simulate initial fetch, delayed realtime events, reconnect catch-up, reload, a retry after timeout, and two tabs delivering for the same learner; assert one deduplicated message/history view and explicit conflict handling.

**Acceptance Scenarios**:

1. **Given** a room with persisted messages and assessment lifecycle records, **When** a user joins, reconnects, or reloads, **Then** the UI catches up from persisted state and merges realtime events by stable identity without duplicate messages.
2. **Given** a teacher focuses a particular learner message, **When** a later message arrives from another learner or tab, **Then** the reviewed-send request retains the original focus student ID, focus message ID, checklist ID, and parent message ID.
3. **Given** a delivery request times out before the client knows its result, **When** the teacher retries, **Then** the backend idempotency result is reflected once and the UI does not append a duplicate question.
4. **Given** a room is in Guard, **When** an assessment draft is generated or delivered, **Then** assessment is represented as a turn-level mode, the room remains or returns to its server-authoritative participation mode, and no progression lock is bypassed.
5. **Given** a mode or payload combination is invalid, **When** the UI receives it, **Then** it does not coerce assessment into a room mode, render a null instruction, or send an incompatible payload.
6. **Given** a learner has used one chance for a delivered question, **When** the learner fully reloads or remounts the page, reconnects, or opens another tab, **Then** every page renders the same persisted one-chance-remaining state and none can reset or bypass the attempt limit.

### User Story 4 - Teacher and Learner See Role-Appropriate Progress and Exports (Priority: P2)

As a room participant, I need progress and exports scoped to my role and learner identity, so that teachers can review the lifecycle while learners receive only public conversation and public question data.

**Why this priority**: The UI must preserve the privacy boundary through local views, reloads, and downloads, not only in the primary message surface.

**Independent Test**: Load the same room as teacher, learner, and observer, inspect checklist views and exports, and assert owner-scoped progress plus absence of private assessment fields from learner-facing outputs.

**Acceptance Scenarios**:

1. **Given** a transfer-policy checklist owned by learner A, **When** the teacher views the room, **Then** the teacher sees the selected learner's structured progress; learner B does not receive learner A's progress through the room UI.
2. **Given** a learner downloads room data, **When** the export is built, **Then** it contains public messages and public assessment rendering only, without keys, rationale, transfer basis, raw decisions, or teacher-only interaction metadata.
3. **Given** a teacher downloads room data, **When** the export is built, **Then** teacher-only metadata is included only in the authorized teacher projection and is not copied into the learner projection.
4. **Given** legacy room-shared checklist data, **When** it is displayed beside transfer-policy data, **Then** legacy values remain legacy and are not displayed as transfer verification.

### Edge Cases

- The selected learner, source message, checklist, or parent message is missing, belongs to another room, or is not persisted; preparation is blocked instead of using text matching or the latest message as a fallback.
- A realtime insert arrives before the initial fetch, arrives twice, or arrives after a reconnect; stable IDs determine one visible record and preserve chronological ordering.
- A candidate is dirty, invalid, discarded, or superseded by a delivery from another tab; no unconfirmed candidate becomes a delivered question.
- A stale or tampered answer payload reaches the UI boundary; the selectable answer control cannot produce it, and validation rejects it without consuming a normal UI attempt.
- A participant collapses an assessment while an answer selection or result is present; expanding it restores the same local selection and server-authoritative result without consuming a chance or changing another participant's view.
- A learner fully reloads or remounts the page, reconnects, or opens another tab after an incorrect attempt; all clients re-read the persisted attempt count, remaining chances, outcome, and disclosure state, and none can reset the lifecycle.
- A reviewed payload or delivery result has assessment mode paired with a room-only mode, a missing instruction, or an invalid target; the UI rejects the payload without coercion.
- Guard mode is manually changed while an assessment is pending; assessment cannot bypass the room participation lock and recovery remains a reviewed tutoring action.
- Browser exports, local state, realtime payloads, errors, and rendered learner content must not contain the assessment key, transfer basis, rationale, or raw model output.

## Requirements

### Functional Requirements

- **FR-001**: The room UI MUST identify the selected learner, focus learner message, checklist, target item, and parent message by stable persisted IDs throughout candidate preparation, review, send, answer submission, reload, and reconnect.
- **FR-002**: The UI MUST consume component 101's shared assessment/progress type exports and component 102's `PublicAssessmentDTO`, `PublicMessageDTO`/`PUBLIC_MESSAGE_DTO_KEYS`, `ReviewedDeliveryDTO`, `ProcessedMessageDTO`, `PUBLIC_ASSESSMENT_FORBIDDEN_KEYS`, `TransferAssessmentService`, and `transferAssessmentService` without editing, redefining, or renaming shared fields. `AssessmentApiEnvelope` and `AssessmentApiError` remain within component 102's typed service boundary, which owns envelope parsing and operation mapping. `PublicAssessmentDTO` is exactly `{ id, student_id, selection_type, stem, options }`. `ProcessedMessageDTO` supplies its canonical message/assessment IDs, processing state, answer outcome, attempt fields, selection, terminal/progress/feedback fields, code, idempotency state, and `terminal_failure_feedback`. React-only selection, presentation, and disclosure types MUST remain in a component-103-owned UI module, and the adapter MUST fail closed when required fields or role projections are invalid and MUST never pass unknown fields through to a component, export, realtime payload, or browser-facing state.
- **FR-003**: The teacher review surface MUST show the structured candidate decision returned by `prepareTurn` with its target context, four ordered options, selection type, correct answer, learner-safe correct-answer explanation, rendered learner preview, and confirmation state. There is no persisted draft row, so the surface MUST NOT display or claim a draft revision, snapshot hash, or server-side review record.
- **FR-004**: The teacher MUST be able to edit the draft content, answer key, and learner-safe explanation only through the structured editor; any edit MUST clear prior confirmation and require reconfirmation before send.
- **FR-005**: The reviewed-send path MUST deliver the confirmed structured decision together with its prepared scope identity (`roomId`, `studentId`, `checklistId`, `itemId`, `focusStudentMessageId`) in one `sendReviewed` call, and MUST surface server validation, scope, and conflict failures (invalid payload, wrong learner, assessment already open, capability disabled, forbidden) as explicit unsent states without creating a learner-visible record. The reviewed-send request carries no expected draft revision and no expected content hash, because no draft row exists.
- **FR-006**: Discarding, replacing, or re-preparing an unconfirmed candidate decision MUST remain UI-local review state. It MUST NOT create a delivered assessment, progress change, duplicate message, or any persisted record, and the UI MUST NOT call a reject or regenerate operation, because the promoted six-operation contract has none.
- **FR-007**: The learner UI MUST render only the public assessment stem, canonical selection instruction, and options A-D from a delivered question. It MUST use radio buttons for a single-answer question and checkboxes for a multiple-answer question.
- **FR-008**: Learner answer submission MUST require an explicit Submit answer action, keep that action disabled until the required displayed option selection exists, and use the existing room chat message path with the delivered assessment identity and the correct persisted parent relationship. The assessment answer surface MUST NOT accept free-text answers, and the browser MUST NOT grade answers or write progress directly.
- **FR-009**: The UI MUST render the two-attempt lifecycle exclusively from component 102's persisted, server-authoritative result. After the first incorrect result it MUST show only incorrect feedback and the server-reported remaining chance; after the terminal second incorrect result it MUST show the role-safe correct answer and learner-safe explanation and disable further submission. The browser MUST NOT increment, reset, infer, or otherwise decide attempts used, attempts remaining, terminal state, or answer disclosure.
- **FR-010**: Room participation state MUST remain a binary tutoring/Guard concern; assessment MUST remain a turn-level concern and MUST map to tutoring on reviewed delivery unless the server rejects it.
- **FR-011**: The room ingress MUST merge initial fetch, realtime events, retry results, and reconnect catch-up by stable IDs and MUST converge without duplicate messages or lifecycle records.
- **FR-012**: The UI MUST restore persisted question, answer, attempt-count, remaining-chance, terminal, and disclosure state after reload and MUST handle duplicate-tab sends using backend request identity, server conflict outcomes, and re-read persisted state rather than a local draft revision. No browser lifecycle may reset the attempt limit.
- **FR-013**: Progress displays MUST read owner-scoped transfer checklists for the selected learner and MUST leave legacy room-shared checklist behavior unchanged.
- **FR-014**: Learner-facing exports and browser-visible payloads MUST exclude the assessment key, transfer basis, rationale, raw model output, and teacher-only interaction metadata.
- **FR-015**: Teacher-only exports MAY include authorized review metadata but MUST preserve the public/private projection boundary and MUST NOT become a second progress authority.
- **FR-016**: Invalid mode/instruction combinations, missing identity links, malformed public assessments, and unauthorized projection data MUST produce explicit UI errors or an unavailable state, never a silent fallback.
- **FR-017**: The UI MUST preserve existing tutoring and Guard behavior for legacy rooms, including Multi-agent draft review, staged message playback, and learner response gating, and MUST not enable transfer behavior when the backend capability is unavailable or disabled.
- **FR-018**: Component verification MUST cover focus identity, parent IDs, catch-up/reconnect, public/private lifecycle, dirty edits, reconfirmation, superseded or duplicated delivery conflicts, mode mismatch, structured downstream decisions, reload, retry, and duplicate-tab behavior.
- **FR-019**: Learner and preview rendering MUST use the structured assessment stem as the question text and MUST render the structured options exactly once in the selection controls. The UI MUST NOT append options to a rendered question string that already contains an option list or use text pattern matching to remove duplicated options.
- **FR-020**: Every transfer-assessment message MUST start expanded and expose an accessible collapse/expand control to every room participant. Collapsed state MUST be local view state per participant, MUST NOT be written to shared room state, and MUST NOT alter answer selections, attempts, results, or another participant's view.

### Key Entities

- **Room participation state**: The server-owned room-level state, limited to `tutoring` or `guard` for UI participation and progression-lock behavior.
- **Tutor turn decision**: The structured turn-level decision consumed by the teacher review surface; it may be `tutoring`, `guard`, or `assessment`, with compatible instruction and target fields.
- **Teacher review candidate**: The teacher-visible structured `TutorDecisionV3` returned by `prepareTurn` and held only as UI-local review state, including the answer key and editable learner-safe correct-answer explanation. There is no persisted draft row, so it has no draft identity, revision, or snapshot hash, and no rejection or regeneration lifecycle.
- **Public assessment question**: Component 102's exact learner-visible `{ id, student_id, selection_type, stem, options }` projection, with no `rendered_text`, key, learner-safe explanation, or transfer basis. The persisted delivered message stores enough public data to reconstruct the same controls after reload.
- **Terminal failure feedback**: Component 102's `terminal_failure_feedback` projection containing only `correct_option_ids` and `learner_safe_explanation`; it is visible only to the authorized learner for terminal `answer_outcome: failed` and is null for every other result.
- **Assessment answer message**: The learner's ordinary room message linked to the delivered assessment and its persisted parent/source relationship.
- **Assessment answer view state**: The participant-local option selection and submission/loading error for one delivered question, combined with the persisted attempt count, remaining chances, terminal state, and role-safe feedback returned by component 102. Local selection may reset on remount; authoritative attempt and disclosure state may not.
- **Transfer checklist view**: An owner-scoped projection of the existing progress pair for one learner; it is read-only in this component.
- **Lifecycle cursor**: Stable IDs, timestamps, and idempotency outcome used to merge room state and detect superseded operations without making React state authoritative.
- **Assessment disclosure state**: Participant-local expanded or collapsed view state for one transfer-assessment message; it is not persisted as shared room state and has no effect on assessment lifecycle state.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of integration fixtures retain the same focus student ID, focus message ID, checklist ID, target item ID, and parent message ID from candidate preparation through reviewed delivery and answer submission.
- **SC-002**: 100% of draft edits clear confirmation; 100% of server-rejected deliveries (already-open assessment, wrong learner, invalid payload, disabled capability) are surfaced as unsent conflicts; zero unconfirmed or rejected candidates produce learner-visible questions or progress writes.
- **SC-003**: 100% of learner projection tests contain only the allowlisted public assessment fields; private keys, transfer basis, rationale, raw model output, and teacher-only metadata appear zero times in learner payloads, exports, and browser state.
- **SC-004**: 100% of deterministic answer fixtures show the UI forwarding persisted answer identity and rendering backend-graded outcomes while making zero direct progress writes; first-incorrect fixtures expose neither the correct answer nor learner-safe explanation, terminal second-incorrect fixtures expose both, no fixture permits a third submission, and the UI produces no empty, free-text, or malformed assessment submissions.
- **SC-005**: After initial fetch, reconnect catch-up, reload, timeout retry, and duplicate-tab events, 100% of lifecycle fixtures converge to one persisted message/question/answer/attempt representation per identity with no duplicate delivery, attempt, or history entry and with identical remaining-chance and terminal state across clients.
- **SC-006**: 100% of mode compatibility fixtures keep room state in `tutoring` or `guard`, represent assessment only at turn level, reject invalid combinations, and preserve Guard recovery behavior.
- **SC-007**: Teachers can complete review, edit, reconfirm, and send for a confirmed candidate in one uninterrupted flow, while learners can select answers through selection-type-appropriate controls and explicitly submit without receiving private fields.
- **SC-008**: In 100% of learner and teacher rendering fixtures, each assessment displays its stem once and each structured option exactly once; no option list is duplicated inside the question text.
- **SC-009**: In 100% of role and lifecycle fixtures, assessment messages start expanded, every room participant can independently collapse and expand them, and toggling disclosure changes zero shared room, answer-selection, attempt, or result state.

## Assumptions

- Upstream component 102 owns `tutor-system/src/services/transferAssessmentService.ts` and supplies exactly six operations on one private table (`initializeChecklist`, `postMessage`, `prepareTurn`, `sendReviewed`, `processMessage`, `analyzeMessage`), the `PublicAssessmentDTO`/`PublicMessageDTO`/`ReviewedDeliveryDTO`/`ProcessedMessageDTO` projections, `AssessmentApiEnvelope`/`AssessmentApiError`, trusted authorization, answer keys, persisted attempt lifecycle, server-graded outcomes, role-safe terminal feedback, and progress outcomes. This component does not edit or recreate that service contract. `prepareTurn` returns the generated candidate `TutorDecisionV3`, including the learner-safe explanation, directly to the authorized teacher, and `sendReviewed` accepts no expected revision or hash.
- Domain contracts and shared assessment/progress type exports from component 101, together with the normative transfer plan, define the progress pairs, assessment lifecycle, exact answer semantics, and room/turn mode split; component 103 consumes them without editing shared type files.
- Existing React, Supabase client, RoomContext, room pages, message components, and Jest/React Testing Library patterns remain the application surface.
- `TRANSFER_ASSESSMENT_ENABLED` remains backend-controlled and disabled until release gates pass; the UI treats unavailable capability as a disabled/unavailable state.
- Legacy checklist and tutoring/Guard paths must remain operational and are tested as regression behavior.
- The integration owner will update root agent context after this planning package; this component will not run `update-agent-context.sh` or modify `AGENTS.md`.

## Out of Scope

- SQL migrations, RLS, database transaction design, trusted principal implementation, provider credentials, model prompts, Promptfoo evaluation, hosted deployment, release-browser evidence, and edits to component 102's `tutor-system/src/services/transferAssessmentService.ts` or its service-owned contract tests.
- New authentication, a new quiz application, client-side grading, direct progress mutation, a room-level Assessment Mode, or a new mastery field.
