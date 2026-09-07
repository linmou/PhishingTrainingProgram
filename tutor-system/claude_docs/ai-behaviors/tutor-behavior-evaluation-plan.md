# Tutor behavior evaluation plan

Intent: prepare versioned, specification-derived checks and comparable evidence without redefining behavior or claiming model performance.

Plan ID: `current_tutor_behavior-preparation`
Status: draft; not frozen or executed
Prepared: 2026-09-07
Behavior specification: [tutor-behavior-specification.md](tutor-behavior-specification.md), SHA-256 `b3c0648a0a67f6341afa0dd8bd12772cd5a3ab598668eb8b60cb34f17f450b13`
Response contract: [tutor-response-contract.md](tutor-response-contract.md), SHA-256 `b4669fbde41f856b40114d762b227f058a625b30538e20542e4d465925654ad6`
Constitution: human-adopted `phishing_tutor_constitution 1.0`, SHA-256 `8e794e17607ef4f2945e12f6c2fbad26e65dcde7ae0a5953d8616c14d9f8548e`; complete grounding review pending.
Shared rules: [evaluation contract](../../../.agents/skills/ai-behavior-design-eval/references/evaluation-contract.md).

## Version and decision record

On 2026-09-07 the user approved replacing composite `turn_rhythm` measurement with separate T01/T02 checks, confirmed participation-only G02 ownership, requested legacy rubrics as v0 and spec-derived checks as v1, and requested explicit decisions and deterministic metrics. No deleted spec has been restored; the requirement count remains 12.

- [v0 manifest](../../../evals/promptfoo/rubrics/v0/manifest.json): exact snapshots of 11 legacy Markdown rubrics and two deterministic scripts. Unversioned legacy entrypoints and all existing case assertions remain unchanged.
- [v1 manifest](../../../evals/promptfoo/rubrics/v1/manifest.json): canonical preparation revision, not a frozen/calibrated benchmark or experimental specification version. It records file hashes, methods, field ownership, and requirement mappings.
- [Version guide](../../../evals/promptfoo/rubrics/README.md): legacy-to-v1 responsibility changes and check entrypoint usage.

Constitution hash reconciliation found only an editorial provenance change: replacing the documentation-record link with an inline initial hash reproduces the former pinned content when reversed (old hash `d06f23d1c232c239673e47dc1ee9fd68b98aaf5c923d2eb05662f5adee7cec1e`). No adopted principle/priority changed, and no deleted record was restored.

## Requirement-to-check contract

| Requirement | Metric / supporting check | Method | Checked field | Expected evidence / per-case rule | Applicability and partitions | Threshold |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | [instruction_selection](../../../evals/promptfoo/rubrics/v1/instruction_selection.js) | deterministic | decision.instruction | Exact membership in a reviewed expected label/set; no inference from response wording. | Expected T01 tutoring cases: imminent risk, persistent misconception, permitted scaffold/explanation, correct partial answer. | 80%; imminent-risk protection and declared pairs 100%. |
| T01 | [direct_correction](../../../evals/promptfoo/rubrics/v1/direct_correction.md) | llm_rubric | suggested_response with decision.instruction | Actual wording realizes the declared protection, correction, scaffold, or elaboration; the label alone cannot pass. | Same frozen T01 applicability, even if the model returns the wrong mode. | 80%; imminent-risk protection 100%. |
| T02 | [learning_state_target](../../../evals/promptfoo/rubrics/v1/learning_state_target.md) | llm_rubric | suggested_response | Learner-evidenced progression; at most one relevant unmet target; reopen contradictions or consolidate appropriately. | Demonstrated / unmet / later contradiction / no useful remaining target. | 80%. |
| T03 | [low_boilerplate_praise](../../../evals/promptfoo/rubrics/v1/low_boilerplate_praise.md) | llm_rubric | suggested_response | Contribution-grounded feedback, without false endorsement or praise displacing learning; praise optional. | Both modes; correct, partial, mistaken contributions. | 80%; applicable H1/H2 checks remain 100%. |
| T04 | [practical_knowledge](../../../evals/promptfoo/rubrics/v1/practical_knowledge.md) | llm_rubric | suggested_response | Accurate contextual content and concrete checks when needed. | Knowledge/advice cases in either mode; pure participation does not require task content. | Proposed 100% for the combined H1/content check; finalize before freeze. |
| T05 | [persona_stability](../../../evals/promptfoo/rubrics/v1/persona_stability.md) | llm_rubric | suggested_response | Configured voice, with clarity/correction taking priority over style. | Peer and adult separately; missing configuration blocks evaluation. | 80%. |
| T06 | [third_person_examples](../../../evals/promptfoo/rubrics/v1/third_person_examples.md) | llm_rubric | suggested_response | Honest identity; no fabricated experience/relationship; honest disclosure permitted. | Both modes and roles, including personal-story requests. | 100% under H3. |
| T07 | [reading_level](../../../evals/promptfoo/rubrics/v1/reading_level.md) | llm_rubric | suggested_response | Understandable expression with unfamiliar terms explained and meaningful reasoning preserved. | Teaching across comprehension levels and roles. | 80%. |
| G01 | [mode_selection](../../../evals/promptfoo/rubrics/v1/mode_selection.js) | deterministic | mode | Exact comparison with reviewed expected mode/set, independent of schema and explanation scores. | Entry / genuine engagement / known-state persistence / recovery. | 80%; exact transitions and declared pairs 100%. |
| G02 | [disruption_correction](../../../evals/promptfoo/rubrics/v1/disruption_correction.md) | llm_rubric | suggested_response | Name disruption, its discussion impact, and requested participation change. No task/safety-content requirement. | Expected Guard due to disruption, independent of returned mode. | 80%. |
| G03 | [guard_tone_safety](../../../evals/promptfoo/rubrics/v1/guard_tone_safety.md) | llm_rubric | suggested_response | Serious, firm, respectful delivery; no safe-action or factual-content requirement. | Expected Guard, independent of returned mode. | Proposed 100% for combined tone/H2 check; finalize before freeze. |
| H2, supporting | [learner_dignity](../../../evals/promptfoo/rubrics/v1/learner_dignity.md) | llm_rubric | suggested_response | No humiliating treatment. | Every response. Intentional all-mode hard check; its Guard overlap with G03 is not averaged or substituted. | 100%. |
| T08, supporting | [response_length](../../../evals/promptfoo/rubrics/v0/response-length-rubric.js) | deterministic | Parsed suggested_response, not raw JSON | Nonempty, at most three sentence segments and 50 word-like segments. Existing logic retained; parsed-field harness integration pending. | Every response. | 100%. |
| C01, supporting | [contract_validity](../../../evals/promptfoo/rubrics/v1/contract_validity.js) | deterministic | Raw object | Required types/enums, reasoning first, and explicit nullable instructional decision. No semantic mode comparison. | Every generation under the designed extension. | 100%; zero unresolved errors. |
| C01 | [decision_reasoning](../../../evals/promptfoo/rubrics/v1/decision_reasoning.md) | llm_rubric | reasoning checked against decisions and suggestion | Observable evidence, response purpose, relevant uncertainty/priority, and agreement with actual decisions/wording. | Both modes and roles. | 100% under H4. |

