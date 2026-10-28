---
type: epic
title: "Cyberbullying rooms"
parent: initiative-platform-baseline
covers: [R10]
refined: true
risk: medium
---

# Cyberbullying rooms

## Description

In a cyberbullying room the learner writes about a scenario from a cyberbullying template, the server judges against five shared learning targets, and the room owner replies through reviewed character drafts that every participant sees under the same character. This epic lists the invariants that exist today.

## Outcome

For anyone changing the cyberbullying practice or adding a practice type: what is specific to this practice is written once, with the requirement each comes from and the test that guards it.

## Requirements

Test paths are from the repository root.

- R1 (parent R10; prd FR-7): A tutor can choose a cyberbullying template, edit its post and pre-populated dialogue, and create a room. For a cyberbullying room only cyberbullying templates are offered, and creation is refused until one is chosen ("Choose a Cyberbullying template."). Edited pre-populated dialogue keeps each comment's original author. The AI assistant is on for every cyberbullying room. Guard: `tutor-system/src/__tests__/room_template_management.test.tsx` ("creates $id from its template with its full scenario and edited post"; "lists only Cyberbullying templates for Cyberbullying practice"; "keeps creation blocked until a Cyberbullying template is chosen"); `tutor-system/scripts/browser-e2e/workflows/cyberbullying.js`.
- R2 (parent R10; prd FR-44): Every cyberbullying learner gets the same five learning targets when they join: recognize cyberbullying and its impact; show empathy and support; stand up constructively; avoid reinforcing bullying; choose a safe next step. Targets are set up once per learner and room, even if the learner joins from several tabs. They cannot be edited, removed or varied by scenario, but manual progress edits remain available. Only the learner's own messages provide evidence. Guard: `tutor-system/supabase/tests/cyberbullying_practise.sql` (exactly five targets initialized; rejoining is idempotent; observer has no learner evidence; custom target rejected with SHARED_TARGETS_REQUIRED).
- R3 (parent R10; prd FR-45): A cyberbullying room supports exactly: save a learner message, judge it against the learning targets, request a character draft, tutor review, regenerate, reject, send, rate, continue, and override Guard. Transfer assessments and Quick Adjust are refused. A learning target is complete when it is Covered. Guard: `tutor-system/supabase/tests/cyberbullying_practise.sql` (unsupported preparation and clear refused with FORBIDDEN); `tutor-system/src/contexts/__tests__/RoomContext.multiAgentDraft.test.tsx` ("regenerates with character workflow parameters").
- R4 (parent R10; prd FR-46; C3): A learner's message is saved first, then judged against the five targets. If judging fails, the message stays saved. Guard: `tutor-system/src/contexts/__tests__/RoomContext.cyberbullying.test.tsx` ("stores a learner comment before analysis and leaves it available when analysis fails").
- R5 (parent R10; prd FR-47; C1; AD-13): The room owner can request one character draft for the learner's latest message, choosing the character or letting the AI assistant choose. Inputs: the stored scenario, the complete conversation with each speaker's character attribution, the chosen character if any, and the Guard state. Output: one character and its text. Audience: the room owner only. If the room owner chose a character, the draft uses it. A request is refused when the AI assistant is off or there is no learner message. Guard: `tutor-system/supabase/functions/ai-api/index.test.ts` ("cyberbullying reads full context and returns a browser draft for each role without persistence writes"; "cyberbullying rejects missing identity and ownership before contacting the provider"); `tutor-system/supabase/tests/cyberbullying_browser_draft.sql`.
- R6 (parent R10; prd FR-48; C1; R4): The room owner can change a character draft's character and text, regenerate it, reject it, override Guard, and send it as a character reply. The room owner cannot send a tutor reply without first requesting and reviewing a character draft. Sending saves the character reply, its suggestion action and the Guard state together. Suggestion actions follow the AI suggestions epic; changing only the character records `modified`. The chosen character applies to that draft only. Guard: `tutor-system/src/contexts/__tests__/RoomContext.cyberbullying.test.tsx` ("a character-only edit is modified even when the original text and Guard are unchanged"); `tutor-system/supabase/tests/cyberbullying_browser_draft.sql` ("failed reviews roll back publication"); `tutor-system/src/services/__tests__/guardModeService.test.ts` ("uses one RPC for the message, feedback, and room-mode transaction").
- R7 (parent R10; prd FR-49): Every participant sees a character reply under the same character and persona name, live and after reload; the AI assistant and exports carry the same character. Sent character replies cannot be edited. Guard: `tutor-system/src/contexts/__tests__/RoomContext.cyberbullying.test.tsx` ("realtime/reload projection keeps stored character identity for every viewer"); `tutor-system/supabase/tests/cyberbullying_browser_draft.sql` (persona copilot:tom).

## Constraints

- No AI-generated text reaches a learner unless the room owner sends it (constitution C1).
- The server decides grades, attempts and progress changes from recorded evidence (constitution C3).
- One shared mechanism wins unless a practice type needs a different behavior for learning reasons: all learning targets are judged the same way, and transfer assessments accept option selections only (constitution priority rule R7).
- The room's practice type is fixed at creation and cyberbullying rooms always use the trusted path (AD-2, AD-9).

## Done when

- Every invariant names its PRD requirement, its spine decision where one governs it, and its guard.
- Every touch point below is also listed in the epic it names.

## Boundaries

- Touch point: server authority, request ids and persistence — owner: epic-platform-guarantees
- Touch point: room creation and templates — owner: epic-rooms-and-templates
- Touch point: the rating gate on character replies — owner: epic-conversation
- Touch point: progress states and manual edits — owner: epic-learning-progress
- Touch point: Guard override — owner: epic-supervision-and-guard
- Touch point: tutor review and send actions — owner: epic-ai-suggestions
- Touch point: cyberbullying exports with every participant's progress — owner: epic-exports-and-records
- Not here: transfer assessments and Quick Adjust, which cyberbullying rooms refuse; scenario-specific learning targets.

## References

- parent — `_bmad-output/initiative-platform-baseline/initiative-platform-baseline.md`, Requirements R10
- architecture — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md`, AD-2, AD-9, AD-13
- architecture seed — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-seed-tutor-platform.md`, roles and their names today
- prd — `_bmad-output/initiative-platform-baseline/prd-tutor-platform/prd-tutor-platform.md`, section 6

## Notes

- Source conflict: R5 — prd FR-47 refuses a request when no learner message exists; only a foreign-room parent is tested, not the empty case.
