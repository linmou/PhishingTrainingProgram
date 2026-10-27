# Issues 19-22 Release Record

Intent: deliver the scoped message, feedback, assessment-ordering and RoomContext changes with exact staging and production evidence.

Updated: 2026-10-27. Release commit: `ac1282ab037d0320bd5ff1c7a2c38604f8c517a9`. Release owner: root Codex agent. Batch: `issues-19-22-20261026`. PR #31 merged as `7a752d13a1910a86f6dd98e3025b2d1d32a2e984`. Status: production verified; all four issues meet scoped acceptance. Final acceptance below supersedes historical checkpoints. Historical staging candidate: `d4dc4a5d947c26510ba15065894cddd3e1b879c4`; initial scoped integration `b392d5b`, base `4ff3f86`.

## Scope and Artifacts

This candidate includes #19 bounded message reconciliation and reconnect recovery, #20 batched/scoped feedback, #21 indexed assessment display ordering and #22 membership/Realtime ownership extraction. The tutor prompt, AI service and behavior specification match the target base; issue #2 remains suspended in the separate combined branch.

Runtime commits were selected into a fresh worktree from current `origin/no_sign_up`; the prior branch and primary checkout edits remain preserved. The minimal SQL prerequisite enables existing subscriptions for public messages, feedback and rooms without altering their permissions. SQL SHA-256: `c909b92da2c9b7d96c2a4f0d4e23a8f06d0cc85bb8885d01d2aa911dc4cf5e78`. The imported assessmentRendering file remains an assessment-api bundle dependency. Its exact scoped source closure replaced the previously staged combined bundle as version 77 before acceptance. ai-api is an unchanged dependency.

## Historical October 26 Staging Gates

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

Render auto-deploys the frontend from `no_sign_up`. The client retains degraded recovery before the publication is enabled. Read-only inspection of production assessment-api version 17 found only the assessmentRendering dependency different among the 11 runtime files; handler, parser, grading and prompt source match. The ordering helper does not change handler request/response contracts. This supported frontend compatibility before ordered SQL/Edge promotion. At this historical checkpoint, production had not been mutated by this batch and production acceptance remained open; final promotion and acceptance are recorded below.

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

Historical October 26 checkpoint: staging verified, awaiting production release. The evidence-only commit preserved the runtime, function and SQL artifacts. Its remaining merge, promotion and acceptance work is reconciled below; this checkpoint is not the current release status.

## October 27 Acceptance Reconciliation

PR #31 merged on October 26 at 19:19:53 UTC. The [Realtime prerequisite record](documentation_update_record_v2026_10_24_realtime_publication.md#independent-prerequisite-release-on-october-26) documents exact SQL application, real message/feedback/room events, payload boundaries and cleanup on production at `dec7c27`. The [public-flag release record](documentation_update_record_v2026_10_26_public_feature_flag.md#final-production-verification-and-archival) records promotion of the inherited ordering helper with all assessment-api runtime files matching `dc83330`, plus final answer lifecycle acceptance. PR #39 merged as `18b3109`, preserving that evidence and archiving the applied flag SQL. Both SQL artifacts are now archived.

The selected synchronization, feedback, ownership and ordering runtime files are unchanged from the passing staged performance run `9ce6ee7` to current integration. Its raw report `pr-29-resume/output/playwright/room-performance-1793052365618-e3e469ff/report.json` passes all three histories, real INSERT/UPDATE and room/feedback events, reconnect acknowledgements, missed INSERT/old UPDATE recovery, payload checks and room/user cleanup. At 10/100/1000 messages, message reads per 60 seconds are 1/2/11, initial feedback calls 1/1/10, unchanged feedback reads zero and recovery 2476/2339/2133 ms. The retained baseline at 100/1000 has 30 reads, 200/2159 initial feedback calls and 2531640/25376640 body bytes versus 84290/844090 after. These are measured staging comparisons, not production timing guarantees.

Fresh local verification on the integrated evidence branch passed 25 suites, 258 tests and the existing ownership snapshot; one suite/test remains intentionally skipped. The first invocation passed tests but failed to save JSON into a missing output directory; after creating it, the identical invocation exited 0. Results: `pr-29-resume/output/issues-19-22-closeout-20261027/focused-regression.json`.

