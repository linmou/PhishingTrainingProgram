# Addendum: Exports and records epic

Intent: hold the volatile facts about how well this epic's rules are guarded by tests, so the epic itself stays stable. Each row links up to a rule in `_bmad-output/initiative-platform-baseline/tickets/epic-exports-and-records/epic-exports-and-records.md`.

Updated: 2026-10-27. Sources: the guard audit and the P6 triage audit in the git-ignored `audits/` folder (`guard_exports_and_records_*`, `guardp6_exports_and_records_*`). Tests were read, not run; the 'Why the guard fails' column comes from criteria c2 and c3 of the guard audit.

## A. Test debt needed for the pilot

| Rule | Guard | Why the guard fails | Basis | Harm if the clause breaks |
| --- | --- | --- | --- | --- |
| R1 | `tutor-system/src/contexts/__tests__/roomExportBuilder.transfer.test.ts` (keeps every private assessment field out of the learner JSON export) | Uses already-public fixtures, so it never checks removal of contaminated private fields or the database publication boundary (disputed). | C5 | Correct options or explanations reach the learner before publication, spoiling the assessment. |
| R2 | `tutor-system/src/services/__tests__/aiService.feedbackInstruction.test.ts` (records an unsent character review with separate originals and edits through the shared table); `tutor-system/supabase/tests/cyberbullying_browser_draft.sql` | aiService.feedbackInstruction.test.ts mocks storage; both it and cyberbullying_browser_draft.sql omit assertions for stored response time and context on unsent reviews. | C1 | Unsent character AI text in the public feedback table can be read by a learner before the owner sends it. |
| R1 | `tutor-system/src/contexts/__tests__/RoomContext.roleBasedExport.test.tsx` (should include AI summary for tutors); `tutor-system/src/services/__tests__/cyberbullyingProgress.test.ts` (reads and exports understanding plus behavior targets with their learner and evidence identities) | RoomContext.roleBasedExport.test.tsx checks only TXT summaries; cyberbullyingProgress.test.ts bypasses the download path and omits tutor and observer progress exports. | P8, OQ-20 | A missing summary or progress view in exports leaves the pilot's analysis incomplete. |
| R2 | `tutor-system/src/__tests__/ai_suggestion_tracking.bdd.test.tsx` (Contextual message tracking; Track response time metrics) | Records timing and context in a fake array; never checks durable retention, assessment-draft records, or all required review fields. | P8, OQ-20 | Incomplete review metadata and timing leave the pilot's research data incomplete. |

## B. Guards that can wait under P6

None: the owner kept every research record required (OQ-20 in `_bmad-output/initiative-platform-baseline/prd-tutor-platform/addendum.md` §F).

## C. Clauses with no guard

| Former ID | Rule | Missing guard |
| --- | --- | --- |
| G-77 | R2 | "No IP or browser information" is checked on the client payload only, not on database columns; "records are kept with the room" is tested only with mocks (FR-51). |
