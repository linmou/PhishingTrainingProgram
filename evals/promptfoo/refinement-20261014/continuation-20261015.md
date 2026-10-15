# Prompt refinement continuation

Intent: continue the requested prompt cleanup and improvement after integrating the added transfer cases.

Date: 2026-10-15. Existing results remain immutable. The expanded transfer baseline contains354 records:120 added-case records reused unchanged and234 missing independent calls completed. Baseline event/state checks pass248/354 and259/354; all354 outputs are valid. Three-member macro-F1 is57.26%.

Tutor candidate08 restores the user's explicitly approved two-sentence Guard response structure, restores the general clarity-over-casual-style priority, and clarifies knowing rejection as acceptance of a correction followed by choosing the rejected inference. The other candidate07 rules, current base generator, cases, model settings and gates remain fixed. This targets13 correct-Guard responses that omit participation impact and3 knowing-rejection mode errors. The structure is user-approved; no case utterance or worked JSON solution is restored.

Transfer candidate01 changes the prompt only in the frozen handler. It removes labeled learner-answer examples and concrete action lists, replaces the filled JSON example with field definitions, distinguishes a demonstrated intended choice from observed external execution, preserves target scope and current-speaker attribution, and orders contradiction/transfer/repair decisions according to TA01–TA04. These are a bundled procedural clarification, not an isolated causal estimate for any one sentence. The current consumer, model sampling, gold labels and thresholds remain fixed. The full118-case suite includes all73 original cases, all40 additions and5 separate propagated sequence checks.

Both candidates require independent integrity audit before execution. Tutor preflight reuses its existing baseline; any full semantic judging reuses the candidate's own saved targets and unchanged baseline judgments. Transfer comparisons reuse all baseline evidence. No sampled failure is replaced to improve a score. Full gates and independent unseen validation remain required before acceptance.
