# Specification-derived tutor evaluation

Intent: run the approved v1 mixed deterministic/LLM evaluation while preserving the legacy Promptfoo cases and every intermediate result.

Updated: 2026-10-17. Source baseline commit: `19d58a1`; experiment snapshots preserve the worktree implementation.

This is the v1 execution entrypoint, separate from the legacy Promptfoo CLI. It preserves conditional applicability and the separate factual-accuracy hard verdict; neither can be represented honestly by averaging legacy component scores. The [project evaluation plan](../../../tutor-system/docs/ai-behaviors/tutor-behavior-evaluation-plan.md) owns the experiment; the [rubric manifest](../rubrics/v1/manifest.json) owns check metadata. Rubric Markdown contains only judge instructions.

## Shared evaluator and adapters

`model-comparison.js` compares frozen tutor and transfer outputs with a different target model. `candidate11-qwen38.js` and `candidate11-qwen38-high-cap.js` preserve the historical Tutor11 experiments, including the separate 600-token condition. Their `freeze`, `run OUT --num_workers N`, and `report` commands require the recorded local reference artifacts under `output/`. Frozen validation deliberately rejects source drift. On 2026-10-17, the combined local suite passed 65/67 tests; both historical Tutor11 artifact checks rejected evaluator source drift after the contextual-reply change. Those historical experiments must not be presented as validated against the current evaluator.

`evaluator.js` is the sole current output scorer. It accepts a frozen case, raw generation, contract version, settings, judge transport, and optional replay evidence. It returns the same result records consumed by `gate.js` and `analyze.js`, with explicit `pass`, `fail`, `not_applicable`, `missing`, and `error` statuses.

`runner.js` is the offline generation adapter. `browser-adapter.js` validates product input/evidence, removes prohibited capture fields and configured secrets, and delegates the final accepted raw generation to the same evaluator. Browser automation is product-path evidence, not an independent text scorer. It records request/response bodies and every format attempt, but never authorization headers, cookies, browser storage, API keys, or Supabase keys.

The [shortcut-removal experiment](../refinement-20261014/README.md) uses `--variant product --contract_version v2 --settings FILE`. `product-adapter.js` calls the production ecological request builder and parser, and reads the actual format-repair instruction. An optional policy replaces only the appended active tutor policy. The room configuration and user request remain the same. This experiment uses a 100-token, non-thinking target at temperature 0.3 and three repetitions. The selected tutor integration now fixes production generation to those decoding settings; earlier room-configured values describe historical behavior. The historical settings below describe earlier runs. Credentials use `OAI_API_KEY` and `OAI_BASE_URL` as declared by the project environment example. Live checklist/assessment enrichment and production transport reliability require separate product verification.

Rubric revision `v1.1` clarifies instruction realization's semantic boundaries: grammatical form alone does not determine scaffolding, and stopping an unsafe action does not itself correct a false inference. The [adoption audit](../refinement-20261014/audit-instruction-adoption-20261015.json) reconciles all 41 calibration examples and unchanged cases, applicability and gates. Comparisons across this revision require replaying every affected baseline and candidate judgment, including prior passes; preserve the target outputs and original run directories. `calibrate-instruction-boundaries.js PROPOSAL SETTINGS NEW_DIRECTORY --current-only` calibrates the exact current rubric bytes against the independently labeled boundary fixtures.

Current rubric revision `v1.2` / evaluator revision7 routes schema-valid Guard/null to the semantic realization judge on frozen T01 rows. It fails absence of a declared teaching action instead of misreporting a contract error; returned mode cannot suppress applicability. A general clarification also distinguishes a response's protective benefit from its first instructional action. The [v1.2 review and calibration](../refinement-20261014/audit-null-instruction-v12.json) records49/49 agreement under the adopted condition and preserves the failed initial48/49 condition. New comparisons rejudge every affected realization row on both sides; unchanged judgments require exact request/settings identity. Cases, expected labels and thresholds are unchanged.

