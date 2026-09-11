# Versioned RPC Contract

**Intent**: Define the trusted database operation names, actor/request inputs, result obligations, and legacy boundary for W3-W5.

## Common rules

- Every transfer RPC receives a server-derived actor ID and a request ID where it mutates state. The Edge Function supplies these; browsers cannot execute the functions directly.
- `service_role` is the only application grant for transfer RPCs. `anon` and `authenticated` direct execute grants are revoked.
- Inputs that name a room, student, checklist, item, question, message, draft, or snapshot are checked against the verified principal and stored relationships.
- Results are JSON objects with stable IDs/status/error codes; private rows are never returned wholesale.
- Replaying the same request returns its recorded result. Reusing a request ID with different payload/scope is a conflict.

## RPCs

| Versioned RPC | Inputs | Result obligation |
|---|---|---|
| `initialize_transfer_checklist_v1` | room, requested student, template, actor, request | one active owner-scoped transfer checklist or stable existing result; legacy rows not reinterpreted |
| `post_assessment_message_v1` | room, content, parent/question, actor, request | one stored authored message and public processing indicator; retry returns same message |
| `prepare_transfer_turn_v1` | room, focus student message, checklist, actor, request | scope-checked preparation outcome; provider generation remains outside an open DB transaction |
| `review_assessment_draft_v1` | draft, expected revision, final payload, content confirmation, actor, request | validated new revision/hash; any material edit clears confirmation |
| `reject_assessment_draft_v1` | `p_draft_id UUID`, `p_expected_revision INTEGER`, `p_reason TEXT`, `p_actor_id UUID`, `p_request_id UUID` | atomically lock current unsent draft, set `status='rejected'`, store controlled reason and same-trigger suppression, and persist stable result `{draft_id, revision, status, same_trigger_suppressed}` |
| `regenerate_assessment_draft_v1` | `p_source_draft_id UUID`, `p_expected_revision INTEGER`, `p_expected_snapshot_hash TEXT`, `p_generated_payload JSONB`, `p_raw_hash TEXT`, `p_actor_id UUID`, `p_request_id UUID` | atomically recheck source/scope/snapshot, set source `superseded`, insert one linked replacement `draft` with the same trigger key and generated private payload, and persist stable result `{source_draft_id, source_status, replacement_draft_id, replacement_revision, replacement_status}` |
| `send_reviewed_tutor_response_v3` | draft, expected revision/hash, actor, request | atomic public message/question/key/audit/room participation mapping; one unresolved question |
| `apply_learning_event_v1` | event JSON with scope, dedupe key, evidence IDs, kind, snapshot context | applied/no-change/deferred/rejected/error result plus linked evidence/update IDs; actual history pairs |
| `process_assessment_message_v1` | stored answer message, actor, request | first-valid-answer result or clarification/assisted outcome; deterministic key grading |
| `cancel_assessment_question_v1` | question, reason, actor, request | closed interaction without learner failure |
| `invalidate_assessment_question_v1` | question, reason, expected snapshot, actor, request | immutable-key invalidation and causal reconciliation result |
| `confirm_external_transfer_v1` | item, source evidence IDs, transfer evidence, note, snapshot, actor, request | tutor-attested event through the same transition authority |

## Delivery result

`send_reviewed_tutor_response_v3` must commit, in one transaction, the final tutor message, public question, immutable private key, audit record, idempotency result, draft sent state, and room participation mapping. For an assessment, the message turn mode is `assessment`, instruction is `transfer_assess`, and room participation remains `tutoring`. Any failure rolls back all of these writes.

## Draft disposition results

Both draft RPCs are `service_role` only and use `private.assessment_request_results` for operation/request/payload idempotency. A retry with identical scope and payload returns the recorded JSON; request reuse with a different payload returns `IDEMPOTENCY_CONFLICT` without mutation.

`reject_assessment_draft_v1` accepts only `p_reason='teacher_rejected'` and the expected current revision in `draft` status, then derives the generation-trigger key from stored scope, focus message, and snapshot data. Its commit includes the rejected status, controlled reason, suppression state, and request result. `prepare_transfer_turn_v1` must detect that rejected trigger and return `DRAFT_TRIGGER_SUPPRESSED`; it cannot silently create another draft.

`regenerate_assessment_draft_v1` is called only after explicit teacher authorization and server-side provider generation. It accepts a source in `draft`, `rejected`, or `ignored` status, but never `sent` or an already superseded source. It locks the source, validates expected revision and snapshot, marks it `superseded`, inserts exactly one replacement linked by `supersedes_draft_id`, and records the request result in one commit. A uniqueness constraint prevents two replacements for one source. Any failure rolls back source and replacement changes. It never writes a public question/message, key, evidence, progress, or room participation state.

## Evidence result

`apply_learning_event_v1` returns `processing_state` (`applied`, `no_change`, `deferred_guard`, `rejected`, or `error`) with event ID and safe error code. `applied` includes the linked evidence/update IDs and resulting progress pair. It never returns a private key or raw event payload to a learner.

## Legacy boundary

The legacy `send_reviewed_tutor_response` overload remains available only for its existing legacy client path. It must not write transfer questions, transfer keys, or transfer progress. Legacy local identity compatibility in migration 026 does not authorize the transfer RPC set.
