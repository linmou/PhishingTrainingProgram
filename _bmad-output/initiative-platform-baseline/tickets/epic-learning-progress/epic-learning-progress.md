---
type: epic
title: "Learning targets and progress"
parent: initiative-platform-baseline
covers: [R6, R7]
refined: true
risk: high
---

# Learning targets and progress

## Description

Learners have learner-owned learning targets. Each learner message is judged against each target on the server. Progress moves only through the defined states and events, is shown to the room owner and the learner, can be corrected by hand by the room owner, and pauses while Guard is on. This epic lists the invariants that exist today.

## Outcome

For anyone changing how learning is judged or recorded: the states, events and single-writer rules are written once, with the requirement each comes from and the test that guards it.

## Requirements

Test paths are from the repository root.

- R1 (parent R6; prd FR-18; R7): The room owner sets up a phishing room's learning targets by generating them from the room's scenario or entering them by hand, and approves them before they are saved. Generated and hand-entered targets are both learner-owned and judged on the server, whether in-room assessment is on or off. Every phishing template supplies exactly five targets, and custom targets are saved as written, without truncation. Generation that fails or returns nothing invents no targets and says they are unavailable. Until targets exist, the room owner sees a setup reminder and the learner sees "Waiting for the tutor to set up learning targets." Guard: `tutor-system/src/__tests__/checklist_ai_unit.test.ts` ("rejects %s consistently without retrying or inventing targets").
- R2 (parent R6; prd FR-19): Learning targets belong to one learner. Targets saved before the learner joins apply when they join, and that learner's earlier messages are judged oldest first before progress is shown. A learner never receives another learner's progress. If catch-up fails, the saved targets are kept and the room owner can retry; retrying never double-counts. Guard: `tutor-system/src/hooks/__tests__/useChecklist.earlyMessages.integration.test.tsx` ("preserves the draft after a partial failure and safely retries completed evidence").
- R3 (parent R6; prd FR-20, NFR-9; C2; AD-2): Every learner message is judged against each learning target separately, in message order, using the conversation up to that message, and only learning events that pass the contract are applied. A learning event is applied only if it quotes the learner message it is about; tutor replies, character replies and pre-populated dialogue can never supply evidence. A message is judged only after all of that learner's earlier messages. If judging fails for any target, no progress is applied for that message and it stays retryable. Whether a judgment is correct is governed by the learning-event judging specification and checked by evaluation. Guard: `tutor-system/supabase/functions/assessment-api/index.test.ts` ("Cyberbullying settles all five target analyses before applying progress and records failed attempts"; "rejects historical speaker evidence before updating learner status"); `evals/promptfoo/learning-progress-analyzer/`.
- R4 (parent R7; prd FR-21; C3; AD-1): Learning targets move between progress states only in three ways: learning events as defined in the transfer-status response contract, a transfer assessment result, and a manual edit. Pending to Partial on an initial signal; Pending or Partial to Covered on demonstrated understanding; Needs review to Partial on a post-repair signal; any state except Covered to Covered on spontaneous transfer; Partial or Covered to Needs review on contradiction. A learning event not allowed from the current state is recorded as rejected and changes nothing. Guard: `tutor-system/src/services/__tests__/learningProgressTransitions.test.ts` ("applies the complete %s transition column").
- R5 (parent R7; prd FR-22; AD-5): While Guard is on, no learning progress advances. Learning events gathered meanwhile are applied when Guard ends, unless the target's progress state no longer allows them. Guard: `tutor-system/supabase/tests/final_assessment_after_understanding.sql` (scenario guard); `tutor-system/supabase/tests/transfer_assessment_rpc_behaviour.sql` (case guard_manual_replay).
- R6 (parent R7; prd FR-23): The room owner and the learner can open the Learning Progress panel showing each target's progress state and evidence for that learner. The panel never covers the room owner's AI and send controls on desktop, and on narrow screens it uses the full width. Guard: `tutor-system/src/components/__tests__/ChecklistPanel.transfer.test.tsx` ("shows Guard protection while keeping the shared assessment targets visible").
- R7 (parent R7; prd FR-53; C2): The room owner can manually change a target's progress state and add a note. The change appears in the Learning Progress panel for the room owner and the learner, and is recorded as evidence attributed to the room owner. Guard: `tutor-system/src/__tests__/checklist_management.test.ts` ("saves a tutor status update with its note, history row, and manual evidence").

## Constraints

- Learning progress changes only from the learner's own contributions or the room owner's recorded manual edit (constitution C2).
- The server decides grades, attempts and progress changes from recorded evidence; the browser never decides them (constitution C3).
- Item progress changes only through the learning-event writer or the manual progress-edit writer; no new writer is added; history tables are append-only (AD-1).
- Every judging operation is an operation of the trusted gateway, and every new room is on the trusted path; the browser-side judging path serves existing rooms only (AD-2).
- Guard defers progress, not storage; held events replay in creation order and are re-validated (AD-5).

## Done when

- Every invariant names its PRD requirement, its spine decision where one governs it, and its guard.
- Every touch point below is also listed in the epic it names.

## Boundaries

- Touch point: server authority and repeatable requests — owner: epic-platform-guarantees
- Touch point: saved learner messages that judging reads — owner: epic-conversation
- Touch point: Guard, which pauses progress — owner: epic-supervision-and-guard
- Touch point: AI suggestions that read the learner's progress — owner: epic-ai-suggestions
- Touch point: transfer assessments that change progress — owner: epic-transfer-assessment
- Touch point: the five shared cyberbullying targets — owner: epic-cyberbullying-rooms
- Touch point: learning progress in exports — owner: epic-exports-and-records
- Touch point: room creation, where phishing targets are set up — owner: epic-rooms-and-templates
- Not here: the quality of AI judging, which the AI behavior specifications govern; new room-wide learning targets, which are retired.

## References

- parent — `_bmad-output/initiative-platform-baseline/initiative-platform-baseline.md`, Requirements R6, R7
- architecture — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md`, AD-1, AD-2, AD-5, AD-10
- architecture seed — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-seed-tutor-platform.md`, roles and their names today
- prd — `_bmad-output/initiative-platform-baseline/prd-tutor-platform/prd-tutor-platform.md`, sections 4.4, 5.1

## Notes

- Source conflict: R1 — prd FR-18 says a failed generation invents no targets; a test asserts a silent fallback to the template's targets when extraction fails.
