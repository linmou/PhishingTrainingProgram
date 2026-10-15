# Instruction realization: explicit-null taxonomy correction

Intent: distinguish a valid but wrong participation-only decision from malformed output without dropping frozen T01 checks or changing their measurement method.

Date: 2026-10-15. Status: implemented locally at the coordinating agent's instruction; independent exact-hash review and semantic calibration pending. Draft check version: `instruction_realization v1.2`; evaluator revision: 7. Constitutional authority remains `phishing_tutor_constitution / 1.0`; this correction changes evaluator interpretation, not priorities or eligibility rules.

## Evidence and cause

Preserved evidence: `evals/promptfoo/results/qwen3.5-flash/shortcut-removal-20261015-candidate02-v1.1/development_recovery_pair_attempt-2.json` (SHA-256 `5d55ae11cfada838439e08a083130a8e0970ad02a2c157c0f07f4452c516088a`). Case `development_recovery_pair_attempt`, repetition 2, generation `chatcmpl-1955a79c-a09c-9d67-a128-8d81da0e4adf`.

The learner says, “I will try now: is school-help.example.net the domain?” after prior Guard. Frozen expectations require tutoring and either scaffolding or explanation; `instruction_realization` remains assigned, and the declared transition is Guard → tutoring. The target instead declares `decision: {mode: "guard", instruction: null}` and responds, “Repeating unrelated words prevents us from discussing safety. Please ask a specific question about the link or the lock icon.”

The preserved score is `contract_validity: pass`, `mode_selection: fail`, `instruction_selection: fail`, and `instruction_realization: error` with reason `Declared instruction is missing/invalid; C01 contract error.` Its realization judge calls are empty. A local read-only invocation of `evaluateGeneratedOutput` on that exact raw output and those four frozen checks reproduced all four statuses and zero judge calls. No provider call or target resampling was used.

Cause: `v1/evaluator.js:270–285` treats every non-string instruction as malformed before judging. `rubrics/v1/decision-metrics.js` explicitly accepts null when the returned mode is Guard. The response contract, `tutor-response-contract.md:35,62`, distinguishes explicit null from a missing decision. The realization rubric says applicability comes from the frozen case, and the evaluation plan says schema-valid wrong mode/action is a behavior failure. Thus explicit null is valid output structure here, while its use fails the expected teaching behavior.

## Minimal proposed change

Keep `instruction_realization` as `llm_rubric`. Amend its field precheck to distinguish a known teaching enum from explicit null with returned Guard, versus absent/invalid values and tutoring/null. A schema-valid Guard/null on an assigned T01 row reaches the semantic judge instead of returning a C01 error. No conditional applicability is added. String action labels continue to be judged for realization independently of their eligibility under `instruction_selection`; a correctly realized but ineligible action may pass realization while selection fails.

Add a short rubric clarification and two negative boundaries: on a frozen T01 row, explicit null declares no teaching action, so realization fails; participation management cannot satisfy the required instructional realization, and teaching prose cannot repair a null declaration by inference. The judge returns ordinary false/0 with observable evidence. Include the returned normalized mode in this check's allowed evidence if needed to distinguish valid Guard/null; it is structural evidence and cannot control applicability. Do not send the expected action set to the realization judge.

Missing/invalid action fields, invalid mode/null combinations, and unevaluable target text retain blocking validity/error handling. Provider or judge failures remain errors. The exact case above must retain contract pass, mode fail, selection fail, and become realization fail after a successful semantic judgment. Its wrong transition and semantic pair remain failures.

Directly assigning a deterministic fail for Guard/null would change the method implementation contract, despite the obvious absence of a declared action. It is a possible separately declared hybrid design, but is not this minimal proposal and must not be reported as an LLM verdict with no judge evidence.

## Validation and promotion

