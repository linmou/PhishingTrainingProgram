---
type: epic
title: "Transfer assessment"
parent: initiative-platform-baseline
covers: [R9]
refined: true
risk: high
---

# Transfer assessment

## Description

A transfer assessment becomes due, is reviewed and sent by the room owner, answered and graded with two attempts, and its result messages and effect on progress are saved. This epic lists the invariants that exist today. A new feature that touches assessments, Guard, learning progress or tutor review checks itself against them.

## Outcome

For anyone changing assessments, grading or what learners see about answers: each rule is written once, with the requirement it comes from and the test or evaluation that guards it.

## Requirements

Test paths are from the repository root, under `tutor-system/` unless they start with `evals/`.

- R1 (parent R9; prd FR-32; AD-3): An assessment is due only when a learner moves a learning target from Partial to Covered by demonstrating understanding. Due is derived from progress history and never stored, and one such change never produces two assessments. Guard: `supabase/tests/final_assessment_after_understanding.sql` (scenarios partial, pass, "open assessment blocks duplicate delivery").
- R2 (parent R9; prd FR-33, FR-34): When an assessment is due, the room owner's next request for an AI suggestion returns one assessment draft instead. A draft must have four distinct options A to D, one correct option for single-answer or two or three for multiple-answer, a question of at most two sentences and 80 words, and a non-empty learner explanation; an invalid draft cannot be sent. Guard: `src/__tests__/transfer_assessment.bdd.test.tsx` ("An eligible assessment bypasses the shared tutor"); `src/services/__tests__/assessmentRendering.test.ts`; `src/components/__tests__/AssessmentDraftEditor.test.tsx`.
- R3 (parent R9; prd FR-35; AD-3): The room owner edits and sends a draft, or rejects it. Rejecting delivers nothing to the learner, leaves the assessment due and offered again at the next request, and shows a message naming the learning target whose progress may now be wrong. Learners never see a draft. Guard: `src/pages/__tests__/RoomPagePost.transferDraft.test.tsx` (discard delivers nothing; draft hidden from learner roles).
- R4 (parent R9; prd FR-36; AD-7, C1): The server rechecks a draft before saving it. Delivery is refused if the assessment is no longer due or Guard is on. A retried delivery never creates a second question, and delivery never changes Guard. Guard: `supabase/tests/final_assessment_after_understanding.sql` (not eligible); `supabase/tests/transfer_assessment_rpc_behaviour.sql` (case delivery_retry).
- R5 (parent R9; prd FR-37): Only the learner can answer their own open assessment, by selecting options. Observers and other students cannot answer. Any answer that is not an option selection is refused. Guard: `supabase/functions/assessment-api/index.test.ts` ("observer cannot post a message or answer through the trusted API"); `supabase/tests/transfer_assessment_rpc_behaviour.sql` (cases wrong_actor, invalid_selection).
- R6 (parent R9; prd FR-37): While an assessment is open the learner's ordinary messaging is disabled with an explanation, and it reopens when the assessment closes. Guard: `src/pages/__tests__/RoomPagePost.transferLifecycle.test.tsx`; `scripts/browser-e2e/workflows/assessment-answer.js`.
- R7 (parent R9; prd FR-38; AD-4, AD-5, AD-7): The server grades by exact match and allows at most two attempts. While Guard is on, an answer is held, not graded, and uses no attempt. Repeated, concurrent, late or out-of-scope submissions never create extra attempts. The grade, progress event, attempt and result message are saved together. Guard: `supabase/tests/transfer_assessment_rpc_behaviour.sql` (cases first_wrong, cas_conflict, second_wrong, duplicate, third_submission, terminal_rollback); `supabase/tests/assessment_result_messages.sql` (scenarios guard_raw, rollback).
- R8 (parent R9; prd FR-39; AD-12, C5): Every accepted attempt creates exactly one result message with fixed text. The correct answer and learner explanation appear only in the second-wrong-attempt message. Result messages are written by the server, cannot be edited, are visible to every participant and appear in exports. Guard: `supabase/tests/assessment_result_messages.sql`; `src/components/__tests__/PostComment.transfer.test.tsx`; `src/contexts/__tests__/roomExportBuilder.transfer.test.ts`.
- R9 (parent R9; prd FR-40; AD-1): A passed assessment completes the learning target. A failed one moves it to Needs review. Failure alone never turns on Guard. A completed target is not assessed again unless a later contradiction reopens it. Guard: `supabase/tests/final_assessment_after_understanding.sql` (scenarios pass, failure_repair, contradiction).
- R10 (parent R9; prd FR-41): After an assessment ends, the room owner must send tutor feedback before that learner can get another one. When several are due they are offered one at a time. Guard: `scripts/browser-e2e/workflows/assessment-delivery.js`; `supabase/tests/assessment_result_messages.sql` (feedback required).
- R11 (parent R9; prd FR-42; AD-12): Every participant sees the same assessment, attempts and outcome after joining, reloading, reconnecting or using several tabs, and a late or duplicate update cannot reopen a finished assessment. Guard: `src/contexts/__tests__/transferAssessmentUiAdapter.lifecycle.test.ts`.
- R12 (parent R9; prd FR-31; AD-6): In-room assessment is on by default for phishing rooms; the room owner can turn it off and the operator can turn assessments off everywhere. Turning it off does not close an assessment that is already open, and learning targets, judging and progress work the same either way. Guard: `supabase/tests/room_assessment_default_on.sql`; `supabase/functions/assessment-api/index.test.ts` ("disabled feature makes no storage call").
- R13 (parent R9; prd FR-32; AD-6): A later contradiction cancels a due assessment. Changing the learning target's wording cancels an open one without using an attempt and writes one closure message. Guard: `supabase/tests/final_assessment_after_understanding.sql` (scenarios contradiction, stale_open); `supabase/tests/assessment_result_messages.sql` (scenario target_edit).
- R14 (parent R9; prd FR-33, NFR-9): Whether the new context differs meaningfully from the scenario, and the quality of assessment drafts, are governed by the tutor behavior specification T09.1 to T09.6 and checked by its evaluation suite. Guard: `evals/promptfoo/v1/transfer/metric-registry.json` with `evals/promptfoo/rubrics/v1/medium_transfer_quality.md` and `assessment_item_validity.md`.

