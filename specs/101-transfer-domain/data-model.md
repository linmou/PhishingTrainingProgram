# Data Model: Server-Authoritative Transfer Attempts

**Intent**: Define the assessment, attempt, result, progress, and fixture records shared by deterministic implementation and downstream consumers.
**Date**: 2026-09-22
**Revised**: 2026-09-30

## Contract Records

### `TransferAssessmentDraft`

Active assessment preparation returns `{ reason, target_item_id, assessment }`. `target_item_id` identifies one approved item in the current learner checklist. `assessment` is a `PrivateAssessment`; its stem is the question, and its evidence IDs belong to the focused learner. The draft has no tutor decision mode, teaching instruction, or duplicate response field. It is held only in teacher review state.

### `TransferTurnContext`

The context is a turn snapshot, not a persisted progression authority. It contains:

- `progress_policy_version`: `legacy_v1` or `transfer_v1`.
- `focus_student_id`, `focus_student_message_id`, and optional `checklist_id`.
- `prior_participation_mode`: `tutoring`, `guard`, or `unknown`.
- learner-owned checklist item snapshots with item ID, area text, priority, progress pair, evidence message IDs, and repair message ID.
- an unresolved public assessment plus its ID, when one is delivered and open.
- eligible item IDs, `feedback_required`, and `progress_snapshot_hash` for stale-state comparison.

The context must not contain a learner-visible answer key or private transfer basis in its unresolved public assessment.

### Assessment records

- `PrivateAssessment`: exactly four unique options in A-D order, selection type, stem, rendered text, one key for `single` or two/three keys for `multiple`, required trimmed non-empty `learner_safe_explanation`, and a non-empty transfer basis with known source evidence IDs. Its changed context tests the same concept in a relevant new situation, not a cosmetic substitution or unstated prerequisite.
- `PublicAssessment`: the unresolved contract consumed by component 102, containing assessment ID, stem, rendered text, selection type, and options. It excludes `correct_option_ids`, `learner_safe_explanation`, transfer basis, rationale, raw model output, API operations, and transport fields.
- `ParsedSelection`: `{ kind: 'selection', option_ids }`, `{ kind: 'clarification_required', code }`, or `{ kind: 'not_selection' }`.

### `TransferAttemptSnapshot`

| Field | Shape | Rule |
|---|---|---|
| `assessment_id` | string | Must match the current delivered assessment. |
| `accepted_attempt_count` | `0 | 1 | 2` | Counts only validated selections accepted for this assessment. |
| `resolution` | `open | passed | failed` | `open` allows a valid selection only while count is 0 or 1; terminal states require count 1 or 2. |
| `processed_answer_message_ids` | readonly string array | Contains the unique identities of consumed valid selections; length equals `accepted_attempt_count`. Replays do not increment the count or reapply progress. |

State invariants:

- `open/0` is the initial delivered state.
- `open/1` exists only after the first incorrect valid selection.
- `passed/1` means correct on the first attempt; `passed/2` means incorrect then correct.
- `failed/2` means two incorrect valid selections.
- `open/2`, `failed/0`, `failed/1`, `passed/0`, counts outside 0-2, and mismatched assessment identities are invalid.
- Component 102 persists and updates this snapshot atomically. Component 101 only validates and transforms immutable values.

### Result union

`TransferResolvedAssessment` is discriminated by `disposition`:

- `retryable`: first incorrect; next snapshot is `open/1`, `remaining_attempts` is 1, progress is unchanged, transition is null, and terminal feedback is absent.
- `passed`: correct on attempt one or two; next snapshot is terminal, `remaining_attempts` is 0, transition is `assessment_pass`, private terminal feedback is retained, and `learner_feedback_authorized` is false.
- `failed`: second incorrect; next snapshot is `failed/2`, `remaining_attempts` is 0, transition is `assessment_fail`, terminal feedback is present, and `learner_feedback_authorized` is true.
- `not_delivered`, `unresolved`, `assisted`, `duplicate`, `stale`, or `guard_deferred`: no attempt is consumed and transition is null.

`TransferTerminalFeedback` contains `correct_option_ids` and `learner_safe_explanation`. It exists only on terminal `passed` and `failed` results. `TransferPassedResult` fixes `learner_feedback_authorized` to false, so component 102 must keep its feedback private. `TransferFailedResult` fixes the field to true; only that second-incorrect outcome permits learner projection.

## Progress State Model

Valid pairs are closed and exhaustive:

| Status | Understanding level | Meaning |
|---|---|---|
| `pending` | `none` | No transfer-policy evidence accepted. |
| `partially_covered` | `basic` | Initial or post-repair evidence exists; transfer check may be eligible. |
| `needs_review` | `basic` | Transfer failed or later contradiction reopened the concept. |
| `covered` | `good` | The local transfer criterion was met; not permanent mastery. |

No other pair, `excellent`, parallel mastery field, or legacy reinterpretation is valid for `transfer_v1`.

## Complete Reducer Matrix

The seven event kinds produce 28 required cells. `apply` and `no_change` preserve the pair shape; `reject` is reserved for invalid state/event combinations.

| Current pair | `initial_signal` | `post_repair_signal` | `spontaneous_transfer` | `contradiction` | `assessment_pass` | `assessment_fail` | `no_change` |
|---|---|---|---|---|---|---|---|
| `pending/none` | apply -> `partially_covered/basic` | no change | apply -> `covered/good` | no change | reject | reject | no change |
| `partially_covered/basic` | no change | no change | apply -> `covered/good` | apply -> `needs_review/basic` | apply -> `covered/good` | apply -> `needs_review/basic` | no change |
| `needs_review/basic` | no change | apply -> `partially_covered/basic` | apply -> `covered/good` | no change | reject | reject | no change |
| `covered/good` | no change | no change | no change | apply -> `needs_review/basic` | reject | reject | no change |

The table is the expected deterministic behavior to encode in fixtures and tests. Invalid serialized state pairs are rejected before matrix dispatch.

## Answer Resolution Outcomes

| Outcome | Preconditions | Progress/sequence effect |
|---|---|---|
| `not_delivered` | Matching question is draft/unsent or delivery is false | Preserve current pair; no grade or feedback. |
| `unresolved` | Ambiguous or format clarification, or no recognized selection | Keep question open; no grade. |
| `retryable` | First accepted valid selection is not the exact key set | Keep question open at `open/1`; preserve progress; disclose no terminal feedback. |
| `passed` | First or second accepted valid selection is the exact key set | Apply pass once; close question; require feedback; retain feedback privately and forbid learner projection. |
| `failed` | Second accepted valid selection is not the exact key set | Apply fail once; close question; require repair; attach feedback and authorize learner projection. |
| `assisted` | Content help could coach answer | Cancel/close without failing grade; no same-message assessment chain. |
| `duplicate` / `stale` | Answer identity already processed, question terminal/exhausted, or snapshot/message no longer current | Preserve state; consume no attempt; no second side effect. |

## Golden Fixture Record

Each fixture must include:

- `fixture_id`, `suite`, `contract_version`, and `policy_version`.
- normalized input records and referenced known item/message IDs.
- input and expected `TransferAttemptSnapshot`, disposition, remaining attempts, progress pair, transition, disclosure fields, and next-action boundary.
- a short evidence note linking the fixture to the source requirement or scenario.
- boundary metadata for parser syntax, subset membership, word-like segment count, sentence count, or matrix cell where applicable.

Fixtures must not contain real secrets, provider credentials, or claims that a mock proves hosted authorization/persistence.
