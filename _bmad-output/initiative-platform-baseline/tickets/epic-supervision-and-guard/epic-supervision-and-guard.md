---
type: epic
title: "Owner supervision and Guard"
parent: initiative-platform-baseline
covers: [R3]
refined: false
risk: high
---

# Owner supervision and Guard

## Description

Only the room owner uses tutor controls and decides Guard. No AI text reaches a learner without the owner's send. The room owner is never the learner of their own room. While Guard is on, learning progress pauses.

## Outcome

For anyone adding a tutor control or an automatic action: the owner-only and Guard rules are written once.

## Boundaries

- Touch point: the Guard recommendation in AI suggestions belongs to epic-ai-suggestions; how Guard defers progress belongs to epic-learning-progress; how it holds assessment answers belongs to epic-transfer-assessment.
- Not here: violation counting or automatic enforcement.

## Done when

- Each invariant names its PRD requirement, its spine decision and the test that guards it.

## References

- parent — `_bmad-output/initiative-platform-baseline/initiative-platform-baseline.md`, Requirements R3
- architecture — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md`, AD-5, AD-8, AD-13
