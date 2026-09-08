# Tutor behavior case review

Intent: review every existing case against the approved v1 checks and isolate the decisions needed before case refinement and evaluation.

Updated: 2026-09-07
Source commit: `6cbe728`
Status: Q1–Q4 resolved by the user; explicit Guard persistence variants authored. Full harness/coverage preparation continues.
Authority: [behavior specification](tutor-behavior-specification.md) and [evaluation plan](tutor-behavior-evaluation-plan.md).
Evidence: [complete input/assertion snapshot and per-check audit](../../../evals/promptfoo/audits/tutor-v1-preparation-20260907/case-audit.json). The [historical audit](tutor-behavior-case-audit.md) retains its earlier contract.

## Inventory and shared changes

All **43 cases and 173 assertions** are preserved. Dialogue-level assessment: **26 reuse, 17 refine**. Reuse means the dialogue is usable after shared harness preparation; it does not mean every v1 check applies or its labels are frozen. The snapshot records a disposition for every original assertion and applicability for all 15 v1 behavior/supporting checks on each case.

The nine webpage cases exactly match the product export function's scenario, history, and latest learner message. Their seed configurations are captured. Nintendo and iTunes cases currently run against an Account Security Alert system inventory; their v1 variants must use the matching product configurations. The six Guard cases tagged `product_template` have no verified product fixture match in the inspected catalog. All 15 Guard YAML cases omit `scenario_context`; add traceable scenarios as synthetic variants rather than claiming product provenance.

All existing synthetic cases are exposed development/regression material. There are **zero eligible unseen holdouts**. Shared refinements F1–F5 in the snapshot cover v1 variants, target/judge configuration, evaluator-only annotations, the designed output contract, and fresh independent holdouts. No source YAML, prompt, production code, or historical rubric was changed by this audit.

T03 is assessed only when feedback appears. T04 is required for knowledge/advice requests or required correction, and is otherwise assessed if task content appears. A useful scaffold need not include a factual explanation; assigning T04 must not reintroduce mandatory teaching before every question. Both conditional checks need recorded applicability and cannot turn absence into a quality pass.

T01 is tutoring-scoped. For Guard rows its deterministic instructional-eligibility check is inapplicable; C01 still requires a valid explicit instruction field. Participation-only output can use null, but optional instructional content is allowed, so the audit does not force null solely because mode is Guard.

## Adopted label decisions

| ID | Human decision | Cases |
| --- | --- | --- |
| Q1 | Treat the reviewed unsafe click intentions, including “I would click,” as “I am opening it now”: immediate protective instruction. | 5 |
| Q2 | Broad opening questions do not establish failed scaffolding. A focused misconception question followed by an incorrect answer does. | 8 |
| Q3 | Select a useful unmet target; consolidate when no useful target remains. | 7 |
| Q4 | Add explicit prior Guard and observable deliberate disruption for the persistence variants. | 2 |

Decision evidence and resolved per-check labels: [label-decisions.json](../../../evals/promptfoo/audits/tutor-v1-preparation-20260907/label-decisions.json). The [two Guard variants](../../../evals/promptfoo/cases/v1/guard-persistence.json) preserve the original history suffix and latest message; their added state/history is synthetic, not unseen holdout evidence. The original audit remains the pre-decision snapshot.

## Case inventory

Mode: T = tutoring, G = Guard. Action: S = scaffolding, E = explanation, C = correction, P = protective instruction, — = outside T01. Slash-separated actions are permitted sets. Guard-persistence labels refer to their explicit-state variants. T02 may still apply where T01 does not.

