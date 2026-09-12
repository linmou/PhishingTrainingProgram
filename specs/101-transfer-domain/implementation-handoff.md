# Implementation Handoff: W2 Deterministic Transfer Behavior

**Intent**: report component 101's implemented public contracts, preserved TDD evidence, exact commands and results, and the downstream risks for component 102 and 104, without claiming any integration promotion.
**Date**: 2026-09-11

## Normative Source

- Normative source SHA-256: `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`, recorded during T001 and restated here so the implementation handoff the task names actually exists.
- Component planning commit: `d64b4bed13f57c3fb03442b9d6c757f868d17129`.
- Local implementation commit: `4b818a2 feat(transfer): implement pure transfer-assessment resolver and changed-context rejection`.

## Changed Public Contracts

- `transferAssessmentOrchestrator.ts` is new and is the component's pure entry point. It exports `resolveTransferAnswer`, `createTransferTurnContext`, `reduceTurnEvent`, and the types `TransferAssessment`, `TransferLifecycleContext`, `TransferAnswerInput`, `TransferTurnContextInput`, `TransferResolvedAssessment`, `TransferAssessmentDisposition`, `TransferAssessmentNextAction`.
- `TransferLifecycleContext` gained `pending_repair_message_id`; `TransferAnswerInput` gained optional `references_message_id`.
- `tutorDecisionContract.ts` now rejects a `changed_context` that restates the source context, satisfying FR-003's prohibition on cosmetic substitutions and unstated prerequisites. The check is a normalized situation-word overlap test; see Residual Risks.
- `transferAssessmentGoldenFixtures.ts` moved from `src/services/__tests__/fixtures/` to `src/services/` because Jest collected the old location as an empty test suite under full discovery. Import paths updated in both consuming test suites.
- No change to `transferAssessmentService.ts`, its test, `specs/**` content semantics, or any 102-owned surface.

## Behaviour Implemented

- Delivery, staleness, duplicate, feedback, and protective-deferral gates run before any parse or grade, so an undelivered, stale, already-resolved, feedback-pending, or Guard-deferred answer can never create a second effect.
- Pending repair without learner evidence that references the repair returns `unresolved` with `await_learner_evidence`; evidence that references the repair applies the `post_repair_signal` transition to return the target to `partially_covered/basic` and leaves grading to a fresh assessment.
- First valid selection grades by exact deduplicated set equality only, mapping to `passed`/`assessment_pass` or `failed`/`assessment_fail` through the single reducer authority.
- Ambiguous or unrecognized input returns `unresolved` with its stable clarification code; content help returns `assisted` with `cancel_question`.

## Verification Evidence

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
- `resolveTransferAnswer` returns no assessment payload; component 102 owns projection into its DTOs and must keep the private key and transfer basis out of any learner-facing envelope.
- Duplicate suppression by resolved-answer identity is only partially isolated: the feedback gate can also produce `duplicate`, so 102 must enforce idempotency by persisted answer identity rather than by relying on this pure result alone.
- The full-suite regression carries 29 pre-existing failing suites unrelated to this component; they are baseline failures, not component defects, but they will also be present in integration.