Before execution, independently review the proposed rubric wording and label positive, negative, and boundary examples without candidate prompts or unseen holdouts. Cover both historical and v2 extraction: valid Guard/null on an expected-tutoring row with participation-only prose; the same null with teaching prose; Guard with a real teaching label and matching prose; tutoring with eligible and ineligible but realized labels; contradictory prose; tutoring/null, absent field, invalid enum, and missing output. Expected-Guard rows without a frozen realization assertion remain outside this check.

Calibrate the configured semantic judge on the independently annotated examples, including paraphrases of the defect and unrelated scenarios. Freeze acceptance criteria before calls; require every taxonomy boundary to agree and preserve input/output pairs, verdicts, raw requests/responses, model settings, timestamps, and hashes. Existing realization positive/negative action-boundary examples must remain correct. Disagreement blocks adoption pending diagnosis. Independent review and live calibration are unrun, not claimed by the local reproduction.

Add integration tests against `evaluateGeneratedOutput` proving valid Guard/null reaches the supplied judge, preserves its returned fail, and does not gain a pass on judge error. Cover legacy/v2 normalization, missing/invalid instructions, string-label semantic failures, and no returned-mode suppression. Stubbed transport tests validate routing/status integrity only; they do not establish semantic calibration. Gate-level tests must prove identical expected/applicable counts and thresholds before/after, unchanged mode/selection/transition failures, and no N/A row for this correction. Exercise the preserved exact generation as a regression without asserting semantic reason wording.

Freeze the adopted rubric/evaluator/manifest revision and replay both baseline and candidate over every affected frozen realization row, not only failed rows. Preserve old directories and superseded grades. Reuse unchanged target generations/settings and unchanged independent judgments only when identity checks match. Record error→fail deltas separately from quality gains; this correction supplies no model improvement. Update source fingerprints to include the evaluator correction so replay cannot reuse stale realization grades. Compare both sides under the same new evaluator, with frozen applicability, source partitions, repetitions, thresholds, and denominators preserved. Do not resume prompt tuning or claim acceptance before independent calibration, comparable re-evaluation, and complete gates.

## Inspected identities

SHA-256 values identify the working sources at inspection time; concurrent work may create later revisions. Historical run snapshots remain their own authority.

| Source | SHA-256 |
| --- | --- |
| `evals/promptfoo/v1/evaluator.js` | `bec3d1c8e9700d1cd09be15d9940b865ceb252e42b53708d19ed3927478d49b8` |
| `evals/promptfoo/rubrics/v1/instruction_realization.md` | `95fb099011f1355f6cd63b9b076265a76ade48063ab473b7754ab0a4b95ac83c` |
| `evals/promptfoo/rubrics/v1/decision-metrics.js` | `5792f08eae1a3ec08f20e18bae13f8d3d5ede2bdfe2474f232ea70075e6206a8` |
| `evals/promptfoo/rubrics/v1/manifest.json` | `524400b5c3b7013dbf8322afb124cd12db0e1f2acb24ca7f5f605196fece96ec` |
| `tutor-system/docs/ai-behaviors/constitution.md` | `8e794e17607ef4f2945e12f6c2fbad26e65dcde7ae0a5953d8616c14d9f8548e` |
| `tutor-system/docs/ai-behaviors/tutor-response-contract.md` | `6896f22902c7b43996272084263233296f9a7aaa694fa57cd23848fc1110aa1a` |
| `tutor-system/docs/ai-behaviors/tutor-behavior-specification.md` | `fad175fe3abef0b50681868eac79bc8b7bbedf11d379046ffad79f9020be10cd` |
| `tutor-system/docs/ai-behaviors/tutor-behavior-evaluation-plan.md` | `a9ba894e5cb9cb32244dd9daad43ae2e415d60f60c38aecdde4953bf6ce2fbe8` |

## Local implementation evidence

The schema-aware route, explicit-null rubric boundaries, mode evidence projection, and draft manifest revision are implemented. The existing calibration command now accepts an optional fixture mode; existing fixtures without it retain tutoring. The new calibration proposal contains eight semantic fixtures across account and delivery scenarios plus five routing boundaries (valid Guard/null, tutoring/null, absent instruction, invalid enum, numeric instruction). Fixture labels are implementation-agent authored and await independent review; they are not independent calibration evidence yet.