Run the seven-room product adapter from `tutor-system/` with `npm run eval:behavior:web`. It requires a local app and the configured Supabase endpoint (local or hosted) and writes a new `results/qwen3.5-flash/web-test-rooms-<timestamp>/` directory; it does not overwrite a `latest` report. Hosted runs may write test rooms, messages, and review/audit rows to that project. To pass the persistence checks, the endpoint must also have the raw-instruction schema/RPC migration applied; the runner records a product failure instead of hiding that mismatch when it is absent. Product and diagnostic behavior verdicts remain separate.

## Inputs and commands

The [contextual-reply regression pair](contextual-reply-cases.json) preserves the real iTunes room history where “Looks like it does” incorrectly received reasoning about an earlier suspicious-account observation. Its controlled derivative changes only the latest reply to “Looks like it doesn't.” The [focused plan](contextual-reply-plan.md) maps both cases to existing requirements and checks; [case audit](contextual-reply-case-audit.json) accounts for all 61 unchanged cases. These are exposed ecological development cases, not independent holdouts. Run calibration before the focused diagnostic; use `full` to append both cases to the existing suite without modifying its frozen source. Every command requires a new output directory.

```sh
rtk proxy node evals/promptfoo/v1/contextual-reply.js calibrate NEW_CALIBRATION_DIRECTORY
rtk proxy node evals/promptfoo/v1/contextual-reply.js focused NEW_FOCUSED_DIRECTORY
rtk proxy node evals/promptfoo/v1/contextual-reply.js full NEW_FULL_DIRECTORY
```

