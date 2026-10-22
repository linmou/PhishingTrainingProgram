# W9/W10: Prompt and Behavior Evaluation

## Source

Original §§6-7, §15, §17 W9-W10, and the `ai-behavior-design-eval` contract.

## Ordered implementation

1. Freeze the numbered transfer requirement, response contract, applicability dispositions, deterministic golden cases, semantic rubrics, thresholds, and manifest before prompt edits.
2. Add transfer-specific Promptfoo cases for positive, negative, boundary, recovery, regression, multi-target, Guard, clarification, assistance, contradiction, spontaneous transfer, and semantic pairs.
3. Register `transfer_trigger_target`, `medium_transfer_quality`, `assessment_item_validity`, `assessment_followup`, and `verification_evidence` with typed deterministic/supporting checks.
4. Calibrate semantic judges on positive, negative, boundary, and contradictory outputs; preserve judge configuration and errors.
5. Run unchanged production and contract-compatible baselines, then candidate comparisons on the same frozen cases and partitions.
6. Run independently authored holdouts only after candidate freeze; preserve raw requests, outputs, parsed results, per-case judgments, and metadata.
7. Extend the blocking quality gate and test missing/error/zero-coverage/regression/pair cases.

## Completion gate

Every required partition has complete evidence, semantic pairs pass, no unresolved execution/judge errors remain, existing behavior does not regress, and all results are preserved in an immutable run directory. Evaluation acceptance remains separate from product release acceptance.
