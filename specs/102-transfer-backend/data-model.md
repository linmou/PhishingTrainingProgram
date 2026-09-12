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

The assessment is stored on the tutor message itself. There is no separate question or key table: `public.messages` carries the assessment columns, all nullable so ordinary chat rows are unaffected.

| Column on `public.messages` | Purpose |
|---|---|
| `assessment_options` | the ordered A-D option objects |
| `assessment_key` | the correct option ids |
| `assessment_lifecycle` | `delivered`, `answered`, `cancelled`, or `invalidated`; NULL means the row is not an assessment |
| `assessment_answer_message_id` | the learner message that answered it |
| `assessment_selected_option_ids` | what the learner selected |
| `assessment_result` | `pass` or `fail` |
| `assessment_closed_at` | when it closed |
| `assessment_checklist_id`, `assessment_item_id` | the scope the verdict applies to |

`assessment_id` is a pre-existing column whose foreign key was dropped with the question table; it is retained but unused.

Key confidentiality is an accepted tradeoff, not an oversight. `public.messages` is readable by every room participant, so a learner can read `assessment_key` with a crafted REST request. The owner accepted this because the product is a training app rather than a strict exam, and a working function outranks key secrecy. The normal API response still excludes the key, so the UI path never receives it.

### Private entities

| Entity | Fields | Lifecycle rules |
|---|---|---|
| `private.learning_event_inbox` | Stable event/dedupe key, scope/source IDs, kind/payload, classifier, processing state, linked evidence/update, timestamps | Records applied, no-change, deferred, rejected, and error outcomes for replay/audit. This is the only table the component keeps: it is what applies `assessment_pass` and `assessment_fail` to `checklist_items`. |

`one_open_assessment_per_student` is a partial unique index on `messages(room_id, user_id) WHERE assessment_lifecycle = 'delivered'`, replacing the index that lived on the dropped question table.


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
