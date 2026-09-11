# Implementation Plan: Transfer Room Lifecycle and UI Integration

**Branch**: `103-transfer-room-ui` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)
**Input**: Component 103 ownership for W7-W8 room lifecycle and teacher/learner UI integration.

## Summary

Extend the existing React room flow so it consumes component 102's exported transfer-assessment DTOs and typed envelopes without changing the shared service or becoming a second authority for identity, grading, or progress. The plan covers React-specific state adaptation, stable learner/message/checklist focus, deduplicated initial/realtime/reconnect ingress, teacher draft review/edit/reconfirm/send, learner public question rendering and chat answer linkage, binary tutoring/Guard room state with assessment turn state, and role-scoped progress/export projections.

The implementation stays within the existing `RoomContext` and room page/component composition. SQL/RLS, trusted principal and provider behavior, model prompts, Promptfoo, and release-browser execution remain upstream or downstream gates. The original plan is preserved at SHA-256 `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`.

## Technical Context

**Language/Version**: TypeScript 4.9 with React 18  
**Primary Dependencies**: React, React Testing Library, Jest through CRA, existing Supabase browser client and service wrappers  
**Storage**: Existing Supabase-backed room/message/checklist data consumed through typed service DTOs; no schema changes in this component  
**Testing**: Jest, React Testing Library, existing room/component integration conventions, `npx tsc --noEmit`, CRA production build  
**Target Platform**: Existing web application browsers supported by the repository's CRA browserslist  
**Project Type**: React web application with room context, pages, and reusable message components  
**Performance Goals**: A reconnect or reload must converge to one visible record per persisted lifecycle identity without requiring a second manual send; normal room rendering remains responsive for the existing message volume  
**Constraints**: No direct progress writes; no private key/rationale/raw-model data in learner DTOs, exports, realtime payloads, or browser state; no assessment room mode; no new authentication; feature capability remains disabled unless the backend reports it available  
**Scale/Scope**: One selected learner per transfer room review flow, one focus message per prepared turn, one unresolved delivered assessment per room/learner as enforced upstream, and the existing room message list  

## Constitution Check

The pre-design gate passes:

- **I. Preserve Requirements and Evidence**: Every FR/SC maps to a story and task; the normative original-plan SHA and W7/W8 work package are recorded. Initiative status remains in `milestone_ledger.md` rather than this branch package.
- **II. Keep Authority Server-Side**: UI consumes allowlisted DTOs, forwards identities, never grades or writes progress, and keeps private fields out of learner projections.
- **III. Test First and Verify the Real Boundary**: Tasks put focused React integration tests before implementation and include reconnect, duplicate-tab, privacy, and structured-contract cases. Hosted SQL/auth gates are explicitly deferred to their owners.
- **IV. Use Stable, Explicit Contracts**: Component 103 consumes component 102's exported `PublicAssessmentDTO`, `TeacherAssessmentDraftDTO`, and typed envelopes; React-only state adaptation, message identities, revision/hash handling, and role-scoped projections are recorded in `contracts/room-ui-contracts.md`.
- **V. Prefer the Smallest Coherent Design**: Existing context, service, pages, editor, message components, and export builder are reused; no second room provider or assessment application is proposed.

Post-design gate target: the same five principles remain satisfied after the plan's contracts, data model, and tasks are read together. No constitutional exception is required.

## Source Evidence and Ownership

The current branch already contains partial transfer artifacts: `types/assessment.ts`, `types/learningProgress.ts`, `services/transferAssessmentService.ts`, `services/assessmentRendering.ts`, `components/AssessmentDraftEditor.tsx`, and the transfer migration/service tests. The observed integration gaps are:

- `RoomContext` has generic service results and partial draft/send wiring, but ingress and lifecycle state are not a complete persisted/realtime merge model.
- `RoomPagePost` mounts the editor but messages are still rendered through ordinary `PostComment`; there is no complete learner public assessment projection path.
- Existing realtime and polling paths can append or replace messages independently, so duplicate/reconnect/parent identity behavior needs one explicit merge rule.
- Existing exports distinguish tutor and learner at a high level but require explicit assessment public/private projection tests.

Ownership boundaries for this plan:

