# Component-specific tutoring scaffolding

Intent: test whether ordinary tutoring gives a learner a separate opportunity to recognize a problem and choose a safe action before disclosing either answer.

Updated: 2026-11-13. Source baseline: `2172ab600c042f454553e9369f057b2f65cb3c60`.

Preparation and independent static review are complete. Judge calibration agrees on 49/49 annotated checks with the restored Qwen configuration. Earlier provider and JSON-mode failures remain preserved. The frozen tutor comparison is running; see [report](report.md).

The canonical [specification](../../../../tutor-system/docs/ai-behaviors/tutor-behavior-specification.md) owns T01.1, T02.1 and T02.2; the [evaluation plan](../../../../tutor-system/docs/ai-behaviors/tutor-behavior-evaluation-plan.md) owns priorities and gates. The user approved separate recognition/action opportunities and retained immediate protection. This focused increment does not establish full-suite acceptance or authorize release.

## Design and artifacts

- [prepare.cjs](prepare.cjs) builds 27 fixed histories plus two four-turn controlled trajectories across all six phishing/privacy standard templates. All template records and complete original learning-point payloads are preserved in [source-templates.json](source-templates.json); equality with the merged catalog is asserted. The four cyberbullying templates are source provenance only.
- Each trajectory retains actual generated tutor replies. Subsequent scripted learner statements are controlled interventions, not simulated natural learning or evidence of learning efficacy.
- Three arms use identical model settings: merged baseline, [instruction-only candidate](candidate-policy.txt), and the same instruction plus teacher-reference labels for the target headings and recognition/action fields. The latter preserves the exact heading and component content; it changes no room or curriculum facts. There is no expression-only arm, so this design does not estimate a full factorial interaction.
- Three independent repetitions imply **315 planned tutor responses**: 27 × 3 arms × 3 repetitions plus 8 trajectory turns × 3 arms × 3 repetitions. Complete fixed-history comparisons and controlled trajectories are reported separately.
- [rubrics.json](rubrics.json) keeps four primary judgments separate: recognition-before-action, component disclosure, responsive progression, and factual accuracy. Seven secondary judgments cover instruction realization, feedback, accessibility, dignity, honesty, persona and decision rationale. Feedback absence is inapplicable, never an automatic pass. New correction realization explicitly supersedes the old rubric's unconditional safe-action requirement.
- [run.cjs](run.cjs) reuses the existing HTTP transport and production parser/repair. It preserves inputs, target attempts, raw judge responses, source snapshots and expected missing denominators, and supports resuming unchanged runs. Individual and two-/three-member classification votes use fixed members and abstain on ties; they do not combine tutor prose.

Qwen settings: target temperature 0.3, 600 tokens; judge temperature 0, 2,600 tokens; thinking disabled; three repetitions without seed; at most eight concurrent calls. The 30-minute limit counts active command execution, including the failed provider segment, but excludes waiting for a configuration decision. Credentials are never frozen or logged. Provider/model changes require explicit authorization and fresh comparable calls.

The first candidate replaces the merged notice/action block and explicitly overrides older correction clauses. Those older clauses remain elsewhere in the base prompt; whether the override suffices is a hypothesis, not an established result.

## Reproduction

Run from the experiment worktree root. Node modules reuse the main checkout locally. Generate into an unused directory; generated fixtures and raw calls are ignored by Git and preserved locally.

```sh
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-component-scaffolding/prepare.cjs evals/promptfoo/scaffolding-diagnostics/2026-11-13-component-scaffolding/generated/v2
rtk proxy node --test evals/promptfoo/scaffolding-diagnostics/2026-11-13-component-scaffolding/harness.test.cjs
```

The existing `generated/v2` must not be overwritten. For another preparation snapshot select a new directory and explicitly version the runner input path. The tests regenerate their own fixtures in a new temporary directory.

Select model/configuration explicitly, for example via `rtk proxy env PTP_EVAL_MODEL=<approved-model> PTP_EVAL_ENV_FILE=<approved-env-file> node .../run.cjs calibrate <new-raw-calibration-directory> 8`. When present, the configured `OAI_MODEL` must match the selected model; otherwise the explicit user-approved model controls. Do not reuse an existing raw calibration directory for changed provider, rubric or model. Calibrate every rubric first, freeze only after independent review, then use `freeze`, `run`, and `secondary` against the new immutable comparison directory. Full exact commands belong in [experiment_log.md](experiment_log.md).

## Structural verification

`rtk proxy node --test evals/promptfoo/scaffolding-diagnostics/2026-11-13-component-scaffolding/harness.test.cjs`: **10/10 passed**. These test source and target-content preservation, reference isolation, one policy insertion, prior tutor-turn preservation, typed judge/error handling, conditional feedback, calibration coverage, private-reason isolation, and missing target denominators. They do not grade semantic tutor wording.

Independent preparation review: [independent-preparation-review.json](independent-preparation-review.json). Grounding review: [grounding-review.json](grounding-review.json). Prior cases/assertions retain their original source artifacts and judgments; the focused audit records scope separately.
