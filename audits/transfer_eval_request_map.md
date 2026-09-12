# Request Map: transfer_eval (component 104-transfer-evaluation)

Claim under later audit: `The requirement re-check defines the user-visible outcome and complete definition of done; the request map imports it, selects the smallest vertical executable slice, and defines a phase-safe TDD path.`

Route: `compact`. Risk tier: `low`.
Feature label: `transfer_eval`.

## 1. Requirement re-check

User-visible outcome (one sentence): a release reviewer can run one offline command set that validates the frozen transfer case/manifest/rubric contract, exercises the deterministic T09 contract, lifecycle, and pair checks, evaluates the blocking transfer quality gate on complete immutable evidence, and refuses to accept anything that is missing, errored, zero-coverage, regressed, or pair-incomplete.

### Requirement to feature table

| Requirement | User-visible feature | Must-exist artifact | Acceptance evidence | Work type | TDD? |
|---|---|---|---|---|---|
| FR-001, FR-002 | Versioned transfer case contract with target/evaluator isolation | `evals/promptfoo/v1/transfer/case-schema.js`, `evals/promptfoo/v1/transfer/cases.json` | `case-schema.test.js` | executable | yes |
| FR-003, FR-004 | Five public rubric IDs plus one deterministic check, with per-rubric declarations | `evals/promptfoo/v1/transfer/metric-registry.json`, the four `evals/promptfoo/rubrics/v1/transfer_*.md` files, `evals/promptfoo/rubrics/v1/assessment_followup.md`, `evals/promptfoo/rubrics/v1/manifest.json` | `manifest.test.js`, `coverage.test.js` | executable + guidance | yes (declaration and validation only) |
| FR-005 | `t09_contract_and_progress` deterministic supporting check | `evals/promptfoo/v1/transfer/contract-checks.js` plus `evals/promptfoo/v1/transfer/fixtures/contract-fixtures.json` | `contract-checks.test.js` | executable | yes |
| FR-006, FR-007 | Required case roles, named coverage gaps, and T09.1-T09.6 lifecycle coverage | `evals/promptfoo/v1/transfer/cases.json`, `evals/promptfoo/v1/transfer/followup-checks.js` | `coverage.test.js`, `followup.test.js` | executable + data | yes |
| FR-008, FR-009, FR-010, FR-022 | Frozen manifest, partitions, comparability, shared-contract snapshot | `evals/promptfoo/v1/transfer/manifest-schema.js`, `evals/promptfoo/v1/transfer/comparison.js`, `evals/promptfoo/v1/transfer/manifest.json` | `manifest.test.js`, `comparison.test.js` | executable | yes |
| FR-011, FR-012 | Immutable manifest and per-case evidence records | `evals/promptfoo/v1/transfer/evidence-record.js` | `evidence-record.test.js` | executable | yes |
| FR-013, FR-014, FR-015 | Blocking gate with exact denominators and regression diagnostics | `evals/promptfoo/v1/transfer/quality-gate.js`, `evals/promptfoo/v1/transfer/gate-policy.json` | `quality-gate.test.js` | executable | yes |
| FR-016 | Non-substitution report boundary | `evals/promptfoo/v1/transfer/report.js` | `release-boundary.test.js` | executable | yes |
| FR-017, FR-019, FR-020, FR-021 | Thin adapter over the component-102 v3 builder, source-based budget parity | `evals/promptfoo/v1/transfer/adapter.js`, `evals/promptfoo/v1/transfer/shared-request-contract.js`, `evals/promptfoo/v1/transfer/runner-config.js` | `shared-request-contract.test.js`, `adapter.test.js`, `runner-config.test.js` | executable | yes |
| FR-018 | Preserved original-plan SHA-256 | `specs/104-transfer-evaluation/research.md` record plus hash assertion | `shared-request-contract.test.js` | guidance + executable | yes |
| SC-004, US3 offline | Calibration contract and baseline/candidate comparability, deterministic-only offline mode | `evals/promptfoo/v1/transfer/calibrate.js`, `evals/promptfoo/v1/transfer/comparison.js` | `calibration.test.js`, `comparison.test.js` | executable | yes |
| Phase 5 live stages | Recorded with exact commands, prerequisites, and observed verdict; never reported as a pass unless observed | `specs/104-transfer-evaluation/verification-record.md` | record lists commands, prerequisites, exit codes, and verdict | result | no (execution, outside TDD phases) |
| Phase 1 setup | Ownership map and integration-edge record | `specs/104-transfer-evaluation/integration-edge.md` | file exists and names 102/104/101/105 ownership | guidance | no |

