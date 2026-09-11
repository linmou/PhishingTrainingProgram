# Feature Specification: Transfer Room Lifecycle and UI Integration

**Feature Branch**: `103-transfer-room-ui`  
**Created**: 2026-09-11  
**Status**: Planned  
**Input**: Component 103 ownership for W7-W8 room lifecycle and teacher/learner UI integration.

## Scope

This component connects the existing room experience to the transfer-assessment contracts from upstream components. It covers room ingress and catch-up, teacher review and delivery, learner question rendering and answer submission, participation-mode preservation, and role-scoped exports. It does not define database schema, row-level security, trusted identity, provider behavior, prompts, evaluation, or release-browser execution.

Component 102 owns `tutor-system/src/services/transferAssessmentService.ts`, its operation mapping, and its typed API DTO/envelope exports. This component consumes only those exported allowlisted contracts and may narrow them into React view state in UI-owned files. It never treats browser role, display name, local storage, or client-side progress state as authorization or as the source of truth for learning progress.

## User Scenarios & Testing

### User Story 1 - Teacher Reviews and Sends a Transfer Question (Priority: P1)

As a teacher, I need to review a structured transfer-assessment draft for the selected learner and send it only after I confirm the content, so that the learner receives the intended question and the private answer key remains available only to the authorized review path.

**Why this priority**: Delivery is the boundary that turns a generated draft into a learner-visible assessment. An unsent or rejected draft must never affect the learner or progress.

**Independent Test**: Provide a structured draft and a selected learner focus, edit the stem/options/key, confirm it, send it, and assert the reviewed-send request contains the expected draft revision/hash while the resulting learner message contains only the public assessment projection.

**Acceptance Scenarios**:

1. **Given** a teacher has one current draft for a selected learner and source message, **When** the teacher opens the review surface, **Then** the editor shows the target, four ordered options, selection type, rendered learner preview, and confirmation state without exposing unrelated learners' private data.
2. **Given** the teacher edits the stem, options, selection type, or key, **When** the draft is submitted, **Then** the prior confirmation is cleared and a new explicit confirmation is required.
3. **Given** a confirmed draft with the current revision and hash, **When** the teacher sends it, **Then** exactly one reviewed delivery is requested and the room participation state remains tutoring even though the tutor turn is assessment.
4. **Given** a teacher rejects a draft or requests regeneration, **When** no replacement is confirmed and sent, **Then** no learner-visible question, answer key, progress transition, or phantom message is created.
5. **Given** another tab or actor has changed the draft revision, **When** this teacher tries to confirm or send the stale draft, **Then** the UI reports a stale revision, keeps the stale draft unsent, and requires a fresh draft state.

### User Story 2 - Learner Sees and Answers a Public Question (Priority: P1)

As a learner, I need to see the public assessment question in the ordinary tutoring room and submit a deterministic answer through the existing chat, so that my answer can be resolved without seeing the answer key or private transfer basis.

**Why this priority**: The learner-visible path is the product behavior that the teacher review flow is intended to deliver.

**Independent Test**: Load a delivered assessment, render its public projection, submit single and multiple selections through chat, reload, and assert the first valid answer is associated with the delivered question while no client-side progress write occurs.

**Acceptance Scenarios**:

1. **Given** a delivered assessment, **When** the learner opens or reloads the room, **Then** the learner sees the stem, the canonical instruction, and options A-D in order, and does not receive the correct option IDs, transfer basis, teacher rationale, raw model output, draft revision, or private key.
2. **Given** a single-answer question, **When** the learner submits one explicit label, **Then** the message carries the delivered assessment identity and the UI does not locally grade or write progress.
3. **Given** a multiple-answer question, **When** the learner submits labels in a different order or repeats a label, **Then** the submission remains deterministic and is delegated to the server-authoritative answer-processing path.
4. **Given** an ambiguous alternative such as `B or D`, content help, or an empty message, **When** the learner submits it, **Then** the UI does not invent a selection or failure; it shows the server-provided lifecycle result or neutral clarification state.
5. **Given** a learner submits a second answer after the question has resolved, **When** the message is processed, **Then** it cannot earn another grade or create another progress transition for that question.

### User Story 3 - Room Lifecycle Survives Reload, Reconnect, and Duplicate Tabs (Priority: P2)

As a teacher or learner, I need the room to converge on persisted state after reloads, realtime reconnects, and duplicate-tab activity, so that drafts, questions, answers, parent links, and room modes are not duplicated or lost.

**Why this priority**: Room state is distributed across persisted records, realtime events, and local React state. Incorrect convergence can create duplicate delivery or attach an answer to the wrong learner/message.

