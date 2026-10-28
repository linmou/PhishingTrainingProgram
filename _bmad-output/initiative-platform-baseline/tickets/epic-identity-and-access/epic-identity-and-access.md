---
type: epic
title: "Identity and room access"
parent: initiative-platform-baseline
covers: [R1, R2]
refined: true
risk: medium
---

# Identity and room access

## Description

A person joins with a name and role, keeps that identity across reloads, and leaves. Students find rooms and enter them, with the password if one is set. The first student becomes the room's only learner for the room's whole life; everyone else observes read-only. The identity identifies users but does not authenticate them.

## Outcome

For anyone changing who can do what in a room: the join, learner-seat and observer rules are written once, with the requirement each comes from and the test that guards it.

## Requirements

Test paths are from the repository root.

- R1 (parent R1; prd FR-1): A visitor enters a display name and chooses tutor, student or observer to get an application identity. An empty or whitespace-only name is refused with "Please enter your name" and nothing is created. The same normalized name (trimmed, lower-cased, spaces collapsed) with the same role always selects the same user. After joining, the user lands on their role's dashboard, and reloading keeps them signed in. Guard: `tutor-system/src/components/__tests__/SimpleLogin.test.tsx` ("shows error when submitting empty name"); `tutor-system/src/contexts/__tests__/AuthContext.test.tsx`.
- R2 (parent R1; prd FR-2): A user can change their display name, role and avatar (from presets). The changes are saved to the user record and to the browser, and the user identifier does not change when name or role changes. Guard: `tutor-system/src/contexts/__tests__/AuthContext.test.tsx` ("should persist user data after role changes").
- R3 (parent R1; prd FR-3; C4): A user can leave, which removes the application identity from this browser only; leaving deletes no user, room, message or learning progress data. Guard: `tutor-system/src/contexts/__tests__/AuthContext.test.tsx` ("should clear localStorage on sign out").
- R4 (parent R2; prd FR-10): A room owner can set a room password; anyone except the room owner must enter it before the room opens. A wrong password shows "Incorrect password. Please try again." and keeps the prompt open; cancel returns home. The room owner is never prompted. The password is a convenience gate, not a security control. Guard: `tutor-system/src/__tests__/room_management.bdd.test.tsx` ("Entering incorrect password for room access"; "Canceling password prompt").
- R5 (parent R2; prd FR-11): A student sees active rooms other than test rooms with title, tutor, description, image and status, can search them, and sees the list update live. Status is Available, Observer Available (the room has a learner) or Your Session, with Join, Observe or Rejoin actions. With no visible rooms the student sees "No rooms available" and a waiting message. Guard: `tutor-system/src/pages/__tests__/StudentView.roomVisibility.test.tsx` ("shows empty waiting state when every returned room is hidden"); `tutor-system/src/__tests__/room_discovery.test.tsx` ("should show new rooms without refreshing").
- R6 (parent R2; prd FR-12; AD-8): A student can become a room's learner if it has none; any later student enters as an observer. At most one learner exists per room at any time, enforced on the server. The room owner is never the learner of their own room and never answers an assessment, whatever role their profile shows. The learner keeps the seat for the room's whole life, and rooms are not reused for another learner. Guard: `tutor-system/supabase/tests/unified_room_progress.sql` ("Concurrent first joins did not arbitrate to one learner seat").
- R7 (parent R2; prd FR-13): An observer can list active rooms other than test rooms and open any of them read-only. Observers have no message composer and see a read-only notice, and cannot post, answer transfer assessments or rate. Guard: `tutor-system/supabase/functions/assessment-api/index.test.ts` ("observer cannot post a message or answer through the trusted API").
- R8 (parent R1; prd NFR-4): The application identity identifies users but does not authenticate them, and room data is readable and writable by any client of the app, except the private material in NFR-3. This is accepted for the current small-scale pilot: anyone can act as any user by typing the same name and role, and any participant can read any room's messages and password. Guard: none.

## Constraints

- No AI text reaches a learner unless the room owner sends it (constitution C1); the room owner never holds the learner seat (AD-8).
- Within a room, owner, learner and observer are derived from the room's own records, never from the user's profile role (AD-8).
- Conflicts between ease of use and trustworthy attribution are decided by constitution priority rule R1: ease and speed win under close adult supervision, and attribution relies on that supervision.

## Done when

- Every invariant names its PRD requirement, its spine decision where one governs it, and its guard.
- Every touch point below is also listed in the epic it names.

## Boundaries

- Touch point: server authority, repeatable requests and persistence — owner: epic-platform-guarantees
- Touch point: room creation and ownership — owner: epic-rooms-and-templates
- Touch point: owner-only controls — owner: epic-supervision-and-guard
- Touch point: the learner's messaging and ratings — owner: epic-conversation
- Touch point: role-based exports — owner: epic-exports-and-records
- Not here: authentication, accounts, passwords or email sign-in; more than one learner per room.

## References

- parent — `_bmad-output/initiative-platform-baseline/initiative-platform-baseline.md`, Requirements R1, R2
- architecture — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md`, AD-8
- architecture seed — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-seed-tutor-platform.md`, roles and their names today
- prd — `_bmad-output/initiative-platform-baseline/prd-tutor-platform/prd-tutor-platform.md`, sections 4.1, 4.3
