# Component-specific tutoring scaffolding

Intent: test whether ordinary tutoring gives a learner a separate opportunity to recognize a problem and choose a safe action before disclosing either answer.

Updated: 2026-11-13. Source baseline: `2172ab600c042f454553e9369f057b2f65cb3c60`.

The focused experiment is complete with 525 tutor responses. Under the user's corrected **≥80% ordinary-rubric threshold**, the final candidate is not yet validated: independent AI review found 79 disclosure passes, 19 clear failures and 7 ambiguous cases out of 105. This bounds confirmed/possible passes at 75.2%–81.9%; five of the ambiguous cases would need confirmed passes to reach 84/105. The original frozen 100% criterion remains in execution history. Initial judge calibration agreed on 49/49 annotated checks, but output audits found boundary errors. One bounded clarification agreed on 69/71 checks; disclosure remains uncalibrated at 12/14. Further order-judgment errors make all semantic aggregates provisional. Earlier provider and JSON-mode failures remain preserved. See [report](report.md) for the separately labeled threshold reassessment, matched results, case analysis and limits.

The canonical [specification](../../../../tutor-system/docs/ai-behaviors/tutor-behavior-specification.md) owns T01.1, T02.1 and T02.2; the [evaluation plan](../../../../tutor-system/docs/ai-behaviors/tutor-behavior-evaluation-plan.md) owns priorities and gates. The user approved separate recognition/action opportunities and retained immediate protection. This focused increment does not establish full-suite acceptance or authorize release.

## Design and artifacts

- [prepare.cjs](prepare.cjs) builds 27 fixed histories plus two four-turn controlled trajectories across all six phishing/privacy standard templates. All template records and complete original learning-point payloads are preserved in [source-templates.json](source-templates.json); equality with the merged catalog is asserted. The four cyberbullying templates are source provenance only.
- Each trajectory retains actual generated tutor replies. Subsequent scripted learner statements are controlled interventions, not simulated natural learning or evidence of learning efficacy.
- Three arms use identical model settings: merged baseline, [instruction-only candidate](candidate-policy.txt), and the same instruction plus teacher-reference labels for the target headings and recognition/action fields. The latter preserves the exact heading and component content; it changes no room or curriculum facts. There is no expression-only arm, so this design does not estimate a full factorial interaction.
- The first comparison generated **315 tutor responses**: 27 × 3 arms × 3 repetitions plus 8 trajectory turns × 3 arms × 3 repetitions. Two subsequent cleanup candidates each generated 105 matched responses, for **525 total**. Complete fixed-history comparisons and controlled trajectories are reported separately.
- [candidate-cleanup.json](candidate-cleanup.json) removes six conflicting ordinary-teaching clauses from the active policy. [candidate-cleanup-full.json](candidate-cleanup-full.json) additionally removes three mandatory/direct-answer clauses from the room prompt generator. Both start from the instruction-only arm with original target labels. Full rendered requests are checked for exactly one occurrence of every generic clause before replacement; no case-specific rule is added.
- [rubrics.json](rubrics.json) keeps four primary judgments separate: recognition-before-action, component disclosure, responsive progression, and factual accuracy. Seven secondary judgments cover instruction realization, feedback, accessibility, dignity, honesty, persona and decision rationale. Feedback absence is inapplicable, never an automatic pass. New correction realization explicitly supersedes the old rubric's unconditional safe-action requirement.
- [run.cjs](run.cjs) reuses the existing HTTP transport and production parser/repair. It preserves inputs, target attempts, raw judge responses, source snapshots and expected missing denominators, and supports resuming unchanged runs. Individual and two-/three-member classification votes use fixed members and abstain on ties; they do not combine tutor prose.

Qwen settings: target temperature 0.3, 600 tokens; judge temperature 0, 2,600 tokens; thinking disabled; three repetitions without seed; at most eight concurrent calls. Active execution finished at 1,695,382 ms (28.26 minutes) within the 30-minute limit, including the failed provider segment and excluding waiting for a configuration decision. Credentials are never frozen or logged. Provider/model changes require explicit authorization and fresh comparable calls.

The first candidate replaces the merged notice/action block and explicitly overrides older correction clauses. The first cleanup revealed additional mandatory-safe-action rules in `responsePolicy.ts` and `emotionalParameters.ts`; the full cleanup addresses these too. Generic direct-teaching style examples remain. These controlled edits test competing prompt directives, but removing them does not itself establish successful scaffolding.

[refine.cjs](refine.cjs) preserves the initial targets while replaying the amended primary metrics and generating the cleanup candidates. Every applicable output, including previous passes, receives the same amended grading. [retry-judge.cjs](retry-judge.cjs) and [retry-primary.cjs](retry-primary.cjs) permit one identical-request repair only for invalid judge records, with original errors and source hashes retained. Valid unfavorable verdicts are never resampled. These retries repair execution validity, not the failed disclosure calibration.

## Reproduction

Run from the experiment worktree root. Node modules reuse the main checkout locally. Generate into an unused directory; generated fixtures and raw calls are ignored by Git and preserved locally.

```sh
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-component-scaffolding/prepare.cjs evals/promptfoo/scaffolding-diagnostics/2026-11-13-component-scaffolding/generated/v2
rtk proxy node --test evals/promptfoo/scaffolding-diagnostics/2026-11-13-component-scaffolding/harness.test.cjs
```

The existing `generated/v2` must not be overwritten. For another preparation snapshot select a new directory and explicitly version the runner input path. The tests regenerate their own fixtures in a new temporary directory.

Select model/configuration explicitly, for example via `rtk proxy env PTP_EVAL_MODEL=<approved-model> PTP_EVAL_ENV_FILE=<approved-env-file> node .../run.cjs calibrate <new-raw-calibration-directory> 8`. When present, the configured `OAI_MODEL` must match the selected model; otherwise the explicit user-approved model controls. Do not reuse an existing raw calibration directory for changed provider, rubric or model. Calibrate every rubric first, freeze only after independent review, then use `freeze`, `run`, and `secondary` against the new immutable comparison directory. Full exact commands belong in [experiment_log.md](experiment_log.md).

## Structural verification

`rtk proxy node --test evals/promptfoo/scaffolding-diagnostics/2026-11-13-component-scaffolding/harness.test.cjs evals/promptfoo/scaffolding-diagnostics/2026-11-13-component-scaffolding/refine.test.cjs`: **12/12 passed**. These test source and target-content preservation, reference isolation, one policy insertion, prior tutor-turn preservation, typed judge/error handling, conditional feedback, calibration coverage, private-reason isolation, missing target denominators and frozen cleanup behavior. They do not grade semantic tutor wording.

Independent preparation review: [independent-preparation-review.json](independent-preparation-review.json). Grounding review: [grounding-review.json](grounding-review.json). Prior cases/assertions retain their original source artifacts and judgments; the focused audit records scope separately.
