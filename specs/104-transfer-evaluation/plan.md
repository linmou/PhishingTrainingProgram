# Implementation Plan: Frozen Transfer Behavior Evaluation

**Branch**: `104-transfer-evaluation` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/104-transfer-evaluation/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Define a frozen, source-grounded W9-W10 evaluation package for T09 transfer behavior. The package will extend the existing versioned Promptfoo runner/evaluator/gate pattern with transfer case data, five public rubric contracts (four semantic and one deterministic), deterministic supporting checks, calibration/baseline/candidate/holdout partitions, immutable manifests and raw per-case evidence, and a blocking quality gate. Its target adapter is a thin consumer of the component-102-owned v3 request/context builder in `tutor-system/src/services/ecologicalTutorCall.ts`, using the same backend-owned production prompt reference/hash and effective 1,200 completion-token budget as product. Component 102 implements that shared production contract and provider path; component 104 tests consumption and parity without copying prompt or secret handling.

## Technical Context

**Language/Version**: Node.js/CommonJS JavaScript for the evaluation harness; the TypeScript shared v3 contract exported through `tutor-system/src/services/ecologicalTutorCall.ts` is consumed through the repository's existing build/runtime boundary and remains implemented by component 102.  
**Primary Dependencies**: Existing `promptfoo` package, repository v1 runner/evaluator/gate, `node:test`, and the OpenAI-compatible transport already described by project configuration.  
**Storage**: Version-controlled JSON/YAML/Markdown contracts and fixtures; immutable run directories under `evals/promptfoo/results/<model>/<run-id>/`.  
**Testing**: `node --test` for evaluator/gate/fixture tests; existing tutor-system regression commands remain separate evidence.  
**Target Platform**: Repository-local Node.js execution and the existing Promptfoo/provider path when later authorized.  
**Project Type**: Evaluation harness and evidence package supporting a React/TypeScript tutor application.  
**Performance Goals**: Complete every declared case/check/repetition without dropping results; respect the frozen request concurrency, timeout, retry, token, and repetition settings recorded in the run manifest.  
**Constraints**: No credentials in artifacts; no silent fallback of missing configuration; no prompt/provider production edits in this component; no duplicate prompt, request/context, token-budget, endpoint, or secret authority; effective v3 completion budget fixed at 1,200 tokens in product and evaluation adapters; no overwrite of immutable runs; no use of Promptfoo evidence as a database, authorization, or browser gate.  
**Scale/Scope**: All cases and assertions declared by the frozen manifest across calibration, baseline, candidate, regression, and eligible holdout partitions. The manifest, not an invented case count, defines the denominator.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-Phase 0 result: PASS.

- Principle I: the plan requires stable requirement mappings, complete denominators, immutable manifests, and visible missing/error evidence.
- Principle II: learner identity, answer keys, private transfer basis, and provider authority are explicitly outside this component and remain server-owned by upstream/downstream owners.
- Principle III: later executable changes must use the repository's TDD workflow; this turn creates planning artifacts only and defines deterministic, semantic, and integration evidence lanes separately.
- Principle IV: the case schema, five rubric IDs, deterministic supporting check, partitions, manifest, and gate are explicit versioned contracts; component 102 exclusively owns the shared product request/context and prompt identity, while component 104 owns evaluation consumption and evidence.
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

## Phase 0: Research Summary

Research decisions and source citations are recorded in [research.md](research.md). No unresolved technical unknown remains for the planning package. Live provider/judge settings are an execution prerequisite, not a silent planning default.

## Phase 1: Design Summary

- [data-model.md](data-model.md) defines evaluator entities and denominator relationships.
- [contracts/transfer-case-schema.md](contracts/transfer-case-schema.md) defines the public case contract.
- [contracts/rubric-registry.md](contracts/rubric-registry.md) defines the five public rubric IDs (four semantic and one deterministic) and deterministic supporting check.
- [contracts/run-manifest.md](contracts/run-manifest.md) defines immutable run snapshots and per-case evidence.
- [contracts/quality-gate.md](contracts/quality-gate.md) defines blocking thresholds, missing/error handling, pair gates, and non-substitution.
- The shared-request parity design freezes the component-102 builder hash/version, backend prompt reference/hash, effective 1,200-token budget, and normalized product/evaluation message equivalence before scoring.
- [quickstart.md](quickstart.md) records later deterministic verification and authorized run commands.

The required `.specify/scripts/bash/update-agent-context.sh codex` step is deferred to integration because root `AGENTS.md` is integration-owned and the component instruction prohibits modifying it or running the context updater. No new technology was introduced that requires an agent-context update.

Post-Phase 1 result: PASS. The design preserves the constitution, canonical T09 rules, source hash, one status/evidence authority, and separate product gates.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | N/A | The package reuses the existing versioned evaluator/gate and adds only transfer-scoped contracts and evidence. |
