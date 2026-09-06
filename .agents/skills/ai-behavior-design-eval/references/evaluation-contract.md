# Evaluation contract

Intent: define the measurement and evidence rules shared by evaluation preparation, prompt refinement, and saved-run review.

## Checks and calibration

Each semantic rubric owns one property and declares allowed input fields, observable pass/fail conditions, treatment of absent/contradictory/irrelevant output, annotated positive/negative/boundary responses, and a machine-readable result format. Record judge model and settings. Run calibration before baseline comparison; version demonstrated grader fixes and recalibrate.

Use deterministic assertions for schema, first-field ordering, enums, exact decisions, length/count limits, and transitions. Judge meaning, grounding, relevance, and tone semantically. Score each parsed decision and user-facing response independently; a semantic pass cannot override an invalid contract. An unavailable judge leaves semantic evaluation unrun, rather than substituting keyword matching.

## Case coverage and provenance

Positive cases require the behavior; negative cases distinguish similar inputs where it is inappropriate; boundary cases exercise ambiguity and limits; recovery cases begin with an error or earlier wrong state; regression cases preserve existing checks and identify historical failure provenance when available.

For semantic pairs, hold wording, entities, length, and cue counts as constant as practical while changing one meaning-bearing fact. Record the pair ID, changed factor, and different expected results. Negation, quoted speech, safe-action acceptance/refusal, and confusion/deliberate repetition are useful contrasts. Evaluate both members jointly. For stateful sequences, preserve every turn and assert the decision and resulting state after each step.

Ecological cases require real product records or version-controlled fixtures consumed by the product. Preserve source ID, revision/export time, scenario, history, configuration, and changed-field rationale. A derivative changes only the behavior-relevant field named by that rationale; multiple unrelated edits make it synthetic. Use the product exporter for generated fixtures. Ecological provenance establishes product relevance, not unseen generalization.

## Holdout lifecycle

An independent person or authorized separate agent authors holdouts from the frozen spec/rubrics, without the target prompt or development dialogues. Require distinct scenarios, entities, wording, and semantic boundaries. Record author, version, creation/exposure status, and provenance separately from current holdout eligibility. Missing independence is a declared coverage gap.

Withhold content and detailed failures from the prompt author until the candidate is frozen. An independent validation round evaluates baseline and candidate on the same held-out set. If holdout feedback informs tuning, retain its provenance and failures, mark it exposed, keep it in development/regression coverage, and independently author replacements. Run both baseline and candidate on the replacement set. Previously viewed synthetic cases remain useful tests but cannot count toward eligible unseen-holdout coverage.

## Acceptance gates

Freeze thresholds, required partitions, repetitions, and seed policy before runs. Use these defaults unless a different user/project requirement was specified before evaluation; retain stricter established gates.

| Gate | Passing condition |
| --- | --- |
| Each new and existing semantic metric | At least 80% overall and independently in ecological, eligible synthetic-holdout, and each required applicable partition. |
| Existing-metric non-regression | Rate does not decline against the unchanged-prompt baseline on the same cases, assertions, settings, and partitions. |
| Required schema, enum, exact transition, and declared safety-critical checks | 100%. |
| Semantic pairs | 100% of pairs; both members satisfy their expected assertions. |
| Manifest coverage | Every expected case/assertion/metric/suite/partition has a result. |
| Evaluation, API, parsing, and judge errors | Zero unresolved errors; missing/error results cannot be omitted from denominators. |

Compare exact fractions. Keep unchanged regression slices visible when adding cases; extra easy cases cannot conceal a decline. A 95% to 81% drop fails non-regression despite clearing 80%. Report every newly failing case/assertion for review; a universal 100% case gate applies only when specified.

Aggregate every predeclared repetition instead of selecting the luckiest run. A legitimate requirement or grader correction receives a new version and comparable baseline; observed failures alone cannot justify lowering the gate. Benchmark acceptance requires complete immutable evidence, not merely a passing summary or overwritten `latest` report.

## Run evidence

Preserve successes and failures as they occur. Each immutable run directory contains:

- Complete target inputs: prompt, scenario, history, and prior state; raw, parsed, and displayed outputs.
- Prompt content or immutable reference; case, rubric, and manifest versions/hashes.
- Target/judge models, endpoints without credentials, temperature, limits, seed/repetition policy, and provider options.
- Raw and parsed judge output, per-assertion scores/reasons, aggregates, missing results, errors, thresholds, and verdict.
- Commands, exit codes, start/end times, token usage when available, git revision, and worktree changes.

Redact credentials and personal identifiers without altering tested meaning. Mark unavailable metadata explicitly. The project-document snapshot summarizes these runs and links to them; it does not replace full input-output pairs or intermediate evidence.
