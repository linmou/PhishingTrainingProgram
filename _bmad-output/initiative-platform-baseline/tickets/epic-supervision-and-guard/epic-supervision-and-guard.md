---
type: epic
title: "Owner supervision and Guard"
parent: initiative-platform-baseline
covers: [R3]
refined: true
risk: high
---

# Owner supervision and Guard

## Description

Only the room owner uses tutor controls and decides Guard. No AI text reaches a learner without the owner's send. The room owner is never the learner of their own room. While Guard is on, learning progress pauses.

## Outcome

For anyone adding a tutor control or an automatic action: the owner-only and Guard rules are written once, with the requirement each comes from and the test that guards it.

## Requirements

Test paths are from the repository root.

- R1 (parent R3; prd FR-52; constitution rules R5, R9; AD-8): Only the room owner can use tutor controls in a room: the AI assistant, tutor review, Guard, learning-target setup, manual learning progress edits, in-room assessment and tutor replies. Another tutor who opens the room has none of these controls and takes part as an observer. The screen shows tutor controls only to the room owner. The server refuses these operations from anyone but the room owner: publishing a tutor reply or reviewed AI text, editing learning progress, and delivering or grading an assessment. The room owner is never the learner of their own room and never answers an assessment, whatever role their profile shows (initiative R3; the learner-seat rules themselves are in epic-identity-and-access). Guard: `tutor-system/supabase/tests/cyberbullying_browser_draft.sql` ("wrong owner accepted").
- R2 (parent R3; prd FR-30; constitution rule R9; AD-5, AD-8): The room owner can turn Guard on or off for the room at any time after confirming; in phishing rooms an AI suggestion may recommend it, and the room owner decides. Guard changes only by the room owner's action; an AI recommendation alone never changes it. Sending a reply records the Guard state and may also apply the Guard state the room owner chose in the composer. While Guard is on, the room owner's tutor replies are shown as "Security Supervisor" and learning progress pauses. When the AI recommends Guard, and how a Guard tutor reply is worded, is governed by the tutor behavior specification G01 to G03. Guard: `tutor-system/src/__tests__/guardModeComposerIdentity.integration.test.tsx` ("does not persist a header mode transition when confirmation is cancelled"); `tutor-system/scripts/browser-e2e/workflows/guard-mode.js`.
- R3 (parent R3; prd NFR-1; constitution C1; AD-13): No AI-generated text reaches a learner without the room owner's explicit send, and the AI assistant never changes room state on its own. Guard: `tutor-system/supabase/tests/cyberbullying_browser_draft.sql` ("unsent reviews cannot publish"); `tutor-system/src/pages/__tests__/RoomPagePost.transferDraft.test.tsx` ("discards the candidate through the room context without delivering anything").

## Constraints

- No AI-generated text reaches a learner unless the room owner sends it (constitution C1).
- Supervision wins over speed: every AI draft is reviewed by the room owner, who may reject it and write their own reply, even when that is slower (constitution priority rule R4); only the room owner uses tutor controls in a room (priority rule R5).
- At the pilot stage the screen may enforce a tutor-only control alone, except where a failure causes immediate harm or breaks C1–C6 (priority rule R9).
- The room's Guard flag is changed only by the room owner: through its confirmed operation, or by a reply send that applies the Guard state chosen in the composer (AD-5).
- Publishing a tutor reply or reviewed AI text, editing learning progress, delivering or grading an assessment, and deleting a room are database functions that check the actor's room role; other tutor-only controls may be gated by the screen alone (AD-8). The owner of a room never holds its learner seat and never answers an assessment (AD-8).
- AI text becomes a learner-visible message only through the reviewed-send function, which checks the actor is the room's owner (AD-13).

## Done when

- Every invariant names its PRD requirement, its spine decision where one governs it, and its guard.
- Every touch point below is also listed in the epic it names.

## Boundaries

- Touch point: server authority and repeatable requests — owner: epic-platform-guarantees
- Touch point: the room's owner record and observer role — owner: epic-identity-and-access
- Touch point: how Guard pauses and replays progress — owner: epic-learning-progress
- Touch point: the Guard recommendation and the review and send flow — owner: epic-ai-suggestions
- Touch point: how Guard holds assessment answers — owner: epic-transfer-assessment
- Touch point: Guard override on character replies — owner: epic-cyberbullying-rooms
- Not here: violation counting or automatic enforcement; the wording of Guard replies, which the AI behavior specifications govern.

## References

- parent — `_bmad-output/initiative-platform-baseline/initiative-platform-baseline.md`, Requirements R3
- architecture — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md`, AD-5, AD-8, AD-13
- architecture seed — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-seed-tutor-platform.md`, roles and their names today
- prd — `_bmad-output/initiative-platform-baseline/prd-tutor-platform/prd-tutor-platform.md`, sections 4.5 and 8
