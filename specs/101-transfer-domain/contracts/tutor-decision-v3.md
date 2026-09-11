# Contract: TutorDecisionV3 and TransferTurnContext

**Intent**: Give downstream implementation, backend, and evaluation owners one explicit W2 contract for structured transfer decisions and turn snapshots.
**Date**: 2026-09-11

## Decision Contract

`TutorDecisionV3` is reason-first JSON with these required top-level fields:

```json
{
  "reason": "observable evidence and teaching purpose",
  "decision": {
    "mode": "tutoring | guard | assessment",
    "instruction": "protective_instruction | correction | scaffolding | explanation | consolidation | guard | transfer_assess",
    "target_item_id": "known-id-or-null"
  },
  "response": "non-empty learner-facing response or assessment stem",
  "assessment": "private assessment object or null"
}
```

Compatibility rules:

| Mode | Instruction | Target | Assessment |
|---|---|---|---|
| `tutoring` | one real teaching instruction | null | null |
| `guard` | `guard` or one real teaching instruction | null | null |
| `assessment` | `transfer_assess` | known item ID | valid private assessment |

Real teaching instructions are `protective_instruction`, `correction`, `scaffolding`, `explanation`, and `consolidation`. Guard rejects `transfer_assess`, a non-null target, or a non-null assessment payload; it does not reject a real teaching instruction merely because the participation mode is Guard.

An assessment object requires `selection_type`, canonical A-D options, valid key cardinality, and non-empty transfer basis with known source evidence IDs. The parser rejects missing/blank fields, non-first `reason`, unknown IDs, duplicate option text, invalid modes, incompatible fields, overlong rendering, and invalid key cardinality.

## Public Output Contract for Component 102

Component 101 defines the pure learner-visible shape that component 102 must project through its service/API boundary:

```json
{
  "id": "assessment-id",
  "selection_type": "single | multiple",
  "stem": "question stem",
  "rendered_text": "stem, instruction, and A-D options",
  "options": [
    {"id": "A", "text": "..."},
    {"id": "B", "text": "..."},
    {"id": "C", "text": "..."},
    {"id": "D", "text": "..."}
  ]
}
```

The component 101 contract must not contain `correct_option_ids`, `transfer_basis`, private rationale, raw model output, API operations, or transport fields. Component 102 owns private-to-public projection, API adaptation, and their tests. Public assessment delivery is still an ordinary tutor turn with `mode: assessment`; it is not a room participation mode.

## Turn Context Contract

`TransferTurnContext` identifies the focused learner/message/checklist, policy version, prior participation mode, checklist item snapshots, unresolved public assessment, eligible item IDs, feedback boundary, and progress snapshot hash. It is used to detect stale decisions and sequence boundaries; it does not write progress.

## Validation and Consumer Boundary

- The v3 parser and assessment validation own structural contract validation.
- The parser owns explicit selection syntax and clarification codes.
- The grader owns exact-set equality.
- The reducer owns progress transitions.
- The component 101 pure orchestrator owns deterministic sequencing and no-chain behavior.
- Component 101 owns only the pure orchestrator; component 102 owns `transferAssessmentService.ts`, API operations, and public projection.
- Server persistence, authentication, authorization, key storage, and atomic idempotency remain downstream W3/W4 responsibilities.
