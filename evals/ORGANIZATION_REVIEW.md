# Evaluation folder reorganization — Option A

**Decision:** Use a simple, capability-first physical folder structure. No faceted classification, generated catalog, alternate browse hierarchy, or duplicate evidence store.

**Current scope:** Review the actual repository layout and propose a safe physical migration. This document is not evidence that migration has occurred. The existing AI behavior skill and future general meta-skill remain separate, later stages.

## Folder rules

1. **Same dimension per level:** The `suites/` level contains evaluated capabilities only. Each capability contains `resources/` and `experiments/`; each experiment contains its definition and complete run snapshots.
2. **Human-readable names:** Use project-recognized names such as `tutor-behavior`, `learning-progress-analyzer`, and `transfer-assessment`. Reuse existing human-approved terminology where available; discuss ambiguous candidates before renaming.
3. **Atomic snapshots:** A run directory is an indivisible piece of historical evidence, including unsuccessful or interrupted runs. Preserve its original bytes, recorded identity and full internal structure. If its references depend on the path, keep that historical directory in place rather than breaking it.
4. **Separate responsibilities:** Release verification belongs under `release-verification/`, and reviewer applications and test harnesses under `tooling/`, not beside evaluated capabilities.

## Target folder tree for future work

```text
evals/
├── suites/
│   ├── tutor-behavior/
│   │   ├── resources/
│   │   │   ├── cases/
│   │   │   ├── rubrics/
│   │   │   └── prompts/
│   │   └── experiments/
│   │       └── <experiment-name>/
│   │           ├── definition/
│   │           └── runs/
│   │               └── <run-id>/
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
    └── review-apps/
```

No empty directories are created just to mirror this tree. No directory aliases or copied run data are required.

## Concrete existing paths and decisions

| Current folder | Intended responsibility | What must happen before a physical move |
| --- | --- | --- |
| `evals/promptfoo/v1/` | Tutor evaluation runner plus several shared checks | Classify code, cases, and experiment records separately; find imports and source hashes |
| `evals/promptfoo/refinement-20261014/` | Tutor shortcut-removal experiment | Identify which historical files are frozen or referenced by hashes; do not split evidence |
| `evals/promptfoo/learning-progress-analyzer/` | Learning-progress analyzer suite | Reconcile imported historic identifiers, hardcoded imports and references to `output/transfer-analysis-*` |
| `evals/promptfoo/rubrics/`, `cases/`, `prompts/` | Evaluation resources | Establish which capability owns each resource before moving |
| `evals/promptfoo/results/` and repository-root `output/` | Historical raw runs (Git-ignored) | Inspect local filesystem, run paths, provenance, replay identity before any move |
| `evals/transfer-assessment/release/` | Transfer release verification | Preserve full historical `<run-id>/` bundles and SHA-256-checked external references |
| `evals/web/` | Review application (tooling) | Search scripts, imports, tests and user-facing paths before moving |

### Why physical migration is not yet complete

Snapshots can include the original source path, worktree state, fingerprints, absolute paths or relative references. In particular, the tutor runner checks a fingerprint on resume; the release verifier checks evidence hashes. GitHub also cannot inventory the Git-ignored local runs. Moving every folder immediately would conflict with the user's snapshot-preservation requirement.

The safe strategy is to classify and migrate **non-snapshot** files only after their references are verified. Apply Option A to **new** experiment directories. Keep frozen historical directories at their original locations whenever relocation cannot be proven safe. Do not present a partly migrated tree as finished.

## Discussion remaining

Option A itself is decided. The only open questions are concrete: whether a particular old directory can move without breaking its uses, and whether a suggested folder name matches the project's established vocabulary.

Before a physical move, present the old/new path mapping and verify that its executable references remain valid. A full migration test requires local access to ignored run directories; do not infer that they are absent from GitHub.

Do not modify `.agents/skills/ai-behavior-design-eval/` or create the generalized meta-skill until this repository-specific change is evaluated.
