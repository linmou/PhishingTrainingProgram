---
type: epic
title: "Live conversation and ratings"
parent: initiative-platform-baseline
covers: [R5]
refined: true
risk: low
---

# Live conversation and ratings

## Description

Every participant sees the same live conversation within about 2 seconds, with typing indicators. The learner rates every tutor reply before writing again.

## Outcome

For anyone changing messaging or ratings: the shared-conversation and rating-gate rules are written once, with the requirement each comes from and the test that guards it.

## Requirements

Test paths are from the repository root.

- R1 (parent R5; prd FR-14, NFR-8): The room owner and the learner can exchange messages, and every participant sees new messages without refreshing. A sent message appears for every participant within about 2 seconds. Leaving and re-entering shows the full history in order, and messages sent while a participant was offline appear when they reconnect. Room lists and ratings update without refresh. Guard: `tutor-system/src/__tests__/real_time_chat.bdd.test.tsx` ("Messages appear immediately without page refresh"); `tutor-system/src/__tests__/room_discovery.test.tsx` ("should show new rooms without refreshing").
- R2 (parent R5; prd FR-15): The room owner and the learner can see when the other is typing; the indicator clears when typing stops or after 3 seconds without input. Guard: `tutor-system/src/__tests__/real_time_chat.bdd.test.tsx` ("Typing indicators are shown between tutor and student").
- R3 (parent R5; prd FR-16; R8): The learner must rate the most recent tutor reply before sending their next message. The gate applies to the learner only; tutors and observers are never gated. It covers every tutor reply in both practice types, including character replies and replies written without the AI assistant. Pre-populated dialogue and result messages are never rated. A learner has one rating per message, and changing it replaces it. The room owner and observers see rating counts update live. If saving the rating fails, the learner is told and their unsent message is kept. Guard: `tutor-system/src/__tests__/tutor_response_rating_gate.integration.test.tsx` ("blocks the reply, animates a mandatory prompt for the latest response, and unlocks only after feedback succeeds").

## Constraints

- Collecting feedback wins over the learner's burden: the learner rates every tutor reply before writing again, and the rating stays one quick step (constitution priority rule R8).
- Result and closure messages are inserted only by database functions; the answer key reaches a public message only inside the result message at its publication point (AD-12).
- Every mutating operation is repeatable: a message send repeated by a retry or a second tab creates no duplicate (AD-7).

## Done when

- Every invariant names its PRD requirement, its spine decision where one governs it, and its guard.
- Every touch point below is also listed in the epic it names.

## Boundaries

- Touch point: server authority, repeatable requests and persistence — owner: epic-platform-guarantees
- Touch point: the learner seat and observer read-only rule — owner: epic-identity-and-access
- Touch point: judging of saved learner messages — owner: epic-learning-progress
- Touch point: the content of tutor replies — owner: epic-ai-suggestions
- Touch point: character replies that the rating gate covers — owner: epic-cyberbullying-rooms
- Touch point: result messages, which are never rated — owner: epic-transfer-assessment
- Not here: clearing chat history, which is not a supported feature.

## References

- parent — `_bmad-output/initiative-platform-baseline/initiative-platform-baseline.md`, Requirements R5
- architecture — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md`, AD-7, AD-12
- prd — `_bmad-output/initiative-platform-baseline/prd-tutor-platform/prd-tutor-platform.md`, section 4.3

## Notes

- Planned change (issue #46; PRD FR-16, FR-54): while the temporary exit assessment is in force, transfer assessment questions, open and hidden or ended and shown again, are not rating targets for R3. Not yet built; update R3 and its guard in the implementation PR.
