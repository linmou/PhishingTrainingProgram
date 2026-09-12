# Deterministic check: assessment_followup

Intent: declare the deterministic post-assessment lifecycle check that keeps delivery, answer resolution, clarification, assistance, feedback ordering, Guard scope, and failed-context reuse observable without semantic judgment.

Method: deterministic. Version: v1. Requirement mapping: T09.4, T09.5, T09.6, FR-003.

Allowed inputs: the declared transition sequence for the case, the ordered tutor turns with their item ids and mode, and the learner answer turns with their selected option ids and outcome. Do not read expected labels, holdout eligibility, or gate thresholds.

Prohibited inputs: `holdout_eligibility`. This check never calls a judge.

## Pass property

The sequence passes when every one of the following holds at the turn it applies to:

1. Delivery precedes grading: an answer is graded only after its question was delivered.
2. The first valid answer resolves the question exactly once; a later answer to the same delivered item is a second resolution and fails.
3. A clarification request leaves the question open, so a later answer still resolves it once.
4. An assistance request cancels the question without recording a behaviour failure, and a fresh question may follow.
5. Result-specific feedback precedes any later assessment; two consecutive deliveries without feedback fail.
6. A wrong answer alone never activates Guard: the participation mode stays `tutoring`.
7. A failed transfer is not immediately reused in the same context.

Each turn is reported with its state after the step, so a single final response can never replace the sequence evidence.

## Fail conditions and codes

| Code | Meaning |
| --- | --- |
| `graded_before_delivery` | An answer turn appears before any delivered question. |
| `resolved_twice` | A second answer resolves a question that is already resolved. |
| `feedback_precedes_assessment` | A question is delivered before result-specific feedback for the previous one. |
| `consecutive_assessments` | Two deliveries occur with no answer and no feedback between them. |
| `wrong_answer_guard` | The transition to Guard is explained only by a wrong answer. |
| `failed_context_reuse` | A failed item is re-delivered in the same context without intervening feedback. |
| `assistance_treated_as_failure` | An assistance request is recorded as a learner failure. |

`missing` and `error` are distinct from `fail`: an absent sequence is `missing`, and a malformed or unknown step kind is `error`, because neither is an observed behaviour failure.

## Calibration

Calibration is not applicable. This check is covered by deterministic lifecycle fixtures instead of judge calibration, so `assessment_followup` is excluded from semantic judge calibration and its `calibration` declaration records that exclusion.

## Result format

The check returns a typed record:

```json
{"metric": "assessment_followup", "method": "deterministic", "status": "fail", "failures": [{"code": "resolved_twice", "turn": 2, "actual": {"turn": 2, "kind": "learner_answer"}}], "steps": [], "resolved_turns": [1, 2], "cancellations": []}
```

## Error and missing handling

The check is required at 100%: every declared sequence must pass in every repetition. A missing or errored sequence stays in the denominator and blocks acceptance as `incomplete`.
