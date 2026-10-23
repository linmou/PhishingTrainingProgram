---
type: epic
title: "Platform guarantees"
parent: initiative-platform-baseline
covers: [R12, R13]
refined: true
risk: medium
---

# Platform guarantees

## Description

The rules every other epic relies on: the server decides grades and progress, repeating a request has no duplicate effect, state survives reloads and several tabs, failures are shown, an outdated client is told to reload, AI provider credentials stay on the server, and the app works on desktop, tablet and phone. This epic lists the guarantees that exist today. A new feature checks itself against them.

## Outcome

For anyone changing shared behavior: the cross-cutting guarantees are written once, with the requirement each comes from and the test that guards it.

## Requirements

Test paths are from the repository root.

- R1 (parent R12; prd NFR-2; C3; AD-1, AD-2): Grading, attempt counting, whether a transfer assessment is due, learning progress changes, the learner seat and private transfer-assessment data are decided on the server. The browser never grades or changes learning progress directly. Guard: `tutor-system/src/contexts/__tests__/RoomContext.transferAnswer.test.tsx` ("does not grade or write progress in the browser"); `tutor-system/supabase/tests/transfer_assessment_direct_roles.sql`; `tutor-system/supabase/tests/final_assessment_after_understanding.sql`.
- R2 (parent R12; prd NFR-5; AD-7): Repeating any request (send, attempt, delivery, judging) produces no duplicate effect, and concurrent requests resolve to one outcome. Guard: `tutor-system/supabase/tests/transfer_assessment_rpc_behaviour.sql` (cases duplicate, cas_conflict, delivery_retry).
- R3 (parent R12; prd NFR-6; C4): The application identity, conversation, learning progress and transfer-assessment state survive reloads, reconnects and multiple tabs. Rooms are kept after use. Guard: `tutor-system/src/contexts/__tests__/AuthContext.test.tsx` ("should restore user from localStorage on initialization").
- R4 (parent R12; prd NFR-7): When something needed is missing or fails (conversation history, learning targets, AI output, configuration), the user gets a clear error, with no placeholder content and no hidden fallback. Guard: `tutor-system/src/services/__tests__/aiService.externalFailure.test.ts` ("returns an error instead of a generic dummy suggestion…").
- R5 (parent R12; prd NFR-11; AD-11): A browser running an outdated version of the app is told to reload, rather than writing data under old rules. Guard: `tutor-system/supabase/functions/assessment-api/index.test.ts` ("rejects missing and outdated client contracts…").
- R6 (parent R13; prd NFR-12): The app is a responsive web app for desktop, tablet and phone in current mainstream browsers. Guard: `tutor-system/src/__tests__/observer_view_steps.test.tsx` ("Observer interface is responsive on mobile devices").
- R7 (parent R12; prd NFR-3; C6; AD-11): AI provider credentials never reach the browser; every AI call is made by a server function. Guard: `tutor-system/src/services/__tests__/aiService.edgeBoundary.test.ts` ("invokes ai-api with chat data and never sends provider credentials from React").

## Constraints

- The server decides grades, attempts and progress changes from recorded evidence; the browser never decides them (constitution C3).
- Data is deleted only by a tutor's explicit, confirmed deletion of a room they own (constitution C4).
- AI provider credentials never reach the browser (constitution C6).
- Every mutating operation carries a request id that the caller keeps across retries of the same user action (AD-7); every breaking change to a request or response shape bumps the contract version in the order AD-11 gives.

## Done when

- Every invariant names its PRD requirement, its spine decision and its guard.
- Every touch point below is also listed in the epic it names.

## Boundaries

- Touch point: identity, joining and the learner seat follow these guarantees — owner: epic-identity-and-access
- Touch point: room creation and deletion follow these guarantees — owner: epic-rooms-and-templates
- Touch point: messages and ratings follow these guarantees — owner: epic-conversation
- Touch point: judging and progress follow server authority and repeatable requests — owner: epic-learning-progress
- Touch point: owner-only controls and Guard follow these guarantees — owner: epic-supervision-and-guard
- Touch point: AI calls follow the credential and version-handshake rules — owner: epic-ai-suggestions
- Touch point: grading follows server authority and repeatable requests — owner: epic-transfer-assessment
- Touch point: cyberbullying judging and drafts follow these guarantees — owner: epic-cyberbullying-rooms
- Touch point: exports and records follow the persistence guarantee — owner: epic-exports-and-records
- Touch point: the Supabase project, the Edge Function gateway and the AI provider gateway — used by every epic that stores state or calls the AI; owner: this epic.
- Not here: any single feature's behavior.

## References

- parent — `_bmad-output/initiative-platform-baseline/initiative-platform-baseline.md`, Requirements R12, R13
- architecture — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md`, AD-1, AD-2, AD-7, AD-10, AD-11
- architecture seed — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-seed-tutor-platform.md`, roles and their names today
- prd — `_bmad-output/initiative-platform-baseline/prd-tutor-platform/prd-tutor-platform.md`, section 8

## Notes

- Source conflict: R4 — prd NFR-7 allows no hidden fallback; the code falls back to a local-only user after three failed connection attempts at join.
- Source conflict: R5 — prd NFR-11 tells an outdated browser to reload; the server rejects it with a reload code, but no client code handling it was found.
