# Early learner message recheck

Intent: record the goal-setup evidence recovery change and its verification.

Date: 2026-10-14. Baseline commit: `88b3ccd`.
Branch: `fix/recheck-messages-after-goals`.
Merged into `no_sign_up` as `7582916`; see the [post-merge verification](documentation_update_record_v2026_10_14_early_message_recheck_merge.md).

## Change

`ChecklistService.initializeTransferChecklistForStudent` now verifies the initialized learner-owned
checklist, reads saved ordinary student messages for that learner and room in 500-row pages ordered
by `created_at`, then `id`, and calls the existing trusted analysis API sequentially. Assessment
answers stay outside that inventory. A final owner-scoped checklist read supplies refreshed progress
to the existing `useChecklist` draft promotion path. Any query, analysis, or refresh failure propagates
to that path, retaining its local draft and Retry sync action. Server idempotency handles a repeated
message after partial success.

Updated reference: `docs/RoomContext.md`, transfer target setup description.

## Regression evidence

The new `src/hooks/__tests__/useChecklist.earlyMessages.integration.test.tsx` uses the real hook,
checklist service, and transfer API facade with mocked Supabase query and function transports.

Before the production edit:

```sh
rtk proxy npm test -- --watchAll=false --runInBand --silent --runTestsByPath src/hooks/__tests__/useChecklist.earlyMessages.integration.test.tsx --testNamePattern='analyzes both early|saves goals with an empty|does not inspect'
```

Result: 1 failed, 2 passed, 8 skipped. For two early messages, expected analysis IDs
`["earlier", "later"]`; observed `[]`. Empty-history and initialization-failure controls passed.

After the service change, all 11 cases in that integration file passed. Cases cover the original
two-message sequence; empty history; room, owner, student-role, and assessment filtering; timestamp
ties; partial failure with retry; inventory and initialization failures; checklist identity checks;
final read failure; delayed learner arrival; sequential calls; and a 1,001-message history.

Independent review then found an ordering race between goal replay and the learner's live analysis.
The final change extracts `ChecklistService.analyzeStudentMessages`, which reads the complete ordered
inventory, validates a selected focus when supplied, and analyzes only the prefix through that focus.
Goal initialization, ordinary learner sends, and tutor AI focus requests now share this path. A
deterministic concurrent transport case pauses goal replay at X, posts B while A is still pending,
and starts live prefix analysis. Neither call advances past X until released; deduplicated commits
are exactly `["x", "a", "b"]` and the final numeric progress state is the chronological result `2`.
Two other cases verify selected-focus boundaries and missing-focus errors before analysis.

Review also identified an ordinary message whose initial owner read is empty but whose targets
appear before its insert returns. Its context regression failed before the follow-up change
(`expected owner reads: 2; observed: 1`). The context now rereads owner progress after that insert and
uses prefix analysis if transfer targets exist. A second case verifies the stored message when
targets remain absent. The shared helper integration file now has **14 passing cases**.

Focused combined command:

```sh
rtk proxy env REACT_APP_SUPABASE_URL=https://example.supabase.co REACT_APP_SUPABASE_ANON_KEY=test-anon-key npm test -- --watchAll=false --runInBand --silent --runTestsByPath src/hooks/__tests__/useChecklist.earlyMessages.integration.test.tsx src/components/__tests__/ChecklistPanel.transfer.test.tsx src/services/__tests__/transferAssessmentService.test.ts src/services/__tests__/transferAssessmentApiContract.test.ts src/__tests__/checklist_management.test.ts
```

Result: **72 tests passed across 5 suites**. The placeholder environment is needed for the existing
facade suite's Supabase client construction. An initial combined run without those variables passed
the hook and panel suites (43 tests) but could not load the facade suite (`supabaseUrl is required`);
the corrected combined command above passed.

Final affected-suite command after both review fixes:

