# Evaluation workspace

This is a human-facing navigation entrypoint for evaluation-related work. The existing paths below remain the executable and historical paths; this document does not rename, move, modify, or revalidate evidence.

## Find the relevant work

| Evaluated capability / task | Entry point | What it contains |
| --- | --- | --- |
| Tutor response and decision behavior | [Promptfoo tutor evaluation](promptfoo/README.md), [specification-derived runner](promptfoo/v1/README.md) | Legacy Promptfoo checks, v1 runner, candidate policies, generation and evaluator checks |
| Learning-progress analyzer | [Analyzer evaluation](promptfoo/learning-progress-analyzer/README.md) | Event classification and state/consumer checks; not a tutor-response score |
| Transfer assessment behavior | [Transfer checks](promptfoo/v1/transfer/) | Assessment decisions, quality, validity and lifecycle checks |
| Transfer assessment release readiness | [Release evidence](transfer-assessment/release/README.md) | Release gates and separately frozen release-verification runs, not interchangeable with semantic model acceptance |
| Human prompt/eval review | [Review workspace](web/README.md) | Standalone reviewer UI; static imported results are not new model evaluations |

## Find experiment definitions, results and evidence

| Need | Existing location | Notes |
| --- | --- | --- |
| Tutor prompt refinement experiment | [Shortcut-removal experiment](promptfoo/refinement-20261014/README.md) | Candidate definitions, audits, run records and pointers to frozen raw runs |
| Current tutor scoring code and cases | [v1/](promptfoo/v1/README.md) | Runner and source materials; `v1` is a harness/contract-era label rather than a model name |
| Rubrics and their versions | [rubrics/](promptfoo/rubrics/README.md) | Judge definitions; versioned rubrics are not experiment runs |
| Historical / active Promptfoo run output | `evals/promptfoo/results/<model>/<run-id>/` | Git-ignored; local runs are not enumerable from the GitHub checkout |
| Analyzer raw run output | `output/learning-progress-analyzer/` and historical `output/transfer-analysis-*` | Git-ignored; names from frozen runs remain unchanged |
| Transfer release evidence bundles | [release/](transfer-assessment/release/README.md) | Recorded run IDs contain full bundles; never split a run |

For conceptual terms, see [terminology and human review](ORGANIZATION_REVIEW.md).

## Invariants

- Do not split, merge, rename, or edit historical run/snapshot bundles merely to improve human readability.
- Do not change run IDs, recorded paths, source hashes, manifests, references, or replay fingerprints without a separate impact assessment.
- An index is a navigation aid, never an alternative source of experimental evidence.
- Missing, interrupted, failed and blocked runs remain discoverable and must not be represented as completed or passing.
- New names are proposals until the human terminology review is resolved. Do not silently promote a suggested label to a canonical project term.
