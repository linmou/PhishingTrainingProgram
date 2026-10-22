# W1/W2/W5/W6/W7/W8: Transfer Runtime

## Source

Original §§3-7, §9, §11, §14, and §17 W1-W2/W5-W8.

## Ordered implementation

1. Finish the narrowed transfer/legacy types and v3 response contract.
2. Add the golden fixture package and complete reducer, parser, grader, rendering, contract, and orchestrator tests.
3. Make evidence ingestion target a persisted learner/message/checklist identity and preserve causal ordering.
4. Route transfer progress through the single server-authoritative transition operation; no React or prompt-side progression writes.
5. Preserve assessment draft structure through room state and teacher review; clear confirmation after edits and reject stale revisions.
6. Deliver public stem/instructions/options only; map assessment delivery to tutoring participation and preserve Guard behavior.
7. Process the first valid learner answer deterministically, then require tutoring feedback before a new assessment.
8. Exercise wrong-answer repair, spontaneous transfer, contradiction reopening, assistance cancellation, clarification, duplicate messages, and stale state.

## Completion gate

All required §14 suites pass, including `transferAssessmentService.test.ts`, and the browser-facing consumers use the structured decisions rather than only copied text.
