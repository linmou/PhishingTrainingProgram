# Addendum: Conversation epic

Intent: hold the volatile facts about how well this epic's rules are guarded by tests, so the epic itself stays stable. Each row links up to a rule in `_bmad-output/initiative-platform-baseline/tickets/epic-conversation/epic-conversation.md`.

Updated: 2026-10-24. Sources: the guard audit and the P6 triage audit in the git-ignored `audits/` folder (`guard_conversation_*`, `guardp6_conversation_*`). Tests were read, not run.

## A. Test debt needed for the pilot

| Rule | Guard | Basis | Harm if the clause breaks |
| --- | --- | --- | --- |
| R3 | `tutor-system/src/__tests__/tutor_response_rating_gate.integration.test.tsx` (blocks the reply, animates a mandatory prompt for the latest response, and unlocks only after feedback succeeds) | P8, OQ-20 | Missing or wrong ratings leave the pilot's research data incomplete, and it cannot be recollected. |

## B. Guards that can wait under P6

The owner deferred these on 2026-10-24 under the open question named in `_bmad-output/initiative-platform-baseline/prd-tutor-platform/addendum.md` §F: the limitation is accepted for the pilot, and the tests wait for the formal product.

| Rule | Guard | Accepted limitation | Open question |
| --- | --- | --- | --- |
| R1 | `tutor-system/src/__tests__/real_time_chat.bdd.test.tsx` (Messages appear immediately without page refresh); `tutor-system/src/__tests__/room_discovery.test.tsx` (should show new rooms without refreshing) | Delivery or room cards may be late; saved messages are kept. | OQ-19 |
| R2 | `tutor-system/src/__tests__/real_time_chat.bdd.test.tsx` (Typing indicators are shown between tutor and student) | A stale typing indicator is a usability limitation. | OQ-19 |

## C. Clauses with no guard

| Former ID | Rule | Missing guard |
| --- | --- | --- |
| G-65 | R3 | No test that a failed rating keeps the unsent message, that result messages are never rated, or that one rating per message holds in the database; the gate for character replies is covered only by the cyberbullying browser test (FR-16). |
