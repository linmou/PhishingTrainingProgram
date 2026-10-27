# Addendum: Platform guarantees epic

Intent: hold the volatile facts about how well this epic's rules are guarded by tests, so the epic itself stays stable. Each row links up to a rule in `_bmad-output/initiative-platform-baseline/tickets/epic-platform-guarantees/epic-platform-guarantees.md`.

Updated: 2026-10-27. Sources: the guard audit and the P6 triage audit in the git-ignored `audits/` folder (`guard_platform_guarantees_*`, `guardp6_platform_guarantees_*`). Tests were read, not run; the 'Why the guard fails' column comes from criteria c2 and c3 of the guard audit.

## A. Test debt needed for the pilot

| Rule | Guard | Why the guard fails | Basis | Harm if the clause breaks |
| --- | --- | --- | --- | --- |
| R1 | `tutor-system/src/contexts/__tests__/RoomContext.transferAnswer.test.tsx` (does not grade or write progress in the browser) | Stubs grading and progress owners (disputed); checks its own mock's method names without asserting that browser writes never occur. | C3 | Grades or progress decided in the browser corrupt the server's record. |
| R2 | `tutor-system/supabase/tests/transfer_assessment_rpc_behaviour.sql` (cas_conflict; delivery_retry; duplicate) | Tests sequential assessment retries, leaving plain-send and judging deduplication and genuinely concurrent requests untested (disputed). | C3 | Repeated requests use extra attempts or advance progress twice. |
| R3 | `tutor-system/src/contexts/__tests__/AuthContext.test.tsx` (should restore user from localStorage on initialization) | Restores only browser identity; never checks conversation, progress, or assessment persistence across reconnects and multiple tabs (disputed). | C4 | Conversation, progress or assessment records are lost on reload or reconnect. |
| R7 | `tutor-system/src/services/__tests__/aiService.edgeBoundary.test.ts` (invokes ai-api with chat data and never sends provider credentials from React) | Mocks the ai-api invocation, so the gateway's server-side credential handling never runs. | C6 | Provider credentials in the browser allow uncontrolled cost and abuse. |

## B. Guards that can wait under P6

The owner deferred these on 2026-10-24 under the open question named in `_bmad-output/initiative-platform-baseline/prd-tutor-platform/addendum.md` §F: the limitation is accepted for the pilot, and the tests wait for the formal product.

| Rule | Guard | Why the guard fails | Accepted limitation | Open question |
| --- | --- | --- | --- | --- |
| R4 | `tutor-system/src/services/__tests__/aiService.externalFailure.test.ts` (returns an error instead of a generic dummy suggestion…) | Checks one AI-output failure, leaving conversation, target, and configuration failures and their visible errors untested (disputed). | An inadequate owner-visible suggestion is rejected by hand; no fallback grade or data loss is allowed. | OQ-19 |
| R6 | `tutor-system/src/__tests__/observer_view_steps.test.tsx` (Observer interface is responsive on mobile devices) | Checks a CSS class in jsdom on one phone-sized observer page, leaving actual layout, tablets, and other screens untested (disputed). | Pilot devices are chosen and supervised; a cramped layout is accepted. | OQ-19 |

## C. Clauses with no guard

| Former ID | Rule | Missing guard |
| --- | --- | --- |
| G-58 | R1 | Whether a transfer assessment is due is checked by tests for one rule only (final assessment after understanding); no test shows the browser cannot force a due state (NFR-2). |
| G-59 | R2, R3 | No test repeats a plain message send or the reviewed tutor reply, and no real multi-tab test covers persistence; "rooms are kept" is tested only against a mocked list (NFR-5, NFR-6). |
| G-60 | R6 | Responsive behavior is tested only as a CSS class on the observer page at two widths; no tablet, tutor, student or room-page case (NFR-12). |
