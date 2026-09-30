# Implementation Plan: Two-Attempt Transfer Behavior Evaluation

**Branch**: `104-transfer-evaluation` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/104-transfer-evaluation/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Refactor revision (2026-09-29): extend existing evaluation cases with room-specific targets, genuine learner evidence, mandatory eligible assessment routing, blockers, and shared-tutor call counts. Keep existing quality and lifecycle checks and immutable prior runs.

Upgrade the existing transfer evaluation package for the server-authoritative two-attempt lifecycle and learner-safe explanation. Preserve the five existing public rubrics, add the semantic `learner_explanation_quality` metric, add deterministic disclosure evidence, and version the lifecycle fixtures so historical first-valid-resolution evidence cannot satisfy the new gate. The adapter remains a thin consumer of component 102's promoted v3 request builders and prompt identity; evaluator code consumes component 101 lifecycle outcomes and component 102 DTOs without copying grading, persistence, authorization, or prompt logic.

## Technical Context

**Language/Version**: Node.js/CommonJS JavaScript for the evaluation harness; the TypeScript shared v3 contract exported through `tutor-system/src/services/ecologicalTutorCall.ts` is consumed through the repository's existing build/runtime boundary and remains implemented by component 102.  
**Primary Dependencies**: Existing `promptfoo` package, repository v1 runner/evaluator/gate, `node:test`, promoted component 101/102 contracts, and the DashScope-compatible transport.  
**Storage**: Version-controlled JSON/YAML/Markdown contracts and fixtures; immutable run directories under `evals/promptfoo/results/<model>/<run-id>/`.  
**Testing**: `node --test` for evaluator/gate/fixture tests; existing tutor-system regression commands remain separate evidence.  
**Target Platform**: Repository-local Node.js execution and the existing Promptfoo/provider path when later authorized.  
**Project Type**: Evaluation harness and evidence package supporting a React/TypeScript tutor application.  
**Performance Goals**: Complete every declared case/check/repetition without dropping results; respect the frozen request concurrency, timeout, retry, token, and repetition settings recorded in the run manifest.  
**Constraints**: No credentials in artifacts; target and judge are both `qwen3.5-flash` through the existing DashScope-compatible provider per integration commit `df40f32`; missing/mismatched configuration blocks with no runtime fallback; no prompt/provider production edits; no duplicate lifecycle, request/context, token-budget, endpoint, or secret authority; no overwrite of immutable runs; no use of Promptfoo evidence as a database, authorization, UI, or browser gate.  
**Scale/Scope**: All cases and assertions declared by the frozen manifest across calibration, baseline, candidate, regression, and eligible holdout partitions. The manifest, not an invented case count, defines the denominator.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-Phase 0 result: PASS.

- Principle I: the plan requires stable requirement mappings, complete denominators, immutable manifests, and visible missing/error evidence.
- Principle II: attempt counts, learner identity, answer keys, explanations before terminal failure, private transfer basis, and provider authority remain server-owned by upstream components.
- Principle III: later executable changes must use the repository's TDD workflow; this turn creates planning artifacts only and defines deterministic, semantic, and integration evidence lanes separately.
- Principle IV: the case schema, six rubric IDs, lifecycle and disclosure checks, partitions, manifest, and gate are explicit versioned contracts; component 101 owns lifecycle semantics, component 102 owns persistence/request/prompt/DTO contracts, and component 104 owns evaluation consumption and evidence.
- Principle V: the design reuses the existing v1 runner/evaluator/gate and the shared `ecologicalTutorCall.ts` boundary, avoiding a second request builder, legacy score ledger, duplicate production prompt, or duplicate provider-secret path.

No constitution violation requires a complexity exception. The original-plan source hash is preserved as `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`.

## Project Structure

### Documentation (this feature)

```text
specs/104-transfer-evaluation/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
# Evaluation harness source and evidence paths
evals/promptfoo/
├── v1/
│   ├── transfer/               # future transfer cases, adapters, and gate registration
│   └── *.test.js               # existing and transfer quality-gate tests
├── rubrics/v1/                 # existing versioned rubric registry plus transfer rubrics
├── holdouts/                   # sealed holdout packages; transfer additions remain independent
└── results/<model>/<run-id>/   # immutable executed evidence, never a working latest result

tutor-system/
├── src/services/ecologicalTutorCall.ts # component-102-owned shared v3 request/context contract; consumed, not copied
├── scripts/                    # existing command entry points; production prompt ownership stays upstream
└── claude_docs/ai-behaviors/  # canonical behavior/contract/evaluation documents, read-only for this component

```

