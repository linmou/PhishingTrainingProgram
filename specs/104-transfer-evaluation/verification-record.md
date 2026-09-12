# Verification Record: component 104-transfer-evaluation

**Intent**: record exactly which gates this component ran, with observed commands, exit codes, and counts, and which gates remain unrun, so no unobserved result is reported as a pass.

**Recorded**: 2026-09-12 on branch `104-transfer-evaluation`.

## 1. Observed offline results

| # | Command (run from the worktree root) | Exit | Observed counts |
| --- | --- | --- | --- |
| 1 | `rtk proxy node --test evals/promptfoo/v1/transfer/*.test.js` | 0 | tests 111, pass 111, fail 0 |
| 2 | `rtk proxy node evals/promptfoo/v1/transfer/validate-manifest.js specs/104-transfer-evaluation/contracts/transfer-case-schema.md` | 0 | 13 cases, `case_errors` 0, `manifest_errors` 0, `schema_document_sections_missing` [] |
| 3 | `rtk proxy node evals/promptfoo/v1/transfer/gate-fixtures.js` | 0 | fixtures 15, matched 15, mismatched 0 |
| 4 | `rtk proxy node --test evals/promptfoo/v1/transfer/*.test.js evals/promptfoo/v1/harness.test.js evals/promptfoo/v1/analyze.test.js evals/promptfoo/rubrics/v1/decision-metrics.test.js` | 0 | tests 147, pass 147, fail 0 |

The regression command (4) includes the historical v0/v1 suites, so the additive registration in `evaluator.js`, `gate.js`, and `runner.js` is observed not to change legacy results.

## 2. The 1,200-token budget and the thinking flag (R13, R14)

The effective transfer completion budget is **not** a shared export. It is the literal `max_tokens: 1200` at the transfer call site in `tutor-system/supabase/functions/assessment-api/index.ts`, and the same call site sets `enable_thinking: false` and `temperature: 0.3`. A second, unrelated `max_tokens: 600` call exists in the same file and is excluded.

Two source locations were checked, and the check is recorded as source-based:

- `tutor-system/src/services/ecologicalTutorCall.ts` — the shared v3 builder. Frozen hash `b5ef029891fe4849700ab592dfc68014b0788354cdb964e80428c2767a56fc6a` at promotion SHA `7f5e979`.
- `tutor-system/supabase/functions/assessment-api/index.ts` — the transfer call site. Frozen hash `5ee3a9ec99967634181e4eb66f9fdad4f8496c37930e1497db326b32183dcb7f`.

Resolved values: both effective budgets are `1200`, both thinking flags are `false`. `shared-request-contract.js` locates the call site by the `TRANSFER_V3_SYSTEM_PROMPT` marker, extracts the three settings, and asserts `1200` / `false` / `0.3`, while explicitly asserting the unrelated `600` literal is still present and excluded. `manifest.json` declares `product_effective_completion_token_budget` and `evaluation_effective_completion_token_budget` both `1200`, and `product_enable_thinking` / `evaluation_enable_thinking` both `false`. The gate treats any budget, thinking-flag, builder-hash, or prompt-hash mismatch as a pre-scoring `incomplete` with **zero** metric rows, so a drifted configuration can never reach scoring.

Resolved separation from the legacy path: `evals/promptfoo/v1/settings.json` keeps `target_max_tokens: 8000` and `target_enable_thinking: true` unchanged, because the legacy v1 path evaluates a different production call. `manifest-schema.json` records that path as `inherited_by_transfer: false`; the transfer path declares its own values and never inherits the legacy ones. A test asserts the two are different.

The documented alternative is a component-102-owned exported budget constant; 102-owned files were not edited.

## 3. Environment facts measured in this worktree

- `tutor-system/node_modules` was **absent**; it is now installed with `npm install` (exit 0, 2130 packages) because the historical `harness.test.js` cannot load `runner.js` without `tutor-system/node_modules/dotenv`. Before that install, `harness.test.js` failed with `Cannot find module .../tutor-system/node_modules/dotenv` — an environment failure, not a behaviour failure.
- `tutor-system/.env` was **absent** and has been copied from the integration worktree with `cp ../integration/tutor-system/.env tutor-system/.env`. It is gitignored and is not committed. Measured without printing values: `REACT_APP_OAI_API_KEY` present with length 35 and not a placeholder, `REACT_APP_OAI_BASE_URL` present with host `dashscope-intl.aliyuncs.com`.
- `typescript@5` was installed at the worktree root with `npm install --no-save` so the repository's established `require.extensions['.ts']` hook resolves. Verified that `package.json` and `package-lock.json` are unmodified by that install.

## 4. Blocking unrun stages

**Status: RUNNABLE-BUT-UNRUN.** The live stages are not impossible — the configuration is present — but they have not been executed, and no result from them is claimed anywhere in this component.

