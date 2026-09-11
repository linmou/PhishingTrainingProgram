# Transfer Rubric Registry Contract

**Intent**: pin the five public T09 semantic rubric IDs and the deterministic supporting check without merging independent evidence.

## Public metric registry

| ID | Method | Checked field/consumer | Pass property | Default gate |
| --- | --- | --- | --- | --- |
| `transfer_trigger_target` | `llm_rubric` | learner evidence, selected target, and decision | Eligibility follows learner-owned evidence without strong prior proof; at most one current relevant target is selected; other newly signaled concepts remain represented. | 80% overall and each required partition; declared hard constraints remain 100%. |
| `medium_transfer_quality` | `llm_rubric` | source context, changed context, assessment/spontaneous-transfer result | The meaning-bearing situation changes while the tested concept remains the same; cosmetic brand/name substitutions fail. | 80% applicable partitions; 100% for every declared semantic pair. |
| `assessment_item_validity` | `llm_rubric` | assessment stem, options, key/basis, and rendered item | Accurate, self-contained, target-relevant item with plausible options, no invented organization facts, no answer leakage, and consistent selection type/key. | 80%; safety-critical factual validity is 100%. |
| `assessment_followup` | `deterministic` | delivered-question lifecycle and ordered tutor turns | Delivery precedes grading; first valid answer resolves once; clarification remains open; assistance cancels without failure; feedback precedes another assessment; wrong answer alone does not trigger Guard. | 100%. |
| `verification_evidence` | `llm_rubric` | reason, transfer basis, source evidence references, original/changed contexts | The decision basis cites observable learner evidence and distinguishes original and changed contexts without invented facts. | 80%; H1/H4 violations are 100% hard failures. |

These five IDs are the only public T09 semantic rubric IDs in this component. Supporting contract validity, response length, exact grading, state-pair, ID, rendering, and privacy checks remain typed supporting evidence and must not be averaged into semantic scores.

## Deterministic supporting check

`t09_contract_and_progress` MUST cover:

- v3 response shape and reason-first serialization;
- allowed mode/instruction/assessment combinations and known target/message IDs;
- exactly four A-D options, key cardinality, normalized exact-set grading, and duplicate/order behavior;
- assessment rendering and stem limits;
- progress pair validity and no parallel mastery field;
- assessment as a tutor turn rather than a room mode;
- delivery-before-grading and first-resolution-only lifecycle invariants where the evaluator fixture supplies state.

It returns typed per-case results with `pass`, `fail`, `missing`, or `error`. It cannot be used to claim semantic medium transfer or evidence quality.

## Rubric input and output contract

Each rubric declaration includes `metric_id`, version, requirement mappings, allowed input fields, prohibited fields, applicability, pass/fail examples, judge settings/version, and error/missing handling. The judge receives the same preserved generation used by deterministic checks. It must return machine-readable `pass`, `score`, and concise observable `reason`; raw and parsed judge outputs are retained.

The target never receives expected labels, pair/holdout status, rubric instructions, or evaluator annotations. A missing semantic judge leaves that check `missing` or `error` and blocks full acceptance; deterministic checks may still run for diagnosis.

## Calibration contract

Before baseline acceptance, each semantic rubric is calibrated with annotated positive, negative, boundary, and contradictory outputs. Calibration records judge model/settings, rubric version, examples, human labels, judge labels, disagreements, adjudication, and unresolved errors. Calibration examples are not eligible holdouts.

## Joint and pair rules

- Join checks by run, case/version, repetition, turn, and target-generation identity.
- Evaluate both semantic-pair members jointly; one failing member fails the pair gate.
- Preserve joint outcomes and unevaluable counts; do not reconstruct them from marginal rates.
- A persuasive explanation does not override a wrong deterministic decision.
- An invalid/missing target output is a validity/execution issue, not a semantic pass or ordinary behavior failure.
