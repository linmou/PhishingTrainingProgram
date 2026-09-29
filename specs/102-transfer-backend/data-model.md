# Production Data Model: Transfer Assessment Backend

<!-- Intent: record the production assessment storage shape inspected on 2026-09-28. -->

## Current Production Data Model

The live public.messages relation has these assessment-related columns:

| Column | Type | Observed use |
|---|---|---|
| assessment_id | uuid | Links a learner answer message to its question message. |
| assessment_options | jsonb | Stores displayed options on the tutor question. |
| assessment_lifecycle | text | Tracks question lifecycle. |
| assessment_answer_message_id | uuid | Links the processed learner answer. |
| assessment_selected_option_ids | text[] | Stores resolved option IDs. |
| assessment_result | text | Stores the result. |
| assessment_closed_at | timestamptz | Stores terminal processing time. |
| assessment_checklist_id | uuid | Associates the question with its checklist. |
| assessment_item_id | uuid | Associates the question with its checklist item. |
| assessment_selection_type | text | Stores single or multiple selection. |
| assessment_student_id | uuid | Stores the intended learner identity. |

The live public.messages relation has no assessment_key column.

The private.transfer_assessments table exists with these columns: id, question_message_id, room_id, student_id, checklist_id, item_id, focus_student_message_id, selection_type, correct_option_ids, learner_safe_explanation, transfer_basis, reviewed_private_payload, lifecycle, attempt_count, terminal_answer_message_id, terminal_result, delivery_request_id, closed_at, created_at, and updated_at. It contained zero rows at inspection. The production assessment RPCs described in [rpc-contract.md](contracts/rpc-contract.md) do not read or write this table.

The private.learning_event_inbox table also exists and contained zero rows at inspection. The assessment processor calls the learning-event function after grading.

## Historical Component 102 Target Model (Not Production)

The remaining sections preserve the local component-102 target model and are not a description of the production schema.

## Historical Policy and Progress

Transfer checklists remain owner-scoped `transfer_v1` rows. Component 101 owns the valid progress pairs and terminal event transitions. Component 102 persists those transitions without adding another mastery field.

## Historical Public Entities

### `public.messages`

The delivered question remains an ordinary tutor message. New deliveries use:

| Field | Rule |
|---|---|
| `id`, `room_id`, `user_id`, `parent_message_id`, `created_at` | Stable room, author, focus-message, and ordering identity |
| `content` | Exact assessment `stem`; never option-bearing `rendered_text` |
| `response_mode` | `assessment` for the tutor turn; room participation remains `tutoring` |
| `assessment_id` | Stable link to the private assessment |
| `assessment_student_id` | Immutable public target learner identity derived from the owner-scoped checklist; used for UI routing, never authorization |
| `assessment_options` | Ordered A-D public option objects |
| `assessment_selection_type` | `single` or `multiple` |
| `assessment_lifecycle` | Public summary: `delivered`, `passed`, `failed`, `cancelled`, or `legacy_incomplete` |
| `assessment_selected_option_ids` | On learner answer messages only, normalized displayed option IDs |

`assessment_key` is removed from public authority. Existing recoverable values are moved private before the public column is cleared/dropped. `assessment_student_id` must equal the private assessment `student_id` and the owner of its `transfer_v1` checklist at delivery. It allows room consumers to route controls but never authorizes submission. Public rows never contain `rendered_text`, the learner-safe explanation, transfer basis, rationale, reviewed private payload, raw provider output, or attempt ledger.

## Historical Private Entities

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
| `processing_state` | `applied`, `deferred`, or `rejected`; retries read the committed response |
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

Terminal pass/fail uses the existing causal learning-event ledger. The event key includes assessment and terminal answer identities. First incorrect attempts create no learning event. If Guard becomes active after answer resolution, the terminal attempt and original inbox event commit as deferred without progress. A room transition from Guard to tutoring replays deferred terminal assessment events in creation order through a database trigger, whether the mode change is reviewed or manual. Replay retains each event ID and dedupe key, writes one evidence and history row if the item remains partially covered, and rejects an invalidated transition without changing progress. Repeated mode updates do not reapply the event.

## Historical Lifecycle

```text
delivery -> open(attempt_count=0)
open + wrong #1 -> open(attempt_count=1), answer_outcome=retry
open + correct #1/#2 -> passed, terminal progress event, no private feedback
open(after wrong #1) + wrong #2 -> failed, terminal progress event, terminal failure feedback
passed|failed|cancelled|legacy_incomplete + submission -> no mutation
```

## Historical Processed DTO Invariants

`processing_state` describes application mechanics: `applied`, `duplicate`, `rejected`, or `deferred`. `answer_outcome` describes learning lifecycle: `retry`, `passed`, `failed`, or null. A duplicate may return the original `answer_outcome` with `already_processed=true`.

`terminal_failure_feedback` is non-null if and only if the authorized learner receives a terminal `failed` outcome. Its exact fields are `correct_option_ids` and `learner_safe_explanation`. Every other projection uses null.

## Historical Lock and Transaction Order

1. Resolve verified principal and authorize room/learner outside the RPC body in the Edge Function.
2. Read the private processing context and resolve the stored answer with component 101 inside the trusted Edge handler.
3. The commit RPC checks request and answer-message idempotency, then locks room, transfer checklist/item, and private assessment in that order.
4. Compare the expected count/resolution with the locked state and validate the stored answer scope and selected IDs.
5. Allocate the next attempt from the trusted resolver outcome, bounded to two; on a stale snapshot, reread and rerun the resolver.
6. For terminal outcomes, apply the learning event, evidence, progress, and actual history before marking the assessment terminal. A rejected transition rolls back the whole call.
7. Return an allowlisted result only after commit. A committed second failure may disclose terminal feedback even when its learning event is explicitly `deferred` by Guard; rollback exposes no terminal feedback.

## Historical Migration Reconciliation

- Inspect hosted schema and archived migration state before applying the forward migration.
- Move any existing `messages.assessment_key` into a private `legacy_incomplete` record tied to the message, then clear/drop the public key field.
- Backfill `assessment_student_id` only when `assessment_checklist_id` resolves to exactly one owner-scoped `transfer_v1` checklist. Leave an ambiguous or missing target null, retain `legacy_incomplete`, and make its public assessment projection unavailable.
- Do not invent `learner_safe_explanation`, attempt rows, or valid terminal evidence for legacy browser-only data.
- Preserve public messages and existing evidence. Legacy-incomplete assessments cannot be processed by the new grading RPC.
- Revoke untrusted transfer RPC/table access and regenerate `src/types/database.ts` from the resulting hosted schema.
