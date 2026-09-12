# Rubric: assessment_item_validity

Intent: judge whether a candidate assessment item is accurate, self-contained, relevant, and non-invented.

Method: semantic (`llm_rubric`). Version: v1. Requirement mapping: T09.2, T09.3, FR-003.

Allowed inputs: the preserved target input projection, the parsed v3 decision, the `assessment` object (stem, options, selection_type, correct_option_ids, transfer_basis), and the rendered text. Do not read expected labels, pair membership, holdout eligibility, or gate thresholds.

Prohibited inputs: `evaluator`, `holdout_eligibility`, `pair`, `source_provenance`, `transition`.

## Pass property

The item passes when all of the following hold:

1. The stem is answerable from the stem and options alone, without the tutor's private reasoning.
2. The correct option is genuinely correct and each distractor is plausible but wrong for a reason the learner can inspect.
3. The item is relevant to the configured learning target it claims to assess.
4. No organization, product, person, or statistic is invented. Every entity comes from the supplied context.
5. The key is consistent with the declared selection type: exactly one correct option for `single`, at least two for `multiple`.
6. The item does not leak the answer in the stem, in an option label, or in an odd-one-out surface pattern.
7. The item does not depend on the suspect link being opened or on any unsafe action.

## Fail conditions

- A factual claim in the stem or an option is false.
- The item names an organization, product, or statistic that the supplied context never contains.
- The declared key contradicts the declared selection type.
- The answer is recoverable from the stem wording without understanding the concept.
- The item tests a different concept than the one it claims to transfer.
- Answering correctly requires opening or trusting the suspect resource.

## Boundary examples

- Pass: a single-selection item whose key is the stated check, with three distractors that each name a different real check from the configured inventory.
- Fail: a single-selection item with two correct options.
- Fail: a stem that invents a bank name that never appears in the supplied context.
- Boundary: an accurate item whose distractors are all obviously absurd, so the key is free; that fails the plausibility requirement.

## Result format

Return one JSON object root-keyed by `assessment_item_validity`:

```json
{"assessment_item_validity": {"pass": true, "score": 1, "reason": "short observable evidence"}}
```

## Error and missing handling

A judge transport error, an unparseable judge response, or an absent result is recorded as `error` or `missing`. A factual-validity failure is a hard failure for the case and blocks acceptance rather than being averaged into a rate.
