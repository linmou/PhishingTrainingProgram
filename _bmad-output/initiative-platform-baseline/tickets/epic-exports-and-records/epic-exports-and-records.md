---
type: epic
title: "Exports and review records"
parent: initiative-platform-baseline
covers: [R11]
refined: true
risk: low
---

# Exports and review records

## Description

Every participant can download the room's export as TXT or JSON, with content that depends on their role. The room owner's reviews of AI drafts are recorded for later analysis. This epic lists the invariants that exist today.

## Outcome

For anyone adding data to exports or records: what is exported, to whom, and what is recorded is written once, with the requirement each comes from and the test that guards it.

## Requirements

Test paths are from the repository root.

- R1 (parent R11; prd FR-50; C5): Any participant can download the room's export as TXT or JSON. The room owner's export additionally includes the tutor-review records and a summary of suggestion actions. The learner's export includes their own transfer-assessment attempts. Cyberbullying exports include the learner's learning progress for every participant, observers included. No export contains private transfer-assessment material beyond what result messages publish. Guard: `tutor-system/src/contexts/__tests__/RoomContext.roleBasedExport.test.tsx` ("should include AI summary for tutors"); `tutor-system/src/contexts/__tests__/roomExportBuilder.transfer.test.ts` ("exports the target learner retry state without terminal disclosure"; "keeps every private assessment field out of the learner JSON export"); `tutor-system/src/services/__tests__/cyberbullyingProgress.test.ts` ("reads and exports understanding plus behavior targets with their learner and evidence identities").
- R2 (parent R11; prd FR-51): The system records, for every AI suggestion, assessment draft and character draft, the suggestion action, the original and final text, the response time, the context messages, the original and final Guard state, and the instruction label or character. No IP address or browser information is recorded, and the records are kept with the room after use. Guard: `tutor-system/src/__tests__/ai_suggestion_tracking.bdd.test.tsx` ("Track response time metrics"; "Contextual message tracking"); `tutor-system/supabase/tests/cyberbullying_browser_draft.sql`; `tutor-system/src/services/__tests__/aiService.feedbackInstruction.test.ts` ("records an unsent character review with separate originals and edits through the shared table").

## Constraints

- Collecting data for refinement is part of the product (constitution P8); private assessment material reaches participants only at its publication point (constitution C5; AD-12).
- Data is deleted only by an owner's confirmed room deletion; records are kept with the room (constitution C4).
- Nothing secret is stored in a public table; raw AI output lives in the private schema (AD-12).

## Done when

- Every invariant names its PRD requirement, its spine decision where one governs it, and its guard.
- Every touch point below is also listed in the epic it names.

## Boundaries

- Touch point: persistence and server authority — owner: epic-platform-guarantees
- Touch point: roles that decide export content — owner: epic-identity-and-access
- Touch point: the learner's progress in exports — owner: epic-learning-progress
- Touch point: review actions that are recorded — owner: epic-ai-suggestions
- Touch point: assessment attempts and result messages — owner: epic-transfer-assessment
- Touch point: character replies and every participant's progress — owner: epic-cyberbullying-rooms
- Not here: IP addresses or browser information, which are never recorded.

## References

- parent — `_bmad-output/initiative-platform-baseline/initiative-platform-baseline.md`, Requirements R11
- architecture — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md`, AD-8, AD-12
- architecture seed — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-seed-tutor-platform.md`, roles and their names today
- prd — `_bmad-output/initiative-platform-baseline/prd-tutor-platform/prd-tutor-platform.md`, section 4.6

## Notes

- Source conflict: R1 — prd FR-50 puts a summary of suggestion actions in the room owner's export; the JSON owner export has none (a test asserts it is undefined), and cyberbullying exports carry one learner's progress, not every participant's.