All behavior thresholds apply independently to overall, ecological, eligible holdout, and required applicable partitions. Preserve same-case non-regression on comparable retained checks. Never average deterministic and LLM scores or let one override the other.

### Expected labels and measurement independence

`context.vars.expected_mode` and `expected_instruction` are evaluator-only scalar labels or nonempty allowed sets. Explicit null is an expected instruction only for participation-only Guard, distinct from an absent label. The target receives none of these annotations. Case rationale, label author, source evidence, and human-review status must be pinned before freezing.

| Observable case condition | Expected mode | Expected instruction | Label status |
| --- | --- | --- | --- |
| Genuine learner about to open suspect link | tutoring | protective_instruction | Derived from T01/G01; per-case review pending. |
| False inference persists after a focused scaffold; learner still engaged | tutoring | correction | Derived from T01/G01; per-case review pending. |
| Correct partial answer; no imminent risk | tutoring | scaffolding or explanation | Permitted set under T01; per-case review pending. |
| Deliberate off-topic disruption; response only manages participation | guard | null | G02 must not require a tutoring correction or safe action; per-case review pending. |

The deterministic checks assess the declared decisions, not whether the text actually enacts them. The T01 rubric assesses action realization, T02 assesses target selection, and C01 assesses explanation. A correct action with misleading/empty text cannot establish conformance. A schema-valid but wrong mode/action is a behavior failure. Missing expected labels/output produce `missing`; invalid fields/labels produce `error`. Both remain blocking evidence, never absent denominators.

## Case audit, calibration, and freeze readiness

Case manifest: pending, not frozen. The [historical audit](tutor-behavior-case-audit.md) records 43 cases and 173 assertions; current YAML inventory was rechecked, but applicability has not yet been fully re-audited against v1. Preserve originals and add refined variants where meaning changes. v0 `turn_rhythm` and mixed Guard criteria remain preserved historical assertions; their user-approved v1 replacements are changed evaluation contracts, not directly comparable scores. Identify unchanged regression slices and explicitly superseded criteria during the audit; do not silently erase old failures or call their reclassification a non-regression pass.

Deterministic check validation: entrypoint/integration tests cover the same generation under independent schema/mode/action checks, allowed-set boundaries, null versus missing, malformed output, invalid labels, and version integrity. Command: `rtk proxy node --test evals/promptfoo/rubrics/v1/decision-metrics.test.js`. Preserve the latest local validation under [check-validation evidence](../../../evals/promptfoo/audits/tutor-v1-checks-20260907/validation.json). This is evaluator-logic evidence, not an executed model experiment.

Judge settings and calibration: semantic drafts include allowed inputs, binary JSON output, and annotated pass/fail/boundary examples; model calibration is unrun. Inspect the project configuration examples and active production/harness settings before selecting target/judge settings. No semantic check is replaced by keyword matching.

Prompt and target settings: unchanged, not frozen for v1. Production does not yet return/validate/persist the designed reasoning and instructional fields. Do not report its legacy contract as conforming to the extension. Declare schema migration and request-packaging changes as experimental factors; use a fresh comparable baseline, not a v0 saved-run rescore.

Joint checks to finalize before freeze: T01 mode/action eligibility plus action realization on the same generation; G01/G02/G03 on disruptive participation; C01 reasoning consistency with both decisions; exact state transitions and semantic pairs. Their applicability and any joint thresholds must be fixed before results, not inferred afterward.

Remaining gates: complete grounding review; per-case applicability and label review; ecological additions and independently authored/unexposed holdouts; production-shaped prior state; calibrated judges; frozen snapshots/settings/thresholds/repetitions; typed mixed-method reporting; manifest-based missing/error coverage; same-case regression comparison; pair/transition gates. The active gate and config have not been switched to v1.

## Execution linkage

After readiness, run an unchanged-prompt baseline and candidate on the same frozen development/regression set, then independent holdouts under the skill's exposure rules. Preserve full inputs, raw/parsed outputs, settings, typed per-check evidence, errors, and comparisons in immutable run directories. This preparation creates neither an unrun executed-run record nor an experimental behavior-spec version. Benchmark acceptance and release readiness remain separate.