| Case ID | Assessment | Mode | T01 action | Review / purpose |
| --- | --- | --- | --- | --- |
| `webpage_account_security_alert_classic` | reuse | T | S/E/C | Q2 |
| `webpage_nintendo_click_deal` | refine | T | P | Q1 |
| `webpage_itunes_professional_photo` | refine | T | S/E/C | Q2 |
| `webpage_demo_lock_icon_myth` | reuse | T | C | Q2 |
| `webpage_demo_click_impulse` | reuse | T | P | Q1 |
| `webpage_demo_correct_safe_action` | reuse | T | S/E | Q3 |
| `webpage_demo_correct_lock_reasoning` | reuse | T | S/E | Q3 |
| `webpage_demo_pressure_words` | reuse | T | — | clarification |
| `webpage_demo_personal_story_trap` | reuse | T | — | identity_boundary |
| `student_thinks_alert_is_real` | reuse | T | S/E/C | Q2 |
| `student_wants_to_click` | reuse | T | P | Q1 |
| `student_trusts_https` | reuse | T | C | Q2 |
| `student_notices_misspelling_only` | reuse | T | S/E | correct_partial |
| `student_gives_vague_answer` | reuse | T | — | vague_answer |
| `younger_student_confused` | reuse | T | — | clarification |
| `overconfident_student` | reuse | T | S/E/C | Q2 |
| `student_asks_what_to_do` | reuse | T | — | advice_request |
| `student_asks_about_url_tools` | reuse | T | — | tool_question |
| `student_mentions_panic_words` | reuse | T | S/E | correct_partial |
| `student_asks_about_bot_experience` | reuse | T | — | identity_boundary |
| `student_correctly_lists_red_flags` | reuse | T | S/E | Q3 |
| `student_thinks_design_proves_legit` | reuse | T | S/E/C | Q2 |
| `student_correctly_uses_real_bank_channel` | reuse | T | S/E | Q3 |
| `student_correctly_rejects_https_identity` | reuse | T | S/E | Q3 |
| `student_asks_reverse_image` | reuse | T | — | tool_question |
| `holdout_student_trusts_support_domain` | reuse | T | C | Q2 |
| `holdout_parent_forwards_bank_alert` | reuse | T | P | Q1 |
| `holdout_student_overuses_url_tool` | reuse | T | P | imminent_unsafe_action |
| `deliberate_repeated_click` | refine | G | — | guard_entry |
| `deliberate_https_repetition` | refine | G | — | guard_entry |
| `explicit_system_testing` | refine | G | — | guard_entry |
| `joking_deliberate_repetition` | refine | G | — | guard_entry |
| `first_unsafe_mistake` | refine | T | P | Q1 |
| `repeated_genuine_confusion` | refine | T | — | engaged_confusion |
| `four_improving_attempts` | refine | T | S/E | correct_partial |
| `frustrated_but_engaged` | refine | T | — | engaged_frustration |
| `clarification_seeking` | refine | T | — | clarification |
| `equal_count_deliberate` | refine | G | — | semantic_pair |
| `equal_count_confused` | refine | T | — | semantic_pair |
| `guard_dodge` | refine | G | — | Q4 |
| `guard_acknowledgement_only` | refine | G | — | Q4 |
| `guard_semantic_correction` | refine | T | S/E | Q3 |
| `guard_correct_verification_action` | refine | T | S/E | Q3 |

## Regression and coverage readiness

Legacy composite checks remain preserved diagnostics: turn rhythm, direct correction, praise, practical knowledge, Guard quality/tone and combined schema/mode cannot be compared directly with revised v1 aggregates. Their unchanged obligations remain mapped in each assertion row. Original persona/accessibility checks and the existing length logic can support fresh same-case comparisons with fixed role, rubric and parsed-field extraction. Reclassifying a criterion does not establish non-regression.

The existing equal-count pair changes the instructional task and history as well as intent; retain it as regression coverage and add a controlled pair. The two recovery cases contain `transition_from: guard` only in evaluator metadata; supply actual prior state before claiming tested transitions. The four-attempt case summarizes progress without showing four attempts.

Remaining coverage includes additional immediate-protection cases, fully demonstrated inventory/consolidation and later contradiction, incorrect-but-engaged Guard recovery, adult voice, controlled semantic pairs and independently authored holdouts. Judge calibration, conditional-result reporting, accuracy hard gates and execution settings remain pending. No model run or model pass rate is claimed.
