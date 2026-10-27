# Addendum: Owner supervision and Guard epic

Intent: hold the volatile facts about how well this epic's rules are guarded by tests, so the epic itself stays stable. Each row links up to a rule in `_bmad-output/initiative-platform-baseline/tickets/epic-supervision-and-guard/epic-supervision-and-guard.md`.

Updated: 2026-10-24. Sources: the guard audit and the P6 triage audit in the git-ignored `audits/` folder (`guard_supervision_and_guard_*`, `guardp6_supervision_and_guard_*`). Tests were read, not run.

## A. Test debt needed for the pilot

| Rule | Guard | Basis | Harm if the clause breaks |
| --- | --- | --- | --- |
| R1 | `tutor-system/supabase/tests/cyberbullying_browser_draft.sql` (wrong owner accepted) | C1, C2, C3 | A non-owner publishes unreviewed AI text or changes the learner's progress. The test calls an older send function that anonymous visitors can call. |
| R2 | `tutor-system/scripts/browser-e2e/workflows/guard-mode.js` | C3, P6 limit | Progress advances or replays against the Guard state, giving a wrong learning record. |
| R3 | `tutor-system/src/pages/__tests__/RoomPagePost.transferDraft.test.tsx` (discards the candidate through the room context without delivering anything); `tutor-system/supabase/tests/cyberbullying_browser_draft.sql` (unsent reviews cannot publish) | C1 | A discarded or unsent draft reaches the learner. The screen test mocks the room context. |

## B. Guards that can wait under P6

The owner deferred these on 2026-10-24 under the open question named in `_bmad-output/initiative-platform-baseline/prd-tutor-platform/addendum.md` §F: the limitation is accepted for the pilot, and the tests wait for the formal product.

| Rule | Guard | Accepted limitation | Open question |
| --- | --- | --- | --- |
| R2 | `tutor-system/src/__tests__/guardModeComposerIdentity.integration.test.tsx` (does not persist a header mode transition when confirmation is cancelled) | Applying the Guard state the owner chose in the composer when sending; the owner stays in control. | OQ-17 |

## C. Clauses with no guard

| Former ID | Rule | Missing guard |
| --- | --- | --- |
| G-70 | R1, R3 | No test that a phishing suggestion inserts no message or that the AI never changes other room state; no test renders the room as a second tutor (NFR-1, FR-52). |
