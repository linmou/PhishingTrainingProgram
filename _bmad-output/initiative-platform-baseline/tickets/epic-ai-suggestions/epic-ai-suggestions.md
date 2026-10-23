---
type: epic
title: "AI suggestions and tutor review"
parent: initiative-platform-baseline
covers: [R8]
refined: true
risk: medium
---

# AI suggestions and tutor review

## Description

The room owner requests an AI suggestion for a learner message, reviews, edits and sends it, and sets the AI role. A change of AI model or prompt is re-evaluated before release. This epic lists the invariants that exist today.

## Outcome

For anyone changing AI drafts or the review flow: the input, output, audience and review rules are written once, with the requirement each comes from and the test or evaluation that guards it.

## Requirements

Test paths are from the repository root.

- R1 (parent R8; prd FR-24): The room owner can turn the AI assistant on or off for a room and set its AI role and style parameters; settings persist, and reopening settings shows the saved values. With the AI assistant off, no AI draft can be requested. Guard: `tutor-system/src/__tests__/ai_assistant.bdd.test.tsx` ("Tutor disables AI assistant"; "AI configuration persistence"); `tutor-system/src/components/__tests__/AIAssistantSettings.test.tsx` ("hydrates modular controls from aiConfig prompt_config instead of default values").
- R2 (parent R8; prd FR-25; C1; AD-13): The room owner can request an AI suggestion for a chosen learner message, or the latest one. Inputs: the scenario, the complete saved conversation, the learner's learning progress and the current Guard state. Output: suggested text, a reason, an instruction label and a Guard recommendation. Audience: the room owner only; the suggestion is never sent automatically. If any part of the conversation cannot be loaded, no suggestion is generated and the room owner sees an error, and can still type a tutor reply. With no learner message, no suggestion is generated. Guard: `tutor-system/src/services/__tests__/aiService.guardMode.test.ts` ("returns an independent semantic mode, reason, and response from the provider"); `tutor-system/src/contexts/__tests__/RoomContext.aiGenerationFailure.test.tsx` ("rejects generateAIResponse when the AI service reports failure"); `tutor-system/src/__tests__/ai_assistant.bdd.test.tsx` ("AI handles no student messages gracefully").
- R3 (parent R8; prd FR-26, NFR-9, NFR-10): The content of AI suggestions is governed by the tutor behavior specification (T01 to T08, G01 to G03) under the tutoring constitution and verified by its evaluation suite, not by code tests. A change to the prompt or model behind AI suggestions is released only after its evaluation suite has been run, and must be re-evaluated for each practice type that uses it. Constitutions change only through an explicit human decision; passing evaluations cannot authorize a change. Guard: `evals/promptfoo/promptfooconfig.yaml` (case deliberate_repeated_click); `tutor-system/scripts/check-promptfoo-quality-gate.test.js` ("a failed assertion cannot become a pass by disappearing").
- R4 (parent R8; prd FR-27): Every AI suggestion carries a reason and an instruction label, for the room owner only. Reasons and instruction labels are never shown to learners and are kept in the room owner's export. AI output that does not fit the output contract is not shown; after one repair attempt the room owner gets an error instead. Guard: `tutor-system/src/contexts/__tests__/roomExportBuilder.test.ts` ("keeps the decision trail in the tutor TXT export and out of the student TXT export"); `tutor-system/supabase/functions/ai-api/index.test.ts` ("cyberbullying retries malformed role output and records both attempts without publishing").
- R5 (parent R8; prd FR-28; C1; R4): The room owner can copy, edit, reject or regenerate an AI suggestion, and only the room owner's explicit send publishes a tutor reply. Sent unchanged records `accepted`; sent after edits records `modified`; rejected records `rejected`; replaced by a new request records `ignored`. An empty tutor reply cannot be sent, and if sending fails the edited text is kept. Guard: `tutor-system/src/__tests__/ai_assistant.bdd.test.tsx` ("Tutor accepts AI suggestion"; "Tutor modifies AI suggestion"; "Tutor rejects AI suggestion"); `tutor-system/src/__tests__/ai_suggestion_tracking.bdd.test.tsx` ("Track ignored suggestions").
- R6 (parent R8; prd FR-29): The room owner can choose the AI role and its style parameters, including through Quick Adjust. In a room with one student and the AI assistant on, the learner can choose the AI role instead, which then locks it. The learner's choice is offered only when the AI assistant is on and the room has exactly one student, and never to observers. Once the learner chooses, the room owner sees the AI role as locked, and regeneration uses it. Guard: `tutor-system/src/__tests__/student_ai_tone.integration.test.tsx` ("Student selects Peer role updates room AI role and locks tutor control"); `tutor-system/src/components/__tests__/AISuggestionBox.test.tsx` ("disables the student-locked %s role and regenerates with that role").

## Constraints

- No AI-generated text reaches a learner unless the room owner sends it (constitution C1).
- Supervision wins over speed: every AI draft is reviewed by the room owner (constitution priority rule R4).
- Every LLM call is made by an Edge Function with server-side secrets; no gateway operation that spends the provider key runs without an identified, authorized caller (AD-11).
- AI text becomes a learner-visible message only through the reviewed-send function (AD-13); AI model identifiers live once and no Edge Function hardcodes one (AD-10).

## Done when

- Every invariant names its PRD requirement, its spine decision where one governs it, and its guard.
- Every touch point below is also listed in the epic it names.

## Boundaries

- Touch point: server authority, request ids and the version handshake — owner: epic-platform-guarantees
- Touch point: the saved conversation, tutor replies and ratings — owner: epic-conversation
- Touch point: the learner's progress that suggestions read — owner: epic-learning-progress
- Touch point: owner-only controls and Guard — owner: epic-supervision-and-guard
- Touch point: assessment drafts that replace the suggestion when one is due — owner: epic-transfer-assessment
- Touch point: character drafts in cyberbullying rooms — owner: epic-cyberbullying-rooms
- Touch point: review records and the decision trail in exports — owner: epic-exports-and-records
- Not here: the quality of AI output, which the AI behavior specifications govern; AI that speaks to learners on its own.

## References

- parent — `_bmad-output/initiative-platform-baseline/initiative-platform-baseline.md`, Requirements R8
- architecture — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-tutor-platform.md`, AD-10, AD-11, AD-13
- architecture seed — `_bmad-output/initiative-platform-baseline/architecture-tutor-platform/architecture-seed-tutor-platform.md`, roles and their names today
- prd — `_bmad-output/initiative-platform-baseline/prd-tutor-platform/prd-tutor-platform.md`, section 5.2 and section 7

## Notes

- Source conflict: R2 — prd FR-25 allows only the room owner to request a suggestion; for phishing rooms this is a role check in the browser, with no server check.
