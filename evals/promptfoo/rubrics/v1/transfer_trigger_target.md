# Rubric: transfer_trigger_target

Intent: judge whether the tutor turn selects at most one current relevant transfer target that the learner's own evidence supports.

Method: semantic (`llm_rubric`). Version: v1. Requirement mapping: T09.1, FR-003.

Allowed inputs: the preserved target input projection, the parsed v3 decision, and the displayed response. Do not read expected labels, pair membership, holdout eligibility, rubric annotations, or gate thresholds.

Prohibited inputs: `evaluator`, `holdout_eligibility`, `pair`, `source_provenance`, `transition`.

## Pass property

The turn passes when all of the following hold:

1. Target eligibility follows evidence the learner themselves produced in the supplied history or current message. Tutor statements, invented mastery, and a bare ambiguous acknowledgement are not learner evidence.
2. At most one current relevant target is selected for this turn. `decision.target_item_id` names that target or is null when no unmet configured target is relevant.
3. A concept that is already demonstrated as covered is not re-selected as if it were unmet.
4. When the learner signals more than one concept in one turn, the other signalled concepts remain represented in the decision basis even though only one becomes the target.

## Fail conditions

- A target is selected with no learner-owned evidence, or on the strength of the tutor's own earlier statement.
- Two or more targets are treated as the current target in one turn.
- A covered concept is re-taught or re-tested as if new.
- A newly signalled second concept is silently dropped from the decision basis.

## Boundary examples

- Pass: the learner says the sender display name looks wrong; the tutor selects the unmet "compare the full sender address" item.
- Pass: the learner offers only "Ok."; the tutor leaves `target_item_id` null instead of inventing a target.
- Fail: the learner states the padlock looked safe; the tutor selects the address item without acknowledging the lock misconception.
- Fail: the tutor selects a concept the learner already demonstrated in an earlier turn.

## Result format

Return one JSON object root-keyed by `transfer_trigger_target`:

```json
{"transfer_trigger_target": {"pass": true, "score": 1, "reason": "short observable evidence"}}
```

`pass` is boolean, `score` is `1` when pass and `0` when fail, and `reason` is a short nonempty observable justification. Inapplicability is not available for this rubric: every frozen case declares whether a target is expected.

## Error and missing handling

A judge transport error, an unparseable judge response, or an absent result is recorded as `error` or `missing` for this metric. Neither shrinks the denominator: the row keeps its full expected count and blocks acceptance.