Rubric filename note: `tasks.md` T015 names four semantic rubric files. They are `evals/promptfoo/rubrics/v1/transfer_trigger_target.md`, `transfer_medium_transfer_quality.md`, `transfer_assessment_item_validity.md`, and `transfer_verification_evidence.md`, plus the deterministic `evals/promptfoo/rubrics/v1/assessment_followup.md`.

Definition of done: these exact offline commands run from the worktree root and pass -

1. `rtk proxy node --test evals/promptfoo/v1/transfer/*.test.js evals/promptfoo/v1/harness.test.js`
2. `rtk proxy node evals/promptfoo/v1/transfer/validate-manifest.js specs/104-transfer-evaluation/contracts/transfer-case-schema.md`
3. `rtk proxy node evals/promptfoo/v1/transfer/gate-fixtures.js`

plus: the gate returns `accepted` only for complete passing synthetic evidence and returns `incomplete`/`failed` for every blocking fixture in `contracts/quality-gate.md`; every new test file opens with the AGENTS.md file-purpose comment; every new executable opens with a shebang and purpose comment; the frozen contracts, rubrics, cases, manifest, evidence writer, and report are committed on `104-transfer-evaluation`; and the live Phase 5 stages are recorded with their exact commands, prerequisites, and observed outcome.

### Exclusions (each with source evidence)

1. Live model, judge, baseline, candidate, and holdout execution is outside the TDD phases. Source: `spec.md:148` - "Live model evaluation, judge calibration against real outputs, independent holdout execution, and release acceptance are later execution stages; planning artifacts may record them as pending but may not claim them as passed." Also `quickstart.md:41` - "missing configuration is a blocking unrun stage, not a fallback."
2. Production prompt, provider path, migrations, database, auth, UI, browser, and release acceptance are outside this feature. Source: `spec.md:12` - "This component does not implement production prompts, the provider path, database/auth behavior, React UI, or the release browser suite."
3. Legacy evaluator, runner, and gate meanings must not change. Source: `tasks.md:68` (T023) - "without replacing legacy checks or generating a second target response"; `tasks.md:106` (T037) - "preserving legacy metrics".
4. Judge sampling options are not re-derived in the offline path. Source: `spec.md:149` - "no API key, base URL, judge model, or provider parameter is invented when it is absent from the checked-in examples."
5. Holdout execution waits for candidate freeze. Source: `quickstart.md:45` - "After the candidate is frozen, an independent author/agent runs the same baseline and candidate variants against an eligible sealed holdout directory."

## 2. Smallest vertical executable slice

The smallest usable increment is the offline contract-and-gate path: frozen case/manifest/rubric artifacts plus the validators, deterministic checks, adapter parity, gate, and evidence writer named by the quickstart deterministic commands. It is usable on its own by a release reviewer and needs no provider configuration. Semantic judge execution stays outside this slice.

## 3. Highest-risk execution boundary and the minimal path that crosses it

Highest-risk boundary: the component-102-owned TypeScript v3 request/context builder at `tutor-system/src/services/ecologicalTutorCall.ts`, consumed across the repository's TypeScript/JavaScript boundary, plus the literal production token budget at the transfer call site in `tutor-system/supabase/functions/assessment-api/index.ts`.

Minimal execution path that crosses it: `shared-request-contract.test.js` installs the repository's established `require.extensions['.ts']` hook (same three compiler options as `evals/promptfoo/v1/prepare.js`) resolving `typescript` from the worktree root, requires the real `ecologicalTutorCall.ts` from disk, projects one frozen transfer case through `adapter.js`, and asserts byte-equality between the resulting request and a second construction from an equivalent `TransferTutorRequestContextInputV3` whose arrays are permuted and duplicated. It also reads the Edge Function source from disk and asserts the transfer-path `max_tokens: 1200` literal.

