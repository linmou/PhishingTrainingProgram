# Research: Two-Attempt Transfer Behavior Evaluation

**Intent**: record the source-grounded decisions for the two-attempt and learner-safe explanation upgrade without copying product logic or inventing live settings.

## Decision 0: Consume promoted lifecycle and DTO contracts

**Decision**: Pin and consume component 101's `TransferAttemptSnapshot`/`TransferResolvedAssessment` and component 102's exact public/result contracts. `PublicAssessmentDTO` is `{id, student_id, selection_type, stem, options}` and excludes `rendered_text`. `ProcessedMessageDTO` uses canonical `processing_state`, `answer_outcome`, attempt/result fields, and terminal-only `terminal_failure_feedback`. Evaluation fixtures record observable before/after results; evaluator code does not re-grade answers, increment attempts, authorize users, or apply progress.

**Rationale**: Attempts are server-authoritative across reloads and tabs. Reconstructing their rules in the harness would create a second authority and could make a synthetic fixture pass while the real producer-consumer handoff fails.

**Promotion condition**: The integration branch must provide immutable 101 and 102 contract SHAs and reconcile the canonical T09 first-valid-resolution text before upgraded cases freeze.

## Decision 1: Extend the existing versioned evaluator boundary

**Decision**: Use `evals/promptfoo/v1/runner.js`, `evaluator.js`, `gate.js`, and their `node:test` suites as the evaluation execution boundary. Use the component-102-owned v3 request/context contract implemented through `tutor-system/src/services/ecologicalTutorCall.ts` as the single target-request construction boundary. Transfer code may add a thin projection/invocation shim, but not a second message builder.

**Rationale**: The existing v1 evaluator already preserves typed `pass`, `fail`, `not_applicable`, `missing`, and `error` results, complete generation denominators, judge evidence, pair/transition checks, and baseline comparison. A second legacy gate would create competing status authorities and could lose existing regression evidence.

**Alternatives considered**:

- A standalone legacy Promptfoo configuration was rejected because it would duplicate the typed evidence and gate behavior already required by the evaluation contract.
- Reusing only the root legacy `promptfooconfig.yaml` was rejected because its gate is not transfer-aware and has no T09 partitions, immutable manifest contract, or holdout lifecycle.
- Constructing transfer messages in `evals/promptfoo/v1/transfer/adapter.js` was rejected because it would allow product and evaluation context, prompt identity, and token budget to drift.

## Decision 1A: Share the v3 product contract and freeze parity evidence

**Decision**: Component 102 extends `ecologicalTutorCall.ts` with the versioned transfer v3 request/context export and owns the production prompt reference/hash, provider transport/secret path, and effective 1,200 completion-token setting. Component 104 consumes those exports, projects target-visible case data into them, and tests normalized product/evaluation message and budget equivalence. Evaluation never embeds production prompt text or resolves provider secrets.

**Rationale**: The original plan explicitly requires product and Promptfoo to share `ecologicalTutorCall.ts` and requires the 1,200-token v3 budget in both target adapters. Pinning builder and prompt hashes in each immutable manifest proves what was evaluated while retaining one production authority. Evaluator labels remain in the evaluation projection and are never accepted by the shared target builder.

**Blocking dependency**: Until component 102 exports the v3 builder, stable contract version/hash input, backend prompt reference/hash, and effective 1,200-token configuration needed by the adapter, component 104 may complete fixtures and gate tests but cannot claim a comparable target run. The gate records this as `incomplete`; it does not add a fallback builder.

## Decision 2: Use one shared case manifest for target generation and judging

**Decision**: Store complete target inputs and evaluator-only expected labels in one versioned transfer case manifest, with explicit applicability, partition, provenance, pair, transition, and holdout fields. The target adapter receives only the target-input projection.

**Rationale**: The evaluation contract requires both deterministic and semantic checks to inspect the same preserved generation. Separating cases by evaluator would make missing joins and changed inputs difficult to detect.

**Source evidence**: `tutor-behavior-evaluation-plan.md`, `ai-behavior-design-eval/references/evaluation-contract.md`, and the Promptfoo integration reference.

## Decision 3: Preserve existing rubrics and add focused explanation checks

**Decision**: Preserve `transfer_trigger_target`, `medium_transfer_quality`, `assessment_item_validity`, `assessment_followup`, and `verification_evidence`. Add `learner_explanation_quality` as one semantic metric and `learner_explanation_disclosure` as one deterministic supporting check. Expand `assessment_followup` to the two-attempt sequence and retain `t09_contract_and_progress` for structure/grading/progress contract evidence.

