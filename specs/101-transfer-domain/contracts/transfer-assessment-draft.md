# Contract: TransferAssessmentDraft and TransferTurnContext

**Intent**: Give downstream owners one explicit contract for assessment-only drafts and turn snapshots.
**Date**: 2026-09-11  
**Revised**: 2026-09-30

## Active Assessment Contract

`TransferAssessmentDraft` is `{ reason: string, target_item_id: string, assessment: PrivateAssessment }`. Assessment validation checks the known target, learner-owned source evidence, private item quality, and rendering. It has no `decision.mode`, instruction, or `response`; `assessment.stem` is the question.

## Draft Contract

The assessment-only draft has these top-level fields:

```json
{
  "reason": "observable evidence and teaching purpose",
  "target_item_id": "known item ID",
  "assessment": "private assessment object with stem, options, key, explanation, and transfer basis"
}
```

An assessment object requires `selection_type`, canonical A-D options, valid key cardinality, a trimmed non-empty `learner_safe_explanation`, and non-empty transfer basis with known source evidence IDs. `validateAssessmentDraft` rejects missing or blank fields, unknown IDs, duplicate option text, overlong rendering, invalid key cardinality, and any top-level tutor-decision fields. Tutoring and Guard decisions use their separate tutor contract.

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

The unresolved component 101 public contract must not contain `correct_option_ids`, `learner_safe_explanation`, `transfer_basis`, private rationale, raw model output, API operations, or transport fields. Component 102 owns private-to-public projection, API adaptation, and their tests. Public assessment delivery is a tutor-authored message with `response_mode: assessment`; it is not a room participation mode or a shared-tutor decision.

## Attempt and Feedback Contract

`TransferAttemptSnapshot` is the server-owned lifecycle value passed into the pure resolver:

```json
{
  "assessment_id": "assessment-id",
  "accepted_attempt_count": 0,
  "resolution": "open",
  "processed_answer_message_ids": []
}
```

The only valid lifecycle states are `open/0`, `open/1`, `passed/1`, `passed/2`, and `failed/2`. A valid current selection appends its answer-message identity and increments the count. Replayed identities, invalid inputs, and terminal submissions do neither.

The first incorrect result is `retryable`, has one remaining attempt, applies no progress transition, and has no `terminal_feedback` field. Correct on either attempt returns terminal `passed`; a second incorrect returns terminal `failed`. Both terminal variants have zero remaining attempts and carry private server/audit feedback:

```json
{
  "learner_feedback_authorized": false,
  "terminal_feedback": {
    "correct_option_ids": ["B"],
    "learner_safe_explanation": "The displayed identity alone does not verify who controls the account."
  }
}
```

For `passed`, `learner_feedback_authorized` is the literal `false`; component 102 MUST NOT project the retained key or explanation to the learner. For second-incorrect `failed`, the field is the literal `true`; only that result authorizes component 102 to project terminal feedback to the learner. Neither variant adds feedback to the unresolved `PublicAssessment`.

## Turn Context Contract

`TransferTurnContext` identifies the focused learner/message/checklist, policy version, prior participation mode, checklist item snapshots, unresolved public assessment, eligible item IDs, feedback boundary, and progress snapshot hash. It is used to detect stale decisions and sequence boundaries; it does not write progress.

## Validation and Consumer Boundary

- Assessment draft validation owns structural contract validation.
- The answer parser owns explicit selection syntax and clarification codes.
- The grader owns exact-set equality.
- The reducer owns progress transitions.
- The component 101 pure orchestrator owns deterministic sequencing and no-chain behavior.
- Component 101 owns only shared domain types, validation, and the pure orchestrator; component 102 owns `transferAssessmentService.ts`, persistence, API operations, and public/terminal projection.
- Server persistence, authentication, authorization, key/explanation storage, concurrency, and atomic idempotency remain component 102 responsibilities.