Observable evidence that the boundary was crossed: the required module returns the real exports (`buildTransferTutorRequestContextV3`, `buildTransferTutorRequestV3`, `buildTransferTutorUserMessageV3`), the SHA-256 of the real file bytes equals the frozen hash `b5ef029891fe4849700ab592dfc68014b0788354cdb964e80428c2767a56fc6a`, and permuting and duplicating input arrays still yields the identical serialized request because the real builder applies `sortedUnique` (`ecologicalTutorCall.ts:90-92,147`), option-order sorting (`:117`), and checklist-id sorting (`:146`). A local reimplementation would not reproduce those canonicalisations or the real file hash.

Budget parity is source-based (recorded as R13): the effective 1,200-token budget is the literal `max_tokens: 1200` at the transfer call site in the Edge Function, not a shared export. Parity is asserted against the production source at the promotion SHA. The documented alternative is a 102-owned exported constant; 102-owned files are not edited here.

## 4. Behavior-controlling properties, shortcut, and asserted effect

| # | Property (constraining clause) | Shortcut that must fail | Asserted effect and owning test |
|---|---|---|---|
| P1 | Case identity and version unique in manifest (FR-001) | Accept duplicate `case_id`/`case_version` | `case-schema.test.js`: duplicate returns an error naming the case |
| P2 | Evaluator labels never inside target input (FR-002) | Scan only for the literal key `expected` | `case-schema.test.js`: injected `rubric_annotations`, `pair`, and `holdout` keys are each rejected |
| P3 | Exactly five public rubric IDs, four semantic and one deterministic (FR-003) | Register a sixth ID or a wrong method | `manifest.test.js`: mismatch reported with the offending ID |
| P4 | `assessment_followup` is deterministic and excluded from judge calibration (FR-003, SC-004) | Include it in semantic calibration | `calibration.test.js`: `transfer/calibrate.js` refuses it and names it lifecycle-covered |
| P5 | Semantic pair has exactly two members and one changed factor (FR-006, data-model) | Accept a one-member pair | `pair-transition.test.js`: blocks with member count and pair ID |
| P6 | Eligible holdout has no prompt or development exposure (FR-010) | Mark an exposed holdout eligible | `case-schema.test.js`: fails and names the exposure fields |
| P7 | Manifest pins builder hash, production prompt hash, both 1200 budgets, and parity (FR-022, SC-008) | Omit `shared_request_contract` or use 8000 | `manifest.test.js`: pre-scoring `incomplete` naming the missing or mismatched field path |
| P8 | No credentials or secrets in manifest or evidence (FR-011) | Write an `api_key` field | `evidence-record.test.js`: secret scanner blocks and names the path |
| P9 | Unit budget parity is read from production source, not a local literal (R13) | Copy `1200` into an evaluation constant | `shared-request-contract.test.js`: asserts the file path plus the extracted literal at the transfer call site |
| P10 | v3 reason-first serialization and known IDs (FR-005) | Accept `decision` before `reason` | `contract-checks.test.js`: fails with expected and actual key order |
| P11 | Four A-D options, key cardinality, selection-type consistency (FR-005) | Accept three options or two keys for `single` | `contract-checks.test.js`: fails with option and key counts |
| P12 | Assessment is a tutor turn, never a room mode (FR-005) | Put `assessment` in `room.active_response_mode` | `contract-checks.test.js`: fails on room-mode separation |
| P13 | Progress pair validity, no parallel mastery field (FR-005) | Emit `mastery` alongside the progress pair | `contract-checks.test.js`: fails naming the parallel field |
| P14 | Delivery precedes grading, and the first valid answer resolves once (FR-005, FR-007) | Grade before delivery, or resolve twice | `followup.test.js`: fails with the turn index |
| P15 | Clarification stays open, assistance cancels without failure (FR-007) | Treat assistance as a failure | `followup.test.js`: distinguishes `not_applicable` from `fail` |
| P16 | Feedback precedes a later assessment, no immediate chain (FR-007) | Deliver two assessments back to back | `followup.test.js`: fails with both turn indices |
| P17 | A wrong answer alone does not activate Guard (FR-007) | Map a wrong answer to `guard` | `followup.test.js`: fails on mode |
| P18 | Failed transfer is not immediately reused (FR-007) | Reuse the failed item in the same context | `followup.test.js`: fails with the item and context |
| P19 | Required row missing or errored stays in the denominator (FR-013, SC-003) | Drop the row from the denominator | `quality-gate.test.js`: `incomplete` with the expected denominator count |
| P20 | Zero-applicable partition is zero coverage, not 100 percent (FR-014) | Report 100 percent for an empty partition | `quality-gate.test.js`: `incomplete` naming the partition |
| P21 | Candidate below a comparable baseline fails even above threshold (FR-013, SC-005) | Accept 90 percent against a 100 percent baseline | `quality-gate.test.js`: `failed` plus the pass-to-fail case list |
| P22 | One failing pair member blocks despite an aggregate pass (FR-013) | Average the pair | `quality-gate.test.js`: `failed` naming pair and member |
| P23 | Exact threshold comes from the frozen policy, not current source (FR-014) | Read thresholds from a later working manifest | `quality-gate.test.js`: uses the frozen `gate-policy.json` value |
| P24 | Evidence records are write-once (FR-011) | Overwrite an existing run file | `evidence-record.test.js`: second write throws and original bytes are unchanged |
| P25 | Evidence preserves raw, parsed, displayed, expected, and actual (FR-012) | Store only a score | `evidence-record.test.js`: record-shape assertion fails on missing raw or judgment fields |
| P26 | Report keeps the non-substitution statement (FR-016, SC-007) | Claim database or browser acceptance | `release-boundary.test.js`: fails when a claim is removed and names all six boundaries |
| P27 | Legacy harness meaning is unchanged by registration (T023, T037) | Replace legacy checks | `adapter.test.js`: legacy `assess` and `checkedResult` outputs are byte-equal with and without transfer registration |
| P28 | Feature flag stays disabled (spec Edge Cases) | Default the flag to enabled | `runner-config.test.js`: default is asserted `false` and the live path throws `MISSING_LIVE_CONFIGURATION` |
| P29 | Every rubric declares method, checked consumer, requirements, applicability, pass rule, threshold, calibration status, and error handling (FR-004) | Register a rubric with only an ID and a title | `manifest.test.js`: fails naming the missing declaration field |
| P30 | Every required case role is covered or recorded as a named coverage gap (FR-006) | Silently drop the assistance role | `coverage.test.js`: fails with the missing role name, while an explicit gap entry passes |
| P31 | The adapter cannot read evaluator-only metadata or build prompt text (FR-021) | Read `case.evaluator` inside the projection | `adapter.test.js`: projection throws naming the evaluator key |
| P32 | Non-substitution report names all six separate gates (SC-007) | Emit a report without the boundary list | `release-boundary.test.js`: fails and lists the six boundaries |
| P33 | Manifest and gate are incomplete on a shared-builder, prompt-hash, or parity failure (FR-022) | Score first and compare hashes later | `quality-gate.test.js`: `incomplete` before any metric row |
| P34 | Calibration records raw judge request and response plus adjudication, and unresolved errors stay visible (SC-004) | Drop a judge error from the calibration record | `calibration.test.js`: error status preserved and never counted as agreement |

