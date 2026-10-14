---
title: Recheck learner messages after learning goals are saved
type: bugfix
created: 2026-10-14
status: done
baseline_commit: 88b3ccd
context:
  - tutor-system/docs/RoomContext.md
  - tutor-system/docs/browser-e2e-testing.md
---

Intent: close the missing goal-setup recheck in an isolated, reviewable worktree.

<frozen-after-approval reason="user requested a worktree to fix the investigated issue">

## Intent

Student messages posted before learning goals exist are saved but cannot update learning progress. Saving goals currently leaves that evidence unchecked until a tutor separately requests AI for a particular message. Automatically analyze eligible saved learner messages after target initialization, using the existing trusted analysis API.

## Boundaries & Constraints

Use the existing checklist initialization service and message-analysis endpoint. Preserve learner ownership, assessment-answer handling, Guard policy, and server message deduplication. Analyze messages in chronological order. Keep this change on `fix/recheck-messages-after-goals` in its dedicated worktree with focused tests and documentation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected behavior |
| --- | --- | --- |
| Early evidence | Two ordinary learner messages before goals | Both message IDs are analyzed after target initialization, oldest first; returned progress reflects analysis. |
| Empty history | Learner joined without posting | Goals save normally with no analysis calls. |
| Mixed history | Tutor posts, another learner, assessment answers | Query selects only ordinary messages from the target checklist owner in this room. |
| Retry | First message succeeds, second analysis fails | Goal draft remains retryable; failure is surfaced. Retry uses the API's completed-message deduplication. |
| Read error | Message inventory cannot be loaded | Fail explicitly and preserve retry state rather than silently skipping evidence. |
| Initialization error | Target write fails | No historical analysis occurs. |
| Long history | More than one query page | All eligible messages are visited in stable chronological order. |
| Delayed learner arrival | Goals initially saved as a local draft | Promotion to a learner-owned checklist executes the same recheck. |

</frozen-after-approval>

## Code Map

- `tutor-system/src/services/checklistService.ts`: initializes trusted targets and returns the owner-scoped checklist; add sequential history analysis and final progress reread here.
- `tutor-system/src/contexts/RoomContext.tsx`: route ordinary learner sends and tutor AI focus requests through the same chronological prefix analysis as goal initialization.
- `tutor-system/src/hooks/useChecklist.ts`: preserves target drafts until initialization succeeds; existing promotion/retry path should cover analysis failures as well.
- `tutor-system/src/services/transferAssessmentService.ts`: existing initializeChecklist/analyzeMessage methods; preserve API contracts.
- `tutor-system/src/hooks/__tests__/useChecklist.earlyMessages.integration.test.tsx`: new integration regression using the real hook and initialization service, mocked transport.
- `tutor-system/src/components/__tests__/ChecklistPanel.transfer.test.tsx`: existing target promotion/retry/role coverage.
- `tutor-system/docs/RoomContext.md` and a dated update record: document historical evidence recovery and validation.

## Tasks & Acceptance

- [x] Reproduce the original symptom with a failing hook/service integration regression.
- [x] Initialize goals, load eligible messages with stable ordering/pagination, and analyze sequentially through the existing API.
- [x] Reread progress after analysis and propagate failures to the existing target-draft retry path.
- [x] Verify zero messages, owner filtering, assessment exclusion, partial failure/retry, delayed learner promotion, and multiple pages.
- [x] Verify concurrent goal replay and live-message analysis cannot process a newer message before older pending evidence; verify tutor focus stops at the selected message.
- [x] Verify a warm completed history does not cause one Edge request per historical message on each new interaction; retain deferred/failed messages for recheck.
- [x] Run affected Jest suites, application TypeScript, production build, and existing backend deduplication contract checks where available.
- [x] Independently review the complete diff and update nearest documentation; commit scoped changes in the new worktree.

Acceptance criteria:

