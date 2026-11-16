# Task-label and point-completion evaluation update

Intent: preserve the user's continuation decisions and link the focused behavior design to its experiment evidence.

Latest local manual trial, 2026-11-13: applied the contextual-completion experiment's `task_meaning` candidate at the user's request. Replaced the completion-evidence block, aligned the two mandatory action-progression clauses with configured task meaning, and added the tested remaining-task instruction. Full rendered requests match all nine cases in `2026-11-13-contextual-completion/raw/frozen-v3.json` exactly. The existing request-builder suite passes 11/11. The bundle served at localhost:3107 contains all three candidate changes. This local availability does not confer behavioral acceptance; the measured candidate still has progression failures.

Updated: 2026-11-13. Source baseline: `297a1b389e99f2843d5cb51e46ef402ae3ae5f50`.

The user requested completion of one learning point before the next, through its observation task followed by its behavior task. Their final presentation decision retains the original knowledge-point headings for rationale tracing, with `Observation task` and `Behavior task` as the field labels. The experiment separates the label change from an explicit per-point completion instruction.

The [specification](../ai-behaviors/tutor-behavior-specification.md) clarifies existing T02.1/T02.2 learner-evidence requirements under P2/R1. The [evaluation plan](../ai-behaviors/tutor-behavior-evaluation-plan.md#focused-increments) scopes three semantic rubrics: observation-before-behavior, responsive progression, and component-specific disclosure. The user's latest scope decision prioritizes these requirements, rubrics and data; broader regression work is outside this run.

The user selected Qwen3.8-flash for tutor and judge using the current DashScope environment. This selection is explicit because the inspected `.env` omits `OAI_MODEL`. The experiment records its model settings and reports intermediate calibration, generation, grading and failure evidence. Earlier DeepSeek results retain their original provenance.

Preparation and execution status: in progress. The frozen package and final report will record exact artifact hashes, independent reviews, comparable results and remaining acceptance gaps. No experimental behavior version is assigned by this documentation update alone.

Local manual trial, 2026-11-13: the user clarified that deployment means localhost:3107 only, not the default branch. Applied the frozen V12 `completion_cleanup` runtime candidate to this experiment worktree: inherited component policy, retained headings with Observation/Behavior labels at final request assembly, sequence instruction, four completion-rule replacements and learner-evidence repair. The served development bundle contains all these changes. The request-builder suite passed 11/11 tests, including persisted inventory/progress formatting, heading/content preservation and unchanged user history. Independent implementation verification matched all 14 frozen fixed/trajectory initial requests exactly. This makes the candidate available for manual testing; it does not resolve the behavioral failures in the experiment report. Hosted release planning was canceled before any merge or deployment.
