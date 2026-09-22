# Transfer Rubric Registry Contract

**Intent**: pin the six public T09 rubric IDs and two deterministic supporting checks without merging independent evidence.

## Public metric registry

| ID | Method | Checked field/consumer | Pass property | Default gate |
| --- | --- | --- | --- | --- |
| `transfer_trigger_target` | `llm_rubric` | learner evidence, selected target, and decision | Eligibility follows learner-owned evidence without strong prior proof; at most one current relevant target is selected; other newly signaled concepts remain represented. | 80% overall and each required partition; declared hard constraints remain 100%. |
| `medium_transfer_quality` | `llm_rubric` | source context, changed context, assessment/spontaneous-transfer result | The meaning-bearing situation changes while the tested concept remains the same; cosmetic brand/name substitutions fail. | 80% applicable partitions; 100% for every declared semantic pair. |
| `assessment_item_validity` | `llm_rubric` | assessment stem, options, key/basis, and rendered item | Accurate, self-contained, target-relevant item with plausible options, no invented organization facts, no answer leakage, and consistent selection type/key. | 80%; safety-critical factual validity is 100%. |
| `assessment_followup` | `deterministic` | delivered-question lifecycle and ordered tutor turns | Delivery precedes grading; first wrong remains open; correct on either of two attempts passes; second wrong fails; non-consuming/replay cases preserve state; feedback precedes another assessment. | 100%. |
| `verification_evidence` | `llm_rubric` | reason, transfer basis, source evidence references, original/changed contexts | The decision basis cites observable learner evidence and distinguishes original and changed contexts without invented facts. | 80%; H1/H4 violations are 100% hard failures. |
| `learner_explanation_quality` | `llm_rubric` | reviewed learner-safe explanation, correct option, concept rule, and changed context | The reviewed explanation accurately connects the correct answer to the tested concept and scenario, does not contradict the key, and remains learner-appropriate without exposing private reasoning or unrelated learner data. | 80% overall and each required partition; declared factual/privacy hard cases are 100%. |

These six IDs are the public T09 rubric IDs in this upgrade. Five are semantic and `assessment_followup` is deterministic. Supporting contract validity, disclosure, response length, exact grading, state-pair, ID, rendering, and privacy checks remain typed supporting evidence and must not be averaged into semantic scores.

## Deterministic supporting check

`t09_contract_and_progress` MUST cover:

- v3 response shape and reason-first serialization;
- allowed mode/instruction/assessment combinations and known target/message IDs;
- exactly four A-D options, key cardinality, normalized exact-set grading, and duplicate/order behavior;
- assessment rendering and stem limits;
- progress pair validity and no parallel mastery field;
- assessment as a tutor turn rather than a room mode;
- delivery-before-grading and the promoted two-attempt lifecycle where the evaluator fixture supplies authoritative state.
- promoted 101/102 two-attempt outcome/state compatibility and exactly one terminal progress transition.

It returns typed per-case results with `pass`, `fail`, `missing`, or `error`. It cannot be used to claim semantic medium transfer or evidence quality.

`learner_explanation_disclosure` MUST cover:

- no `correct_option_ids` or `learner_safe_explanation` in delivery, first-incorrect, or pass projections;
- both fields in the authorized learner's second-incorrect terminal projection;
- no transfer basis, model rationale, raw output, credentials, unrelated learner data, or other private fields in learner projections;
- generated/reviewed explanation provenance and equality between the reviewed value and terminal learner value;
- explicit fail/missing/error evidence for leakage, partial terminal feedback, or missing provenance.

The check compares explicit DTO allowlists, stage, identity, and source provenance. It does not use keyword matching as a semantic-quality substitute.

## Rubric input and output contract

Each rubric declaration includes `metric_id`, version, requirement mappings, allowed input fields, prohibited fields, applicability, pass/fail examples, judge settings/version, and error/missing handling. The judge receives the same preserved generation used by deterministic checks. It must return machine-readable `pass`, `score`, and concise observable `reason`; raw and parsed judge outputs are retained.

Every check scores the same preserved generation built through the pinned component-102-owned v3 request/context contract in `ecologicalTutorCall.ts`, with the backend production prompt reference/hash and effective 1,200-token budget recorded in the run manifest. The evaluation layer does not rebuild that request or prompt. The target never receives expected labels, pair/holdout status, rubric instructions, or evaluator annotations. A missing semantic judge leaves that check `missing` or `error` and blocks full acceptance; deterministic checks may still run for diagnosis.

## Calibration contract

Before baseline acceptance, each of the five semantic rubrics is calibrated with annotated positive, negative, boundary, and contradictory outputs. `learner_explanation_quality` additionally includes missing, irrelevant, key-inconsistent, privacy-unsafe, and teacher-edited examples. Calibration records target/judge model (`qwen3.5-flash`), DashScope-compatible provider settings, rubric version, examples, human labels, judge labels, disagreements, adjudication, and unresolved errors. `assessment_followup` and supporting checks use deterministic fixtures. Calibration examples are not eligible holdouts.

## Joint and pair rules

- Join checks by run, case/version, repetition, turn, and target-generation identity.
- Evaluate both semantic-pair members jointly; one failing member fails the pair gate.
- Preserve joint outcomes and unevaluable counts; do not reconstruct them from marginal rates.
- A persuasive explanation does not override a wrong deterministic decision.
- An invalid/missing target output is a validity/execution issue, not a semantic pass or ordinary behavior failure.
