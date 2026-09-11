# Data Model: Transfer Room Lifecycle and UI Integration

## Intent

Define the React-owned view state and identity relationships for W7-W8. Component 102 owns the API DTO definitions and service operation mapping; backend storage, authorization, progress transitions, and answer keys also remain upstream.

## Identity graph

```text
Room
  -> selected learner (student_id)
  -> focus learner message (focus_student_message_id)
  -> owner-scoped checklist (checklist_id)
  -> target checklist item (target_item_id)
  -> teacher draft (draft_id, revision, progress_snapshot_hash)
  -> delivered question (assessment_id)
  -> learner answer message (message_id, parent_message_id, assessment_id)
```

Every arrow is an explicit persisted relationship supplied or validated by upstream operations. UI code must not infer an ID from display text, array position, latest message, or local role selection.

## UI projections

### RoomViewState

- `room`: public room projection plus server-owned `active_response_mode` limited to `tutoring` or `guard`.
- `messages`: deduplicated persisted message projections, retaining `id`, `room_id`, `user_id`/role projection, `parent_message_id`, `response_mode`, `assessment_id`, timestamps, content, and display metadata allowed for the current role.
- `participants`: existing room participant projection.
- `focus`: selected `student_id`, `focus_student_message_id`, `checklist_id`, and `target_item_id` when a teacher is reviewing a transfer turn.
- `draft`: nullable `TeacherAssessmentDraftDTO` with local UI status (`idle`, `loading`, `dirty`, `ready`, `sending`, `stale`, `rejected`, `error`). Local status is view state only and is not a progress state.
- `publicQuestion`: nullable `PublicAssessmentDTO` attached to a delivered message.
- `catchUp`: loading/error cursor state for initial fetch, realtime reconnect, and retry; it does not replace persisted lifecycle status.

### TeacherAssessmentDraftDTO (component 102 export)

Private, teacher-only review projection. Required identity and lifecycle fields:

- `draft_id`: stable draft identity.
- `revision`: optimistic-concurrency revision.
- `progress_snapshot_hash`: expected server snapshot used to reject stale review/send.
- `focus_student_id`, `focus_student_message_id`, `checklist_id`, `target_item_id`: stable source identity.
- `decision`: the private structured `TutorDecisionV3` needed by the teacher editor, including key and transfer basis only in this authorized projection.
- `status`: upstream draft lifecycle status, narrowed to `draft | rejected | ignored | sent | superseded`; the UI does not invent or rewrite a persisted status.

Teacher edit state is a copy of the structured decision until review succeeds. It must never be sent as a learner projection.

### PublicAssessmentDTO (component 102 export)

Learner-visible allowlist:

- `id`: assessment question identity. A message links to this identity through its separate `assessment_id` field.
- `selection_type`: `single` or `multiple`.
- `stem` and canonical `rendered_text`.
- `options`: exactly four ordered entries with only `id` (`A`-`D`) and `text`.

Explicitly excluded: `correct_option_ids`, `transfer_basis`, private reason/rationale, model response metadata, draft revision, progress snapshot hash, and teacher-only lifecycle metadata.

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
idle -> prepared -> dirty -> ready -> sending -> delivered
  |       |         |       |        |
  |       +-> rejected      +-> stale/error
  +----------------------------------+

delivered -> answer_pending -> resolved | cancelled | invalidated
```

This is a UI view of upstream lifecycle records. Only `prepared`, `dirty`, `ready`, `sending`, and display loading/error states are locally actionable. `resolved`, `cancelled`, and `invalidated` are consumed from backend DTOs.

## Invariants

- One visible lifecycle entry exists per persisted identity.
- A dirty or stale draft is never sendable.
- Assessment delivery does not change room participation mode to `assessment`.
- Learner projections contain no private assessment fields.
- UI state changes cannot update progress pairs.
- Legacy and transfer-policy checklist projections are not merged into one semantic state.
