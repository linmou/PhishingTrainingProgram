# Implementation Handoff: W2 Deterministic Transfer Behavior

**Intent**: report component 101's implemented public contracts, preserved TDD evidence, exact commands and results, and the downstream risks for component 102 and 104, without claiming any integration promotion.
**Date**: 2026-09-22
**Implementation commit ID**: `91d8036`

## Current Implementation (2026-09-22)

The two-attempt transfer lifecycle is implemented in the pure component 101 domain boundary. The resolver accepts a server-owned `TransferAttemptSnapshot`, validates lifecycle invariants, and returns immutable result snapshots. Component 102 remains responsible for persistence, concurrency, idempotency, API DTOs, and role-safe projection. `transferAssessmentService.ts`, Supabase migrations/functions, React/UI code, provider calls, and evaluation/release surfaces were not changed.

### 2026-09-29 Snapshot Enforcement Follow-up

`attempt_snapshot` is required on both resolver context types. `resolveTransferAnswer` always validates and consumes that snapshot; the snapshot-free one-attempt fallback and snapshot-free result type are removed. A missing or malformed snapshot fails with `INVALID_ATTEMPT_SNAPSHOT`. The normative requirements are unchanged.

- RED evidence: the missing-snapshot regression failed before the implementation change and passed afterward.
- Focused verification: orchestrator **32/32**, golden fixtures **103/103**, and assessment API Edge Function **13/13** passed.
- TypeScript: isolated resolver check passed. Repository-wide `npx tsc --noEmit` remains non-zero with **454 pre-existing errors across 34 files**; there are no diagnostics on the edited implementation or test paths.

### Public contracts

- `PrivateAssessment.learner_safe_explanation` is required and validated as trimmed, non-empty text by `tutorDecisionContract.ts`; it is absent from `PublicAssessment`.
- `TransferAttemptSnapshot` carries `assessment_id`, accepted attempt count `0 | 1 | 2`, `open | passed | failed` resolution, and processed answer-message identities.
- `TransferRetryResult` reports the first incorrect valid selection with unchanged progress, one remaining attempt, no transition, and no terminal feedback.
- `TransferPassedResult` reports a correct first or second selection, applies `assessment_pass` once, requires feedback, retains terminal feedback privately, and sets `learner_feedback_authorized: false`.
- `TransferFailedResult` reports the second incorrect selection, applies `assessment_fail` once, requires repair, includes terminal feedback, and sets `learner_feedback_authorized: true`.
- Non-consuming results preserve the input snapshot and do not expose terminal feedback. All attempt/result/feedback types are exported from `tutor-system/src/types/index.ts`.

### Lifecycle evidence

The `transfer_v1` manifest version `1` contains nine executable `attempt_sequence` records: `correct_first`, `incorrect_correct`, `incorrect_incorrect`, `duplicate`, `reload_tab_equivalent`, `terminal_third_submission`, `stale_snapshot`, `guard_deferred`, and `assistance`. The fixture suite replays every record through `resolveTransferAnswer`, asserting progress, next action, applied transition, remaining attempts, immutable snapshot, terminal-feedback presence, and disclosure authorization. First-incorrect outputs contain no terminal feedback; passed outputs retain private feedback with authorization false; only second-incorrect failure authorizes feedback disclosure.

### Current verification

- Exact command from `quickstart.md`: **7 suites passed, 208 tests passed**.
- Focused attempt/contract command: **3 suites passed, 154 tests passed**.
- `npx tsc --noEmit`: non-zero due to the repository baseline (**514 errors in 47 files**). The attributable errors found during implementation are resolved; no remaining errors point to the modified transfer contracts.
- `CI=true npm run test:regression -- --runInBand`: **33 failed, 9 skipped, 91 passed suites**; **130 failed, 141 skipped, 935 passed tests**. Transfer service/orchestrator/fixture suites pass. Failures are unrelated repository/test-environment debt, including missing archived migration files, incomplete Supabase mocks, missing optional test packages, and unrelated UI/service suites.
- `npm run build`: succeeds with existing CRA lint warnings; no transfer-specific build warning was introduced.

