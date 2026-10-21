# Cyberbullying planning record

Intent: preserve the execution plan, user-directed amendments and supporting planning history in Git.
Updated: 2026-10-21. Review-flow amendment baseline: `abb98036df67c1e173ed9b2ab7d1ab5a977869b7`. Reconstructed version 1 commit: `c0de593`.

## Current direction

[final_plan.md](final_plan.md) is the current execution plan. Its review-flow amendment reuses the phishing ordinary-reply browser draft, publishes character replies through `public.messages`, and records original/final text, character and tutor decisions in `public.ai_suggestion_feedback`.

The amendment retires the dedicated Cyberbullying proposal lifecycle and includes migration, history-preservation, verification and release requirements. It records the requested design; implementation acceptance is established by the [release record](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_21_cyberbullying_practise.md).

## Supporting history

- [request.md](request.md): original requirements and recorded decisions.
- [draft_final_plan.md](draft_final_plan.md): earlier synthesis, retained as a historical snapshot.
- [approaches/](approaches/) and [candidates/](candidates/): alternative implementation approaches.
- [judgements_1st/](judgements_1st/) and [audits/](audits/): ranking and audit evidence for the earlier planning snapshots.
- [gates/](gates/) and [run_status.md](run_status.md): planning-run checks and status.
- [tools/check_artifacts.py](tools/check_artifacts.py): historical checker for the original planning stages. The candidate check remains applicable. The judge check expects the input directory before `summary.md` was generated, and the publication check expects the initial identical draft/final snapshot. Subsequent summaries and user amendments are retained as later history.

## Recording amendments

The original import (`cdec6e4`) tracked the draft and amended plan together. The subsequent two-commit sequence reconstructs their intended version order without rewriting that import: `c0de593` records `final_plan.md` with the exact contents of `draft_final_plan.md` as version 1; the following amendment commit restores the current plan as version 2. Compare those two commits to trace the amendment on the same file path.

Update the current plan with a dated decision and revise the affected execution steps and acceptance criteria together. Retain the earlier candidate/audit snapshots as their original evidence. Commit the amended plan so Git records each subsequent revision.

The repository ignore rules select this planning folder for version control. Its local ignore rules keep generated deployment payloads, hosted database inventories and checker caches local.
