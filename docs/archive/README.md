# Documentation archive

Intent: keep superseded and formerly untracked planning sources reachable at stable paths, so requirement citations and BMAD `sources:` entries resolve, while keeping them out of ordinary implementation work.

Updated: 2026-10-22. Baseline commit: `71d5f0e` (tag `docs-baseline-pre-bmad`).

## Rules

- Nothing here is authoritative for current behavior. Current product intent moves to the BMAD PRD, architecture spine and baseline initiative under `_bmad-output/` during the documentation migration.
- Files keep their original repository-relative path under `docs/archive/`, so a former link `X` becomes `docs/archive/X`.
- Archived files are not edited. Corrections go into the current documents, which may cite these files.

## Recovered sources

Copied unchanged on 2026-10-22. They were not previously tracked by Git; `/plan/*` is ignored except `plan/cyberbullying-practise/`.

| Archived path | Origin | Why preserved |
| --- | --- | --- |
| `plan/transfer_assessment_implementation_plan.md` | main checkout, untracked | Original transfer-assessment plan. SHA-256 `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2` matches the "Original-plan SHA-256" recorded in `specs/orchestration/transfer-assessment/dependency-graph.md`. |
| `plan/transfer_assessment_implementation_plan/` | main checkout, untracked | Planning run, the later-amended `final_plan.md` (named "local normative plan" by the dependency graph), work packages, and `milestone_ledger.md` (the "single initiative ledger" in `.specify/memory/constitution.md`). |
| `plan/transfer_learning_refactor_plan.md`, `plan/transfer_learning_refactor_plan/` | main checkout, untracked | Refactor plan cited by the dependency graph's 2026-09-30 revision. The two copies differ; both are kept. |
| `plan/guard-mode-whole-feature/`, `plan/guard-mode-whole-feature_codex-plan-mode/` | main checkout, untracked | Guard mode planning history. |
| `plan/llm-key-server-side/` | main checkout, untracked | Server-side LLM credential plan. |
| `plan/multi-character_initial/` | main checkout, untracked | Initial multi-character behavior and UX plan. |
| `_bmad-output/planning-artifacts/cyberbullying-mode-coupling-review-2026-10-21.md` | main checkout, untracked | Source review cited by `plan/cyberbullying-practise/request.md`. |
| `evals/web/PRD.md` | commit `20989a4` on branch `wip/evals-under-construction` | The parked eval review workspace PRD, traced by `_bmad-output/planning-artifacts/ux-designs/ux-PhishingTrainingProgram-2026-06-22/`. |

Editor files (`.DS_Store`, `.Rhistory`) were excluded.

## BMAD v6 artifacts

Moved with `git mv` on 2026-10-22 so `_bmad-output/` holds only the BMAD v7 store. BMAD's v6→v7 migration was not run: it would have made the eval workspace UX the product initiative and turned completed change specs into backlog stories.

| Archived path | Contents |
| --- | --- |
| `_bmad-output/implementation-artifacts/spec-*.md` | Completed v6 quick-dev change specs (intent, decisions, verification). Inputs to the PRD and baseline epics. |
| `_bmad-output/implementation-artifacts/investigations/` | Root-cause investigations and their evidence files. |
| `_bmad-output/implementation-artifacts/deferred-work.md` | Known baseline defects; becoming `_bmad-output/backlog/` bugs. |
| `_bmad-output/planning-artifacts/ux-designs/ux-PhishingTrainingProgram-2026-06-22/` | UX for the archived eval review workspace (see `evals/web/PRD.md`). |
| `_bmad-output/brainstorming/` | Brainstorming sessions. |

Relative links that leave `_bmad-output/` gained two `../` levels at the move; no other content changed. Links into the untracked `output/` folder were already unresolvable in a clean checkout.
