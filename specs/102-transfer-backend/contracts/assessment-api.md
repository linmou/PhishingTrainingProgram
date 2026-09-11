# Assessment API Contract

**Intent**: Freeze the public operation names, request envelope, response envelope, and DTO privacy boundary for the trusted `assessment-api` Edge Function.

## Request and response envelopes

Every operation is a `POST` body containing a non-empty `operation` and transport `request_id`. The caller's bearer token is read from the request header; identity is never accepted from the body.

```json
{
  "operation": "process_message",
  "request_id": "uuid",
  "message_id": "uuid"
}
```

Success:

```json
{ "ok": true, "data": {} }
```

Error:

```json
{ "ok": false, "error": { "code": "FORBIDDEN", "message": "safe text", "retryable": false } }
```

Messages are safe summaries. They never contain keys, private payloads, provider credentials, raw private model output, or hidden rationale.

## Operations

| Operation | Required body fields | Authorized caller | Result |
|---|---|---|---|
| `capabilities` | `room_id` | verified room participant | capability flags and reason; no private data |
| `initialize_checklist` | `room_id`, requested `student_id`, `template_name` | authorized teacher | transfer checklist ID after server scope validation |
| `post_message` | `room_id`, content, optional parent/question IDs | verified application principal | public stored message and processing indicator |
| `analyze_message` | `room_id`, stored learner `message_id` | trusted backend path for the authorized learner | allowlisted applied/deferred event outcomes |
| `prepare_turn` | `room_id`, focus student message ID, checklist ID | authorized teacher | private authorized-teacher draft reference and reviewable decision; no learner key DTO |
| `review_draft` | draft ID, expected revision, final structured payload, content confirmation | authorized teacher | new revision/hash and review status |
| `send_reviewed` | draft ID, expected revision/hash | authorized teacher | public tutor message and public question DTO, or legacy tutoring result |
| `process_message` | stored learner message ID | verified owner learner/authorized backend | public question result/transition outcome without key |
| `cancel_question` | question ID, controlled reason | authorized teacher | closed public question state; no failure grade |
| `invalidate_question` | question ID, reason, expected snapshot | authorized teacher | invalidation/reconciliation result without replacing key |
| `confirm_external_transfer` | item ID, source message IDs, transfer evidence, note, expected snapshot | authorized teacher | guarded tutor-attested event result |

The operation set is versioned by the RPCs below. Adding an operation or changing a field requires a new contract version and generated client types; body aliases are not compatibility behavior.

## Public DTOs

`PublicAssessmentDTO` contains only `id`, `selection_type`, `stem`, `rendered_text`, and ordered option objects with `id` and `text`. Public question lifecycle DTOs may add scope/link/timestamp/result fields needed by the UI, but never add `correct_option_ids` or `transfer_basis`.

`PublicMessageDTO` contains stored message identity, room/user scope, content, role, parent, turn mode, assessment link, and timestamp. It does not expose private draft or feedback rows.

`TeacherDraftDTO` is returned only after verified teacher authorization. It may include draft revision, review state, structured decision, observable reason, and private assessment basis required for human review. It must not be returned by learner operations or included in public/realtime message payloads.

## Stable error classes

`AUTHORIZATION_NOT_CONFIGURED` (503), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `ASSESSMENT_FEATURE_DISABLED` (503), `LEGACY_CHECKLIST` (409), `UNSUPPORTED_ROOM_SCOPE` (409), `STALE_SNAPSHOT` (409), `DRAFT_REVISION_CONFLICT` (409), `ASSESSMENT_ALREADY_OPEN` (409), `ASSESSMENT_NOT_OPEN` (409), `WRONG_LEARNER` (403/409), `ANSWER_FORMAT_UNRESOLVED` (successful clarification outcome), `ITEM_VALIDATION_FAILED` (422), `AI_PROVIDER_NOT_CONFIGURED` (503), `AI_PROVIDER_ERROR` (502, retryable), `AI_OUTPUT_INVALID` (502, retryable only for bounded format repair), `PROGRESSION_LOCKED` (deferred outcome), and `PERSISTENCE_FAILED` (500, retryable with the same request ID).
