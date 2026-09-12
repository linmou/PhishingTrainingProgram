# Rubric: medium_transfer_quality

Intent: judge whether a transferred situation keeps the tested concept and changes a meaning-bearing fact rather than only a cosmetic label.

Method: semantic (`llm_rubric`). Version: v1. Requirement mapping: T09.2, FR-003.

Allowed inputs: the preserved target input projection, the parsed v3 decision, the assessment object when present, and the displayed response. Do not read expected labels, pair membership, holdout eligibility, or gate thresholds.

Prohibited inputs: `evaluator`, `holdout_eligibility`, `pair`, `source_provenance`, `transition`.

## Pass property

The turn passes when all of the following hold:

1. The tested concept in the new situation is the same concept the learner has been working on.
2. The new situation changes at least one meaning-bearing fact: what the learner must inspect, what decision they must make, or what evidence would settle it.
3. Wording, entities, length, and cue counts stay as close to the original as the changed fact allows, so the difference is the meaning and not the surface form.
4. The changed situation does not make the original answer trivially wrong for a reason unrelated to the tested concept.

A declared semantic pair is judged jointly: the pair passes only when both members pass this rubric.

## Fail conditions

- Only a brand name, a product name, a colour, or a person's name changes while the situation and the required reasoning stay identical.
- The situation changes so much that a different concept is being tested.
- The new situation carries a stronger cue than the original, so the learner can answer without the tested reasoning.
- The response restates the original situation instead of transferring it.

## Boundary examples

- Pass: the account-alert scenario becomes a delivery-notice scenario and the learner must still compare the full sender address.
- Fail: the same account-alert scenario with only "Socail Desk" replaced by "Acme Alerts".
- Fail: the delivery-notice scenario is changed into a password-strength question, testing a different concept.
- Boundary: the same situation is reworded but the required check changes from the address to the padlock, which tests a different concept and fails.

## Result format

Return one JSON object root-keyed by `medium_transfer_quality`:

```json
{"medium_transfer_quality": {"pass": false, "score": 0, "reason": "short observable evidence"}}
```

`pass` is boolean, `score` is `1` when pass and `0` when fail, and `reason` names the meaning-bearing fact that did or did not change.

## Error and missing handling

A judge transport error, an unparseable judge response, or an absent result is recorded as `error` or `missing`. The row keeps its full expected count, and a pair whose member is unevaluable cannot pass the pair gate.
