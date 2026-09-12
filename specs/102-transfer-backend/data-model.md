# Data Model: Server-Authoritative Transfer Assessment Backend

**Intent**: Define the storage entities, lifecycle relationships, and invariants owned by W3-W6 without adding a second mastery authority.

## Policy and progress

`session_checklists.progress_policy_version` is either `legacy_v1` or `transfer_v1`. A transfer checklist requires `student_id`; legacy rows keep their current nullable ownership and semantics. A transfer item uses only these status/understanding pairs:

| Status | Understanding | Meaning |
|---|---|---|
| `pending` | `none` | No positive transfer-policy evidence |
| `partially_covered` | `basic` | Initial evidence makes the item eligible |
| `needs_review` | `basic` | Failure or later contradiction requires repair |
| `covered` | `good` | Local transfer criterion is satisfied |

The database validates the pair. React, model output, and direct clients cannot update the two columns independently for `transfer_v1`.

## Entities

### Existing policy-aware entities

| Entity | Owned fields | Relationships and rules |
|---|---|---|
| `session_checklists` | `id`, `room_id`, `student_id`, `progress_policy_version`, `is_active`, template metadata | One active transfer checklist per `(room_id, student_id)`; legacy rows remain separately queryable. |
| `checklist_items` | Existing objective/status/understanding/attempt fields | Parent policy selects validation rules; no new mastery field. |
| `messages` | Existing author/room/content/parent fields plus `response_mode` turn mode and optional `assessment_id` | Learner answer must be a stored message authored by the verified learner and linked to its delivered question. |
| `coverage_evidence` | Existing evidence plus `event_id` and optional `assessment_id` | Transfer evidence is inserted in the same trusted transaction as progress. |
| `checklist_updates` | Existing history plus event/assessment links and actual previous/new fields | A state-changing event has one causal history row with actual before/after pairs. |

### Public entities

| Entity | Fields | Lifecycle rules |
|---|---|---|
| `public.assessment_questions` | Scope IDs, tutor/source message IDs, selection type, stem, rendered text, ordered A-D options, lifecycle, selected labels/result, feedback link, timestamps | `delivered` is the only unresolved state; one delivered row per room/student; key is never stored here. |

### Private entities

| Entity | Fields | Lifecycle rules |
|---|---|---|
| `private.assessment_drafts` | Raw model output, reviewed payload, scope/focus IDs, revision, reviewer, confirmation, status | Status is `draft`, `ignored`, or `sent`. A material edit increments `revision` and requires confirmation again; a draft that is never sent is simply never delivered. |
| `private.assessment_question_keys` | Question ID, immutable correct labels, private payload, transfer basis, reviewer confirmation, draft revision, source item timestamp | Insert once for delivery; update/delete raises `ASSESSMENT_KEY_IMMUTABLE`. |
| `private.learning_event_inbox` | Stable event/dedupe key, scope/source IDs, kind/payload, classifier, processing state, linked evidence/update, timestamps | Records applied, no-change, deferred, rejected, and error outcomes for replay/audit. |
| `private.assessment_request_results` | Operation, request ID, actor, stable response | Generic request-idempotency ledger shared by every request-bearing RPC. Returns the recorded result for a repeated `(operation, request_id)`; not specific to any one operation. |

There is exactly one assessment pipeline: a tutor message plus a public question, backed by one immutable private key. Request idempotency is recorded in `assessment_request_results`, which is not an assessment artefact and is used by `post_message` and `process_message` among others.

## State transitions

The pure reducer and `apply_learning_event_v1` must agree:

| Event | `pending/none` | `partially_covered/basic` | `needs_review/basic` | `covered/good` |
|---|---|---|---|---|
| `initial_signal` | partial/basic | no change | no change | no change |
| `post_repair_signal` | no change | no change | partial/basic | no change |
| `spontaneous_transfer` | covered/good | covered/good | covered/good | no change |
| `contradiction` | no change | needs_review/basic | no change | needs_review/basic |
| `assessment_pass` | reject | covered/good | reject | reject |
| `assessment_fail` | reject | needs_review/basic | reject | reject |
| `no_change` | no change | no change | no change | no change |

Assessment resolution is separate from this table: delivery is required; first valid answer sets question result once; duplicate processing returns the recorded result; stale/closed/assisted questions do not grade.

## Causal and authorization invariants

1. Every transfer event references one active owner-scoped checklist, one item in that checklist, one room, and the matching learner.
2. Every non-null source evidence message exists in the same room and is authored by the learner unless the event is explicitly tutor-attested external evidence.
3. A state-changing event writes evidence, status/understanding, actual history, and applied event state atomically.
4. Guarded rooms may record a deferred event but cannot mutate protected progress.
5. A delivered assessment has one immutable key and one reviewed draft revision.
6. A public DTO never includes `correct_option_ids`, `transfer_basis`, `raw_model_output`, private payloads, or provider credentials.
7. Old legacy RPCs and public table writes cannot mutate transfer-policy progress/evidence.
8. Legacy checklist values, `excellent` metadata, and simplified-auth reviewed sends retain their legacy interpretation.
9. A draft that is never sent is simply never delivered. There is no rejection, no generation-trigger suppression, and no regeneration: the absence of a send is already the correct outcome, and the product has no requirement to stop a tutor receiving a draft again.

## Lock and dedupe order

For state-changing transactions, lock room, checklist, item, and question in that order where present. Use stable keys:

- observation: `policy + student + item + source_message + event_kind`;
- grading: `question_id + first_valid_answer_message_id`;
- delivery: reviewed draft ID + revision plus the unique unresolved-question index.

Transport retries do not increment learning attempts. Attempts increment only for scored assessment or valid spontaneous-transfer evidence.