- **Component 101**: domain contracts, progress-pair semantics, and shared assessment/progress type exports in `tutor-system/src/types/assessment.ts`, `src/types/learningProgress.ts`, and `src/types/index.ts`.
- **Component 102**: `tutor-system/src/services/transferAssessmentService.ts`, typed API DTO/envelope exports, all operation mapping including `reject_draft` and `regenerate_draft`, service contract tests, trusted operations, authorization, atomicity, idempotency, answer keys, and backend lifecycle outcomes.
- **Component 103**: React-specific narrowing and adapter-local view-state types in UI-owned files, room state convergence, teacher/learner rendering, review lifecycle controls, public/private view projections, and React integration tests. It does not edit component 101's shared type files or component 102's service and tests.
- **Component 105**: release-browser evidence and promotion decisions.

Root `AGENTS.md` and agent context are integration-owned. Running `.specify/scripts/bash/update-agent-context.sh` and changing agent instructions are explicitly deferred.

## Design

### 1. Typed consumer boundary

Consume component 101's shared assessment/progress domain exports and component 102's exported `TeacherAssessmentDraftDTO`, `PublicAssessmentDTO`, and typed operation envelopes for capabilities, preparation, review, send, `reject_draft`, `regenerate_draft`, persisted messages, and lifecycle results. The React-only draft, public-question, and lifecycle view-state types are defined with their mappings in `src/contexts/transferAssessmentUiAdapter.ts` before entering `RoomContext`; the adapter imports 101/102 types unchanged and does not redeclare DTOs, edit shared type barrels, or map API operation names. Components receive `TeacherAssessmentDraftDTO` only on the teacher review path and `PublicAssessmentDTO` only on learner/public message paths.

The learner projection contains assessment ID, selection type, stem/rendered text, and ordered A-D options. It excludes key IDs, transfer basis, private reason/rationale, raw model output, revision/hash, and teacher action. Unknown fields are not spread into public component props or exports.

### 2. Identity and focus

Represent focus as explicit `student_id`, `focus_student_message_id`, `checklist_id`, and `target_item_id`. Preserve `parent_message_id` from the persisted source/question relationship. `generateAIResponse` and transfer preparation must use the selected persisted message, not a fresh text lookup or the latest message after another learner speaks.

The context owns one focus/draft view state. Pages pass IDs and structured callbacks; message components do not search room state or infer target identity.

### 3. Ingress and convergence

Create one merge path for initial join fetch, reconnect/catch-up, polling, optimistic replacement, and realtime inserts. Deduplicate by persisted identity, replace temporary optimistic IDs with the returned record, retain stable ordering, and preserve pre-populated legacy messages. A reconnect or duplicate tab must produce the same visible message/lifecycle set as a clean reload.

Persisted lifecycle records and server idempotency outcomes are authoritative. Local status may represent loading, dirty, stale, or error, but it cannot create a delivered state or progress transition.

### 4. Teacher draft lifecycle

The review surface uses structured decision data. Editing stem, selection type, options, or key clears confirmation and marks the draft dirty. Confirm consumes component 102's typed `review_draft` method with the expected revision and final payload. Send consumes its typed `send_reviewed` method only with the accepted revision and final hash. Rejection and regeneration explicitly consume component 102's `reject_draft` and `regenerate_draft` methods after those contracts are available; the browser does not invent an operation or silently clear a draft as a substitute. Stale/validation/unavailable outcomes are explicit and leave no phantom learner message.

The editor may edit answer content within the structured review flow, but it has no controls for directly changing progress status or understanding pairs. Teacher confirmation is a review assertion, not a client authorization grant.

### 5. Learner question and answer path

Render `PublicAssessmentDTO` in the existing room message experience with canonical instruction and options. The learner submits through ordinary chat, carrying the delivered `assessment_id` and actual parent question ID. The UI does not parse labels for grading, compare against keys, update progress, or create a local pass/fail state. It displays the structured result returned by the trusted path and preserves duplicate/ambiguous/assisted/stale outcomes.

### 6. Room and turn modes

Use `RoomParticipationMode` for room state and `TutorTurnMode` for message/decision state. Assessment is rendered as a turn-level state and reviewed delivery maps the room to tutoring. Guard remains a participation lock and manual override; assessment generation cannot bypass it. Invalid mode/instruction combinations are rejected by the typed adapter and test fixtures rather than coerced.

### 7. Progress and export projections

