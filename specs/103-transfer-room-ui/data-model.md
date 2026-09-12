# Data Model: Transfer Room Lifecycle and UI Integration

## Intent

Define the React-owned view state and identity relationships for W7-W8. Component 101 owns shared assessment/progress domain type exports, while component 102 owns API DTO definitions and service operation mapping; backend storage, authorization, progress transitions, and answer keys also remain upstream. Component 103 defines only adapter-local UI view-state types in `src/contexts/transferAssessmentUiAdapter.ts` and consumes 101/102 exports unchanged.

## Identity graph

```text
Room
  -> selected learner (student_id)
  -> focus learner message (focus_student_message_id)
  -> owner-scoped checklist (checklist_id)
  -> target checklist item (target_item_id)
  -> delivered question (the delivered tutor message id)
  -> learner answer message (message_id, parent_message_id / assessment_id)
```

Every arrow is an explicit persisted relationship supplied or validated by upstream operations. UI code must not infer an ID from display text, array position, latest message, or local role selection. The teacher's reviewed candidate has no identity of its own: it is UI-local state that carries the scope IDs above until `sendReviewed` persists the delivered message.

## UI projections

The React-only review, public-question, and lifecycle state wrappers described below are colocated with their mappings in `src/contexts/transferAssessmentUiAdapter.ts`; they are not added to component 101's shared type files or barrels.

### RoomViewState

- `room`: public room projection plus server-owned `active_response_mode` limited to `tutoring` or `guard`.
- `messages`: deduplicated persisted message projections, retaining `id`, `room_id`, `user_id`/role projection, `parent_message_id`, `response_mode`, timestamps, content, and display metadata allowed for the current role, plus the UI-local `publicAssessment` projection when the message is a delivered question. `assessment_key` is never retained.
- `participants`: existing room participant projection.
- `focus`: selected `student_id`, `focus_student_message_id`, `checklist_id`, and `target_item_id` when a teacher is reviewing a transfer turn.
- `review`: the nullable UI-local `TeacherReviewCandidateView` (see below) with local UI status (`idle`, `preparing`, `ready`, `dirty`, `sending`, `delivered`, `superseded`, `validation`, `unavailable`, `retryable`). Local status is view state only and is not a progress state.
- `publicQuestion`: nullable `PublicAssessmentDTO` attached to a delivered message.
- `catchUp`: loading/error cursor state for initial fetch, realtime reconnect, and retry; it does not replace persisted lifecycle status.

### TeacherReviewCandidateView (component-103 UI state)

The candidate is the structured `TutorDecisionV3` that `prepareTurn` returns to the authorized teacher. It has no persisted row, so this view carries:

- the prepared scope identity from the `prepareTurn` result: `room_id`, `student_id`, `checklist_id`, `item_id` (`string | null`), `focus_student_message_id`;
- `decision`: the private structured `TutorDecisionV3` needed by the teacher editor, including key and transfer basis only in this authorized projection;
- `status`: the UI-local status listed above, derived from the teacher's own screen and from server errors. The UI does not invent or rewrite a persisted status.

It carries no draft id, no revision, and no expected snapshot hash, and it has no reject or regenerate lifecycle. Teacher edit state is a copy of the structured decision until send succeeds. It must never be sent as a learner projection.

### PublicAssessmentDTO (component 102 export)

Learner-visible allowlist:

- `id`: assessment question identity. In the one-table design the delivered tutor message is the question, so its own message id is the assessment identity.
- `selection_type`: `single` or `multiple`.
- `stem` and canonical `rendered_text`.
- `options`: exactly four ordered entries with only `id` (`A`-`D`) and `text`.

Explicitly excluded: `correct_option_ids`, `transfer_basis`, private reason/rationale, model response metadata, `assessment_key`, and teacher-only lifecycle metadata.

Persisted-state limitation: the delivered message stores `content` (the stem), `assessment_options`, and `assessment_lifecycle`. It does not store `selection_type` or `rendered_text`, and `PublicMessageDTO` does not carry them. A reload therefore renders the stem and ordered options plus an explicit unavailable-instruction state instead of guessing a selection type from the key.

### LearnerAnswerSubmission

- `room_id`: room boundary.
- `message_id`: persisted learner message identity.
- `parent_message_id`: actual delivered question/source parent when present.
- `assessment_id`: delivered question identity; null for ordinary messages.
- `content`: original chat content; parser and grader remain server/domain-owned.

The UI sends this projection through component 102's trusted service facade and does not redefine its request mapping or add a grade, progress pair, or answer key.

### ProgressView

- `student_id`, `checklist_id`, `item_id`.
- Existing status/understanding pair read from the server.
- `progress_policy_version` to distinguish `legacy_v1` from `transfer_v1`.
- Evidence/history fields only when included in the role-appropriate upstream projection.

The UI cannot edit transfer-policy status or understanding. Legacy controls remain on the existing legacy path.

### ExportProjection

- `public`: room metadata, public messages, public assessment rendering, and public feedback allowed by the current product.
- `teacher`: public projection plus authorized teacher review metadata.

The builder must choose one projection from the authenticated role and must not serialize private fields first and remove them later.

## Lifecycle state

```text
idle -> preparing -> ready -> dirty -> sending -> delivered
   |        |          |        |         |
   |        |          |        |         +-> superseded | validation | unavailable | retryable
   +--------+----------+--------+--------------------------------------+

delivered -> answered | cancelled | invalidated
```

This is a UI view of the teacher's own screen plus authoritative server results. Only `preparing`, `ready`, `dirty`, `sending`, and the display error states are locally actionable. `delivered`, `answered`, `cancelled`, and `invalidated` are consumed from backend responses; `superseded` is what the UI shows when the server refuses the delivery because persisted state already covers the learner.

## Invariants

- One visible lifecycle entry exists per persisted identity.
- A dirty candidate is never sendable.
- Assessment delivery does not change room participation mode to `assessment`.
- Learner projections contain no private assessment fields, and `assessment_key` is never retained in UI state, exports, or error surfaces.
- UI state changes cannot update progress pairs.
- Legacy and transfer-policy checklist projections are not merged into one semantic state.