**Independent Test**: Simulate initial fetch, delayed realtime events, reconnect catch-up, reload, a retry after timeout, and two tabs acting on the same revision; assert one deduplicated message/history view and explicit conflict handling.

**Acceptance Scenarios**:

1. **Given** a room with persisted messages and assessment lifecycle records, **When** a user joins, reconnects, or reloads, **Then** the UI catches up from persisted state and merges realtime events by stable identity without duplicate messages.
2. **Given** a teacher focuses a particular learner message, **When** a later message arrives from another learner or tab, **Then** the draft and reviewed-send request retain the original focus student ID, focus message ID, checklist ID, and parent message ID.
3. **Given** a delivery request times out before the client knows its result, **When** the teacher retries, **Then** the backend idempotency result is reflected once and the UI does not append a duplicate question.
4. **Given** a room is in Guard, **When** an assessment draft is generated or delivered, **Then** assessment is represented as a turn-level mode, the room remains or returns to its server-authoritative participation mode, and no progression lock is bypassed.
5. **Given** a mode or payload combination is invalid, **When** the UI receives it, **Then** it does not coerce assessment into a room mode, render a null instruction, or send an incompatible payload.

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

- The selected learner, source message, checklist, or parent message is missing, belongs to another room, or is not persisted; the draft is blocked or marked stale instead of using text matching or the latest message as a fallback.
- A realtime insert arrives before the initial fetch, arrives twice, or arrives after a reconnect; stable IDs determine one visible record and preserve chronological ordering.
- A draft is dirty, rejected, regenerated, stale, or invalid; no unsent draft becomes a delivered question.
- A learner submits a malformed selection, an alternative answer, a duplicate label, a correct answer with an explanation, or a second answer; rendering and submission remain deterministic and server-authoritative.
- A draft or send response has assessment mode paired with a room-only mode, a missing instruction, or an invalid target; the UI rejects the payload without coercion.
- Guard mode is manually changed while an assessment is pending; assessment cannot bypass the room participation lock and recovery remains a reviewed tutoring action.
- Browser exports, local state, realtime payloads, errors, and rendered learner content must not contain private keys, transfer basis, rationale, or raw model output.

## Requirements

### Functional Requirements

- **FR-001**: The room UI MUST identify the selected learner, focus learner message, checklist, target item, and parent message by stable persisted IDs throughout draft generation, review, send, answer submission, reload, and reconnect.
- **FR-002**: The UI MUST consume component 102's exported `TeacherAssessmentDraftDTO`, `PublicAssessmentDTO`, and typed API envelopes without redefining their service operation mapping; any React-specific adapter MUST fail closed when required view-state fields or role projections are invalid and MUST never pass unknown fields through to a component, export, realtime payload, or browser-facing state.
- **FR-003**: The teacher review surface MUST show a structured assessment draft with its current revision, target context, four ordered options, selection type, rendered learner preview, and confirmation state.
- **FR-004**: The teacher MUST be able to edit the draft content and answer key only through the structured editor; any edit MUST clear prior confirmation and require reconfirmation before send.
- **FR-005**: The reviewed-send path MUST include the expected draft revision and final content hash, and MUST surface stale-revision or validation failures without creating a learner-visible record.
- **FR-006**: Reject and regenerate actions MUST preserve the rejection/suppression lifecycle and MUST NOT create a delivered assessment, progress change, or duplicate message.
- **FR-007**: The learner UI MUST render only the public assessment stem, canonical selection instruction, and options A-D from a delivered question.
- **FR-008**: Learner answer submission MUST use the existing room chat message path with the delivered assessment identity and the correct persisted parent relationship; the browser MUST NOT grade answers or write progress directly.
- **FR-009**: The UI MUST preserve the server-authoritative first-valid-answer, duplicate-answer, ambiguous-selection, assisted-help, and stale-question outcomes without locally inventing grades or transitions.
- **FR-010**: Room participation state MUST remain a binary tutoring/Guard concern; assessment MUST remain a turn-level concern and MUST map to tutoring on reviewed delivery unless the server rejects it.
- **FR-011**: The room ingress MUST merge initial fetch, realtime events, retry results, and reconnect catch-up by stable IDs and MUST converge without duplicate messages or lifecycle records.
- **FR-012**: The UI MUST restore persisted draft/question/answer state after reload and MUST handle duplicate-tab edits or sends using revision, hash, and idempotency results supplied by the backend.
- **FR-013**: Progress displays MUST read owner-scoped transfer checklists for the selected learner and MUST leave legacy room-shared checklist behavior unchanged.
- **FR-014**: Learner-facing exports and browser-visible payloads MUST exclude private keys, transfer basis, rationale, raw model output, draft revisions, and teacher-only interaction metadata.
- **FR-015**: Teacher-only exports MAY include authorized review metadata but MUST preserve the public/private projection boundary and MUST NOT become a second progress authority.
- **FR-016**: Invalid mode/instruction combinations, missing identity links, malformed public assessments, and unauthorized projection data MUST produce explicit UI errors or an unavailable state, never a silent fallback.
- **FR-017**: The UI MUST preserve existing tutoring and Guard behavior for legacy rooms and MUST not enable transfer behavior when the backend capability is unavailable or disabled.
- **FR-018**: Component verification MUST cover focus identity, parent IDs, catch-up/reconnect, public/private lifecycle, dirty edits, reconfirmation, stale revisions, mode mismatch, rejected/regenerated drafts, structured downstream decisions, reload, retry, and duplicate-tab behavior.