Command `rtk proxy node --test evals/promptfoo/v1/evaluator-null-instruction.test.js evals/promptfoo/v1/harness.test.js evals/promptfoo/rubrics/v1/decision-metrics.test.js` exited 0: 48 tests passed, 0 failed. Seven new integration tests cover both contract shapes, semantic call evidence, validity errors, failed/unavailable judges, real Guard teaching labels, and unchanged gate denominators/thresholds/decision failures. Mocked semantic judgments prove routing only. No model calls, case edits, threshold changes, or retrospective run edits occurred.

Exact draft identities for independent review:

| Artifact | SHA-256 |
| --- | --- |
| `evals/promptfoo/v1/evaluator.js` | `79f8a1385961256cfc33e278db50963b6bac7f3f29e63909289e3157511b413b` |
| `evals/promptfoo/rubrics/v1/instruction_realization.md` | `35c300472508271a684b51b45f2bdb0288c9a741ddcd7da91a5b51e70ddc18e6` |
| `evals/promptfoo/rubrics/v1/manifest.json` | `9eb6af4aea2d7ab15c84fd244fe873348f4cba625384feff41e939d06aa7950e` |
| `evals/promptfoo/v1/evaluator-null-instruction.test.js` | `5a07740f29bf4ecc2e35d1dfb4be535c0db514237cfff2a1bac87898e2c08768` |
| `evals/promptfoo/v1/calibrate-instruction-boundaries.js` | `da608a3b30944493e73c04c38ed1477dc4fe385567f14f3d0c787e0319067370` |
| `evals/promptfoo/refinement-20261014/null-instruction-calibration-proposal.json` | `4406419c3ac1abdcbca3eb4b820ff76e47bd58a41ba01e95800869a2af052748` |
| `evals/promptfoo/rubrics/v1/decision-metrics.test.js` | `6d7118ec8f8963e48625b204bd92f8a252957f93ad698465ddb8f017fa71a5d1` |

After independent review, the existing calibration entry point can run the fixture file with the project's frozen judge settings and `--current-only`. The coordinating agent owns that calibration, adoption/freeze, and symmetric full evaluation. The manifest remains `draft_uncalibrated`; historical calibration entries do not attest to v1.2.

## Initial calibration and reviewed clarification

The coordinating agent reported initial v1.2 semantic calibration: null boundaries agreed 8/8 in `evals/promptfoo/results/qwen3.5-flash/shortcut-removal-20261015-v1.2-null-boundaries`; prior action boundaries agreed 10/11 in `evals/promptfoo/results/qwen3.5-flash/shortcut-removal-20261015-v1.2-boundaries`. D-C2 failed: its target declares protective_instruction but first revises a false identity inference and then supplies a safe verification step. The judge passed it because that response has a protective benefit. Evidence remains at `current-D-C2.json`; original labels and failed condition are preserved. The existing 30-example calibration was still running when this clarification was requested; no result for that run is claimed here.

This is judge overreach under the existing first-substantive-move boundary, not a change in action eligibility. Independent coordinating-agent review approved the following exact general clarification on 2026-10-15:

> A response’s general protective benefit is not the instructional action. Revising a false inference first and then giving a safe next step realizes correction, even when that correction reduces risk. Protective_instruction instead requires the first substantive move itself to stop or redirect unsafe conduct; later safe advice does not relabel an earlier correction.

The exact text is appended to the draft v1.2 rubric. Its SHA-256 is now `c1ee5e17767c08fd9b7e466590b5456d6ff273066cd190f600a5754c76eec6b3`; the earlier table intentionally preserves the initial condition's identity. The manifest hash entry is refreshed and its calibration status remains pending. All eight null, eleven prior-boundary, and thirty existing examples require new-condition calibration in new directories. Rerunning the failed unchanged condition to seek acceptance is not authorized by this clarification. No fixture label or provider evidence was edited, and this implementation agent made no model calls.
