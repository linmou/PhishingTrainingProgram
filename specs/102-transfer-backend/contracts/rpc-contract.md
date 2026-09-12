# Versioned RPC Contract

**Intent**: Define the trusted database operation names, actor/request inputs, result obligations, and legacy boundary for W3-W5.

## Common rules

- Every transfer RPC receives a server-derived actor ID and a request ID where it mutates state. The Edge Function supplies these; browsers cannot execute the functions directly.
- `service_role` is the only application grant for transfer RPCs. `anon` and `authenticated` direct execute grants are revoked.
- Inputs that name a room, student, checklist, item, or message are checked against the verified principal and stored relationships.
- Results are JSON objects with stable IDs/status/error codes; private rows are never returned wholesale.
- A request ID is a transport correlation handle. There is no retry ledger: no caller reuses a request ID, so a replay lookup would never hit. Idempotency is structural instead: one delivered assessment per learner, and an assessment whose `assessment_lifecycle` has already left `delivered`.

## RPCs

| Versioned RPC | Inputs | Result obligation |
|---|---|---|
| `initialize_transfer_checklist_v1` | room, requested student, template, actor, request | one active owner-scoped transfer checklist or stable existing result; legacy rows not reinterpreted |
| `post_assessment_message_v1` | room, content, parent/question, actor, request | one stored authored message and public processing indicator |
| `prepare_transfer_turn_v1` | room, focus student message, checklist, actor, request | scope-checked preparation outcome; provider generation remains outside an open DB transaction |
| `send_reviewed_tutor_response_v3` | reviewed payload, room, student, checklist, item, focus message, actor, request | one tutor message written with the assessment stamped onto it; room participation unchanged; the key is stripped from the response |
| `apply_learning_event_v1` | event JSON with scope, dedupe key, evidence IDs, kind, snapshot context | applied/no-change/deferred/rejected/error result plus linked evidence/update IDs; actual history pairs |
| `process_assessment_message_v1` | stored answer message, actor, request | first-valid-answer result or clarification/assisted outcome; deterministic key grading; the verdict is written back onto the tutor message |

## Delivery result

`send_reviewed_tutor_response_v3` must commit, in one transaction, the tutor message with the assessment stamped onto it and the room participation mapping. For an assessment the message turn mode is `assessment`, the instruction is `transfer_assess`, the lifecycle is set to `delivered`, and room participation remains `tutoring`. Any failure rolls back all of these writes.

A second delivery for a learner who already has a `delivered` assessment is rejected as `ASSESSMENT_ALREADY_OPEN`, and the partial unique index `one_open_assessment_per_student` enforces the same rule.

## Evidence result

`apply_learning_event_v1` returns `processing_state` (`applied`, `no_change`, `deferred_guard`, `rejected`, or `error`) with event ID and safe error code. `applied` includes the linked evidence/update IDs and resulting progress pair. It never returns a private key or raw event payload to a learner.

## Legacy boundary

The legacy `send_reviewed_tutor_response` overload remains available only for its existing legacy client path. It must not write transfer questions, transfer keys, or transfer progress. Legacy local identity compatibility in migration 026 does not authorize the transfer RPC set.