## Constraints

- No AI text reaches a learner unless the room owner sends it (constitution C1).
- The server decides grades, attempts and progress changes (C3).
- The answer key and learner explanation reach participants only at their publication point (C5; AD-12).
- Assessment state has one writer per entity (AD-1) and grading is one transaction with one terminal event per assessment (AD-4).

## Done when

- Every invariant names its PRD requirement, its spine decision and its guard.
- Every touch point below is also listed in the epic it names.

## Boundaries

- Touch point: learning progress states and events — owner: epic-learning-progress
- Touch point: Guard and owner-only controls — owner: epic-supervision-and-guard
- Touch point: the review and send flow that an assessment draft replaces — owner: epic-ai-suggestions
- Touch point: result messages in exports — owner: epic-exports-and-records
- Not here: transfer assessments in cyberbullying rooms, which are refused.
- Must not change: the correct answer and learner explanation stay private until the second wrong attempt.

## References

- parent — `_bmad-output/initiative-platform-baseline/initiative-platform-baseline.md`, Requirements R9
- architecture — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md`, AD-1, AD-3, AD-4, AD-5, AD-6, AD-7, AD-12
- prd — `_bmad-output/initiative-platform-baseline/prd-tutor-platform/prd-tutor-platform.md`, section 5.3

## Notes

- Source conflict: R5 — prd FR-37 refuses any answer that is not an option selection; the code still grades typed text and cancels a free-text answer as "assisted" (spine AD-6 records the code's behavior).
- Decision: 2026-10-23 — transfer assessment is the pilot epic; the other nine are written after the owner reviews this one.
