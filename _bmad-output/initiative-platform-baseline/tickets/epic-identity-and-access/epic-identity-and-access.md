---
type: epic
title: "Identity and room access"
parent: initiative-platform-baseline
covers: [R1, R2]
refined: false
risk: medium
---

# Identity and room access

## Description

A person joins with a name and role, keeps that identity across reloads, and leaves. Students find rooms and enter them, with the password if one is set. The first student becomes the room's only learner for the room's whole life; everyone else observes read-only.

## Outcome

For anyone changing who can do what in a room: the join, learner-seat and observer rules are written once.

## Boundaries

- Touch point: room creation and ownership belong to epic-rooms-and-templates; owner-only controls belong to epic-supervision-and-guard.
- Not here: authentication; the identity only identifies users.

## Done when

- Each invariant names its PRD requirement, its spine decision and the test that guards it.

## References

- parent — `_bmad-output/initiative-platform-baseline/initiative-platform-baseline.md`, Requirements R1, R2
- architecture — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md`, AD-8