```sh
rtk proxy env REACT_APP_SUPABASE_URL=https://example.supabase.co REACT_APP_SUPABASE_ANON_KEY=test-anon-key npm test -- --watchAll=false --runInBand --silent --runTestsByPath src/hooks/__tests__/useChecklist.earlyMessages.integration.test.tsx src/contexts/__tests__/RoomContext.checklistCoverage.test.tsx src/contexts/__tests__/RoomContext.transferAnswer.test.tsx src/contexts/__tests__/RoomContext.transferDraftLifecycle.test.tsx src/contexts/__tests__/RoomContext.transferConcurrency.test.tsx src/contexts/__tests__/RoomContext.transferIngress.test.tsx src/contexts/__tests__/RoomContext.transferModes.test.tsx src/__tests__/transfer_assessment.bdd.test.tsx src/components/__tests__/ChecklistPanel.transfer.test.tsx src/services/__tests__/transferAssessmentService.test.ts src/services/__tests__/transferAssessmentApiContract.test.ts src/__tests__/checklist_management.test.ts
```

Result: **178 tests passed across 12 suites**. RoomContext assertions verify learner and tutor
owner/focus arguments, analysis before assessment preparation, and assessment-answer exclusion.

The final performance review found that revisiting a completed prefix still made one Edge request
for every old message. A failing-before-fix regression primed a 1,001-message history, added one new
focus, and observed **1,002 requests where one was expected**. The helper now keeps a session-storage
cache scoped by room and learner and only records IDs explicitly confirmed by server
`already_processed: true`. Initial replay makes one completion-confirmation request for a newly
processed message, except an explicitly deferred result. Live calls confirm their previous new
message on the next pass. The new focus after 1,001 cached messages requires **one request**; the
following focus requires **two requests**, including confirmation of the preceding new message.
Query pagination still reads the owner inventory so focus validation and ordering remain intact.

Additional integration cases cover Guard-deferred evidence remaining uncached and retryable,
room/learner cache isolation, malformed JSON, invalid cache structures and IDs, unavailable reads
and writes, and confirmed IDs retained after partial failure. The integration suite now has
**21 passing cases**. Confirmation requests do not duplicate progress effects: two early messages
still produce exactly two processed IDs, and concurrent replay/live analysis still commits X, A,
then B once each. Cache failures warn and use actual analysis; cache data never supplies progress.
The same final affected-suite command above passed **185 tests across 12 suites** after this change.

The parent agent separately ran the existing assessment API contract:

```sh
rtk proxy /Users/admin/.deno/bin/deno test --cached-only --allow-env --allow-run supabase/functions/assessment-api/index.test.ts
```

Result reported by parent: **33 tests passed**, including trusted analysis, already-completed
messages, and the default RPC typecheck. Production MCP inspection confirmed existing completed-message
markers, transactional apply deduplication, and idempotent matching-target initialization.

## Validation limits

The regression uses deterministic transport fixtures; it does not claim a live provider result or
browser reproduction. Its retry fixture models the server's already-processed response. Existing
backend contract tests and live source inspection establish the deduplication dependency separately.
The parent independently reran the final 12-suite selection: **185 tests passed**, with complete
Jest results retained in `output/early-message-recheck/jest-final.json`. The production build passed
with existing lint and Browserslist warnings, and application TypeScript reported zero diagnostics.
The full repository check reported the same **454 diagnostics in 33 files** as baseline. Comparing
file, error code, and message (excluding positions shifted by test edits) produces the identical
SHA-256 signature `1c9218b4efed2b62d27f0a8041603516181ef023e9e7d8f327c9b5dbf92ba20a`.

Independent review identified the concurrent-analysis and repeated-history request problems; both
were resolved and their follow-up acceptance/edge reviews found no remaining actionable defects.
A cold browser session still checks completed history once; session confirmations avoid repeated
Edge requests afterward. Confirmed IDs are an advisory optimization, while progress continues to
come from the trusted server projection.
