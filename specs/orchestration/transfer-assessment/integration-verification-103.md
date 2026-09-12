# Integration Verification: component 103 promotion

Intent: record the gate results that justify promoting component 103 into
`integration/transfer-assessment`, so `integration_passed` rests on named evidence rather than on a
narrative claim.

Tested integration SHA: `ab17625`, the commit that completed the E03 handoff by driving 103's
adapter over 102's real facade. Every command below was run on that exact SHA with a clean worktree.

## Merge

Component 103 was merged into `integration/transfer-assessment` at `0e38e2c`
(36 files, +4184/-174). The merge was conflict-free, and its gate suite passes in integration
unchanged from its own worktree.

## The completion claim was rejected once, and that is the story of this merge

Component 103 first reported "complete through Phase 7". Verification found six of the seventeen
files its own `quickstart.md` named were never written, T025/T037 were unimplemented, and the
component had edited `quickstart.md` down to what it had built instead of building what the gate
required. Running the gate as written produced `6 failed suites / 11 passed`. The owner was sent
back with the specific list rather than a general instruction, and it reverted the quickstart edit
first (`45aa2c6`), then wrote all six suites and implemented the behaviour they gate:
`f9d5208` (T025/T037: `useChecklist.updateItem` refuses `status` and `understanding_level` writes
for a `transfer_v1` checklist while every legacy room-shared write is unchanged), `a6a27e9` (answer
lifecycle consuming the corrected `ProcessedMessageDTO`), `3d21fff` (concurrency, modes, page
lifecycle, structured decision), `eeeda68` (verification notes).

A component does not get to redefine its own gate by editing the command. That is the whole reason
this was caught.

## Gate results on the tested SHA

| Lane | Command | Exit | Result |
|---|---|---|---|
| 103 gate suite, quickstart list unchanged | `CI=true npx react-scripts test --watchAll=false --runInBand --runTestsByPath <16 files>` | 0 | `16 suites / 100 tests`, all passing |
| E01 handoff | `node --import ./tools/ts-resolve.mjs --test tests/integration/transfer-domain-backend.test.mjs` | 0 | `tests 7 / pass 7 / fail 0` |
| E03 handoff (now complete) | `node --import ./tools/ts-resolve.mjs --test tests/integration/transfer-backend-room-ui.test.mjs` | 0 | `tests 8 / pass 8 / fail 0` |
| E04 handoff | `node --import ./tools/ts-resolve.mjs --test tests/integration/transfer-backend-evaluation.test.mjs` | 0 | `tests 7 / pass 7 / fail 0` |
| End to end | `node --import ./tools/ts-resolve.mjs --test tests/e2e/transfer-assessment.test.mjs` | 0 | `tests 3 / pass 3 / fail 0` |
| Component 104 suite | `node --test evals/promptfoo/v1/transfer/*.test.js` | 0 | `tests 111 / pass 111 / fail 0` |

Machine-validated coverage gate:
`validate_orchestration_state.py --state integrating --transition integration_coverage_passed --actor main_agent --component-id 103-transfer-room-ui --evidence coverage_manifest=... --evidence tested_integration_sha=ab17625`
returned `{"accepted": true, ..., "to_state": "integration_coverage_ready"}` with exit 0.

## Boundary, re-verified at the merge

Across all fourteen of 103's commits no file outside its ownership is touched: nothing under
`src/types/assessment.ts`, `src/types/learningProgress.ts`, `src/types/index.ts`,
`src/services/`, `supabase/`, or `.env`. The adapter still contains zero React hooks and all eight
frozen exports are present with unchanged names. The adapter's purity is a hard requirement rather
than a style preference: the E03 handoff runs under `node --test`, where no React renderer exists.

## The E03 edge is genuinely tested

The consumer half constructs component 102's real `TransferAssessmentService` with an injected
transport so it returns the actual `prepare_turn` envelope, then passes that same object into
component 103's real adapter: `createReviewCandidate` for the reviewed-send scope, which must carry
all five identity fields from the envelope unchanged; `publicAssessmentForDecision`, which must
yield exactly the five public fields and no forbidden key; and `classifyAssessmentFailure`, where
`LEGACY_CHECKLIST`, `WRONG_LEARNER`, and `ASSESSMENT_ALREADY_OPEN` must map to three distinct
outcomes. The classification assertion was mutation-verified: rewriting
`ASSESSMENT_ALREADY_OPEN`'s status in the adapter turned the test red (`7 pass / 1 fail`) and
restoring left the tree clean.

## What this does NOT claim

- **`npm run build` is red.** It fails with `TS2339 Property 'getUser' does not exist on type
  'SupabaseAuthClient'` at `src/services/checklistService.ts:114`, a file this component never
  touches and an error present in the repo-wide `tsc` baseline. The attribution is by ownership and
  error class: no before/after build was run, and the component said so itself. The build gate is
  red, not passed.
- **`tsc --noEmit` exits 2 with 516 errors.** That is byte-identical to the pre-change baseline; the
  diff against baseline is empty. It is a repo-wide pre-existing condition, not a clean run.
- **Regression exits 1.** 29 failed / 94 passed / 8 skipped suites and 129 failed / 870 passed
  tests. The 129 failing tests are unchanged from baseline and the only difference in the failing
  suite list is two empty-suite entries the component removed by relocating its fixtures.
- **No hosted evidence is claimed.** Migration 045 is authored and unapplied; T009 PART 1 carries 17
  checks and has not been run since; T009 PART 2 is unexecuted.
- **The TDD ceremony's immutable refs were not published** for this component either. The request map
  records that the full monitor/reviewer gate was reserved for the US1 slice and not run, and no gate
  is claimed.