Production preflight through Supabase MCP confirms the intended three-table publication, public flag true, assessment-api v19/bundle `ae491e78fd87f3428c66fc75c38a4e5e9f28b516192d6420be834f21cb8cb427` and ai-api v6/bundle `fb06f78eec921db96331338dff404b7f02938e99503c49fd2c03ad21383c3150`. All 11 downloaded assessment-api runtime files exactly match `dc83330`, including assessmentRendering. Source comparison is retained in `pr-29-resume/output/issues-19-22-closeout-20261027/production-source-manifest.json`.

Combined production checks used the frozen `dc83330` checkout, whose application/Edge and selected harness source match current integration. Ten of eleven selected journeys have passing evidence: cyberbullying, tutor-response, checklist-generation, room-assessment-setup, checklist-management, checklist-coverage, guard-mode, transfer-status-events and early-message-recheck passed fresh runs; assessment-answer passed the exact-source final lifecycle run recorded in PR #39. Assessment-delivery failed after four persisted question/answer/result cycles when a later `analyze_message` returned HTTP 502 / `AI_OUTPUT_INVALID`. All fixture cleanup, lease releases and application shutdowns passed. Preserve this failure; the combined acceptance gate remains open.

Fresh run evidence: `pr-29-resume/output/public-assessment-flag-20261026/production-1793129512612/` and `production-1793130002248/`. Failed delivery report: `public-flag-release-20261027/tmp/browser_demo_runs/production-template-20261027193534-b68547ba/report.json`. Reused exact-source answer report: `production-template-20261027185813-14707d98/report.json` in the same browser evidence root. At this failed checkpoint no corrective deployment had occurred; production remained assessment-api v19.

## Final Combined Production Acceptance

The maintainer merged corrective PR #41 as `ac1282a`. Merged source matched staging-tested source, and the selected performance/ownership modules remained unchanged from `9ce6ee7`. Exact source was promoted to production assessment-api **v20**, bundle `4eebe11322379efb80f4489f01574d18f0ee33ec74515318b9e504ea91f0fb10`; staging remains **v80**. All 11 downloaded runtime files match the merged commit in both environments. No additional SQL was needed.

All **eleven** selected production journeys now pass on frozen `ac1282a`, including full assessment delivery, transitions, answer lifecycle, roles/export, room setup, early-message recheck, tutor response, all three checklist flows and Guard Mode. Every fixture cleanup passes; the app stopped, local fixture lock was removed and both owned project leases were released. Persisted official-support credit is correct, with no unrelated Login Activity or contact-method credit. [Repair record with exact run IDs, artifacts and review limits](documentation_update_record_v2026_10_27_analysis_output_repair.md#final-production-acceptance). Final release evidence: `pr-29-resume/output/issues-19-22-closeout-20261027/production-repair-1793134966910/release.json`; finalizer exited 0 with `production-verified`.

## Issue Disposition

- **#20: scoped acceptance met.** Initial feedback batches at 10/100/1000 messages are 1/1/10; unchanged healthy feedback reads are zero. Targeted rating refreshes, persisted aggregates, own ratings, empty-cache behavior, deduplication and room/user cancellation are covered by focused tests and the live performance/production rating journeys. See [feedback evidence](documentation_update_record_v2026_10_24_feedback_batching.md).
- **#21: scoped acceptance met.** All six before/after benchmark pairs preserve exact ordering output. Heavy-case median/p95 at 1000 messages improves from 7.408/15.901 to 3.155/3.247 ms; at 5000 from 82.437/108.715 to 17.498/19.182 ms. Complexity is O(N log N + N + E). Integrated production source matches, and answer lifecycle ordering passes. See [ordering evidence](documentation_update_record_v2026_10_24_assessment_ordering.md).
- **#19: scoped acceptance met.** Synchronization, recovery, measured costs, cancellation and Guard Mode checks pass; corrective #40 release also passes all eleven combined production journeys, including full assessment delivery.
- **#22: scoped acceptance met.** Module ownership, consumer contracts and before/after request/channel/render counts are verified; all eleven combined production journeys now pass. See [ownership evidence](documentation_update_record_v2026_10_24_room_context_ownership.md).

Root completed #40 repair/release ownership through production acceptance and cleanup. The [repair record](documentation_update_record_v2026_10_27_analysis_output_repair.md) distinguishes format recovery from evidence correctness and preserves both failed and final passing evidence.
