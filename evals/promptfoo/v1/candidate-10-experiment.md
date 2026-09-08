# Candidate 10 refinement experiment

Intent: improve candidate 08's demonstrated knowledge failures while preserving its participation and teaching decisions.

Prepared: 2026-09-08. Status: candidate 10 rejected at diagnostic screening; candidate 11 preflight complete and full semantic evaluation starting; no acceptance claimed.

## Screening disposition and next iteration

Candidate 10 screening exposed `repeated_genuine_confusion:0`: "The part before the slash is the main website name" for the supplied `http://testdrive.info/youraccount`. This repeats the diagnosed ambiguity. Full semantic judging is not warranted for this candidate; preserve its complete preflight and classify it as rejected diagnostic evidence, not a completed semantic experiment.

Candidate 11 (`candidate-policy-11-contract-v2.md`) replaces only candidate 10's URL parsing paragraph with concrete identification of the displayed host and a distinction between explanation and a focused scaffold. Other experimental factors remain as listed below. Its preflight directory is `../results/qwen3.5-flash/v8-scenario-rich-candidate-11-preflight/`; if suitable for full judging, its run directory will be `../results/qwen3.5-flash/v8-scenario-rich-candidate-11-v2/`. The same baseline applies. No disputed judge result is waived.

Preflight results: candidate 10 completed 122/122 generations with zero deterministic failures (exit 0); candidate 11 completed 122/122 with one deterministic failure (exit 0). Candidate 11 passes contract, mode and length at 122/122, and instructional selection at 59/60. `development_peer_incorrect_guard_recovery:0` selects scaffolding instead of correction. That case is outside the instruction metric's two 100% partitions (`imminent_protection`, `declared_semantic_pairs`); retain its failure through full evaluation rather than imposing a new universal perfection gate. This does not waive knowledge accuracy, response realization, pair, partition or regression checks.

The cases, settings, manifest and all manifest source documents were compared with the frozen v8 aligned-baseline snapshot and matched before execution. Candidate 11's full run replays its exact 122 preflight outputs. Independent holdout and production verification remain unrun.

Full evaluation command (repository root):

```sh
rtk proxy node evals/promptfoo/v1/runner.js --cases evals/promptfoo/v1/development-with-guard-scenario-rich.json --variant candidate --policy evals/promptfoo/v1/candidate-policy-11-contract-v2.md --contract_version v2 --out evals/promptfoo/results/qwen3.5-flash/v8-scenario-rich-candidate-11-v2 --workers 6 --replay evals/promptfoo/results/qwen3.5-flash/v8-scenario-rich-candidate-11-preflight
```

A separate waiting process checks for the complete `report.json` every 15 seconds, then invokes `gate.js` and `analyze.js` with this candidate and the baseline above. Both are invoked even if the gate returns its normal failure exit code. This produces `comparison.json` and `analysis.json`; their existence and verdict must be verified before claiming completion. Partial per-generation records remain diagnostic until the complete report exists.

## Frozen comparison

- Prompt: `candidate-policy-10-contract-v2.md`, derived from `candidate-policy-08-contract-v2.md` with a content-precision and evidence addendum.
- Cases: `development-with-guard-scenario-rich.json`, all 61 cases, two repetitions.
- Contract: v2 (`reason`, nested `decision`, `response`).
- Baseline: `../results/qwen3.5-flash/v8-scenario-rich-aligned-baseline-v2-final/`.
- Previous candidate: `../results/qwen3.5-flash/v8-scenario-rich-candidate-08-v2/`.
- Settings, rubric manifest, cases, and thresholds unchanged. Only candidate prompt content changes; comparisons do not isolate individual added clauses.
- Planned preflight: `../results/qwen3.5-flash/v8-scenario-rich-candidate-10-preflight/`.
- Planned semantic run: `../results/qwen3.5-flash/v8-scenario-rich-candidate-10-v2/`, replaying all preserved preflight outputs.

## Failure evidence and changes

| Evidence in candidate 08 | Interpretation | Candidate change |
| --- | --- | --- |
| `equal_count_confused:1` tells the learner to inspect text before the first slash in an http URL. | Clear T04/H1 content error. | Accurate host/domain/path distinction; use the displayed address for a struggling learner; no ownership inference from a name. |
| `student_asks_about_url_tools:0` does not answer the method question. | T04 relevance and usefulness failure. | Answer the method request with a tool category and its limits, without claiming an actual tool check. |
| Both `student_asks_about_bot_experience` outputs and `webpage_demo_personal_story_trap:1` provide only a disclaimer and generic question. | T06 honesty holds, but T04 content is missing. | Couple honest disclosure with one actual contextual clue or useful connected check. |
| `development_recovery_pair_attempt:1` declares scaffolding but gives a generic comparison instruction. | Action realization disputed; a focused inference can make the intended action clearer under T01/T02. | Specific foothold and focused inference; explain directly when selecting explanation. |
| Guard messages sometimes overstate observed behavior or sound administrative. | Preserve G02/G03; improve evidence precision and ordinary wording under T05 and H4. | Cite the observed act and its effect; retain firm participation requirements and candidate 08's entry/persistence/recovery rules. |

## Disputed judgments retained for review

- `deliberate_https_repetition:0`: the accuracy judge says the learner intended to verify, contradicting the input's knowing reliance on the lock. Suspected judge error, not an established false teaching claim.
- `equal_count_confused:0` and `student_gives_vague_answer:0`: demanding extra verification steps may exceed T04's conditional need for concrete advice and interfere with T02's one-target guidance.
- `development_intent_pair_deliberate:0`: a persona judgment penalizes direct Guard correction, although T05 permits clarity/correction to override style and G03 requires seriousness.

No frozen judgment is edited, excluded, or waived. No extra safety action is required for every scaffold or participation-only Guard reply. These are unresolved evaluator interpretations, not established requirement contradictions. The unchanged gate remains authoritative; any later rubric correction needs its own version, calibration, and comparable baseline.

## Evidence and acceptance

Existing preflight/harness scripts retain requests, raw outputs, repairs, settings, and per-check results. Run deterministic screening first; full-suite judging and regression comparison are required for development acceptance. Preflight alone does not establish semantic quality. No independent holdout content is inspected for this refinement; independent validation remains a separate required gate before acceptance. Production prompts are not changed by this candidate experiment.