### Key Entities

- **Room participation state**: The server-owned room-level state, limited to `tutoring` or `guard` for UI participation and progression-lock behavior.
- **Tutor turn decision**: The structured turn-level decision consumed by the teacher review surface; it may be `tutoring`, `guard`, or `assessment`, with compatible instruction and target fields.
- **Assessment draft**: A teacher-visible, revisioned, private structured decision awaiting review, edit, reconfirmation, rejection, regeneration, or delivery.
- **Public assessment question**: The learner-visible projection containing identity, selection type, stem/rendered text, and ordered options, with no key or transfer basis.
- **Assessment answer message**: The learner's ordinary room message linked to the delivered assessment and its persisted parent/source relationship.
- **Transfer checklist view**: An owner-scoped projection of the existing progress pair for one learner; it is read-only in this component.
- **Lifecycle cursor**: Stable IDs, revision/hash, timestamps, and idempotency outcome used to merge room state and detect stale operations without making React state authoritative.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of integration fixtures retain the same focus student ID, focus message ID, checklist ID, target item ID, and parent message ID from draft preparation through reviewed delivery and answer submission.
- **SC-002**: 100% of draft edits clear confirmation; 100% of stale revision/hash attempts are surfaced as unsent conflicts; zero rejected or unsent drafts produce learner-visible questions or progress writes.
- **SC-003**: 100% of learner projection tests contain only the allowlisted public assessment fields; private keys, transfer basis, rationale, raw model output, and teacher-only metadata appear zero times in learner payloads, exports, and browser state.
- **SC-004**: 100% of deterministic answer fixtures show the UI forwarding persisted answer identity and rendering the returned first-valid-answer, duplicate, ambiguous, assisted, stale, reload, and Guard outcomes while making zero direct progress writes; backend grading and transition acceptance remain separate upstream gates.
- **SC-005**: After initial fetch, reconnect catch-up, reload, timeout retry, and duplicate-tab events, 100% of lifecycle fixtures converge to one message/question/answer representation per persisted identity with no duplicate delivery or history entry.
- **SC-006**: 100% of mode compatibility fixtures keep room state in `tutoring` or `guard`, represent assessment only at turn level, reject invalid combinations, and preserve Guard recovery behavior.
- **SC-007**: Teachers can complete review, edit, reconfirm, and send for a valid draft in one uninterrupted flow, while learners can see the rendered question and submit a chat answer without receiving private fields.

## Assumptions

- Upstream component 102 owns `tutor-system/src/services/transferAssessmentService.ts` and supplies typed API envelopes, `TeacherAssessmentDraftDTO`, `PublicAssessmentDTO`, explicit `reject_draft`/`regenerate_draft` operation mapping, trusted operations, revision/hash/idempotency outcomes, and owner-scoped data; this component does not edit or recreate that service contract.
- Domain contracts from component 101 and the normative transfer plan define the progress pairs, assessment lifecycle, exact answer semantics, and room/turn mode split.
- Existing React, Supabase client, RoomContext, room pages, message components, and Jest/React Testing Library patterns remain the application surface.
- `TRANSFER_ASSESSMENT_ENABLED` remains backend-controlled and disabled until release gates pass; the UI treats unavailable capability as a disabled/unavailable state.
- Legacy checklist and tutoring/Guard paths must remain operational and are tested as regression behavior.
- The integration owner will update root agent context after this planning package; this component will not run `update-agent-context.sh` or modify `AGENTS.md`.

## Out of Scope

- SQL migrations, RLS, database transaction design, trusted principal implementation, provider credentials, model prompts, Promptfoo evaluation, hosted deployment, release-browser evidence, and edits to component 102's `tutor-system/src/services/transferAssessmentService.ts` or its service-owned contract tests.
- New authentication, a new quiz application, client-side grading, direct progress mutation, a room-level Assessment Mode, or a new mastery field.
