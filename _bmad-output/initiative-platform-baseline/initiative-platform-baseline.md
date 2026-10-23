---
type: initiative
title: "Platform baseline: the tutor platform as built"
parent: none
sources:
  - _bmad-output/initiative-platform-baseline/prd-tutor-platform/prd-tutor-platform.md
  - _bmad-output/initiative-platform-baseline/constitution-product/constitution-product.md
companions:
  - _bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md
  - _bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-seed-tutor-platform.md
risk: medium
---

# Platform baseline: the tutor platform as built

## Description

The tutor platform already exists: tutors run phishing and cyberbullying practice rooms, learners write, the server judges learning progress, and tutors review AI drafts before anything reaches a learner. This initiative records what the platform guarantees today as capability epics, each listing its invariants, so a proposed new feature can be checked against the epics it touches before it is built. It builds nothing; stories appear only when new work is planned against an epic.

## Outcome

For the people who plan and build the platform: before a new feature is built, they name the baseline epics it touches and see the invariants it must keep. The signal is a feature plan that lists its touched epics and shows no conflict with their invariants.

## Requirements

- R1 (prd FR-1, FR-2, FR-3, NFR-4): A person joins with a name and role, keeps that identity across reloads, and leaves; no account or password is needed.
- R2 (prd FR-10, FR-11, FR-12, FR-13): A student finds rooms and enters them (with the room password if one is set); the first student becomes the room's only learner for the room's whole life; everyone else observes read-only.
- R3 (prd FR-30, FR-52, NFR-1): Only the room owner uses tutor controls, including turning Guard on or off; no AI text reaches a learner unless the room owner sends it; the room owner is never the learner of their own room.
- R4 (prd FR-4, FR-5, FR-6, FR-7, FR-8, FR-9): A tutor creates a room of one practice type, fixed at creation, from a template or a pinned scenario; test rooms stay out of teaching lists; the owner sees the rooms they own and can delete one after confirming.
- R5 (prd FR-14, FR-15, FR-16, NFR-8): Every participant sees the same live conversation within about 2 seconds, and the learner rates every tutor reply before writing again.
- R6 (prd FR-18, FR-19, FR-20, FR-44, NFR-9): Every learner has learner-owned learning targets; each learner message is judged against each target on the server; the quality of that judging is governed by the AI behavior specifications.
- R7 (prd FR-21, FR-22, FR-23, FR-53): Learning progress moves only through the defined states and events, is shown to the room owner, can be corrected by hand by the room owner, and pauses while Guard is on.
- R8 (prd FR-24 to FR-29, NFR-9, NFR-10): The room owner requests an AI suggestion, reviews, edits and sends it, and sets the AI role; a change of AI model or prompt is re-evaluated before release.
- R9 (prd FR-31 to FR-43, NFR-3): When a learner moves a learning target from Partial to Covered, a transfer assessment becomes due; the room owner reviews and sends or rejects it; the learner answers with option controls; the server grades up to two attempts and saves result messages, publishing the correct answer only after the second wrong attempt.
- R10 (prd FR-7, FR-44 to FR-49): In a cyberbullying room the learner writes about a pinned scenario, the server judges against five shared learning targets, and the room owner replies through reviewed character drafts that every participant sees under the same character.
- R11 (prd FR-50, FR-51): Every participant can download the room's export, and the room owner's reviews of AI drafts are recorded for later analysis.
- R12 (prd NFR-2, NFR-5, NFR-6, NFR-7, NFR-11): Grading and progress are decided on the server, repeating a request has no duplicate effect, state survives reloads and several tabs, failures are visible, and an outdated client is told to reload.
- R13 (prd NFR-12): The app is a responsive web app for desktop, tablet and phone in current mainstream browsers.

## Constraints

- The product constitution binds every epic: no AI text reaches a learner without the room owner's send (constitution C1); progress changes only from the learner's contributions or the owner's recorded edit (C2); the server decides grades and progress (C3); data is deleted only by an owner's confirmed room deletion (C4); private assessment material appears only at its publication point (C5); AI provider credentials never reach the browser (C6).
- Conflicts between principles are decided by the constitution's priority rules R1 to R8, not inside an epic.
- Every epic that touches shared state follows the architecture spine (AD-1 to AD-14), in particular one writer per progress and assessment entity (AD-1), the trusted judging path (AD-2), derived assessment due (AD-3), Guard defers progress (AD-5), roles from the room (AD-8) and no secrets in public tables (AD-12).

## Done when

- Every PRD requirement (FR-1 to FR-53, NFR-1 to NFR-12) is covered by at least one epic.
- Every epic is refined, and each of its invariants names the PRD requirement, the spine decision where one governs it, and the test or evaluation that guards it.
- Every touch point between two epics is listed in both epics.
- A sample new feature, checked against the epics it touches, produces a list of invariants it must keep.

## Boundaries

This initiative covers the platform as built; it does not change behavior. Out: success metrics and goals, custom image upload, more than one learner per room, learning-outcome measurement, consent and retention processes, an accessibility conformance target, accounts and passwords, and clearing chat history.

- Touch point: AI behavior specifications and constitutions (`tutor-system/docs/ai-behaviors/`) — govern the quality of AI output; used by epic-ai-suggestions, epic-transfer-assessment and epic-learning-progress; owner: none, human-approved and outside this initiative.
- Touch point: AI provider gateway and Supabase project — used by every epic that calls the AI or stores state; owner: epic-platform-guarantees.
- Tracer path: a tutor creates a room, a learner joins and writes, the server judges progress, the room owner reviews an AI suggestion and sends it, a transfer assessment becomes due and is sent, the learner answers and is graded, and the export shows it all.

## References

- prd — `_bmad-output/initiative-platform-baseline/prd-tutor-platform/prd-tutor-platform.md`, sections 4 to 8
- constitution — `_bmad-output/initiative-platform-baseline/constitution-product/constitution-product.md`, constraints and priority rules
- architecture — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md`, Invariants & Rules

## Notes

- Assumption: A tutor who is not the room owner takes part as an observer (prd section 12).
