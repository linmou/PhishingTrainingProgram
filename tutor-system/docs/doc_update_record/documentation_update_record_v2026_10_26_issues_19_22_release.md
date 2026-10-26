# Issues 19-22 Release Record

Intent: deliver the scoped message, feedback, assessment-ordering and RoomContext changes with exact staging and production evidence.

Updated: 2026-10-26. Tested candidate: `d4dc4a5d947c26510ba15065894cddd3e1b879c4`. Initial scoped integration: `b392d5b`. Base: `4ff3f86`. Release owner: root Codex agent. Batch: `issues-19-22-20261026`. PR: #31.

## Scope and Artifacts

This candidate includes #19 bounded message reconciliation and reconnect recovery, #20 batched/scoped feedback, #21 indexed assessment display ordering and #22 membership/Realtime ownership extraction. The tutor prompt, AI service and behavior specification match the target base; issue #2 remains suspended in the separate combined branch.

Runtime commits were selected into a fresh worktree from current `origin/no_sign_up`; the prior branch and primary checkout edits remain preserved. The minimal SQL prerequisite enables existing subscriptions for public messages, feedback and rooms without altering their permissions. SQL SHA-256: `c909b92da2c9b7d96c2a4f0d4e23a8f06d0cc85bb8885d01d2aa911dc4cf5e78`. The imported assessmentRendering file remains an assessment-api bundle dependency. Its exact scoped source closure replaced the previously staged combined bundle as version 77 before acceptance. ai-api is an unchanged dependency.

## Gates

| Gate | Status | Evidence or next action |
| --- | --- | --- |
| Scope separation | Pass | Prompt, aiService and behavior specification have no base diff; independent runtime review clear |
| Deterministic regression/build | Pass | 148 suites / 1478 tests / 1 snapshot; production build; 45 Deno tests; actual GitHub checks all pass at d4dc4a5, run 40300607418 |
| SQL validation | Pass | Fresh hosted-baseline parity and author/independent four-scenario checks retained; staging publication assertions pass |
| Staging alignment | Pass | assessment-api version 77; all 11 downloaded runtime files match candidate; three public publication memberships verified |
| Staging acceptance | Pass | Actual performance at 10/100/1000 messages and all 11 browser workflows pass, including cleanup |
| Merge | Awaiting authorization | PR #31; independent review clear; exact current-head authorization required by release workflow step 4 |
| Production | Pending | Merge manifest parity, exact SQL-before-Edge promotion, affected live checks and cleanup |

## Verification Scope

Observable contracts: persisted message convergence and cancellation, subscription ownership/rejoin, feedback aggregates and own ratings, room/user isolation, assessment ordering and terminal-event consumption. Run deterministic edge cases and the combined regression suite. Live checks require actual WebSocket acknowledgements/events, bounded healthy reads, missed INSERT and old UPDATE recovery, reconnect acknowledgement, targeted feedback refreshes and complete fixture cleanup. Shared RoomContext requires the affected browser suite including identity/roles/export and assessment lifecycle journeys.

The existing pre-change measurement at app `7762cbb` remains comparative evidence subject to backend/configuration equivalence. Previous combined-candidate performance passed but does not establish acceptance of this scoped candidate. Earlier browser failures and their cleanup repairs remain preserved on the old branch; recheck the scoped runtime before attributing failures. Do not resume tutor-policy refinement within this batch.

## Release Acceptance

Staging project: `ciubrzggdqesgvfkpolj`. Production: `zgbufaxooqxeabewktzd`. Root alone owns hosted writes, holding the cross-machine staging lease through acceptance and cleanup. Record current candidate/merged commit, deployed versions and per-file hashes, SQL result, actual command exits, persisted behavior and cleanup paths before advancing.

Render auto-deploys the frontend from `no_sign_up`. The client retains degraded recovery before the publication is enabled. Read-only inspection of production assessment-api version 17 found only the assessmentRendering dependency different among the 11 runtime files; handler, parser, grading and prompt source match. The ordering helper does not change handler request/response contracts. This supports frontend compatibility before the ordered SQL/Edge promotion; recheck source and target preconditions immediately before promotion. Production promotion follows explicit current-candidate merge authorization and integrated artifact comparison. Keep issues open until the required production acceptance passes. Production has not been mutated by this batch.