No integration merge, handoff test, hosted database/RLS check, authorization check, provider evaluation, browser acceptance, or release smoke run was performed. Component 102 must persist the returned snapshot atomically across reloads/tabs, deduplicate by answer identity, exclude private feedback on retry/pass, and project key/explanation only when `learner_feedback_authorized` is true. Component 104 evaluates explanation quality separately. `TRANSFER_ASSESSMENT_ENABLED` remains disabled.

## 2026-09-22 Upgrade Status

The evidence below records the prior one-attempt implementation and is retained as historical context only. The current implementation and verification are recorded above.

- `PrivateAssessment.learner_safe_explanation` with structural validation and unresolved-public exclusion;
- a server-owned `TransferAttemptSnapshot` persisted by component 102 across reloads and tabs;
- first incorrect -> `retryable` with unchanged progress and no terminal feedback;
- correct on either attempt -> terminal `passed`; second incorrect -> terminal `failed`;
- duplicate, stale, invalid, Guard-deferred, and third submissions -> no additional attempt or transition;
- terminal-only `TransferTerminalFeedback` containing correct option IDs and learner-safe explanation, with learner disclosure forbidden on pass and authorized only on second-incorrect failure.

The revised implementation command, test counts, and current contract evidence are recorded in `Current Implementation` above. The historical task list remains the traceability source for T001-T031.

## Normative Source

- Normative source SHA-256: `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`, recorded during T001 and restated here so the implementation handoff the task names actually exists.
- Component planning commit: `d64b4bed13f57c3fb03442b9d6c757f868d17129`.
- Local implementation commit: `4b818a2 feat(transfer): implement pure transfer-assessment resolver and changed-context rejection`.

## Prior Changed Public Contracts (Historical)

- `transferAssessmentOrchestrator.ts` is new and is the component's pure entry point. It exports `resolveTransferAnswer`, `createTransferTurnContext`, `reduceTurnEvent`, and the types `TransferAssessment`, `TransferLifecycleContext`, `TransferAnswerInput`, `TransferTurnContextInput`, `TransferResolvedAssessment`, `TransferAssessmentDisposition`, `TransferAssessmentNextAction`.
- `TransferLifecycleContext` gained `pending_repair_message_id`; `TransferAnswerInput` gained optional `references_message_id`.
- `tutorDecisionContract.ts` now rejects a `changed_context` that restates the source context, satisfying FR-003's prohibition on cosmetic substitutions and unstated prerequisites. The check is a normalized situation-word overlap test; see Residual Risks.
- `transferAssessmentGoldenFixtures.ts` moved from `src/services/__tests__/fixtures/` to `src/services/` because Jest collected the old location as an empty test suite under full discovery. Import paths updated in both consuming test suites.
- No change to `transferAssessmentService.ts`, its test, `specs/**` content semantics, or any 102-owned surface.

## Prior Behaviour Implemented (Historical)

- Delivery, staleness, duplicate, feedback, and protective-deferral gates run before any parse or grade, so an undelivered, stale, already-resolved, feedback-pending, or Guard-deferred answer can never create a second effect.
- Pending repair without learner evidence that references the repair returns `unresolved` with `await_learner_evidence`; evidence that references the repair applies the `post_repair_signal` transition to return the target to `partially_covered/basic` and leaves grading to a fresh assessment.
- First valid selection grades by exact deduplicated set equality only, mapping to `passed`/`assessment_pass` or `failed`/`assessment_fail` through the single reducer authority.
- Ambiguous or unrecognized input returns `unresolved` with its stable clarification code; content help returns `assisted` with `cancel_question`.

## Prior Verification Evidence (Historical)