**Structure Decision**: Keep all new planning artifacts under this feature directory. Later implementation should extend the existing `evals/promptfoo/v1` typed evaluator and gate rather than create a second Promptfoo score system. Transfer-specific inputs, rubrics, manifest registration, holdouts, and gate tests remain isolated under `evals/promptfoo/v1/transfer` or the existing versioned rubric locations. Any transfer adapter there is only a target/evaluator projection and invocation shim: it must import/consume the component-102-owned v3 builder and contract identity from `ecologicalTutorCall.ts`, never construct messages, inject prompt text, select provider secrets, or redefine the 1,200-token setting. Root legacy `promptfooconfig.yaml`, historical cases, and historical result directories remain preserved. Production prompt files and browser/database gates are not modified by this component.

### Upgrade ownership and dependency gate

- Component 101 contract inputs: `PrivateAssessment.learner_safe_explanation`, `TransferAttemptSnapshot`, and the `TransferResolvedAssessment` discriminated union in `specs/101-transfer-domain/contracts/transfer-domain-determinism.md` and `transfer-assessment-draft.md`.
- Component 102 contract inputs: `TransferTutorRequestV3`, `TransferTutorRequestContextV3`, canonical builders in `ecologicalTutorCall.ts`; `PublicAssessmentDTO {id, student_id, selection_type, stem, options}` with no `rendered_text`; and `ProcessedMessageDTO` with canonical `processing_state`, `answer_outcome`, attempt fields, terminal state, transition, and terminal-only `terminal_failure_feedback` in `specs/102-transfer-backend/contracts/` at component commit `a8c8b31a91bcc1970071117ac0dbbd2dffce85ef` plus the reconciled `student_id` correction.
- Component 104 additions: versioned attempt-sequence fixtures, `learner_explanation_quality`, `learner_explanation_disclosure`, upgraded manifests/comparison/gate logic, and immutable per-step evidence.
- Implementation cannot begin until the integration branch promotes immutable 101 and 102 contract SHAs and reconciles canonical T09's former first-valid-resolution text. No evaluation-local fallback is permitted.

## Phase 0: Research Summary

Research decisions and source citations are recorded in [research.md](research.md). No unresolved technical unknown remains. The authorized target and judge configuration is `qwen3.5-flash` through the existing DashScope-compatible provider; runtime absence or mismatch is blocking.

## Phase 1: Design Summary

- [data-model.md](data-model.md) defines evaluator entities and denominator relationships.
- [contracts/transfer-case-schema.md](contracts/transfer-case-schema.md) defines the public case contract.
- [contracts/rubric-registry.md](contracts/rubric-registry.md) preserves the five existing rubric IDs, adds semantic `learner_explanation_quality`, and defines lifecycle/disclosure supporting checks.
- [contracts/run-manifest.md](contracts/run-manifest.md) defines immutable run snapshots and per-case evidence.
- [contracts/quality-gate.md](contracts/quality-gate.md) defines blocking thresholds, missing/error handling, pair gates, and non-substitution.
- The shared-request parity design freezes component 101/102 contract identities, the component-102 builder and prompt hashes, target settings, and normalized product/evaluation message equivalence before scoring.
- Attempt evidence joins authoritative before/after snapshots by assessment, request/message, accepted attempt, transition, repetition, and turn identity. Explanation evidence preserves generated/reviewed values and judges the reviewed terminal value.
- [quickstart.md](quickstart.md) records later deterministic verification and authorized run commands.

The required `.specify/scripts/bash/update-agent-context.sh codex` step is deferred to integration because root `AGENTS.md` is integration-owned and the component instruction prohibits modifying it or running the context updater. No new technology was introduced that requires an agent-context update.

Post-Phase 1 result: PASS for planning. The design preserves the constitution, approved lifecycle decision, one status/evidence authority, and separate product gates. Implementation remains dependency-gated on promoted 101/102 SHAs and canonical T09 reconciliation.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | The package reuses the existing versioned evaluator/gate and adds only transfer-scoped contracts and evidence. |