## 5. Path classification preflight

Red paths (test-like): the fourteen exact test files `evals/promptfoo/v1/transfer/case-schema.test.js`, `manifest.test.js`, `shared-request-contract.test.js`, `coverage.test.js`, `adapter.test.js`, `contract-checks.test.js`, `followup.test.js`, `pair-transition.test.js`, `calibration.test.js`, `comparison.test.js`, `quality-gate.test.js`, `evidence-record.test.js`, `release-boundary.test.js`, and `runner-config.test.js`, plus `evals/promptfoo/v1/transfer/fixtures/contract-fixtures.json` (overridden to `test`, because the guard's lexical classifier has no `/fixtures/` marker).

Green paths (production-like): `evals/promptfoo/v1/transfer/*.js` (non-test), `evals/promptfoo/v1/transfer/cases.json`, `evals/promptfoo/v1/transfer/manifest.json`, `evals/promptfoo/rubrics/v1/transfer_*.md`, `evals/promptfoo/rubrics/v1/assessment_followup.md`, `evals/promptfoo/rubrics/v1/manifest.json`, `evals/promptfoo/v1/evaluator.js`, `evals/promptfoo/v1/gate.js`, and `evals/promptfoo/v1/runner.js`.

Docs paths: `specs/104-transfer-evaluation/**`.

No lexical collision remains: no runtime file sits under a test-like path, and no test file sits under a production path.

### Semantic overrides (required, with reason)

- `evals/promptfoo/rubrics/v1/transfer_trigger_target.md`, `transfer_medium_transfer_quality.md`, `transfer_assessment_item_validity.md`, `transfer_verification_evidence.md`, and `assessment_followup.md` map to `prod`: the default `.md` doc heuristic is wrong for rubric instruction files loaded as runtime inputs by `rubrics/v1/manifest.json` `checks[].file`, and `spec.md` FR-003 and FR-004 make them metric contracts rather than documentation.
- `evals/promptfoo/v1/transfer/fixtures/**` maps to `test`: Red fixture data for the deterministic checks, and the guard has no `/fixtures/` marker.

## 6. Control inventory for the active requirement

| Control | Non-neutral value used | Asserted effect and owning test |
|---|---|---|
| `contract_version` selection in `runner.js` | `v3` through the registered extension registry | `adapter.test.js`: unknown extensions still throw the legacy error, and `v3` resolves through the registered adapter |
| Target-visible versus evaluator projection in `adapter.js` | a case carrying evaluator labels | `adapter.test.js`: projection excludes every evaluator key and throws on a read attempt |
| Normalized option order in the builder | duplicated and unsorted `options` plus `relevant_evidence_message_ids` | `shared-request-contract.test.js`: byte-equal output against the ordered construction |
| Repetition count in the gate | 2 repetitions | `quality-gate.test.js`: the denominator counts both repetitions and one missing repetition blocks |
| Applicability flag | predeclared conditional `not_applicable` | `quality-gate.test.js`: the metric leaves the denominator only with a declared rule and null pass and score |
| Frozen policy thresholds | policy value 0.8 against a working-manifest value 1.0 | `quality-gate.test.js`: the gate uses the frozen value |
| Baseline comparison join | same case and version with one pass-to-fail | `quality-gate.test.js`: regression reported although the candidate still exceeds 0.8 |
| Run immutability | an existing run directory | `evidence-record.test.js`: second write throws and original bytes are unchanged |
| Feature flag default | absent configuration | `runner-config.test.js`: default `false`, and the live path throws `MISSING_LIVE_CONFIGURATION` |

### Excluded controls (each with quoted source)

- Provider endpoint and secret resolution: `spec.md:114` (FR-021) - "The evaluation adapter MUST remain a thin projection from target-visible case fields into the shared v3 builder and MUST NOT read evaluator-only metadata or duplicate provider endpoint, credential, secret lookup, transport, or production prompt handling."
- Judge-model sampling options in the offline path: `spec.md:149` - "no API key, base URL, judge model, or provider parameter is invented when it is absent from the checked-in examples."
- Holdout execution before candidate freeze: `quickstart.md:45` - "After the candidate is frozen, an independent author/agent runs the same baseline and candidate variants against an eligible sealed holdout directory."

## 7. Test level, seams, and first Red

Level: unit plus one mandatory integration boundary, namely the cross-boundary TypeScript builder consumption and real-file hashing in section 3. Judge calls are injected fakes and no network is used in Red or in the offline suite.

First Red test and its targeted command: `rtk proxy node --test evals/promptfoo/v1/transfer/case-schema.test.js`, asserting P1, P2, P6, and P29 against `evals/promptfoo/v1/transfer/case-schema.js`, which does not exist at Red time, so the failure is a missing production module rather than a syntax or setup error. The remaining test files are created in the same Red phase and each is run so its missing-behaviour failure is recorded.

## 8. Phase plan

- Red: the fourteen exact test files in section 5 plus `fixtures/contract-fixtures.json`.
- Green: all non-test `transfer/*.js`, `transfer/cases.json`, `transfer/manifest.json`, the five rubrics, `rubrics/v1/manifest.json`, and additive registration in `evaluator.js`, `gate.js`, and `runner.js`.
- Regression: `rtk proxy node --test evals/promptfoo/v1/transfer/*.test.js evals/promptfoo/v1/harness.test.js evals/promptfoo/v1/analyze.test.js evals/promptfoo/rubrics/v1/decision-metrics.test.js`.
- Compact no-op Refactor and Test Refactor artifacts, then the Docs phase for `specs/104-transfer-evaluation/**`.
- After the offline suite is green and committed: the authorized live execution stage (baseline, candidate, candidate freeze, then sealed holdouts) recorded in `verification-record.md`.
