# Tutor evaluator versions

Intent: separate legacy v0 evidence from specification-derived v1 checks without silently changing an existing benchmark.

Updated: 2026-09-07
Commit ID: `ba95540` (pre-change baseline; this update's containing commit is recorded in Git history).

## Version ownership

| Location | Meaning | Execution status |
| --- | --- | --- |
| [v0/manifest.json](v0/manifest.json) | Byte-for-byte snapshots of the 11 legacy Markdown rubrics and two deterministic scripts, with original paths and hashes. | Historical contract. Root Markdown and original script paths remain unchanged entrypoints for the existing 43 cases / 173 assertions. |
| [v1/manifest.json](v1/manifest.json) | Specification-derived semantic rubrics and independent deterministic decision/contract checks. | Preparation revision, not a frozen/calibrated benchmark or an experimental behavior-spec version. |

The previous `tutor-behavior/` drafts were relocated to `v1/`. New authoring belongs in v1; do not edit the unversioned legacy entrypoints or v0 snapshots. The active Promptfoo config has not been switched. Pin file hashes when freezing a run; scores under different rubric versions are not directly comparable evidence of improvement.

v1 Markdown files contain only LLM-facing judging instructions, criteria, and examples. Titles, intent, IDs, requirement mappings, version, and calibration/readiness status live in the manifest; do not inject that bookkeeping into judge prompts. v0 remains an exact archive, including its historical formatting.

## Responsibility changes

- v0 `turn_rhythm` has no composite v1 replacement. T01 uses deterministic [instruction_selection](v1/instruction_selection.js) plus [direct_correction](v1/direct_correction.md) for action realization. T02 uses [learning_state_target](v1/learning_state_target.md) for learner-evidenced target choice. The old mixed rubric remains available for historical analysis, not as the definition of v1 behavior.
- v0 `guard_response_quality` becomes v1 [disruption_correction](v1/disruption_correction.md) for G02 only. v1 [guard_tone_safety](v1/guard_tone_safety.md) owns G03 delivery. Neither requires task knowledge or a safe action merely because Guard applies. T04 still governs any knowledge actually supplied in either mode.
- v0's combined schema/mode function is preserved, not reused as two independent v1 metrics. v1 [mode_selection](v1/mode_selection.js) checks G01; [contract_validity](v1/contract_validity.js) is a separate supporting check.
- [decision_reasoning](v1/decision_reasoning.md) covers C01's broader explanation; the v0 mode-reason rubric does not prove this new field's quality.

Preserve existing assertions and failure evidence. The user's 2026-09-07 decisions authorize these responsibility changes, not retroactive regrading. Audit retained comparable checks and superseded criteria before wiring v1; baseline and candidate must use the same v1 snapshots/settings, while historical v0 results remain labeled v0.

## Deterministic check use

The three v1 JavaScript entrypoints accept preserved raw JSON text and a Promptfoo-style `context`. `mode_selection` reads `context.vars.expected_mode`; `instruction_selection` reads `context.vars.expected_instruction`. Each accepts a single label or a nonempty allowed set; explicit null is an allowed expected instruction for participation-only Guard. `contract_validity` needs no expected behavior label.

Expected labels are evaluator-only annotations derived from the specification, with rationale and human-review status required before freezing. They must never be rendered into target requests. The checks do not infer labels from free text or call an LLM.

Each result preserves metric ID, deterministic method, status (`pass`, `fail`, `error`, `missing`), pass/score, expected and actual values, and a reason. Missing labels or output cannot pass. A valid but wrong decision fails; malformed output is an error. A valid individual decision can pass while C01 fails elsewhere in the same object: separate reporting prevents schema/mode double-counting, and the supporting validity gate still blocks acceptance.

The LLM rubric separately checks that the wording realizes the declared instruction; a correct declaration alone cannot establish behavior conformance. Neither evaluator overrides the other. The active gate still needs manifest-based coverage, typed-result preservation, same-case non-regression, and pair/transition integration before v1 acceptance runs.

Local check validation, without model calls:

```sh
rtk proxy node --test evals/promptfoo/rubrics/v1/decision-metrics.test.js
```

This validates evaluator logic, not tutor behavior or LLM judge calibration. Full preparation and gates are owned by the [evaluation plan](../../../tutor-system/claude_docs/ai-behaviors/tutor-behavior-evaluation-plan.md).
