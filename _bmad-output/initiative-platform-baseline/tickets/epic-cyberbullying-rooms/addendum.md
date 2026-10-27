# Addendum: Cyberbullying rooms epic

Intent: hold the volatile facts about how well this epic's rules are guarded by tests, so the epic itself stays stable. Each row links up to a rule in `_bmad-output/initiative-platform-baseline/tickets/epic-cyberbullying-rooms/epic-cyberbullying-rooms.md`.

Updated: 2026-10-27. Sources: the guard audit and the P6 triage audit in the git-ignored `audits/` folder (`guard_cyberbullying_rooms_*`, `guardp6_cyberbullying_rooms_*`). Tests were read, not run; the 'Why the guard fails' column comes from criteria c2 and c3 of the guard audit.

## A. Test debt needed for the pilot

| Rule | Guard | Why the guard fails | Basis | Harm if the clause breaks |
| --- | --- | --- | --- | --- |
| R2 | `tutor-system/supabase/tests/cyberbullying_practise.sql` (observer has no learner evidence; rejoining is idempotent) | Uses sequential rejoins; never rejects another speaker's evidence or checks simultaneous joins. | C2, C3, P6 limit | Another speaker's evidence or duplicate target records change the learner's progress. |
| R3 | `tutor-system/supabase/tests/cyberbullying_practise.sql` (unsupported preparation and clear refused with FORBIDDEN) | Expects UNSUPPORTED_PRACTICE_OPERATION when clearing, although the guard's rule names FORBIDDEN. | C4 | Clearing history outside an owner's room deletion removes pilot data for good. |
| R4 | `tutor-system/src/contexts/__tests__/RoomContext.cyberbullying.test.tsx` (stores a learner comment before analysis and leaves it available when analysis fails) | Mocks message saving and judging, then checks browser memory without checking save order or durable survival after analysis fails. | C3, C4 | A learner message is lost when judging fails, leaving progress without its evidence. |
| R5 | `tutor-system/supabase/tests/cyberbullying_browser_draft.sql` | Never checks that disabled AI or an empty learner conversation prevents requesting a character draft. | C1 | An unsent character draft becomes readable by the learner or is published before the owner sends it. |
| R6 | `tutor-system/src/services/__tests__/guardModeService.test.ts` (uses one RPC for the message, feedback, and room-mode transaction); `tutor-system/supabase/tests/cyberbullying_browser_draft.sql` (failed reviews roll back publication) | guardModeService.test.ts mocks the transaction; cyberbullying_browser_draft.sql checks only message rollback and permits sending without a prior draft request. | C1 | A rejected or invalid review is published without the owner's completed send. |
| R6 | `tutor-system/src/contexts/__tests__/RoomContext.cyberbullying.test.tsx` (a character-only edit is modified even when the original text and Guard are unchanged) | Mocks the reviewed-send function, so the server never records the character-only edit or its label (disputed). | P8, OQ-20 | Wrong accepted or modified labels skew the pilot's research data. |
| R7 | `tutor-system/src/contexts/__tests__/RoomContext.cyberbullying.test.tsx` (realtime/reload projection keeps stored character identity for every viewer); `tutor-system/supabase/tests/cyberbullying_browser_draft.sql` (persona copilot:tom) | RoomContext.cyberbullying.test.tsx checks synthetic projections; cyberbullying_browser_draft.sql checks one persona; neither checks live reloads, export identity, or edit refusal. | P8, OQ-20 | Character labels that differ between views and exports make the recorded dialogue unreliable for analysis. |

## B. Guards that can wait under P6

The owner deferred these on 2026-10-24 under the open question named in `_bmad-output/initiative-platform-baseline/prd-tutor-platform/addendum.md` §F: the limitation is accepted for the pilot, and the tests wait for the formal product.

| Rule | Guard | Why the guard fails | Accepted limitation | Open question |
| --- | --- | --- | --- | --- |
| R1 | `tutor-system/scripts/browser-e2e/workflows/cyberbullying.js`; `tutor-system/src/__tests__/room_template_management.test.tsx` (creates $id with its full scenario and edited post) | room_template_management.test.tsx never edits dialogue to check authors; neither it nor cyberbullying.js checks refusal without a chosen scenario. | Scenario setup and dialogue authors are checked by the tutor before teaching. | OQ-18 |
| R2 | `tutor-system/supabase/tests/cyberbullying_practise.sql` (custom target rejected with SHARED_TARGETS_REQUIRED; exactly five targets initialized) | Counts five targets without checking their required meanings, removal refusal, or manual progress edits. | The owner checks the five targets before practice; learner-only evidence stays required. | OQ-18 |
| R3 | `tutor-system/src/contexts/__tests__/RoomContext.multiAgentDraft.test.tsx` (regenerates with character workflow parameters) | Injects Quick Adjust's disabled state instead of exercising the practice-type restriction; never checks completion when targets are Covered (disputed). | Extra controls such as Quick Adjust are a supervised scope limitation. | OQ-16 |
| R5 | `tutor-system/supabase/functions/ai-api/index.test.ts` (cyberbullying reads full context and returns a browser draft for each role without persistence writes; cyberbullying rejects missing identity and ownership before contacting the provider) | Stubs the ownership refusal and never checks AI-off or empty-conversation refusal. | Draft context, character choice and request ownership affect only a private draft the owner reviews. | OQ-16 |

## C. Clauses with no guard

| Former ID | Rule | Missing guard |
| --- | --- | --- |
| G-74 | R1, R2, R3 | No test for the "Choose a Cyberbullying situation." refusal, edited dialogue keeping each comment's author, several tabs joining at once, the five target names, a tutor message giving no evidence, or Quick Adjust being refused by the server (FR-7, FR-44, FR-45). |
| G-75 | R5, R6, R7 | No test that a character draft is refused with the AI off or with no learner message, that the chosen character and Guard state reach the provider, that a reply cannot be sent without a reviewed draft, or that sent character replies cannot be edited (FR-47, FR-48, FR-49). |