Read transfer progress for the selected learner through the existing owner-scoped checklist service and keep legacy room-shared reads on their explicit path. The export builder chooses public or teacher projection before serializing. Learner exports never contain private fields; teacher exports may contain authorized review metadata but do not become a progress writer.

## Implementation Phases

### Phase 1: Boundary and state foundation

- Confirm component 102's exported DTO/envelope dependency and React-state mapping in `contracts/room-ui-contracts.md`.
- Add the smallest React-owned state adapter and projection helpers needed to represent focus, draft lifecycle, public assessment, and deduplicated message identity.
- Keep upstream operation names and server-owned outcomes intact; do not add schema or auth behavior.

### Phase 2: Teacher lifecycle (US1)

- Complete `AssessmentDraftEditor` lifecycle behavior for dirty edits, validation, confirmation, stale revisions, rejection, regeneration, and send errors.
- Integrate `RoomContext` and `RoomPagePost` with typed draft operations and selected learner/message identity.
- Preserve legacy `AISuggestionBox` behavior for non-transfer rooms.

### Phase 3: Learner public flow (US2)

- Render public assessment fields in `ChatMessage`/`PostComment` or a narrowly scoped assessment child component.
- Link learner chat submission to delivered assessment and parent IDs.
- Verify no answer key, basis, rationale, or local progress mutation crosses the learner boundary.

### Phase 4: Room convergence and role projections (US3-US4)

- Replace independent append/replace behavior with one ingress merge path covering reload, reconnect, duplicate realtime events, timeout retry, and duplicate tabs.
- Add owner-scoped progress rendering and public/private export projection checks.
- Confirm legacy tutoring/Guard and legacy checklist behavior remains unchanged.

### Phase 5: Cross-cutting verification

- Run focused suites, typecheck, existing regression suite, and build.
- Record unrun upstream/downstream gates as pending rather than treating local UI evidence as release acceptance.
- Do not update root agent context; hand that action to the integration owner.

## Verification Matrix

| Concern | Required evidence in this component |
|---|---|
| Focus/message identity | Context and page integration tests with multiple learners and late messages |
| Parent IDs | Message rendering and send tests assert persisted question/answer parent relationships |
| Draft lifecycle | Editor tests for dirty edits, reconfirm, stale revision/hash, reject/regenerate, and no phantom send |
| Public/private boundary | React adapter, learner rendering, export, and browser-state assertions for forbidden fields while consuming component 102 DTOs unchanged |
| Mode split | Contract and context tests for tutoring/Guard room state versus assessment turn state and mismatch rejection |
| Catch-up/reconnect | Context tests for initial fetch, realtime-before-fetch, duplicate realtime, reconnect, reload, and optimistic replacement |
| Answer submission | Chat integration tests assert assessment identity is forwarded and progress APIs are never called from the UI |
| Downstream decision use | Page tests provide structured decisions and verify editor/rendering consume fields, not copied suggestion text |
| Regression | Existing room/component regression suite plus production build |

The focused test file set is declared in `quickstart.md` and tasks. Hosted SQL/RLS, trusted auth, live provider, Promptfoo, and release-browser evidence remain separate gates.

## Integration Risks

- **DTO drift from component 102**: React adapter tests must compile against and consume component 102's exported envelope variants. Incompatible upstream changes block integration; component 103 must not patch or duplicate the service contract or silently fall back to text-only rendering.
- **Shared type drift from component 101**: Adapter and room tests must compile against component 101's assessment/progress exports. Incompatible changes block integration; component 103 must not patch `src/types/assessment.ts`, `src/types/learningProgress.ts`, or `src/types/index.ts`.
- **Existing simplified auth**: this component cannot elevate local role/name values into authorization. If the backend capability is unavailable, render unavailable and keep legacy behavior.
- **Realtime visibility and private fields**: public assessment projections must be built before React state, export, or broadcast handling; never pass raw private response objects through context.
- **Legacy mode enum consumers**: assessment must not be cast into room mode. Run legacy room and Guard tests after mode/type changes.
- **Optimistic state**: temporary messages require explicit replacement by persisted ID and must not be used as evidence or answer parents.
- **Cross-component sequencing**: W7/W8 cannot close until 101 contracts and 102 DTO/auth/idempotency behavior are available; local mocks prove UI behavior only.

## Complexity Tracking

No constitutional violation or new architectural project is required. The plan uses one existing context, one typed service boundary, existing room pages/components, and focused integration tests.
