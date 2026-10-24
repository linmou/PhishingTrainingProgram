# Evaluation organization: proposed taxonomy and review decisions

Status: **proposal for human discussion**, not an adopted glossary or authority to migrate files.

## Conceptual hierarchy (for navigation; not a physical migration)

```text
Evaluated capability
  -> experiment / evaluation plan
    -> recorded execution (run)
      -> frozen evidence bundle (atomic)
```

Cross-cutting materials (rubrics, evaluators, cases, prompts, reviewer tooling) are referenced from the relevant capabilities/experiments; they are not artificially classified as experiments. A directory need not encode every facet: model, date, candidate, judge version and execution state belong in metadata where possible.

## Terms and human review

| Term | Meaning | Status |
| --- | --- | --- |
| Behavior specification, evaluation plan, run record | Defined responsibilities in the existing AI behavior skill | Existing convention |
| Rubric, case, holdout, candidate, baseline | Used in evaluation documentation and executable contracts | Existing convention |
| Run, run ID, snapshot, manifest, fingerprint | Used by existing run-producing code and frozen evidence | Existing convention |
| Release evidence, release verdict | Used by transfer-assessment release runner | Existing convention |
| Evaluated capability | Logical navigation entry keyed to the product behavior/component being measured | **Proposed umbrella label** |
| Experiment | Controlled question / comparison with declared inputs and versions | **Proposed navigation label** |
| Evidence bundle | Atomic set of records associated with one run | **Proposed umbrella label** |

Do not rename runtime identifiers or recorded version labels based only on this glossary. Propose ambiguous terms, list alternatives and rationale, and obtain explicit human approval before using them in new canonical paths.

## Observed physical-layout mismatches

1. `evals/promptfoo/` is named after a tool but also includes a learning-progress analyzer, a dated refinement experiment, rubrics, and harness implementations.
2. Its peers `v1/`, `rubrics/`, `learning-progress-analyzer/`, and `refinement-20261014/` mix version, resource type, measured component, and experiment identity.
3. `evals/transfer-assessment/` is a product capability but currently contains release verification, while transfer model-evaluation code lives under `promptfoo/v1/transfer/`.
4. `evals/web/` is an application for human evaluation review rather than a model-evaluation suite.
5. `evals/promptfoo/results/` and repository-root `output/` are Git-ignored, so the tracked tree does not enumerate actual local experiments.

## Proposed non-destructive action

- Provide human navigation through `evals/README.md`.
- Keep existing executable paths and historic material byte-for-byte unchanged.
- Review glossary and physical hierarchy separately; do not assume that renaming a component or rearranging old run folders is safe.
- Later, update *new* output conventions in the existing `.agents/skills/ai-behavior-design-eval/` skill. Only then evaluate whether the approach can be generalized.

## Decisions requiring user review

1. Should future paths group by **evaluated capability** (e.g. tutor behavior, learning-progress analyzer, transfer assessment) rather than framework/tool (Promptfoo)?
2. Should future experiment results live in one common `runs/` root, or remain adjacent to their capability with a cross-capability catalog? Either can work with an external index.
3. Which proposed names should become approved glossary terms? Are there project-standard alternatives?
4. Should existing source directories (not frozen runs) ever be physically renamed, after checking import paths, snapshot source references, scripts and test fixtures?

## Migration / integrity gates (not yet executed)

- Inventory *local* Git-ignored run roots, including partial and blocked experiments; GitHub inspection is not sufficient.
- Identify atomic bundle boundaries from manifests, run IDs, hashes, stored relative/absolute references, and replay identities.
- Before any move: show exact old -> new mapping, test every dependent executable/reference, and preserve evidence byte hashes and run identity.
- If relocation cannot be demonstrated safe, keep the historical path and add metadata/navigation instead.
- Verify unmodified examples such as the transfer release bundle with the existing verification command; do not use fresh LLM results to justify organization changes.

**Stage boundary:** Do not change AI behavior skill instructions or build a general meta-skill until the user reviews this concrete proposal.
