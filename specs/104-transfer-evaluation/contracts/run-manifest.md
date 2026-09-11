# Immutable Run Manifest Contract

**Intent**: define the evidence snapshot that makes calibration, baseline, candidate, and holdout results reproducible and comparable.

## Required manifest fields

```json
{
  "run_id": "2026-09-11-transfer-candidate-001",
  "manifest_version": "transfer-eval-v1",
  "artifact_hashes": {},
  "partitions": {},
  "settings": {},
  "comparison": {},
  "thresholds": {},
  "execution": {}
}
```

- `run_id` and `manifest_version` identify a write-once run.
- `artifact_hashes` includes the adopted constitution, canonical T09 specification, response contract, evaluation plan, case manifest, rubric registry, prompt/adapter, deterministic checker, gate source, and relevant fixture/provenance files.
- `partitions` names calibration, development, regression, unchanged production baseline, contract-compatible baseline, candidate, and eligible independent holdout sets, with case/version hashes and exposure status.
- `settings` records target/judge model identities, endpoint names without credentials, temperatures, token limits, thinking/provider options, timeout, concurrency, retry/repair limits, repetitions, and seed policy.
- `comparison` records baseline/candidate joins by case/version, metric/assertion version, partition, target-generation identity, repetition, and allowed changed experimental factors.
- `thresholds` records per-metric/partition thresholds, 100% hard checks, pair rule, non-regression rule, and missing/error/zero-coverage behavior.
- `execution` records commands, exit codes, git revision, worktree status, start/end times, and token usage when available.

## Per-case evidence

Each expected `case_id`/version/check/repetition/turn identity has an evidence record under the run directory containing:

- complete target input projection, raw request, raw response, parsed output, and displayed output where applicable;
- expected and actual deterministic values or raw/parsed semantic judgment;
- method, status, score, applicability and rationale;
- target generation ID and judge generation/call identity;
- raw judge request/response/settings for semantic checks;
- provider, parsing, retry, timeout, and error metadata without secrets;
- pair/transition membership and step identity;
- links to source provenance and manifest hashes.

Statuses are exactly `pass`, `fail`, `not_applicable`, `missing`, and `error`. `not_applicable` requires a predeclared conditional rule, `applicable=false`, and null pass/score. Missing/error results are never omitted.

## Immutability rules

- Create a new run directory under `evals/promptfoo/results/<model>/<run-id>/`; never overwrite a prior run.
- Freeze the manifest before candidate evaluation and holdout exposure.
- Replays or rejudgments reference the source run and create a new record with changed evaluator/version metadata.
- Any case, rubric, prompt/adapter, contract, setting, threshold, or gate change creates a new manifest version and comparable baseline.
- Redact credentials and personal identifiers without altering tested meaning; record unavailable metadata explicitly.
- Preserve interrupted runs as partial/incomplete evidence, never as accepted results.
