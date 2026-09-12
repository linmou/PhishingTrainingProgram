# Rubric: verification_evidence

Intent: judge whether the decision basis cites observable learner evidence and distinguishes the original context from the changed context without inventing facts.

Method: semantic (`llm_rubric`). Version: v1. Requirement mapping: T09.1, T09.2, FR-003.

Allowed inputs: the preserved target input projection, the parsed v3 `reason` and `decision`, the `transfer_basis` object when present, and the displayed response. Do not read expected labels, pair membership, holdout eligibility, or gate thresholds.

Prohibited inputs: `evaluator`, `holdout_eligibility`, `pair`, `source_provenance`, `transition`.

## Pass property

The turn passes when all of the following hold:

1. The stated basis cites evidence the learner actually produced, traceable to a supplied message, or states plainly that no learner evidence supports a target.
2. Original context and changed context are distinguishable: what the learner worked on and what the new item asks about are both visible in the basis.
3. Source evidence references are specific rather than a vague appeal to "the conversation".
4. No fact, previous warning, mastery level, or motive is invented.
5. Where a fact is uncertain, the basis states the uncertainty rather than asserting the fact.

## Fail conditions

- The basis asserts learner evidence that appears nowhere in the supplied history.
- The basis claims the learner has mastered or previously failed something the history does not show.
- Original and changed context are described with the same wording, so the transfer cannot be verified.
- The basis invents an organization fact or a message ID that was never supplied.
- The basis appeals to the tutor's own earlier statement as if it were learner evidence.

## Boundary examples

- Pass: the basis names the learner's own comparison of the full sender address as the reason the same check moves to a delivery notice.
- Fail: the basis claims "as you told me earlier, you always check the domain" when the history contains no such statement.
- Fail: the basis says only "based on the conversation" with no identifiable evidence.
- Boundary: a correct item whose basis cites the right concept but swaps the original and changed contexts, so the transfer direction is unverifiable; that fails.

## Result format

Return one JSON object root-keyed by `verification_evidence`:

```json
{"verification_evidence": {"pass": false, "score": 0, "reason": "short observable evidence"}}
```

## Error and missing handling

A judge transport error, an unparseable judge response, or an absent result is recorded as `error` or `missing`. An invented-fact violation is a hard failure and blocks acceptance.
