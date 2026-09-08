# Specification-derived tutor evaluation

Intent: run the approved v1 mixed deterministic/LLM evaluation while preserving the legacy Promptfoo cases and every intermediate result.

This is the v1 execution entrypoint, separate from the legacy Promptfoo CLI. It preserves conditional applicability and the separate factual-accuracy hard verdict; neither can be represented honestly by averaging legacy component scores. The [project evaluation plan](../../../tutor-system/claude_docs/ai-behaviors/tutor-behavior-evaluation-plan.md) owns the experiment; the [rubric manifest](../rubrics/v1/manifest.json) owns check metadata. Rubric Markdown contains only judge instructions.

## Inputs and commands

`development-with-guard.json` contains 61 cases, including all 43 existing cases and all 173 original assertions. Thirteen cases have ecological provenance, including explicitly labeled single-field product-fixture derivatives; six use the adult role. The earlier 59-case set remains preserved as `development-expanded.json`. Derived input provenance is in `baseline-provenance.json`, the preparation audit, and each case. Evaluator labels stay outside model inputs. Sealed independent cases under `../holdouts/` must not be read during prompt refinement.

`development-with-guard-scenario-rich.json` is a versioned derivative of that frozen suite. It preserves the same 61 cases, labels, assertions and ecological fixtures, while giving synthetic-development cases room-style scenario descriptions and scenario-aligned learning inventories. `scenario-rich-provenance.json` records the source hash, catalog and changed fields. Generate it once with `rtk proxy node evals/promptfoo/v1/prepare-scenario-rich.js`; the script refuses to overwrite an existing revision.

Run commands from the repository root:

```sh
rtk proxy node --test evals/promptfoo/rubrics/v1/decision-metrics.test.js evals/promptfoo/v1/harness.test.js evals/promptfoo/v1/analyze.test.js
rtk proxy node evals/promptfoo/v1/calibrate.js NEW_CALIBRATION_DIRECTORY
rtk proxy node evals/promptfoo/v1/runner.js --cases evals/promptfoo/v1/development-with-guard.json --variant baseline --out NEW_BASELINE_DIRECTORY --workers 2
rtk proxy node evals/promptfoo/v1/runner.js --cases evals/promptfoo/v1/development-with-guard.json --variant aligned --out NEW_ALIGNED_DIRECTORY --workers 2
rtk proxy node evals/promptfoo/v1/runner.js --cases evals/promptfoo/v1/development-with-guard.json --variant candidate --policy POLICY_FILE --out NEW_CANDIDATE_DIRECTORY --workers 2
rtk proxy node evals/promptfoo/v1/gate.js CANDIDATE_DIRECTORY BASELINE_DIRECTORY
rtk proxy node evals/promptfoo/v1/analyze.js CANDIDATE_DIRECTORY BASELINE_DIRECTORY
```

`baseline` preserves the old product messages. `aligned` changes only the output-contract instructions while retaining old teaching instructions. `candidate` explicitly replaces the old prompt with the policy file and lean room configuration. Baseline target token allowance is also increased for the expanded contract, so these are controlled experiments, not a claim that the deployed 100/120-token call was tested unchanged in every setting.

For the adopted response-contract design, pass `--contract_version v2` and use a v2 policy. This evaluates `reason` first, nested `decision.mode`/`decision.instruction`, and `response`; the default `legacy` mode preserves historical runs. Contract-v2 runs require a fresh aligned baseline and must not replay outputs generated under the legacy contract.

For faster structural diagnosis, `generate.js CASES POLICY NEW_DIRECTORY` records all target outputs and deterministic results without semantic judgments. This cannot establish acceptance. Feed those exact generations into a full run with `--replay DIRECTORY`; replay rejects changed target messages/model/temperature/token limit/thinking. A replay can also rejudge an earlier run under an explicitly revised evaluator without resampling valid target outputs. `--wait_replay true` streams a known active source run; do not use it if the source will not finish.

## Settings and evidence

Credentials and endpoint come from the project's configured environment; secrets are not written to evidence. `settings.json` declares model, temperatures, thinking flags, token limits, repetitions, timeout and retry policy. Execution revision 7 uses thinking-enabled Qwen3.5 Flash for both roles, 8000-token limits, two repetitions, six concurrent requests per process, 180-second timeout and three total transport attempts. Revision 6 used two concurrent requests while many older runs overlapped; revision 7 changes only that operational allowance after they drained, with matched baseline replays. Evaluator revision 6 is unchanged. Changes to those factors are experiments, not silent fallbacks. Run processes conservatively because their concurrency limits are not global.

The runner evaluates each semantic check separately and permits one schema-only judge repair. An invalid target object receives at most one format repair, preserving its initial output; valid but incorrect behavior is never resampled. Replayed transient errors can use only the remaining total transport-attempt allowance. Exact unchanged judge requests/settings on the identical target output reuse both passing and failing grades. Changed evidence or evaluator instructions require rejudging. G02 protocol clarification is revisioned and calibrated separately from unchanged rubric files.

Each run freezes its case inputs, source documents, settings, policy, rubrics, manifest and runner source hash. Each completed generation preserves its raw target response, parsed output, exact provider requests, raw judge responses, token usage, typed results and generation/repetition identity. Run files are created exclusively; resume requires the same fingerprint. In-flight case judgments are not yet durable until that case finishes; interruption must be recorded as partial evidence, not a completed experiment. A completed `report.json` reconciles the full declared case/repetition set.

`gate.js` reads thresholds from the run snapshot, not the working manifest. It writes all metric/source/required-partition counts, errors, pair and transition violations, same-case pass-to-fail records and applicability changes. `analyze.js` adds same-generation interaction cells, including missing evidence and conditional inapplicability, full failure lists and replay-aware usage. Neither script confers constitutional adoption or deployment approval.

## Acceptance and integration

Candidate 11 also has [simulated learner tests](simulated/README.md) using Promptfoo's conversation engine with the project's configured learner backend. These new synthetic trajectories carry actual generated tutor replies into subsequent turns and run separately from the fixed-history baseline comparison.

Every applicable quality metric must clear 80% in each required partition; hard constraints, required validity, exact transitions and semantic pairs require 100%. Retained metrics must not regress. Missing results and unresolved errors block acceptance. Superseded composite v0 criteria remain visible diagnostics and cannot override the user's v1 design.

Freeze a development candidate before inspecting independent holdout outcomes. Evaluate the baseline and candidate on the same sealed set. Any holdout used for subsequent tuning becomes exposed and needs independently authored replacement coverage.

The production parser/prompt are not switched merely because a diagnostic improves. Contract validation, known prior mode, human-supervisor visibility, reviewed persistence and real downstream behavior require separate product verification before release.