## Staging Evidence

The scoped submitted 15-file assessment-api manifest SHA-256 is `1c8653480523614b1e5243062c1a49075972180c53521f212d42258cf58bb03f`; bundle SHA-256 is `a614ffba3611a1a3b667241f94ed93f071394f509678121387286c99236f6ebe`. Four type-only files are omitted by bundling; all 11 downloaded runtime files match. The initial deployment returned HTTP 400 and left version 76 unchanged; an exact-source retry succeeded as version 77. Both operation records remain preserved; the first failure's cause is unconfirmed. Post-browser inspection still reports version 77. ai-api version 7 is unchanged.

Performance report: `output/playwright/room-performance-1793006912173-c9f591c6/report.json`, status pass. Measured application commit `8e6362e` has the same frontend source tree as `d4dc4a5`: `628389618a2efe070c334819c26a0ce2ca0366f0`.

| History size | Healthy message GETs / 60 seconds | Response body bytes | Initial feedback calls | Join ms | Disconnect recovery ms |
| --- | --- | --- | --- | --- | --- |
| 10 | 1 | 8418 | 1 | 814 | 3620 |
| 100 | 2 | 84290 | 1 | 967 | 2514 |
| 1000 | 11 | 845872 | 10 | 2652 | 1860 |

All histories have zero healthy feedback reads, two targeted rating refreshes, persisted five-like aggregates, actual matching message/room/feedback WebSocket events before UI assertions, fresh reconnect acknowledgement and no private payload or system errors. All three rooms, their dependent fixture rows and both users were removed; errors are empty. Independent source/performance review is clear.

Baseline report: sibling worktree `open-issues-20261024/output/playwright/room-performance-1792976244929-727fe825/report.json`, application `7762cbb8eaeccf8c92360dc8eb335219651cd4b1`. At 100/1000 messages it records 30 message GETs, 2531640/25376640 bytes, 200/2159 initial feedback calls and 1962/16531 ms joins. Baseline backend version 76 and candidate version 77 share the relevant AI-disabled fixture contracts and publication membership. Timings are observed comparisons under uncontrolled conditions, not production averages or isolated causal estimates. The 5000-item assessment-ordering benchmark retained exact output parity and improved heavy-case median from 82.437 to 17.498 ms.

Full browser report: `tmp/browser_demo_runs/staging-template-20261026093728-b8f938db/report.json`, exact candidate `d4dc4a5`, completed `2026-10-26T09:48:02.349Z`, process exit 0. All 11 workflows pass: cyberbullying identities/roles/export, tutor-response, checklist-generation, room-assessment-setup, checklist-management, checklist-coverage, guard-mode, assessment-delivery, assessment-answer, transfer-status-events and early-message-recheck. Every workflow cleanup passes. Persisted provider/lifecycle evidence and screenshots remain in that run directory. Earlier failed runs remain preserved.

Local harness verification passed 44 combined checks before the readiness repair, followed by 27/27 settings-readiness browser checks. Independent runtime review passed 89 tests plus snapshot. The TypeScript program has 446 inherited diagnostics and zero diagnostics in the modified hooks. Five suites / 93 tests are configured skipped in the full regression run. Database baseline and independent four-scenario migration records remain under `/Users/admin/.transfer-assessment-pg17/runs/realtime-publication-20261024/` and the sibling final review directory. Staging leases for both tested candidates were released after cleanup.

Status: staging verified, awaiting production release. The next commit changes this evidence record only, so runtime, function and SQL artifacts remain identical to the tested candidate. Require its actual GitHub checks before presenting the final head. Release trigger: human authorization of that current PR head, merge into `no_sign_up`, integrated artifact parity and fresh target preconditions. Root then promotes exact SQL before Edge source and runs the combined affected production journeys and cleanup. Production acceptance remains open.
