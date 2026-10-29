# Evaluation workspace

## Approved direction: capability-first folders (Option A)

Use a straightforward physical folder hierarchy for **new** evaluation work:

```text
evals/
├── suites/
│   ├── tutor-behavior/
│   │   ├── resources/             # shared cases, rubrics, prompts
│   │   └── experiments/
│   │       ├── shortcut-removal-20261014/
│   │       │   ├── definition/
│   │       │   └── runs/
│   │       │       └── <run-id>/   # atomic snapshot
│   │       ├── contextual-reply/
│   │       └── simulated-conversations/
│   ├── learning-progress-analyzer/
│   │   ├── resources/
│   │   └── experiments/
│   └── transfer-assessment/
│       ├── resources/
│       └── experiments/
├── release-verification/
│   └── transfer-assessment/
│       └── runs/
└── tooling/
    ├── harnesses/
    │   └── promptfoo/
    └── review-apps/
        └── web/
```

The `suites/` siblings are all evaluated capabilities; the `experiments/` siblings are all experiments, and the `runs/` siblings are complete recorded executions. Review tools and release verification have separate responsibilities.

**Status:** This is the agreed layout principle, not a claim that existing files have moved. Existing runner paths and historical snapshot references have not been changed. Do not create a separate faceted catalog or duplicate raw evidence.

## Current entry points (paths unchanged)

| Capability or responsibility | Current location |
| --- | --- |
| Tutor behavior | [Promptfoo tutor evaluation](promptfoo/README.md); [v1 runner](promptfoo/v1/README.md) |
| Tutor shortcut-removal experiment | [Refinement experiment](promptfoo/refinement-20261014/README.md) |
| Learning-progress analyzer | [Analyzer evaluation](promptfoo/learning-progress-analyzer/README.md) |
| Transfer assessment behavior | [Transfer evaluation checks](promptfoo/v1/transfer/) |
| Transfer assessment release verification | [Release evidence](transfer-assessment/release/README.md) |
| Prompt/evaluation review application | [Web workspace](web/README.md) |

Existing local raw results are normally written to the Git-ignored `evals/promptfoo/results/` or repository-root `output/`; their contents are not visible in a GitHub-only inspection.

## Preservation rules

- Treat every historical run snapshot as an indivisible unit. Never split its files across the new hierarchy.
- Do not rename old run IDs, rewrite hashes, or silently change stored absolute/relative paths and replay fingerprints.
- Move ordinary source and configuration files only after checking executable references, import paths, frozen-source references, and tests.
- Use descriptive, existing project terminology. If a proposed folder name is ambiguous, flag it for human discussion before adoption.
- Do not claim a historical result has been revalidated merely because a directory or README was renamed.

For the path-level reorganization and unresolved safety issues, see [organization review](ORGANIZATION_REVIEW.md).