| Stage | Exact command | Prerequisites now met | Why unrun |
| --- | --- | --- | --- |
| Semantic judge calibration | `rtk proxy node evals/promptfoo/v1/calibrate.js <new-evidence-directory>` | `.env` copied; `node_modules` installed | Not yet executed in this worktree. `transfer/calibrate.js` reports `verdict: unrun` and `blocked_reason: MISSING_LIVE_CONFIGURATION` when called without a judge, and lists `judge model`, `judge endpoint`, `provider credentials`, and `judge token limit` as the required configuration. |
| Unchanged baseline run | `rtk proxy node evals/promptfoo/v1/runner.js --cases evals/promptfoo/v1/transfer/cases.json --variant baseline --contract_version v3 --manifest evals/promptfoo/v1/transfer/manifest.json --out evals/promptfoo/results/<model>/<run-id>-baseline` | `.env` copied; `node_modules` installed | Not yet executed. |
| Candidate run | the same command with `--variant candidate` and a `-candidate` output directory | as above | Not yet executed, and therefore no candidate freeze exists. |
| Sealed holdout runs | baseline and candidate against `evals/promptfoo/holdouts/transfer-sealed/` | requires a frozen candidate first | Blocked by the candidate freeze, which is this component's own rule. |
| Gate over live evidence | `rtk proxy node evals/promptfoo/v1/gate.js <candidate-dir> <baseline-dir>` | requires the runs above | Not executed. |

Consequences that must not be reported as passes:

- Semantic rubric calibration is **uncalibrated**, so `transfer_trigger_target`, `medium_transfer_quality`, `assessment_item_validity`, and `verification_evidence` have no live judge evidence. The gate would return `incomplete` for those metrics on a live run that has no judge results.
- No live baseline, candidate, or holdout verdict exists. `evals/promptfoo/results/` contains no transfer run.
- The sealed holdout package is empty, which is correct before candidate freeze.

## 5. Ceremony status (fast-multi-agent-tdd)

The repository mandates the TDD skill for executable work. What actually happened, stated plainly:

- **Request map and Red scope**: saved as `audits/transfer_eval_request_map.md` and `audits/transfer_eval_red_scope.json`, committed at `c56b472`. The map records the requirement re-check, the definition of done, the behavior-controlling properties with their shortcuts and owning tests, the path classifications with semantic overrides, the excluded controls with quoted sources, and the phase plan.
- **Dedicated monitor delegation**: performed twice through the DSH `subagent` tool, in an independent context, with file edits forbidden. Both returned a substantive review rather than a rubber stamp: run 1 returned `PRE-RED GATE: FAIL` with eight defects (an unsupported `*.test.js` glob in `editable`, `fixtures/**` classifying as production, invented `transfer/data/` paths, a wrong module name, citations that did not resolve in-repo, unmapped constraining clauses, an unsupported term, and an imprecise definition of done); run 2 returned `PRE-RED GATE: FAIL` with five further defects (`spec.md:149` should be `:147`, three rubric filenames diverging from `tasks.md`, three missing Green paths, an unmapped `case-schema.json`, and an inconsistent owning-test claim). All were corrected.
- **Monitor identity shape**: the delegation mechanism exposes one durable identifier and no separate agent identifier, and it is session-shaped (`session-<uuid>`). `audits/transfer_eval_role_receipt.json` records that identifier verbatim, because the skill requires the returned identity verbatim and inventing a bare-UUID identifier would be fabrication. A future reader should not mistake the shape for a defect or try to normalise it.
- **Red**: all fourteen test files and the deterministic fixtures were written first and run to observe genuine failure. The observed Red state was 12 distinct `Cannot find module './<module>'` errors (the missing production modules) plus `ENOENT` on the not-yet-written `manifest.json`. Observed count at that commit (`870cda7`): tests 65, pass 55, fail 10, with the remaining files failing at load time on the missing modules. Red evidence is preserved at commit `870cda7`.
- **Green**: implemented in units, each committed after its tests passed: `a32a686`, `3e7fb19`, `9072f8d`, `9b1585d`, `2839a4e`, `296b7a8`, `cb53ba3`, `319440e`, `656640c`, and the denominator fix in this phase.
- **Regression**: exit 0, tests 147, pass 147, fail 0 (command 4 above).
- **Compact no-op Refactor and Test Refactor artifacts**: recorded separately as `audits/transfer_eval_refactor_noop.md` and `audits/transfer_eval_test_refactor_noop.md`.
- **Not performed**: the immutable `pre_red` and `pre_green` Git-ref snapshots and the three-reviewer Red debate. The `pre_red` snapshot was not published before the Red edits, the worktree moved ahead while the monitor review was being corrected, and the gate order is inherently sequential — so a `pre_red` capture at this point would attest the post-implementation tree rather than the approved pre-Red proposal, and a Red debate over already-implemented tests would attest content the reviewers did not see at Red time. Publishing either would be a false provenance claim, which is worse than recording the omission. The guards' substantive protection was instead obtained from the monitor delegation and its two review rounds, and the review findings were all corrected.

## 6. Feature flag and claim boundaries

- The transfer feature flag `TRANSFER_ASSESSMENT_ENABLED` is asserted **disabled by default** in `runner-config.js` and covered by `runner-config.test.js`; it remains disabled. Nothing in this component enables it.
- This record and the produced report make **no database, authentication, authorization, provider-path, browser, UI, activation, rollback, or release claim**. `report.js` labels every verdict as Promptfoo transfer evaluation evidence only, names all six separate gates, and records `claims_release_acceptance: false`; `release-boundary.test.js` fails a report that removes a boundary or asserts a release claim.
- No migration, production prompt, Edge Function, or `ecologicalTutorCall.ts` change was made by this component.
