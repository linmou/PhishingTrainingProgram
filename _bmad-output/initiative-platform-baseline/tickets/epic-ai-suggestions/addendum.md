# Addendum: AI suggestions and tutor review epic

Intent: hold the volatile facts about how well this epic's rules are guarded by tests, so the epic itself stays stable. Each row links up to a rule in `_bmad-output/initiative-platform-baseline/tickets/epic-ai-suggestions/epic-ai-suggestions.md`.

Updated: 2026-10-27. Sources: the guard audit and the P6 triage audit in the git-ignored `audits/` folder (`guard_ai_suggestions_*`, `guardp6_ai_suggestions_*`). Tests were read, not run; the 'Why the guard fails' column comes from criteria c2 and c3 of the guard audit.

## A. Test debt needed for the pilot

| Rule | Guard | Why the guard fails | Basis | Harm if the clause breaks |
| --- | --- | --- | --- | --- |
| R5 | `tutor-system/src/__tests__/ai_assistant.bdd.test.tsx` (Tutor accepts AI suggestion; Tutor modifies AI suggestion) | Fakes the reviewed-send RPC, bypassing SQL owner checks; omits empty-reply refusal and retained edits after failed sends (disputed). | C1 | An unreviewed AI reply reaches the learner. The tests fake the reviewed-send function. |
| R5 | `tutor-system/src/__tests__/ai_assistant.bdd.test.tsx` (Tutor rejects AI suggestion); `tutor-system/src/__tests__/ai_suggestion_tracking.bdd.test.tsx` (Track ignored suggestions) | ai_assistant.bdd.test.tsx fakes rejected-feedback storage; ai_suggestion_tracking.bdd.test.tsx fakes ignored-feedback storage, so neither checks durable recording (disputed). | P8, OQ-20 | Missing or wrong rejected and ignored labels skew the pilot's research data. |

## B. Guards that can wait under P6

The owner deferred these on 2026-10-24 under the open question named in `_bmad-output/initiative-platform-baseline/prd-tutor-platform/addendum.md` §F: the limitation is accepted for the pilot, and the tests wait for the formal product.

| Rule | Guard | Why the guard fails | Accepted limitation | Open question |
| --- | --- | --- | --- | --- |
| R1 | `tutor-system/src/__tests__/ai_assistant.bdd.test.tsx` (AI configuration persistence; Tutor disables AI assistant) | Fakes settings storage and never checks that disabling the assistant prevents draft requests (disputed). | An unwanted owner-visible draft or reset style is noticed and rejected. | OQ-16 |
| R2 | `tutor-system/src/__tests__/ai_assistant.bdd.test.tsx` (AI handles no student messages gracefully); `tutor-system/src/contexts/__tests__/RoomContext.aiGenerationFailure.test.tsx` (rejects generateAIResponse when the AI service reports failure); `tutor-system/src/services/__tests__/aiService.guardMode.test.ts` (returns an independent semantic mode, reason, and response from the provider) | RoomContext.aiGenerationFailure.test.tsx mocks generation and tests provider failure, not conversation loading; aiService.guardMode.test.ts mocks the gateway and accepts a missing instruction label (disputed). | Incomplete drafts or errors stay under owner review; recovery is manual. | OQ-19 |
| R3 | `tutor-system/scripts/check-promptfoo-quality-gate.test.js` (a failed assertion cannot become a pass by disappearing) | Checks missing assertion counts, without checking that release requires evaluation for each practice type (disputed). | Evaluation before release is run by hand. | OQ-21 |
| R4 | `tutor-system/supabase/functions/ai-api/index.test.ts` (cyberbullying retries malformed role output and records both attempts without publishing) | Tests cyberbullying retries, leaving the required phishing repair-then-error path untested (disputed). | The owner rejects malformed suggestions and types a reply. | OQ-21 |
| R6 | `tutor-system/src/__tests__/student_ai_tone.integration.test.tsx` (Student selects Peer role updates room AI role and locks tutor control) | Mocks room updates and asserts the role lock the test itself wrote (disputed). | A wrong or reset style is visible and correctable by the supervising adult. | OQ-16 |

## C. Clauses with no guard

| Former ID | Rule | Missing guard |
| --- | --- | --- |
| G-71 | R1, R2 | No test that, with the AI assistant off, a draft cannot be requested (client throw, hidden button, server refusal); never-auto-sent and a non-owner request are untested for phishing (FR-24, FR-25). |
| G-73 | R4, R5 | No test that reasons and labels are absent from learner-visible payloads, that a phishing repair failure ends in an error, that an empty reply is refused, or that a failed send keeps the text in the interface (FR-27, FR-28). |