**Rationale**: Explanation correctness is semantic and must not be hidden inside item-validity or lifecycle scores. Disclosure timing and role-field presence are deterministic. Keeping these properties separate makes omission, incorrectness, and leakage independently visible.

**Alternatives considered**:

- A single composite transfer score was rejected because it would hide independent failures and violate metric ownership.
- Keyword matching for transfer meaning was rejected because the canonical behavior requires semantic pair and evidence-grounding judgments.
- Pattern matching for explanation safety/correctness was rejected because it cannot establish semantic correctness or privacy provenance. Explicit DTO allowlists and provenance cover disclosure; the calibrated judge covers meaning.

## Decision 3A: Evaluate the reviewed learner-facing explanation

**Decision**: Preserve generated and teacher-reviewed explanation values plus edit provenance. Semantic quality is evaluated on the reviewed value used by `terminal_failure_feedback`; generated-value quality may be reported diagnostically but cannot replace the consumer-facing check.

**Rationale**: The teacher can edit the explanation before delivery. Evaluating only the generated draft would not measure what the learner receives.

## Decision 4: Freeze partitions and comparison order before prompt edits

**Decision**: The manifest must declare calibration, development/regression, unchanged production baseline, contract-compatible baseline where required, candidate, and eligible independent holdout partitions. Calibration precedes baseline; the unchanged and contract-compatible baselines precede candidate comparison; holdouts run only after candidate freeze.

**Rationale**: This preserves comparable evidence and holdout independence. Exposed holdouts move to regression and require independent replacements.

**Settings boundary**: Integration commit `df40f32` records the human decision that target and judge both use `qwen3.5-flash` through the existing DashScope-compatible provider. The Edge Function reads `REACT_APP_OAI_API_KEY`, `REACT_APP_OAI_BASE_URL`, and `OAI_MODEL=qwen3.5-flash` from its Supabase secrets; the evaluation runner reads the same key and URL names from its own environment. The upgraded manifest records effective settings without credentials; missing or mismatched runtime configuration blocks with no fallback.

## Decision 5: Preserve raw evidence immutably and fail closed

**Decision**: Every run writes a new run directory with manifest snapshots/hashes, complete target inputs, raw/parsed/displayed outputs, per-check judgments, deterministic expected/actual values, statuses, settings, commands, revisions, timestamps, and errors. Missing/error/zero-coverage/regression/pair failures remain visible and block the gate.

**Rationale**: The constitution and evaluation contract require evidence preservation and prohibit representing a partial or errored result as passed. Existing `v1/gate.js` demonstrates the intended report shape and comparison behavior.

## Decision 6: Keep product and release evidence separate

**Decision**: Promptfoo acceptance is one evaluation gate only. Database/RLS, trusted principal/answer-key privacy, production provider path, browser downstream-consumption, activation, and rollback evidence remain separate gates owned by their respective components.

**Rationale**: This is required by the initiative verification gates and the canonical T09 plan. The transfer evaluation package can report integration requirements and blockers but cannot promote a Promptfoo pass into a release claim.

## Decision 7: Preserve the source baseline

**Decision**: Compare all planning decisions to the parent-level original handoff at `plan/transfer_assessment_implementation_plan.md`, SHA-256 `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`.

**Rationale**: The initiative plan names that hash as the intent-drift control. The exact path supplied in the task does not exist; the package's indexed parent-level path is the canonical source and hashes to the required value.

## Open execution prerequisites, not planning ambiguities

- Runtime target/judge configuration must match `qwen3.5-flash` and the existing DashScope-compatible provider recorded at integration commit `df40f32`; credentials remain external and missing configuration blocks execution.
- Independent holdout authorship and exposure status must be recorded when cases are created.
- Component 102 must provide the shared `ecologicalTutorCall.ts` v3 builder/identity, backend-owned production prompt reference/hash, effective 1,200-token setting, and a production/provider adapter that emits the frozen v3 response fields; missing exports are integration blockers, not reasons to weaken the manifest or create evaluation copies.
- Components 101 and 102 must provide promoted immutable lifecycle/DTO contract identities; historical first-valid fixtures remain regression history and do not prove the upgraded lifecycle.
- The downstream product gates must be run separately; this package cannot resolve their infrastructure or authorization prerequisites.
