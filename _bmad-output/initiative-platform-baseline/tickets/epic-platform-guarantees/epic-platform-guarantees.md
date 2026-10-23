---
type: epic
title: "Platform guarantees"
parent: initiative-platform-baseline
covers: [R12, R13]
refined: false
risk: medium
---

# Platform guarantees

## Description

The rules every other epic relies on: the server decides grades and progress, repeating a request has no duplicate effect, state survives reloads and several tabs, failures are shown, an outdated client is told to reload, and the app works on desktop, tablet and phone.

## Outcome

For anyone changing shared behavior: the cross-cutting guarantees are written once, so a feature plan can check itself against them.

## Boundaries

- Touch point: every other epic follows these guarantees; this epic owns the Supabase project, the Edge Function gateway and the AI provider gateway they use.
- Not here: any single feature's behavior.

## Done when

- Each invariant names its PRD requirement, its spine decision and the test that guards it.

## References

- parent — `_bmad-output/initiative-platform-baseline/initiative-platform-baseline.md`, Requirements R12, R13
- architecture — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md`, AD-1, AD-4, AD-7, AD-10, AD-11
