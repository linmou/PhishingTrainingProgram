# Contextual completion and redundant tutoring

Intent: turn the reported repeated-tutoring failure into general task-completion requirements and checks, then test a minimal prompt refinement across different contexts.

Updated: 2026-11-13. Source checkpoint: `fb5ca91c090aa92a8f7487cf86d5c19ffbcde291`; later working changes are hashed at freeze.

## Research question

Can the tutor finish the configured observation and behavior tasks without inventing additional requirements or discarding evidence already supplied? The gift-card room motivates the question; it is one exposed ecological case, not the definition of correct behavior.

## General behavior

The authoritative [specification](../../../../tutor-system/docs/ai-behaviors/tutor-behavior-specification.md) owns T02/T02.1/T02.2. Completion is semantic and task-specific. A short answer can supply the required judgment in context. One contribution can satisfy overlapping tasks. A safety verdict cannot replace an action when the action remains unexpressed. An acknowledgment after a demonstrated task does not erase it. Only contradictory evidence or a concrete missing requirement justifies reopening it. The tutor must not demand a new causal explanation, paraphrase or application example unless that is part of the configured task.

## Changed factors

1. Clarified specification and semantic rubrics: task-specific sufficiency, persistence of earlier evidence, and no invented completion requirements.
2. New cases: the reported gift-card conversation and independently authored boundaries across other topics. Old frozen results retain their original interpretation and scores.
3. Prompt candidate: replace the broad completion-evidence override with a contextual, task-specific completion instruction. Preserve headings, task content, model settings and response format.
4. Separate application repair: use the learner's checklist in the tutoring request. This general request-routing defect affects learner checklists across rooms. It is verified through request-boundary integration tests and is not counted as evidence that the prompt improved. Both prompt arms use history-only cases with progress labels uniformly omitted, so later saved state is not injected into an earlier conversational prefix.

## Evaluation

Use the existing DashScope settings with explicit `qwen3.8-flash` for target and judge. Target: thinking false, temperature 0.3, 600 tokens. Judge: thinking true, temperature 0, 8,000 tokens. Three repetitions per case/arm; maximum concurrency 32 shared across active phases. This new follow-up has a 15-minute active execution allowance, separate from the closed earlier comparison; log actual usage and errors.

Freeze the cases, rubric, candidate, source snapshot and settings before generation. Calibrate the new rubric against independently annotated examples before reporting scores. Generate the frozen baseline and candidate while calibration runs. Use the same saved targets for every check; retain failed calls and format repairs. Report all denominators, per-case changes, same-output joint success and independent disagreements.

Primary diagnostic checks are contextual task progression and preservation of unfinished-task prerequisites. Retain the earlier component-disclosure rubric as a co-applicable check. Each metric must reach 80% overall without a baseline pass becoming a candidate fail; all declared completed/unfinished boundaries must pass in all repetitions. This small exposed development set can support a local trial, not general reliability or unseen-holdout acceptance. Independent preparation/refinement and output reviews are required.

## Evidence and decision

The real room has a learner-specific `transfer_v1` checklist even with transfer quizzes disabled. Its tracker marked the plausibility point covered after “Not possible”; subsequent ordinary tutor replies demanded reasons about the same reward. The Mars message is an assessment and is not counted as another ordinary tutoring repetition. Source request-loading inspection independently found that the legacy reader filtered out learner checklists. The precise contribution of the prompt and missing progress to the live replies remains unisolated without captured original provider requests.

Raw source: [room evidence](../2026-11-13-task-label-continuity/raw/manual-room-repetition/evidence.json), [room context](../2026-11-13-task-label-continuity/raw/manual-room-repetition/context.json), and [independent review](../2026-11-13-task-label-continuity/independent-manual-room-review.json). All new synthetic cases are development evidence. No room ID belongs in the runtime fix or prompt.
