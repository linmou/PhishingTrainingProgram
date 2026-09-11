# Implementation Plan: Transfer Assessment Browser Release and Rollback Evidence

**Branch**: `105-transfer-release` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)
**Source baseline**: `plan/transfer_assessment_implementation_plan.md` SHA-256 `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`

## Summary

Complete W11 and original sections 19-20 as a release-evidence package for transfer assessment. The implementation will add one dedicated browser/release runner and a non-secret configuration example under `tutor-system/scripts/`, store immutable run artifacts under `evals/transfer-assessment/release/<run-id>/`, and publish one evidence contract and final verdict that distinguish product, privacy, attack, upstream AI, activation, and rollback gates.

The runner will consume the already-owned backend, room UI, and evaluation contracts from components 102-104. It will execute the required learner/teacher scenarios against an isolated migrated environment, capture screenshots and console/network/storage/export evidence, exercise the named negative operations, preserve blocked and errored results, and never authorize transfer from a client-only state. This plan creates no production implementation, schema, test, prompt, rubric, or integration-worktree changes in the current component.

## Technical Context

**Language/Version**: Node.js JavaScript for the release runner, with existing TypeScript/React application artifacts consumed as black-box product behavior  
**Primary Dependencies**: Existing Playwright browser automation conventions, existing Supabase JavaScript client, existing `tutor-system` npm scripts, and repository JSON/Markdown evidence formats  
**Storage**: Isolated migrated Supabase environment for execution; immutable JSON, PNG, trace, console, network, storage, and export artifacts under `evals/transfer-assessment/release/<run-id>/`  
**Testing**: Dedicated browser run plus direct negative-request checks; upstream deterministic, database, authorization, and Promptfoo results are consumed as linked evidence and are not replaced  
**Target Platform**: Chromium-compatible browser against an isolated deployed or locally served tutor app with a configured non-production Supabase endpoint  
**Project Type**: Existing React web application with Supabase backend and repository release/evaluation scripts  
**Performance Goals**: A single release run completes the required scenario matrix without silently skipping cases; this package does not introduce a load or throughput target  
**Constraints**: Verified principals required; no secrets in artifacts; no Docker assumption; no hosted reset, incidental migration push, or seed operation; backend capability disabled until all gates pass; rollback is non-destructive  
**Scale/Scope**: One teacher, one learner, two teacher-tab contexts, one isolated room/checklist set, and the full required scenario and attack matrix per run; repeatable across fresh run IDs  

## Constitution Check

*GATE: pass before design and rechecked after design.*

| Principle or constraint | Assessment | Evidence in this plan |
|---|---|---|
| Preserve requirements and evidence | PASS | `spec.md` maps FR/SC to W11 and sections 19-20; every result remains visible and is linked to the initiative ledger. |
| Keep authority server-side | PASS | Browser identity values are test inputs only; attack cases require server rejection; private fields are inspected on learner surfaces; activation uses the backend flag. |
| Test first and verify the real boundary | PASS | The plan defines dedicated browser and direct-request evidence against an isolated migrated environment; no mock or seven-room result substitutes for it. |
| Use stable explicit contracts | PASS | `contracts/transfer-release-evidence.md` defines run, evidence, attack, verdict, capability, and rollback records with stable statuses. |
| Prefer the smallest coherent design | PASS | One runner, one non-secret config example, one attack matrix, and one evidence output layout reuse existing scripts and output conventions. |
| React/Supabase architecture | PASS | No architecture change is proposed; the release runner consumes the existing app and hosted boundary. |
| Docker unavailable | PASS | No Docker workflow is planned; hosted or approved isolated execution is named as a prerequisite. |
| Feature flag disabled until release | PASS | `TRANSFER_ASSESSMENT_ENABLED` remains disabled for any incomplete or non-passing gate. |
| Non-destructive rollback | PASS | Rollback only disables new generation/delivery and records before/after evidence. |
| Context update ownership | DEFERRED BY HANDOFF | Root `AGENTS.md` and `update-agent-context.sh` are integration-owned per request; this component records the deferral and does not modify them. |

## Research Summary

See [research.md](research.md) for source-backed decisions. No unresolved technical unknown remains that changes scope or validation strategy.

## Design

### Ownership and Path Layout

