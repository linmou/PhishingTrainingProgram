# Research: Transfer Room Lifecycle and UI Integration

## Intent

Record the repository and normative-plan evidence used to choose the smallest W7-W8 UI design. No external technology choice is introduced by this component.

## Decisions

### Decision: Keep RoomContext as the room state coordinator

- **Decision**: Extend the existing room context and page/component composition for ingress, draft lifecycle, public question display, answer submission, and role-scoped export projections.
- **Rationale**: `tutor-system/src/contexts/RoomContext.tsx` already owns join, message state, realtime subscription, polling, send, AI suggestion, and export flows. `RoomPagePost.tsx` already mounts `AssessmentDraftEditor` for a partial transfer path.
- **Alternatives considered**: A separate assessment application or a second room state provider. Both would duplicate message identity and mode state, conflicting with the original plan's single-authority rule.

### Decision: Consume component 101/102 types through a React-owned adapter

- **Decision**: Component 101 owns shared assessment/progress domain type exports. Component 102 defines and exports the six-operation `TransferAssessmentService` facade, `PublicAssessmentDTO`, `PublicMessageDTO`/`PUBLIC_MESSAGE_DTO_KEYS`, `ReviewedDeliveryDTO`, `ProcessedMessageDTO`, `AssessmentApiEnvelope`/`AssessmentApiError`, and `PUBLIC_ASSESSMENT_FORBIDDEN_KEYS` from `transferAssessmentService.ts`. Component 103 consumes those exports through a React-specific adapter in `src/contexts/transferAssessmentUiAdapter.ts`, where its UI-only review, public-question, and lifecycle view-state types also live; it does not edit or redeclare either upstream contract.
- **Rationale**: Shared domain ownership belongs to component 101 and shared service ownership belongs to component 102. Colocating local view-state types with their React mappings keeps component 103 inside its UI boundary and avoids a second shared type owner.
- **Alternatives considered**: Editing shared type barrels, editing the shared service, duplicating upstream DTOs in UI code, or passing raw API objects directly through React. Each option creates split ownership or weakens the public/private boundary.

### Decision: Treat assessment as a turn, not a room mode

- **Decision**: Keep room participation state binary (`tutoring` or `guard`) and retain `assessment` only in the tutor-turn/message decision. Reviewed assessment delivery maps the room to tutoring; Guard recovery remains server-authoritative.
- **Rationale**: This is settled decision U08 and component 101's existing type split in `types/index.ts` and `types/assessment.ts` already expresses the distinction; component 103 consumes it unchanged.
- **Alternatives considered**: Casting assessment into the existing room mode or adding an Assessment Mode toggle. Both violate the normative plan and would change Guard semantics.

### Decision: Merge persisted ingress and realtime by stable identity

- **Decision**: Initial room load, reconnect catch-up, polling, and realtime inserts feed one deduplicating merge path keyed by persisted message/question/lifecycle IDs. Local optimistic records are replaced by the persisted record, never appended as a second record.
- **Rationale**: The current context appends realtime messages and separately replaces messages during polling. The required W7 scenarios include duplicate inserts, reconnect, timeout retry, reload, and duplicate tabs.
- **Alternatives considered**: Last-write-wins array replacement or timestamp/text matching. Those approaches lose parent identity and can duplicate or misattach assessment answers.

### Decision: Keep progress read-only in this component

- **Decision**: UI reads owner-scoped progress and forwards learner messages/assessment identities to upstream trusted operations. React effects, answer rendering, and exports do not write status or understanding pairs.
- **Rationale**: The original plan assigns progress transitions to the server operation and explicitly forbids a second progression authority in React.
- **Alternatives considered**: Updating checklist state optimistically after a learner answer. This would violate server authority and make retries, stale answers, and Guard deferral incorrect.

### Decision: Teacher edits invalidate confirmation

- **Decision**: Any edit to stem, selection type, options, or key clears confirmation. Send delivers the confirmed structured decision plus the prepared scope identity in one `sendReviewed` call. Confirmation itself is UI-local review state, not a server write.
- **Rationale**: The existing `AssessmentDraftEditor` already resets `contentConfirmed` on edits and calls the shared v3 validator. There is no draft row, so there is no server-side revision to confirm against; W7/W8 add lifecycle tests and the conflict/catch-up handling around this behavior.
- **Alternatives considered**: Preserving confirmation after edits, or inventing a client-side revision to simulate the dropped draft table. The first can deliver content different from what the teacher reviewed; the second implements an API that does not exist.

### Decision: Render the backend-authoritative two-attempt lifecycle

