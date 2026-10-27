# Addendum: Transfer assessment epic

Intent: hold the volatile facts about how well this epic's rules are guarded by tests, so the epic itself stays stable. Each row links up to a rule in `_bmad-output/initiative-platform-baseline/tickets/epic-transfer-assessment/epic-transfer-assessment.md`.

Updated: 2026-10-24. Sources: the guard audit (each guard runs the part that owns its clause, unmocked, and asserts the rule) and the P6 triage audit, both in the git-ignored `audits/` folder (`guard_transfer_assessment_*`, `guardp6_transfer_assessment_*`). Tests were read, not run.

## A. Test debt needed for the pilot

These guards failed the guard audit, and a failure of their clause would cause immediate harm or break a constraint, so the pilot needs a working guard.

| Rule | Guard | Basis | Harm if the clause breaks |
| --- | --- | --- | --- |
| R1 | `tutor-system/supabase/tests/final_assessment_after_understanding.sql` (open assessment blocks duplicate delivery; partial; pass) | C3 | Wrong eligibility creates extra assessed attempts or completion that does not match the learning evidence. |
| R3 | `tutor-system/src/pages/__tests__/RoomPagePost.transferDraft.test.tsx` (discards the candidate through the room context without delivering anything; keeps a prepared candidate hidden from learner roles) | C1, C5 | A discarded or prepared draft reaches the learner, exposing unreviewed AI text and the correct options. |
| R4 | `tutor-system/supabase/tests/final_assessment_after_understanding.sql` (error ASSESSMENT_NOT_ELIGIBLE); `tutor-system/supabase/tests/transfer_assessment_rpc_behaviour.sql` (case delivery_retry) | C3 | Duplicate or ineligible assessments corrupt recorded attempts and progress. |
| R5 | `tutor-system/supabase/functions/assessment-api/index.test.ts` (observer cannot post a message or answer through the trusted API); `tutor-system/supabase/tests/transfer_assessment_rpc_behaviour.sql` (invalid_selection; wrong_actor) | C2, C3 | Another person's or an invalid answer is graded as the learner's attempt. |
| R7 | `tutor-system/supabase/tests/transfer_assessment_rpc_behaviour.sql` (cas_conflict; duplicate; first_wrong; second_wrong; terminal_rollback; third_submission) | C3 | A wrong grade, an extra attempt or a partly saved result falsifies the learning record. |
| R8 | `tutor-system/src/contexts/__tests__/roomExportBuilder.transfer.test.ts`; `tutor-system/supabase/tests/assessment_result_messages.sql` | C3, C4, C5 | An early answer leak spoils the check; altered, lost or duplicate result messages misstate grades. |
| R9 | `tutor-system/supabase/tests/final_assessment_after_understanding.sql` (contradiction; failure_repair; pass) | C3 | A wrong Complete or Needs review state misrecords the outcome. |
| R11 | `tutor-system/src/contexts/__tests__/transferAssessmentUiAdapter.lifecycle.test.ts` | C3, P6 limit | Reopening a finished assessment or showing wrong remaining attempts leads to wrong recorded decisions. |
| R13 | `tutor-system/supabase/tests/assessment_result_messages.sql` (scenario target_edit); `tutor-system/supabase/tests/final_assessment_after_understanding.sql` (contradiction; stale_open) | C3 | A cancellation uses an attempt, or stale progress stays eligible after the evidence changed. |
| R16 | `tutor-system/supabase/tests/assessment_result_messages.sql`; `tutor-system/supabase/tests/private_transfer_assessment_storage_migration.sql` | C5, C6 | Private keys and explanations are published early. |

## B. Guards that can wait under P6

These guards also failed the guard audit, but a failure of their clause is a limitation the supervised pilot can live with. The owner deferred these on 2026-10-24 under the open question named in `_bmad-output/initiative-platform-baseline/prd-tutor-platform/addendum.md` §F: the limitation is accepted for the pilot, and the tests wait for the formal product.

| Rule | Guard | Accepted limitation | Open question |
| --- | --- | --- | --- |
| R2 | `tutor-system/src/__tests__/transfer_assessment.bdd.test.tsx` (An eligible assessment bypasses the shared tutor); `tutor-system/src/components/__tests__/AssessmentDraftEditor.test.tsx`; `tutor-system/src/services/__tests__/assessmentRendering.test.ts` | Draft shape and word limits are checked by the owner's review before sending. | OQ-21 |
| R6 | `tutor-system/scripts/browser-e2e/workflows/assessment-answer.js`; `tutor-system/src/pages/__tests__/RoomPagePost.transferLifecycle.test.tsx` | A missing waiting explanation or a temporary chat restriction is handled by the tutor. | OQ-19 |
| R8 | `tutor-system/src/components/__tests__/PostComment.transfer.test.tsx` | Result display after reload is incomplete; the saved result is kept and adults can check it. | OQ-19 |
| R10 | `tutor-system/scripts/browser-e2e/workflows/assessment-delivery.js`; `tutor-system/supabase/tests/assessment_result_messages.sql` (feedback_required checks) | The tutor gives feedback by hand before the next assessment. | OQ-22 |
| R12 | `tutor-system/supabase/functions/assessment-api/index.test.ts` (disabled feature makes no storage call); `tutor-system/supabase/tests/room_assessment_default_on.sql` | A refusal while assessment is off is recovered by turning it back on. | OQ-22 |
| R14 | `evals/promptfoo/v1/transfer/metric-registry.json` | Semantic quality of new situations is checked by the owner's review, not by an automated suite. | OQ-21 |

## C. Clauses with no guard

| Former ID | Rule | Missing guard |
| --- | --- | --- |
| G-50 | R3 | No test shows that a discarded assessment draft leaves the assessment due and offered again (FR-35). |
| G-51 | R4 | No test shows the server refusing delivery while Guard is on; the Guard checks in the room tests mock the server (FR-36). |
| G-52 | R9 | No test shows that failure never turns on Guard after the second wrong attempt; only the first wrong answer is checked (FR-40). |
| G-53 | R10 | No test shows the server refusing another assessment while tutor feedback is outstanding, and no test fixture has two due targets (FR-41). |
| G-54 | R12 | No test shows that turning in-room assessment off leaves an open assessment answerable (FR-31). |
| G-55 | R13 | A cancelled assessment's closure message count and "no attempt used" are not asserted by any test (FR-32). |
| G-56 | R15 | No guard for FR-43: the AI assistant gets assessment outcomes only from the saved conversation, and waits while result messages are saved. |
