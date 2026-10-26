# Issues 19-22 Release Record

Intent: deliver the scoped message, feedback, assessment-ordering and RoomContext changes with exact staging and production evidence.

Updated: 2026-10-26. Initial scoped integration: `b392d5b`. Base: `4ff3f86`. Release owner: root Codex agent. Batch: `issues-19-22-20261026`.

## Scope and Artifacts

This candidate includes #19 bounded message reconciliation and reconnect recovery, #20 batched/scoped feedback, #21 indexed assessment display ordering and #22 membership/Realtime ownership extraction. The tutor prompt, AI service and behavior specification match the target base; issue #2 remains suspended in the separate combined branch.

Runtime commits were selected into a fresh worktree from current `origin/no_sign_up`; the prior branch and primary checkout edits remain preserved. The minimal SQL prerequisite enables existing subscriptions for public messages, feedback and rooms without altering their permissions. SQL SHA-256: `c909b92da2c9b7d96c2a4f0d4e23a8f06d0cc85bb8885d01d2aa911dc4cf5e78`. The imported assessmentRendering file remains an assessment-api bundle dependency. Its exact scoped source closure must replace the previously staged combined bundle before acceptance. ai-api is an unchanged dependency.

## Gates

| Gate | Status | Evidence or next action |
| --- | --- | --- |
| Scope separation | Initial comparison passes | Prompt, aiService and behavior specification have no base diff; independent review pending |
| Deterministic regression/build | Running | Dedicated agent, one test worker; current-head GitHub checks required |
| SQL validation | Prior exact-artifact evidence retained | Fresh hosted-baseline parity and author/independent four-scenario checks; recheck relevant live preconditions |
| Staging alignment | Pending | Acquire exact-head lease, inspect publication and deploy/compare scoped assessment-api closure |
| Staging acceptance | Pending | Performance10/100/1000 plus affected browser lifecycle/roles/export and fixture cleanup |
| Merge | Pending | Current-head CI/review/staging evidence and explicit human authorization under release workflow |
| Production | Pending | Merge manifest parity, exact SQL-before-Edge promotion, affected live checks and cleanup |

## Verification Scope

Observable contracts: persisted message convergence and cancellation, subscription ownership/rejoin, feedback aggregates and own ratings, room/user isolation, assessment ordering and terminal-event consumption. Run deterministic edge cases and the combined regression suite. Live checks require actual WebSocket acknowledgements/events, bounded healthy reads, missed INSERT and old UPDATE recovery, reconnect acknowledgement, targeted feedback refreshes and complete fixture cleanup. Shared RoomContext requires the affected browser suite including identity/roles/export and assessment lifecycle journeys.

The existing pre-change measurement at app `7762cbb` remains comparative evidence subject to backend/configuration equivalence. Previous combined-candidate performance passed but does not establish acceptance of this scoped candidate. Earlier browser failures and their cleanup repairs remain preserved on the old branch; recheck the scoped runtime before attributing failures. Do not resume tutor-policy refinement within this batch.

## Release Acceptance

Staging project: `ciubrzggdqesgvfkpolj`. Production: `zgbufaxooqxeabewktzd`. Root alone owns hosted writes, holding the cross-machine staging lease through acceptance and cleanup. Record current candidate/merged commit, deployed versions and per-file hashes, SQL result, actual command exits, persisted behavior and cleanup paths before advancing.

Render auto-deploys the frontend from `no_sign_up`. The client retains degraded recovery before the publication is enabled; confirm compatibility with current production contracts before merge. Production promotion follows explicit current-candidate merge authorization and integrated artifact comparison. Keep issues open until the required production acceptance passes. Production has not been mutated by this batch.