- **Decision**: Component 103 imports component 102's canonical `ProcessedMessageDTO` unchanged and maps `processing_state`, `answer_outcome`, `attempt_number`, attempt counts, `terminal`, `transition`, `feedback_required`, `code`, `already_processed`, and `terminal_failure_feedback` into UI presentation. It has no local attempt counter or reset path. Reloads, remounts, reconnects, retries, and duplicate tabs re-read the same lifecycle.
- **Rationale**: Browser-owned counting would let reloads or tabs regain attempts and would make React decide when to disclose the correct answer. That violates the server-authority constitution and cannot handle simultaneous final submissions safely.
- **Alternatives considered**: Page-local attempt state, local-storage synchronization, or a client-generated terminal flag. All remain client authority and were rejected.

### Decision: Use selection controls and structured rendering

- **Decision**: Extend the existing `PublicAssessmentQuestion` component: radio controls for single-answer questions, checkboxes for multiple-answer questions, an explicit Submit answer action disabled until selected, and no free-text assessment input. Consume component 102's exact `PublicAssessmentDTO { id, student_id, selection_type, stem, options }`; render `stem` once and structured `options` once.
- **Rationale**: The revised requirement makes valid submissions deterministic and fixes duplicated options at the data boundary instead of parsing display strings.
- **Alternatives considered**: Adding `rendered_text` back to the public DTO, parsing option labels from chat text, or stripping duplicated lines with pattern matching. These conflict with 102 ownership or are unnecessary and brittle.

### Decision: Keep folding participant-local

- **Decision**: Every assessment message starts expanded. `PostComment` owns an accessible expanded/collapsed boolean for its mounted participant; toggling it does not update room state and does not unmount or clear answer selection or lifecycle feedback.
- **Rationale**: Folding is a display preference, not collaborative assessment state. Keeping the interactive child mounted preserves in-progress selection without introducing persistence.
- **Alternatives considered**: Persisting folding on the message or in shared room context. Both would incorrectly make one participant's preference affect others.

## Reconciliation decisions (2026-09-12)

The planning package for this component was written before upstream component 102 collapsed transfer-assessment storage from five tables to one private table (`private.learning_event_inbox`) with the assessment stamped onto `public.messages`, and before the review step was folded into `send_reviewed`. The promoted 102 contract is exactly six operations: `initialize_checklist`, `post_message`, `prepare_turn`, `send_reviewed`, `process_message`, `analyze_message`. Everything below records a correction of the stale text, not a deferral of it. The old text is wrong and is removed rather than implemented.

### Decision 2026-09-12a: Withdraw `TeacherAssessmentDraftDTO`

- **Decision**: `TeacherAssessmentDraftDTO` is removed from FR-002, the Key Entities, the Assumptions, `plan.md`, `data-model.md`, `contracts/room-ui-contracts.md`, and the quickstart. The private teacher projection is the candidate `TutorDecisionV3` returned by `prepareTurn` plus the scope identity (`room_id`, `student_id`, `checklist_id`, `item_id`, `focus_student_message_id`) and the informational `progress_snapshot_hash` echo. `data-model.md` declares no `draft` field on room view state; it declares a UI-local `TeacherReviewCandidateView`.
- **Reason**: `private.assessment_drafts` was dropped in migration 038. The type was deleted from the promoted 102 export list together with the table, so any code importing it would not compile.
- **Alternatives considered**: Re-declaring a UI-local DTO with the same name to satisfy the old text. Rejected: it would keep a phantom draft identity in the contract for a row that does not exist.

### Decision 2026-09-12b: Withdraw the expected-revision/content-hash requirement (FR-005)

- **Decision**: FR-005 is withdrawn as written and restated. `sendReviewed` accepts `reviewedPayload`, `roomId`, `studentId`, `checklistId`, `itemId`, and `focusStudentMessageId`, and no `expectedRevision` or `expectedHash`. The reviewed-send path must instead surface the server's own validation, scope, and conflict outcomes and must not create a learner-visible record on failure.
- **Reason**: With no draft row there is no revision to be stale and no stored content to hash. The observationally equivalent protection comes from the server re-validating scope and from `ASSESSMENT_ALREADY_OPEN`, which is what a second tab actually observes.
- **Alternatives considered**: Keeping the requirement and synthesizing a client revision/hash. Rejected: it would fabricate an optimistic-concurrency guard that nothing on the server checks.

### Decision 2026-09-12c: Withdraw reject and regenerate (FR-006)

- **Decision**: FR-006 is withdrawn as written and restated. There is no `reject_draft` and no `regenerate_draft` operation, no rejection/suppression lifecycle, and no `rejected`/`ignored` draft status. Discarding, replacing, or re-preparing an unconfirmed candidate is UI-local review state that persists nothing; the teacher re-runs `prepareTurn` if a new candidate is wanted.
- **Reason**: The lean refactor removed both operations, and once the draft table was dropped there was no row left to reject or regenerate.
- **Alternatives considered**: Implementing a client-side suppression list so a rejected candidate "cannot be resent". Rejected: it is not a real lifecycle, it is unverifiable, and it invents state the server does not own.

### Decision 2026-09-12d: Withdraw US1 acceptance scenarios 4 and 5

