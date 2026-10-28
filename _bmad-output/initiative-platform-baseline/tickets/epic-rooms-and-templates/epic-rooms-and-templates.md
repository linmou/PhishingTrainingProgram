---
type: epic
title: "Rooms and templates"
parent: initiative-platform-baseline
covers: [R4]
refined: true
risk: medium
---

# Rooms and templates

## Description

A tutor creates a room of one practice type, fixed at creation, from a template of that practice type. Test rooms stay out of teaching lists. The owner sees the rooms they own and can delete one after confirming.

## Outcome

For anyone adding a practice type or changing room setup: the room lifecycle and its fixed practice type are written once, with the requirement each comes from and the test that guards it.

## Requirements

Test paths are from the repository root.

- R1 (parent R4; prd FR-4): A tutor can create a room with a title, description, preset image, original poster, optional password and pre-populated dialogue, and is taken into it as its room owner. An empty title is refused ("Room title is required"). A custom original poster requires a name, and password mode requires a password. With no image chosen, the default preset image is used. Guard: `tutor-system/src/__tests__/room_management.bdd.test.tsx` ("Room creation form validation").
- R2 (parent R4; prd FR-5; AD-9): A tutor chooses the practice type when creating a room; it can never change afterwards, and any attempt to change it is refused. Every behavior that differs by practice type (AI jobs, sending, export, available operations) is chosen from the stored practice type, never from client-supplied labels. A cyberbullying room or template without a complete scenario is refused. Guard: `tutor-system/supabase/tests/cyberbullying_practise.sql` ("mutable practice type", error PRACTICE_TYPE_IMMUTABLE).
- R3 (parent R4; prd FR-6): A tutor can pre-fill room creation from a template of the selected practice type. Only templates of that practice type are offered. Choosing a template sets scenario, image, original poster, password and pre-populated dialogue, and clears stale values. Templates are read-only to tutors; there is no "save as template". Guard: `tutor-system/src/__tests__/room_template_management.test.tsx` ("should clear stale password and custom OP state when selected template does not define them").
- R4 (parent R4; prd FR-8): A tutor can create test rooms only from the test-room area. Test rooms do not appear on the tutor's main dashboard, in student room lists or in observer room lists, and test-only templates are not offered in the normal creation form. Guard: `tutor-system/src/pages/__tests__/StudentView.roomVisibility.test.tsx` ("shows real teaching rooms and hides marker + Demo: + DemoTutor harness + marked creates").
- R5 (parent R4; prd FR-9; C4; AD-14): A tutor can see the rooms they own whenever they return, and delete one after confirming. Deleting a room removes the room and everything it holds, including its students' messages, learning progress and private assessment records. Only the room owner can delete a room; the server refuses anyone else. Deletion needs an explicit confirmation and cannot be undone. Guard: `tutor-system/src/pages/__tests__/TutorView.modal.test.tsx` ("should handle delete room successfully"); `tutor-system/supabase/tests/cyberbullying_practise.sql` ("room deletion cleans dialogue").

## Constraints

- Data is deleted only by a tutor's explicit, confirmed deletion of a room they own; no other action removes it: not clearing history, reusing a room or releasing the learner seat (constitution C4, priority rule R2).
- The room's practice type is set at creation and is the only branch key for practice-specific behavior (AD-9).
- The only operation that removes room data is one owner-checked database function that deletes the room and everything it holds in both the public and private schemas (AD-14).

## Done when

- Every invariant names its PRD requirement, its spine decision where one governs it, and its guard.
- Every touch point below is also listed in the epic it names.

## Boundaries

- Touch point: server authority and persistence — owner: epic-platform-guarantees
- Touch point: joined users, roles and the learner seat — owner: epic-identity-and-access
- Touch point: cyberbullying scenario creation and the five shared targets — owner: epic-cyberbullying-rooms
- Touch point: phishing learning-target setup — owner: epic-learning-progress
- Not here: reuse of rooms, release of the learner seat, tutor-made templates.

## References

- parent — `_bmad-output/initiative-platform-baseline/initiative-platform-baseline.md`, Requirements R4
- architecture — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md`, AD-8, AD-9, AD-14
- architecture seed — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-seed-tutor-platform.md`, roles and their names today
- prd — `_bmad-output/initiative-platform-baseline/prd-tutor-platform/prd-tutor-platform.md`, section 4.2

## Notes

- Source conflict: R5 — prd FR-9 lets only the room owner delete a room; a database test deletes a room as an anonymous user, and the client only warns when the owner does not match.