- Given a learner posts A and B before goals exist, when the tutor saves goals, then analysis receives A and B chronologically and the panel receives refreshed progress without a separate AI click.
- Given analysis fails after A succeeds, when the tutor retries synchronization, then the draft remains usable and server deduplication prevents duplicate progress evidence for A.
- Given a different learner or assessment answer exists, when goals are saved, then those messages remain outside the replay request inventory.
- Given goal replay and a new student message overlap, when either path analyzes evidence, then both complete the same earlier message prefix before progressing to newer evidence.

## Spec Change Log

2026-10-14 — Edge review found that serializing the goal replay alone did not serialize it with the learner's live analysis. A newer correct message could complete before older unsafe evidence, causing the old evidence to overwrite progress. Extract one shared ordered-prefix helper and use it for goal initialization, ordinary learner sends, and ordinary tutor focus requests. Preserve owner/assessment filtering, pagination, explicit errors, final progress reread, and draft retry behavior. Add a deterministic concurrency regression rather than introducing a second progress ledger.

2026-10-14 — Final acceptance review found that shared prefixes could revisit 1,001 completed messages on every interaction. Add an advisory session cache scoped to room and learner, containing only message IDs explicitly confirmed complete by the trusted API. Goal replay confirms newly processed messages before caching; deferred and failed results remain eligible. Cache failures preserve actual analysis. Add warm-history invocation-count, deferred-retry, and cache-storage boundary tests while preserving the chronological concurrency regression.

2026-10-14 — Cover target initialization during an in-flight ordinary learner insert: reread the owner-scoped checklist after persistence and use prefix analysis if targets appeared. Add a failing-before-fix context regression and an absent-target control. The affected 12-suite run passes 178 tests; the shared helper integration covers 14 cases including concurrent replay, selected-focus boundaries, and missing focus.

## Design Notes

2026-10-14 performance follow-up: cache only explicit server completion confirmations in session
storage scoped by room and learner. Goal replay primes confirmations; live/tutor prefixes skip
confirmed IDs while keeping deferred IDs retryable. Invalid or unavailable cache storage uses
actual server analysis. The 1,001-message warm-history regression failed with 1,002 requests before
this change and now uses one request for a new focus, then two for the following new focus.

Live MCP inspection confirmed that the existing analysis context exposes `analysis_complete`, and completed messages short-circuit before a provider call. The apply RPC also locks and deduplicates by message ID. Initialization is idempotent for matching target text/type, allowing the existing draft retry path to repeat safely. Reuse these mechanisms rather than adding a second progress ledger.

## Verification

Use mocked transport for deterministic regression tests and existing API tests for completed-message deduplication. Run the TypeScript application compiler and production build on the worktree. Record exact commands, red/green results, and validation boundaries in the dated documentation record.

Final results: 185 Jest tests passed across 12 suites, 33 existing API contract tests passed, application TypeScript had zero diagnostics, and the production build passed with existing warnings. Full repository TypeScript still has 454 baseline diagnostics in 33 files; normalized file/code/message signatures match baseline. The original missing-recheck, in-flight goal creation, concurrent analysis, and repeated-history latency cases have regression evidence. See the [verification record](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_early_message_recheck.md).

## Suggested Review Order

Merged into `no_sign_up` as `7582916`. Post-merge verification passed 185 Jest tests, 34 current API contract tests, application TypeScript, and the production build. See the [merge record](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_early_message_recheck_merge.md).

- Follow goal initialization through historical evidence recovery and refreshed progress.
  [checklistService.ts:104](../../tutor-system/src/services/checklistService.ts#L104)
- Inspect the ordered prefix and server-confirmed completion cache.
  [checklistService.ts:136](../../tutor-system/src/services/checklistService.ts#L136)
- Check ordinary learner routing and goals appearing during persistence.
  [RoomContext.tsx:724](../../tutor-system/src/contexts/RoomContext.tsx#L724)
- Verify tutor requests analyze the same prefix before preparing an assessment.
  [RoomContext.tsx:1072](../../tutor-system/src/contexts/RoomContext.tsx#L1072)
- Review actual hook/service/facade regressions and concurrent transport cases.
  [useChecklist.earlyMessages.integration.test.tsx](../../tutor-system/src/hooks/__tests__/useChecklist.earlyMessages.integration.test.tsx)
