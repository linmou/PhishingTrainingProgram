# Addendum: Learning targets and progress epic

Intent: hold the volatile facts about how well this epic's rules are guarded by tests, so the epic itself stays stable. Each row links up to a rule in `_bmad-output/initiative-platform-baseline/tickets/epic-learning-progress/epic-learning-progress.md`.

Updated: 2026-10-27. Sources: the guard audit and the P6 triage audit in the git-ignored `audits/` folder (`guard_learning_progress_*`, `guardp6_learning_progress_*`). Tests were read, not run; the 'Why the guard fails' column comes from criteria c2 and c3 of the guard audit.

## A. Test debt needed for the pilot

| Rule | Guard | Why the guard fails | Basis | Harm if the clause breaks |
| --- | --- | --- | --- | --- |
| R2 | `tutor-system/src/hooks/__tests__/useChecklist.earlyMessages.integration.test.tsx` (preserves the draft after a partial failure and safely retries completed evidence) | Implements duplicate detection in the gateway stub, so the server's real counting check never runs. | C2, C3 | Another learner's message, or one message counted twice, changes progress. The test fakes the server's double-count check. |
| R3 | `tutor-system/supabase/functions/assessment-api/index.test.ts` (rejects historical speaker evidence before updating learner status) | Tests another student's message and a quote mismatch, leaving tutor, character, and pre-populated evidence untested (disputed). | C2 | Tutor, character or pre-populated text advances the learner's progress. |
| R4 | `tutor-system/src/services/__tests__/learningProgressTransitions.test.ts` (applies the complete %s transition column) | Never runs the server writer; expects disallowed events to produce no change instead of a recorded rejection (disputed). | C3 | An invalid transition changes or misrecords progress. |
| R5 | `tutor-system/supabase/tests/final_assessment_after_understanding.sql` (scenario guard); `tutor-system/supabase/tests/transfer_assessment_rpc_behaviour.sql` (case guard_manual_replay) | final_assessment_after_understanding.sql and transfer_assessment_rpc_behaviour.sql toggle the removed active_response_mode column, so neither exercises the current Guard flag or replay trigger. | C3, P6 limit | Progress advances during Guard, or stale evidence is replayed. Both tests set a Guard column that a migration renamed to `guard_mode`. |
| R7 | `tutor-system/src/__tests__/checklist_management.test.ts` (saves a tutor status update with its note, history row, and manual evidence) | Mocks storage and asserts forbidden direct browser writes, bypassing the manual progress-edit writer; never checks the updated owner and learner panels. | C2, C3 | A direct browser write, not the owner's recorded edit, changes progress. |

## B. Guards that can wait under P6

The owner deferred these on 2026-10-24 under the open question named in `_bmad-output/initiative-platform-baseline/prd-tutor-platform/addendum.md` §F: the limitation is accepted for the pilot, and the tests wait for the formal product.

| Rule | Guard | Why the guard fails | Accepted limitation | Open question |
| --- | --- | --- | --- | --- |
| R1 | `tutor-system/src/__tests__/checklist_ai_unit.test.ts` (rejects %s consistently without retrying or inventing targets) | Checks an empty target list without checking that failed generation tells the owner targets are unavailable (disputed). | The owner's approval catches unsuitable targets; failed generation means manual setup. | OQ-18 |
| R6 | `tutor-system/src/components/__tests__/ChecklistPanel.transfer.test.tsx` (shows Guard protection while keeping the shared assessment targets visible) | Checks the Guard banner and disabled controls, leaving per-target progress, evidence, learner views, and layout requirements untested. | Panel layout gaps are worked around by the supervising adult. | OQ-19 |

## C. Clauses with no guard

| Former ID | Rule | Missing guard |
| --- | --- | --- |
| G-67 | R2, R3 | Phishing catch-up replay is tested only with a mocked set of processed messages, and no test shows a tutor or pre-populated line failing as evidence in a phishing room (FR-19, FR-20). |
