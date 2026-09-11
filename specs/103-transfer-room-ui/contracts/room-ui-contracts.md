# Room UI Contracts

## Intent

Specify the allowlisted browser boundary for W7-W8. The UI consumes these projections through `transferAssessmentService` and room services; components do not consume raw provider or database responses.

## Teacher operations

The browser facade exposes typed operations corresponding to the upstream service operations already present in the worktree:

| Operation | Request identity | Response consumed by UI |
|---|---|---|
| `capabilities` | `room_id` | `enabled`, `policy_available`, `can_review_assessment`, optional `reason` |
| `prepare_turn` | `room_id`, `focus_student_message_id`, `checklist_id` | `TeacherAssessmentDraftDTO` or an explicit unavailable/error result |
| `review_draft` | `draft_id`, `expected_revision`, structured final payload, `content_confirmed` | accepted revision/hash or explicit validation/stale result |
| `send_reviewed` | `draft_id`, expected revision, expected final hash | delivered message public projection, room participation projection, and lifecycle identity |
| draft suppression/regeneration | current draft identity and focus identity, through the upstream-defined operation | `rejected`, `ignored`, or replacement draft lifecycle result; no learner message |
| `post_message` | `room_id`, content, optional `parent_message_id`, optional `assessment_id` | persisted message projection and lifecycle result |
| `process_message` | persisted answer/message ID | structured server decision/lifecycle result, never a client grade or progress write instruction |
| `analyze_message` | persisted message ID and room ID | explicit evidence/lifecycle result for the server-owned path |

The facade must type successful and failed envelopes. A generic `Record<string, unknown>` may remain internal to a compatibility adapter only if it is validated and narrowed before reaching React components.

## Private teacher draft allowlist

The teacher editor may receive:

- draft identity, revision, expected snapshot hash;
- selected learner/source message/checklist/item identity;
- structured decision fields required for teacher review, including answer key and transfer basis;
- validation/rejection/regeneration status needed to render the lifecycle.

This projection is never sent to learner components, learner exports, browser-wide broadcast events, or public message payloads.

## Public learner assessment allowlist

Learner components may receive only:

```ts
type PublicAssessmentDTO = {
  id: string; // assessment question identity; message.assessment_id links to it
  selection_type: 'single' | 'multiple';
  stem: string;
  rendered_text: string;
  options: Array<{ id: 'A' | 'B' | 'C' | 'D'; text: string }>;
};
```

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

## Error contract

The facade maps upstream errors into a stable UI error category without exposing raw provider output:

- `unavailable`: capability disabled or trusted operation unavailable;
- `validation`: malformed or semantically invalid draft/public payload;
- `stale`: revision/hash/snapshot conflict;
- `duplicate`: idempotent replay whose persisted result can be shown;
- `unauthorized`: no data or action is rendered;
- `retryable`: transient ingress/send failure with a safe retry action;
- `lifecycle`: rejected, assisted, invalidated, or already-resolved question outcome.

## Contract ownership

Component 102 owns server response shapes, authorization, atomicity, idempotency, and private field enforcement. Component 103 owns typed browser narrowing, state merge, rendering, and role-specific display. Component 105 owns release-browser evidence.
