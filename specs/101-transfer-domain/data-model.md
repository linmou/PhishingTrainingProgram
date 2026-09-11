# Data Model: W2 Deterministic Transfer Behavior

**Intent**: Define the public/private records, progress pairs, event transitions, and golden fixture shape that implementation and tests must share.
**Date**: 2026-09-11

## Contract Records

### `TutorDecisionV3`

| Field | Shape | W2 rule |
|---|---|---|
| `reason` | non-empty string | Serialized first; supervisor-facing and grounded in observable evidence. |
| `decision.mode` | `tutoring` / `guard` / `assessment` | Assessment is a turn mode, not a room participation mode. |
| `decision.instruction` | tutoring instruction, `guard`, or `transfer_assess` | `assessment` requires `transfer_assess`; Guard uses `guard`; tutoring cannot carry assessment. |
| `decision.target_item_id` | known item ID or null | Required for assessment; null for tutoring and Guard. |
| `response` | non-empty string | Assessment stem source; bounded by rendering rules. |
| `assessment` | private assessment or null | Required only for assessment; never exposed in full to the learner. |

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

- `PrivateAssessment`: exactly four unique options in A-D order, selection type, stem, rendered text, one key for `single` or two/three keys for `multiple`, and a non-empty transfer basis with known source evidence IDs. Its changed context tests the same concept in a relevant new situation, not a cosmetic brand/name substitution or an unstated prerequisite.
- `PublicAssessment`: assessment ID plus stem, rendered text, selection type, and options. The public projection excludes `correct_option_ids`, transfer basis, rationale, and raw model output.
- `ParsedSelection`: `{ kind: 'selection', option_ids }`, `{ kind: 'clarification_required', code }`, or `{ kind: 'not_selection' }`.

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
| `passed` | Delivered question, first valid selection, exact key set | Apply pass once; require feedback before another assessment. |
| `failed` | Delivered question, first valid selection, non-exact set | Apply fail once; require repair and new learner evidence. |
| `assisted` | Content help could coach answer | Cancel/close without failing grade; no same-message assessment chain. |
| `duplicate` / `stale` | Resolution already committed or snapshot/message no longer current | Preserve committed result; no second side effect. |

## Golden Fixture Record

Each fixture must include:

- `fixture_id`, `suite`, `contract_version`, and `policy_version`.
- normalized input records and referenced known item/message IDs.
- expected output/disposition, expected progress pair, and expected next-action boundary.
- a short evidence note linking the fixture to the source requirement or scenario.
- boundary metadata for parser syntax, subset membership, word-like segment count, sentence count, or matrix cell where applicable.

Fixtures must not contain real secrets, provider credentials, or claims that a mock proves hosted authorization/persistence.
