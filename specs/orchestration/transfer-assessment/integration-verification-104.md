# Integration Verification: component 104 promotion

Intent: record the gate results that justify promoting component 104 into
`integration/transfer-assessment`, so `integration_passed` rests on named evidence rather than on a
narrative claim.

Tested integration SHA: `f1cb1ea`. That is the commit which completed the E04 handoff by driving
component 104's adapter over component 102's real builder. Every command below was run on that
exact SHA with a clean worktree.

## Merge

Component 104 was merged into `integration/transfer-assessment` at `69e8274`
(57 files, +5955/-6). The merge itself was conflict-free.

## Gate results on the tested SHA

| Lane | Command | Exit | Result |
|---|---|---|---|
| E01 handoff | `node --import ./tools/ts-resolve.mjs --test tests/integration/transfer-domain-backend.test.mjs` | 0 | `tests 7 / pass 7 / fail 0` |
| E04 handoff | `node --import ./tools/ts-resolve.mjs --test tests/integration/transfer-backend-evaluation.test.mjs` | 0 | `tests 7 / pass 7 / fail 0` |
| E03 production side | `node --import ./tools/ts-resolve.mjs --test tests/integration/transfer-backend-room-ui.test.mjs` | 0 | `tests 4 / pass 4 / fail 0` |
| End to end | `node --import ./tools/ts-resolve.mjs --test tests/e2e/transfer-assessment.test.mjs` | 0 | `tests 3 / pass 3 / fail 0` |
| Component 104 suite | `node --test evals/promptfoo/v1/transfer/*.test.js` | 0 | `tests 111 / pass 111 / fail 0` |
| Components 101+102 suites | `CI=true npx react-scripts test --watchAll=false --runInBand --testPathPattern='(transferAssessment\|transferTutor\|transferMigration\|tutorDecisionContract.transfer\|assessmentApi)'` | 0 | `11 suites / 190 tests`, all passing |
| Manifest validation | `node evals/promptfoo/v1/transfer/validate-manifest.js specs/104-transfer-evaluation/contracts/transfer-case-schema.md` | 0 | 13 cases, 0 case errors, 0 manifest errors |
| Gate fixtures | `node evals/promptfoo/v1/transfer/gate-fixtures.js` | 0 | 15 fixtures, 15 matched, 0 mismatched |

Machine-validated coverage gate:
`validate_orchestration_state.py --state integrating --transition integration_coverage_passed --actor main_agent --component-id 104-transfer-evaluation --evidence coverage_manifest=... --evidence tested_integration_sha=f1cb1ea`
returned `{"accepted": true, ..., "to_state": "integration_coverage_ready"}` with exit 0.

## Two defects found and fixed, both before promotion

**1. Undeclared dependency made the component's own green suite unreproducible (`8ce2f7b`).**
Component 104 reported `111/111` on its branch. After the merge the same suite reported
`94 pass / 17 fail` in integration, with `Cannot find module 'typescript'`. The cause was that
`shared-request-contract.js` resolved `typescript` bare from the worktree root, which only worked
because of an undeclared `npm install --no-save typescript@5` in that one checkout. Nothing in the
repository declared it, so no other worktree could reproduce the pass. It now resolves
`tutor-system/node_modules/typescript`, which is declared in `tutor-system/package.json` as
`^4.9.5`. This is the third defect of the same class in this component, after the frozen-plan path
and the unnamed module require; all three presented as a passing suite in one worktree and would
have failed everywhere else.

**2. `ProcessedMessageDTO` read a field the server never sends (`191348d`).** Found by component
103, confirmed by the integration agent against the live function definition:
`process_assessment_message_v1` returns `message_id` in all three of its RETURN clauses and never
returns `question_id`, so the facade reported an empty assessment identity on every learner answer.
The same projection also dropped `code`, `clarification_required`, and `already_processed`, which
made the server's `ANSWER_FORMAT_UNRESOLVED` clarification signal unreachable from the UI. Corrected
test-first: `transferAssessmentProcessMessage.test.ts` was written against all three response
variants, observed failing with `Received: undefined`, then made green. The projection now
reproduces all three shapes.

## What this does NOT claim

- **No live evaluation result is claimed.** The provider probe returned HTTP 200 with the frozen
  `max_tokens 1200` / `enable_thinking false` and consumed 286 of the 1200 budget, which is a
  connectivity and configuration observation only. The live baseline is a partial run (9 of 26
  declared case/repetition generations) and is not a result. Judge calibration, the candidate run,
  candidate freeze, the sealed holdouts, and the live gate have not executed, so the four semantic
  rubrics are uncalibrated and no semantic pass is asserted. `assessment_followup` is deliberately
  absent from the live pass because deriving its lifecycle sequence from frozen case fields would
  invent evidence.
- **No hosted evidence is claimed.** Migration 045 is authored and unapplied. T009 PART 1 carries 17
  checks and has not been run since 045 was authored. T009 PART 2 remains unexecuted. The automated
  credential available to the agent reaches the Management API as `supabase_read_only_user`, which
  has `INSERT = false` on `public.users` and `public.messages`, so the behavioural lane can only run
  from the Dashboard SQL editor.
- **The E04 edge is declared; the E03 edge is not.** `tests/integration/transfer-backend-room-ui.test.mjs`
  still covers only the production side of 102 -> 103, so `upstream_output_consumed` is not asserted
  for it. It is declared when component 103 is merged and the test drives real facade output through
  103's adapter in the same run.
- **The TDD ceremony's immutable refs were not published for this component.** The monitor was
  delegated twice and returned substantive findings that were corrected, but the phase order had
  already passed; publishing `pre_red`/`pre_green` afterwards would attest a tree the reviewers never
  saw. Recorded as an omission, not as provenance.
