# Room UI Consumer Contracts

## Intent

Specify how W7-W8 consumes component 101's shared assessment/progress types and component 102's allowlisted browser contract. Component 101 owns shared domain type files and exports; component 102 owns `tutor-system/src/services/transferAssessmentService.ts`, all API DTO/envelope declarations, and operation mapping. Component 103 owns only React-specific narrowing and adapter-local view-state types in UI-owned files; components do not consume raw provider or database responses.

## Teacher operations

Component 102's browser facade exports typed methods and envelopes for these operations. This table is a consumer dependency, not a component-103 service definition:

| Operation | Request identity | Response consumed by UI |
|---|---|---|
| `capabilities` | `room_id` | `enabled`, `policy_available`, `can_review_assessment`, optional `reason` |
| `prepare_turn` | `room_id`, `focus_student_message_id`, `checklist_id` | `TeacherAssessmentDraftDTO` or an explicit unavailable/error result |
| `review_draft` | `draft_id`, `expected_revision`, structured final payload, `content_confirmed` | accepted revision/hash or explicit validation/stale result |
| `send_reviewed` | `draft_id`, expected revision, expected final hash | delivered message public projection, room participation projection, and lifecycle identity |
| `reject_draft` | current draft identity and expected revision | `rejected` or idempotent lifecycle result; no learner message |
| `regenerate_draft` | current draft identity and stable focus identity | replacement `TeacherAssessmentDraftDTO` or explicit stale/unavailable result; no learner message |
| `post_message` | `room_id`, content, optional `parent_message_id`, optional `assessment_id` | persisted message projection and lifecycle result |
| `process_message` | persisted answer/message ID | structured server decision/lifecycle result, never a client grade or progress write instruction |
| `analyze_message` | persisted message ID and room ID | explicit evidence/lifecycle result for the server-owned path |

Component 102 must type successful and failed envelopes and owns any API compatibility logic. Component 103's React adapter consumes only those exported typed envelopes and maps them into UI states; it must not accept `Record<string, unknown>` or recreate API operation mapping.

## Private teacher draft allowlist

The teacher editor may receive:

- draft identity, revision, expected snapshot hash;
- selected learner/source message/checklist/item identity;
- structured decision fields required for teacher review, including answer key and transfer basis;
- validation/rejection/regeneration status needed to render the lifecycle.

This projection is never sent to learner components, learner exports, browser-wide broadcast events, or public message payloads.

## Public learner assessment allowlist

Learner components import component 102's exported `PublicAssessmentDTO` directly and consume only its assessment identity, selection type, stem, rendered text, and ordered option fields. Component 103 does not redeclare this type. The message's assessment identity links the public projection to its delivered question.

The projection has no `correct_option_ids`, `transfer_basis`, private `reason`, draft revision, snapshot hash, provider output, or teacher action. The renderer derives no answer key and does not perform semantic grading.

## Message relationship contract

Every assessment answer message must preserve the persisted `assessment_id` and its actual `parent_message_id` when a question is being answered. An ordinary learner message has no assessment identity. A UI retry must reuse the upstream idempotency/request identity and must merge the returned persisted message by ID.

## Mode contract

- Room participation: `tutoring | guard`.
- Tutor turn/message: `tutoring | guard | assessment`.
- Assessment turn instruction: `transfer_assess`.
- Guard participation instruction: `guard`.
- `assessment` is not valid as a room participation value.
- Assessment delivery maps to room participation `tutoring`; an independent Guard decision remains server-authoritative.

The UI rejects missing instructions, `assessment` without `transfer_assess`, tutoring/Guard with an assessment payload, and any payload with an unknown target identity.

## React state adaptation

The component-103 adapter imports component 101/102 exports unchanged and defines its React-only draft, public-question, and lifecycle view-state types alongside their mappings in `src/contexts/transferAssessmentUiAdapter.ts`. It maps component 102's exported envelope variants into these states without exposing raw provider output:

- `unavailable`: capability disabled or trusted operation unavailable;
- `validation`: malformed or semantically invalid draft/public payload;
- `stale`: revision/hash/snapshot conflict;
- `duplicate`: idempotent replay whose persisted result can be shown;
- `unauthorized`: no data or action is rendered;
- `retryable`: transient ingress/send failure with a safe retry action;
- `lifecycle`: rejected, assisted, invalidated, or already-resolved question outcome.

## Contract ownership

Component 101 owns shared assessment/progress domain types and exports, including `src/types/assessment.ts`, `src/types/learningProgress.ts`, and `src/types/index.ts`. Component 102 owns `transferAssessmentService.ts`, API DTO/envelope exports, `reject_draft`/`regenerate_draft` and all other operation mapping, authorization, atomicity, idempotency, private field enforcement, and service contract tests. Component 103 owns React-specific narrowing and adapter-local view-state types in UI-owned files, room state merge, rendering, and role-specific display tests. Component 105 owns release-browser evidence.