- Focused W2 suites, exact `quickstart.md` command: `Test Suites: 7 passed, 7 total`, `Tests: 185 passed, 185 total`.
- Pre-Green revision `refs/tdd/transfer_domain/pre_red_round_2` at the frozen Red measurement failed with `Cannot find module '../transferAssessmentOrchestrator'` and `Received function did not throw` for the cosmetic changed-context case. Those are the failures Green cleared.
- Type check: `npx tsc --noEmit` reports zero errors in every touched `transferAssessment*`, `tutorDecisionContract`, `assessmentAnswerParser`, and `types/**` path.
- Full regression, `CI=true npx react-scripts test --watchAll=false --runInBand`:
  - after Green: `Test Suites: 29 failed, 8 skipped, 72 passed, 101 of 109 total`; `Tests: 128 failed, 140 skipped, 719 passed, 987 total`.
  - same command at `refs/tdd/transfer_domain/pre_red` in a detached worktree with the same `.env` and `node_modules`: `Test Suites: 29 failed, 8 skipped, 70 passed, 99 of 107 total`; `Tests: 128 failed, 140 skipped, 578 passed, 846 total`.
  - attribution: the failing suite and test counts are identical before and after, so this component introduced zero new failures; passing tests rose by 141, and passed suites by 2.
- Build: `npm run build` succeeds and produces `build/static/js/main.908a82ec.js`. Under `CI=true` the build fails on pre-existing repository lint debt (React hook dependency warnings, unused variables, a redundant `alt` attribute) and fails identically at `refs/tdd/transfer_domain/pre_red`, so it is not attributable to this component.
- Environment: the worktree needed a `.env` with `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` for any suite that imports `supabase.ts`; it was copied from the main repository, and it is not committed.

## TDD Evidence Preserved

- Pre-Red gate record: `audits/transfer_domain_pre_red_gate.md`, with the Start Gate verdict, the independent monitor passes, the authoritative map digest `7a61390601715310be6f1827744fb8973ceefc526bd0597251abbc0254fbe5c1`, and the planned-test baselines.
- Red reviewer provenance: `audits/transfer_domain_red_iteration1_provenance.json`, binding the role receipt and three reviewer-owned audits by SHA-256.
- Frozen pre-Green baseline: `refs/tdd/transfer_domain/pre_red_round_2` = `3094225b298b78bba924e4923f83448b0d8dbbc3` is the valid pre-Green production revision (the orchestrator module is absent there).
- Recorded snapshot defect: `refs/tdd/transfer_domain/pre_green` = `9e414df3` was published **after** the Green implementation, so it contains the orchestrator and cannot serve as the pre-Green baseline. The pre-Green production revision to use for the Refactor replay is `pre_red_round_2`. This is reported rather than silently corrected.
- Compact-route no-op records: `audits/transfer_domain_refactor_noop.md` and `audits/transfer_domain_test_refactor_noop.md`.

## Unrun Downstream Gates

- No integration merge, no handoff test, no end-to-end test, no smoke run, and no coverage manifest. E01 (101 -> 102) and E02 (101 -> 104) remain integration-owned and unexecuted.
- No hosted Supabase, migration, RLS, authorization, provider, Promptfoo, browser, or release evidence. The feature flag `TRANSFER_ASSESSMENT_ENABLED` remains disabled.
- Component 101 is green locally only; a local pass is not promotion.

## Residual Risks for 102 and 104

- The changed-context quality check is a lexical situation-word overlap heuristic, not a semantic judgement. It rejects a restatement of the source context, but it can be satisfied by an unrelated situation that does not exercise the concept. Component 102 and 104 must not treat it as semantic transfer validation, and a stricter rule needs a product decision.
- In the prior implementation, `resolveTransferAnswer` returns no assessment payload. The upgrade supersedes that boundary only for second-incorrect failure: component 102 must still exclude transfer basis always and key/explanation on retry or pass, while projecting key/explanation only when `learner_feedback_authorized` is true.
- Duplicate suppression by resolved-answer identity is only partially isolated: the feedback gate can also produce `duplicate`, so 102 must enforce idempotency by persisted answer identity rather than by relying on this pure result alone.
- The full-suite regression carries 29 pre-existing failing suites unrelated to this component; they are baseline failures, not component defects, but they will also be present in integration.
