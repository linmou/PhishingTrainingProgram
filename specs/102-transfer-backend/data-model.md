# Data Model: Server-Authoritative Transfer Assessment Backend

<!-- Intent: define the private grading entities, public projection fields, and atomic lifecycle invariants. -->

## Existing Policy and Progress

Transfer checklists remain owner-scoped `transfer_v1` rows. Component 101 owns the valid progress pairs and terminal event transitions. Component 102 persists those transitions without adding another mastery field.

## Public Entities

### `public.messages`

The delivered question remains an ordinary tutor message. New deliveries use:

| Field | Rule |
|---|---|
| `id`, `room_id`, `user_id`, `parent_message_id`, `created_at` | Stable room, author, focus-message, and ordering identity |
| `content` | Exact assessment `stem`; never option-bearing `rendered_text` |
| `response_mode` | `assessment` for the tutor turn; room participation remains `tutoring` |
| `assessment_id` | Stable link to the private assessment |
| `assessment_options` | Ordered A-D public option objects |
| `assessment_selection_type` | `single` or `multiple` |
| `assessment_lifecycle` | Public summary: `delivered`, `passed`, `failed`, `cancelled`, or `legacy_incomplete` |
| `assessment_selected_option_ids` | On learner answer messages only, normalized displayed option IDs |

`assessment_key` is removed from public authority. Existing recoverable values are moved private before the public column is cleared/dropped. Public rows never contain the learner-safe explanation, transfer basis, rationale, reviewed private payload, raw provider output, or attempt ledger.

## Private Entities

### `private.transfer_assessments`

| Field | Type / rule |
|---|---|
| `id` | UUID primary key; same stable assessment identity exposed publicly |
| `question_message_id` | Unique FK to the public tutor message |
| `room_id`, `student_id`, `checklist_id`, `item_id`, `focus_student_message_id` | Non-null scope links validated together |
| `selection_type` | `single` or `multiple` |
| `correct_option_ids` | Non-empty canonical IDs; exactly one for single, two or three for multiple |
| `learner_safe_explanation` | Non-empty component-101-validated text for new delivered rows |
| `transfer_basis` | Private reviewed source/change context and evidence IDs |
| `reviewed_private_payload` | Validated immutable private assessment payload used for audit, never returned wholesale |
| `lifecycle` | `open`, `passed`, `failed`, `cancelled`, or `legacy_incomplete` |
| `attempt_count` | Integer 0-2 and equal to persisted attempt cardinality for new rows |
| `terminal_answer_message_id` | Nullable unique causal learner answer |
| `terminal_result`, `closed_at` | Null while open; consistent with passed/failed terminal state |
| `delivery_request_id` | Unique idempotency identity |
| `created_at`, `updated_at` | Audit timestamps |

New delivered rows require key, explanation, scope, public message, and lifecycle `open`. `legacy_incomplete` may retain a migrated key but is not gradable and does not satisfy new delivery invariants.

### `private.transfer_assessment_attempts`

| Field | Type / rule |
|---|---|
| `id` | UUID primary key |
| `assessment_id` | FK to private assessment |
| `answer_message_id` | Unique causal public learner message |
| `request_id` | Unique transport idempotency identity |
| `ordinal` | 1 or 2; unique per assessment |
| `selected_option_ids` | Canonical deduplicated option IDs |
| `result` | `correct` or `incorrect` |
| `processing_state` | `applied`, `deferred`, or `error`; retries read the existing row |
| `learning_event_id` | Nullable terminal causal event link |
| `created_at` | Audit timestamp |

The transaction locks `private.transfer_assessments` before reading count/lifecycle. Duplicate answer or request identity returns the stored attempt. A distinct request can claim only the next ordinal while lifecycle is open.

### `private.transfer_provider_attempts`

This append-only audit table is not a deliverable draft and grants no grading authority.

| Field | Type / rule |
|---|---|
| `id`, `request_id` | UUID identity and preparation correlation |
| `room_id`, `student_id`, `checklist_id`, `focus_student_message_id` | Scope used to build the canonical request |
| `attempt_ordinal` | 1 or 2; unique per request |
| `provider_base_url`, `provider_model`, `max_tokens` | Non-secret effective configuration metadata |
| `request_hash`, `request_payload` | Canonical version/hash and private request evidence with credentials excluded |
| `raw_response`, `finish_reason` | Private raw provider result and finish metadata |
| `validation_outcome`, `error_code` | `valid`, `invalid`, `truncated`, `http_error`, or `network_error` plus stable safe code |
| `created_at` | Audit timestamp |

The Edge Function records each provider attempt through service-role-only storage before returning a candidate or final provider error. Failure to persist the audit row fails preparation; it never delivers an unrecorded candidate. No browser, public projection, realtime publication, or component-104 runtime can read this table.

### Existing `private.learning_event_inbox`

Terminal pass/fail uses the existing causal learning-event ledger. The event key includes assessment and terminal answer identities. First incorrect attempts create no learning event. Guard-deferred and error states remain visible.

## Lifecycle

```text
delivery -> open(attempt_count=0)
open + wrong #1 -> open(attempt_count=1), answer_outcome=retry
open + correct #1/#2 -> passed, terminal progress event, no private feedback
open(after wrong #1) + wrong #2 -> failed, terminal progress event, terminal failure feedback
passed|failed|cancelled|legacy_incomplete + submission -> no mutation
```

## Processed DTO Invariants

`processing_state` describes application mechanics: `applied`, `duplicate`, `rejected`, or `deferred`. `answer_outcome` describes learning lifecycle: `retry`, `passed`, `failed`, or null. A duplicate may return the original `answer_outcome` with `already_processed=true`.

`terminal_failure_feedback` is non-null if and only if the authorized learner receives a terminal `failed` outcome. Its exact fields are `correct_option_ids` and `learner_safe_explanation`. Every other projection uses null.

## Lock and Transaction Order

1. Resolve verified principal and authorize room/learner outside the RPC body in the Edge Function.
2. Inside the service-role RPC, lock room, transfer checklist/item, and private assessment in that order.
3. Check request and answer-message idempotency.
4. Validate public answer scope and normalized selected IDs against public options.
5. Insert the next attempt and grade against the private key.
6. For terminal outcomes, apply the learning event, evidence, progress, and actual history before marking the assessment terminal.
7. Return an allowlisted result only after commit. A committed second failure may disclose terminal feedback even when its learning event is explicitly `deferred` by Guard; rollback exposes no terminal feedback.

## Migration Reconciliation

- Inspect hosted schema and archived migration state before applying the forward migration.
- Move any existing `messages.assessment_key` into a private `legacy_incomplete` record tied to the message, then clear/drop the public key field.
- Do not invent `learner_safe_explanation`, attempt rows, or valid terminal evidence for legacy browser-only data.
- Preserve public messages and existing evidence. Legacy-incomplete assessments cannot be processed by the new grading RPC.
- Revoke untrusted transfer RPC/table access and regenerate `src/types/database.ts` from the resulting hosted schema.