- **Decision**: US1 scenario 4 (reject or regenerate produces nothing) and scenario 5 (stale revision is reported and requires a fresh draft state) are withdrawn. Their surviving intent is covered by the restated FR-006 (nothing persists without a confirmed send) and by FR-011/FR-012 plus the `superseded` state (a server-refused duplicate-tab delivery is explicit and unsent).
- **Reason**: Both scenarios test the dropped draft lifecycle: one names reject/regenerate, the other a revision that no longer exists.
- **Alternatives considered**: Rewriting scenario 5 into "another tab already delivered for this learner", which is real behavior. That is kept as the `superseded` UI state and is tested, but it is no longer a *stale revision* scenario, so the scenario text is withdrawn rather than reworded in place.

### Decision 2026-09-12e: Remove the phantom names from the task list and quickstart

- **Decision**: `tasks.md` T001, T011, T012, T014, T015, T016, the Traceability table, and the Required Handoff Notes, plus `quickstart.md`'s preconditions and focused-scenario list, are corrected: no `TeacherAssessmentDraftDTO`, no `review_draft`, no `reject_draft`, no `regenerate_draft`, no expected revision/hash, no `PublicQuestionDTO`, no `publicQuestion`, no `DRAFT_REVISION_CONFLICT`, no `DRAFT_ALREADY_SENT`, and no `CONTENT_CONFIRMATION_REQUIRED`.
- **Reason**: Tasks that name deleted operations would have produced tests and code for an API that cannot exist.
- **Alternatives considered**: Leaving the tasks and marking them "deferred upstream". Rejected: they are not deferred, they are withdrawn, and a future reader would otherwise wait for a contract that was deliberately dropped.

### Required upstream contracts for the UI upgrade (2026-09-22)

- Component 101 supplies the two-attempt lifecycle semantics and learner-safe explanation field. Component 103 imports those contracts unchanged.
- Component 102 owns the exact public and processed DTO fields. `PublicAssessmentDTO` has no `rendered_text`; `message.content` equals its stem. `ProcessedMessageDTO.terminal_failure_feedback` is non-null only for an authorized terminal `answer_outcome: failed` and contains the correct option IDs plus learner-safe explanation.
- Component 102 resolves simultaneous/replayed submissions idempotently. Component 103 merges the returned persisted result and does not use button disabling as concurrency control.
- Any promoted field-name or lifecycle mismatch is returned to component 101/102 during reconciliation. Component 103 does not add a compatibility DTO, local counter, text parser, or silent fallback.


- Normative source SHA-256: `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`.
- Normative package: `plan/transfer_assessment_implementation_plan/final_plan.md`, `traceability_graph.md`, `verification_gates.md`, `milestone_ledger.md`, and `work_packages/03_transfer_runtime.md`.
- Existing UI path: `tutor-system/src/contexts/RoomContext.tsx`, `src/pages/RoomPagePost.tsx`, `src/components/AssessmentDraftEditor.tsx`, `src/components/PublicAssessmentQuestion.tsx`, and `src/components/PostComment.tsx`.
- Component 101-owned shared assessment/progress exports: `tutor-system/src/types/assessment.ts`, `src/types/learningProgress.ts`, and `src/types/index.ts`; component 103 does not edit them.
- Component 102-owned browser facade: `tutor-system/src/services/transferAssessmentService.ts`; component 103 consumes its exported types and methods without modifying it.
- Existing tests: `src/services/__tests__/transferAssessmentService.test.ts`, `src/services/__tests__/transferAssessmentMigration.test.ts`, and the room/component test suites.

## Clarification result

No material product or contract question remains for this component. The missing details are implementation tasks constrained by the upstream DTOs and the normative U/D decisions. Root agent-context synchronization is explicitly deferred to the integration owner and is not a product decision.

## Post-reconciliation analysis result (2026-09-12)

After the corrections above, the package was re-checked for the consistency classes Spec Kit analysis reports (duplicate coverage, ambiguity, underspecification, and requirement/task/contract drift):

- **CRITICAL (resolved)**: The spec, plan, data model, contracts, tasks, and quickstart referenced a draft entity, a draft revision, a content hash, and three operations that do not exist in the promoted 102 contract. Implementing them was impossible. Resolved by Decisions 2026-09-12a through 2026-09-12e above.
- **HIGH (resolved)**: FR-005 and FR-006 described server behavior with no corresponding server surface, so their tests could not fail and could not pass. Resolved by withdrawing and restating both.
- **HIGH (resolved 2026-09-22)**: The revised spec originally assigned the two-attempt counter and reset behavior to the browser. Resolved by applying the approved backend-authoritative decision across the spec, plan, data model, consumer contract, tasks, and quickstart.
- **MEDIUM (resolved by reconciliation)**: Component 103 previously proposed competing DTO names. The package now consumes 102's canonical public and processed DTOs verbatim and confines renamed presentation concepts to component-owned React view state.
- **LOW**: No remaining `[NEEDS CLARIFICATION]` marker, and every FR maps to a task in the Traceability table.
