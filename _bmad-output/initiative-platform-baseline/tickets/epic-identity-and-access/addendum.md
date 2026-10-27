# Addendum: Identity and access epic

Intent: hold the volatile facts about how well this epic's rules are guarded by tests, so the epic itself stays stable. Each row links up to a rule in `_bmad-output/initiative-platform-baseline/tickets/epic-identity-and-access/epic-identity-and-access.md`.

Updated: 2026-10-27. Sources: the guard audit and the P6 triage audit in the git-ignored `audits/` folder (`guard_identity_and_access_*`, `guardp6_identity_and_access_*`). Tests were read, not run; the 'Why the guard fails' column comes from criteria c2 and c3 of the guard audit.

## A. Test debt needed for the pilot

| Rule | Guard | Why the guard fails | Basis | Harm if the clause breaks |
| --- | --- | --- | --- | --- |
| R3 | `tutor-system/src/contexts/__tests__/AuthContext.test.tsx` (should clear localStorage on sign out) | Checks browser cleanup without asserting that leaving deletes no server data. | C4 | Leaving deletes rooms, messages or progress without a confirmed owner deletion. |
| R6 | `tutor-system/supabase/tests/unified_room_progress.sql` (Concurrent first joins did not arbitrate to one learner seat) | Uses a single insert instead of concurrent joins, and never checks that the owner cannot become the learner or answer. | C2, C3, C4 | Two learners, or the owner as learner, mix evidence and grades in one seat. |
| R7 | `tutor-system/supabase/functions/assessment-api/index.test.ts` (observer cannot post a message or answer through the trusted API) | Stubs the observer role instead of deriving it from room records; omits rating refusal, composer absence, and the read-only notice. | C2, C3 | An observer's answer is recorded as the learner's grade. |

## B. Guards that can wait under P6

Rows marked OQ-1 were accepted by the owner earlier (`_bmad-output/initiative-platform-baseline/prd-tutor-platform/addendum.md` §E). The others were deferred on 2026-10-24 under the named question in §F. In both cases the limitation is accepted for the pilot, and the tests wait for the formal product.

| Rule | Guard | Why the guard fails | Accepted limitation | Open question |
| --- | --- | --- | --- | --- |
| R1 | `tutor-system/src/components/__tests__/SimpleLogin.test.tsx` (shows error when submitting empty name); `tutor-system/src/contexts/__tests__/AuthContext.test.tsx` | SimpleLogin.test.tsx checks only empty names; AuthContext.test.tsx never asserts normalized-name identity selection or dashboard landing. | Weak attribution under close adult supervision. | OQ-1 (accepted) |
| R2 | `tutor-system/src/contexts/__tests__/AuthContext.test.tsx` (should persist user data after role changes) | Checks the stored role without asserting a stable identifier or a saved user record. | Identity identifies but does not authenticate. | OQ-1 (accepted) |
| R4 | `tutor-system/src/__tests__/room_management.bdd.test.tsx` (Canceling password prompt; Entering incorrect password for room access) | Checks wrong-password and cancel reactions, leaving owner bypass and password gating for all non-owner roles untested. | The room password is a convenience gate. | OQ-1 (accepted) |
| R5 | `tutor-system/src/__tests__/room_discovery.test.tsx` (should show new rooms without refreshing); `tutor-system/src/pages/__tests__/StudentView.roomVisibility.test.tsx` (shows empty waiting state when every returned room is hidden) | room_discovery.test.tsx omits search and session status; StudentView.roomVisibility.test.tsx checks only the empty state, leaving role-specific actions untested. | Room lists may need a refresh or adult guidance. | OQ-19 |

## C. Clauses with no guard

| Former ID | Rule | Missing guard |
| --- | --- | --- |
| G-61 | R1, R2, R3 | No test for a whitespace-only name, for the same normalized name and role selecting the same user, for a display-name change keeping the user id, or for leaving deleting no data (FR-1, FR-2, FR-3). |
| G-62 | R5, R6, R7 | No test for room search, the "Your Session" status, the room owner never being the learner, or observers being unable to rate on the server (FR-11, FR-12, FR-13). |
