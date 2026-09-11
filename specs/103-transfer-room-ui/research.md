# Research: Transfer Room Lifecycle and UI Integration

## Intent

Record the repository and normative-plan evidence used to choose the smallest W7-W8 UI design. No external technology choice is introduced by this component.

## Decisions

### Decision: Keep RoomContext as the room state coordinator

- **Decision**: Extend the existing room context and page/component composition for ingress, draft lifecycle, public question display, answer submission, and role-scoped export projections.
- **Rationale**: `tutor-system/src/contexts/RoomContext.tsx` already owns join, message state, realtime subscription, polling, send, AI suggestion, and export flows. `RoomPagePost.tsx` already mounts `AssessmentDraftEditor` for a partial transfer path.
- **Alternatives considered**: A separate assessment application or a second room state provider. Both would duplicate message identity and mode state, conflicting with the original plan's single-authority rule.

### Decision: Consume component 101/102 types through a React-owned adapter

- **Decision**: Component 101 owns shared assessment/progress domain type exports. Component 102 defines and exports `TeacherAssessmentDraftDTO`, `PublicAssessmentDTO`, typed envelopes, and operation mapping from `transferAssessmentService.ts`. Component 103 consumes those exports through a React-specific adapter in `src/contexts/transferAssessmentUiAdapter.ts`, where its UI-only draft, public-question, and lifecycle view-state types also live; it does not edit or redeclare either upstream contract.
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

- **Decision**: Any edit to stem, selection type, options, or key clears confirmation. Review and send use the current revision and final hash; stale responses remain unsent and require a fresh draft.
- **Rationale**: The existing `AssessmentDraftEditor` already resets `contentConfirmed` on edits and calls the shared v3 validator. W7/W8 add lifecycle tests and persistence/catch-up handling around this behavior.
- **Alternatives considered**: Preserving confirmation after edits or sending the last server version. Both can deliver content different from what the teacher reviewed.

## Repository evidence

- Normative source SHA-256: `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`.
- Normative package: `plan/transfer_assessment_implementation_plan/final_plan.md`, `traceability_graph.md`, `verification_gates.md`, `milestone_ledger.md`, and `work_packages/03_transfer_runtime.md`.
- Existing UI path: `tutor-system/src/contexts/RoomContext.tsx`, `src/pages/RoomPagePost.tsx`, `src/components/AssessmentDraftEditor.tsx`, `src/components/PostComment.tsx`, and `src/components/ChatMessage.tsx`.
- Component 101-owned shared assessment/progress exports: `tutor-system/src/types/assessment.ts`, `src/types/learningProgress.ts`, and `src/types/index.ts`; component 103 does not edit them.
- Component 102-owned browser facade: `tutor-system/src/services/transferAssessmentService.ts`; component 103 consumes its exported types and methods without modifying it.
- Existing tests: `src/services/__tests__/transferAssessmentService.test.ts`, `src/services/__tests__/transferAssessmentMigration.test.ts`, and the room/component test suites.

## Clarification result

No material product or contract question remains for this component. The missing details are implementation tasks constrained by the upstream DTOs and the normative U/D decisions. Root agent-context synchronization is explicitly deferred to the integration owner and is not a product decision.