```text
specs/105-transfer-release/
├── spec.md
├── clarify.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── transfer-release-evidence.md
├── checklists/
│   └── requirements.md
└── tasks.md

tutor-system/
├── package.json                                  # planned release command registration
├── .gitignore                                    # planned ignore for local secret-bearing config
└── scripts/
    ├── transfer-assessment-release.js             # planned dedicated runner
    ├── transfer-assessment-release.config.example.json
    └── transfer-assessment-release-attack-matrix.json

evals/transfer-assessment/release/
├── README.md                                    # planned evidence handling guide
└── <run-id>/                                    # generated, immutable, not a shared status ledger
    ├── snapshot.json
    ├── run-record.json
    ├── scenario-*.json
    ├── privacy.json
    ├── attacks.json
    ├── activation.json
    ├── rollback.json
    ├── report.json
    ├── verdict.json
    ├── screenshots/
    ├── network/
    ├── console/
    ├── storage/
    └── exports/
```

**Structure Decision**: Keep the runner in the existing flat `tutor-system/scripts/` convention and isolate all generated release evidence under a new `evals/transfer-assessment/release/` root. A run directory is an immutable evidence bundle, not a second milestone ledger. The initiative `milestone_ledger.md` remains the only status authority; the final report links to it and records the component result.

### Runner Boundary

1. Load a non-secret configuration file and environment values documented by the existing `tutor-system/.env.example`; reject missing required values before creating a room or checklist.
2. Record commit, worktree state hash, application and Supabase origins, configuration hash, verified-principal source reference, feature-flag state, and linked upstream AI run IDs. Never write tokens or credentials.
3. Create a fresh run directory with exclusive file creation. Preserve every scenario result, including `blocked`, `missing`, `error`, and `fail`.
4. Drive the teacher and learner browser contexts through the W11 scenario matrix, capturing screenshots, console events, network requests, realtime payload observations, exports, and storage snapshots with redaction checks.
5. Execute the attack matrix through the supported client/direct-request boundary, recording request context, expected denial, observed status, and protected-state before/after hashes. Do not target a linked production project.
6. Reconcile local scenario results with linked upstream gate evidence and produce a release verdict. Normalize a present upstream `pending` or `partial` source status to a `blocked` release row, use `missing` when required upstream evidence is absent, and retain the source status/reason as metadata. A Promptfoo or legacy seven-room pass cannot change a browser, privacy, attack, or activation result.
7. Record activation eligibility and rollback rehearsal as separate artifacts. The runner must not enable the backend flag as an incidental test action; activation is a separately authorized release operation.

### Invariants

- One run ID names all records and evidence for a single environment/configuration/commit snapshot.
- A missing or errored result is visible and blocks the final pass; it is never dropped from a denominator.
- Release gate rows use only `pass`, `fail`, `blocked`, `missing`, `error`, or `not_applicable`; upstream `pending` and `partial` values remain source metadata and never become release-row statuses.
- Learner-visible captures contain no answer key, transfer basis, raw model output, private rationale, credential, or unresolved private draft field.
- A rejected attack leaves protected state unchanged; a pass cannot be inferred from a client-side identity label.
- A stale, duplicate, retried, or reconnecting operation produces at most one valid delivery, resolution, and history effect according to the existing contract.
- Activation is eligible only when all release gates have immutable evidence and a passing verdict; rollback never deletes evidence or reinterprets legacy data.
- Cross-component edge tests and `coverage_manifest.json` are referenced as integration-owned dependencies, not implemented by this component.

## Verification Order

1. Validate configuration and the isolated non-production target without changing hosted state.
2. Run the deterministic upstream and evaluation evidence checks supplied by components 102-104; record their immutable IDs and statuses.
3. Run the dedicated browser product-flow matrix and persist per-scenario evidence.
4. Run privacy inspection and the negative attack matrix against the same environment.
5. Reconcile release verdict and feature-flag eligibility; keep the flag disabled on any non-pass.
6. Rehearse non-destructive rollback and compare protected-state/evidence hashes before and after.
7. Publish the final report, review the nearest documentation, and update the single initiative ledger through the integration owner.

Any future executable implementation in this task list must follow the repository's `fast-multi-agent-tdd` workflow, with the named contract/browser assertions written before the runner behavior they verify. This planning package does not invoke that implementation workflow because production and test code changes are explicitly out of scope for the current component turn.

## Documentation and Context Boundary

This component modifies only `specs/105-transfer-release/` in the planning commit. The future implementation must review and, if behavior or public release contracts change, update the nearest tutor/evaluation documentation and create `tutor-system/claude_docs/doc_update_record/documentation_update_record_v2026_09_11_transfer_release.md` with the date and implementation commit. Root `AGENTS.md` context refresh is explicitly deferred to the integration owner; `.specify/scripts/bash/update-agent-context.sh` is not run here.

## Complexity Tracking

No constitution violations require justification. The separate evidence root and single runner are required to preserve the existing distinction between legacy browser regression, AI evaluation, browser acceptance, privacy/authorization, and activation/rollback gates; adding them to the old seven-room output would make evidence non-reproducible and ambiguous.