The focused command executes three generations per case through the unchanged production prompt/contract, all 13 inherited checks and the new supporting `current_turn_grounding` semantic check. Registry v1.4 adds that check after calibration showed the generic reasoning judge accepted the observed stale justification. Existing rubric meanings remain unchanged. Focused/full runs can resume from completed records with identical inputs and settings. This establishes diagnostic coverage for this pair; full-suite non-regression and unseen generalization require separate complete runs. The [run record](contextual-reply-run-record.md) records executed evidence and any calibration or behavior failures.

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
rtk proxy node evals/promptfoo/v1/classification.js CANDIDATE_DIRECTORY BASELINE_DIRECTORY
rtk proxy node evals/promptfoo/v1/analyze.js CANDIDATE_DIRECTORY BASELINE_DIRECTORY
```

`baseline` preserves the old product messages. `aligned` changes only the output-contract instructions while retaining old teaching instructions. `candidate` explicitly replaces the old prompt with the policy file and lean room configuration. Baseline target token allowance is also increased for the expanded contract, so these are controlled experiments, not a claim that the deployed 100/120-token call was tested unchanged in every setting.

For the adopted response-contract design, pass `--contract_version v2` and use a v2 policy. This evaluates `reason` first, nested `decision.mode`/`decision.instruction`, and `response`; the default `legacy` mode preserves historical runs. Contract-v2 runs require a fresh aligned baseline and must not replay outputs generated under the legacy contract.

For faster structural diagnosis, `generate.js CASES POLICY NEW_DIRECTORY` records all target outputs and deterministic results without semantic judgments. This cannot establish acceptance. Feed those exact generations into a full run with `--replay DIRECTORY`; replay rejects changed target messages/model/temperature/token limit/thinking. A replay can also rejudge an earlier run under an explicitly revised evaluator without resampling valid target outputs. `--wait_replay true` streams a known active source run; do not use it if the source will not finish.

For a product diagnostic, use `generate.js CASES POLICY NEW_DIRECTORY v2 --variant product --settings SETTINGS --regenerate_room_prompt true --workers 24`. It uses the same production request, parser and format-repair path as the full runner and freezes the relevant sources. Its `report.json` supports classification diagnostics but explicitly marks semantic judging unrun; the complete gate must fail on missing semantic assertions. Advance by replaying every generated case/repetition into the full runner under the identical policy/settings/generator, preserving failed outputs too.

For a documented interrupted run, `--replay_available true` reuses every existing completed generation and generates the missing ones. It preserves failed judgments as well as passing ones. This does not recover responses that were still held in memory when the earlier process stopped; record that limitation and retain the partial run.

When the declared candidate also changes the base room generator, add `--regenerate_room_prompt true`. This rebuilds the same role/inventory through the current production generator and snapshots its source dependencies. Omit the option for a baseline whose `baseline_system` must stay frozen. Record the base-generator change as a separate factor alongside the active-policy edit; do not claim a suffix-only intervention.

## Settings and evidence

Credentials and endpoint come from the project's configured environment; secrets are not written to evidence. `settings.json` declares the historical execution-revision7 defaults: thinking-enabled Qwen3.5 Flash for both roles, 8000-token limits, two repetitions, six concurrent requests per process, 180-second timeout and three total transport attempts. Revision6 used two concurrent requests while older runs overlapped. The shortcut-removal experiment supplies separate explicit settings files with three repetitions and its declared short/thinking target configurations. Current evaluator revision7 is documented above; historical settings prose retains its original context. Changes to these factors are experiments, not silent fallbacks. Run processes conservatively because their concurrency limits are not global.

The shared evaluator evaluates each semantic check separately and permits one schema-only judge repair. The offline runner gives an invalid target object at most one format repair, preserving its initial output; valid but incorrect behavior is never resampled. Replayed transient errors can use only the remaining total transport-attempt allowance. Exact unchanged judge requests/settings on the identical target output reuse both passing and failing grades. Changed evidence or evaluator instructions require rejudging. G02 protocol clarification is revisioned and calibrated separately from unchanged rubric files.

All v2 target variants now use the production parser, reject truncation even when the text parses, and apply the same production format-repair suffix and terminal error handling. Earlier lean-adapter snapshots retain their historical weaker validation/repair implementation. The shortcut-removal lean diagnostic separately validates every initial/final target against production; all183 passed without repair. New snapshots capture the production consumer/repair sources for v2, so old directories cannot silently resume under the stricter implementation.

Each run freezes its case inputs, source documents, settings, policy, rubrics, manifest and runner source hash. Each completed generation preserves its raw target response, parsed output, exact provider requests, raw judge responses, token usage, typed results and generation/repetition identity. Run files are created exclusively; resume requires the same fingerprint. In-flight case judgments are not yet durable until that case finishes; interruption must be recorded as partial evidence, not a completed experiment. A completed `report.json` reconciles the full declared case/repetition set.

`gate.js` reads thresholds from the run snapshot, not the working manifest. It writes all metric/source/required-partition counts, errors, pair and transition violations, same-case pass-to-fail records and applicability changes. `analyze.js` adds same-generation interaction cells, including missing evidence and conditional inapplicability, full failure lists and replay-aware usage. Neither script confers constitutional adoption or deployment approval.

Both baseline and candidate must have complete, uniquely keyed, typed evidence. Missing rows remain in the expected denominator; result metadata cannot change frozen source or hard partitions. `classification.js` reports each repetition, pooled individuals, and fixed two/three-member majorities. Ties abstain. It must pass alongside the semantic gate; a majority cannot hide an absent or errored generation.

## Acceptance and integration

Candidate 11 also has [simulated learner tests](simulated/README.md) using Promptfoo's conversation engine with the project's configured learner backend. These new synthetic trajectories carry actual generated tutor replies into subsequent turns and run separately from the fixed-history baseline comparison.

Every applicable quality metric must clear 80% in each required partition; hard constraints, required validity, exact transitions and semantic pairs require 100%. Retained metrics must not regress. Missing results and unresolved errors block acceptance. Superseded composite v0 criteria remain visible diagnostics and cannot override the user's v1 design.

Freeze a development candidate before inspecting independent holdout outcomes. Evaluate the baseline and candidate on the same sealed set. Any holdout used for subsequent tuning becomes exposed and needs independently authored replacement coverage.

The production parser/prompt are not switched merely because a diagnostic improves. Contract validation, known prior mode, human-supervisor visibility, reviewed persistence and real downstream behavior require separate product verification before release.
