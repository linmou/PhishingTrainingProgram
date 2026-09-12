# Research: W2 Deterministic Transfer Behavior and Golden Fixtures

**Intent**: Record the evidence-backed design decisions needed to plan W2 without introducing new product behavior.
**Date**: 2026-09-11

## Decision 1: Keep W2 in the existing TypeScript/Jest service boundary

**Decision**: Use the existing `tutor-system` TypeScript 4.9/CRA/Jest conventions and colocated service tests.

**Rationale**: The repository already contains `assessment.ts`, `learningProgress.ts`, the parser, grader, renderer, validator, reducer, v3 contract parser, transfer service, and focused Jest suites. The normative runtime work package calls for pure functions and §14 deterministic suites in this boundary.

**Alternatives considered**:

- Add a separate package or test runner: rejected because it would create a second contract/test boundary without a requirement.
- Move the behavior into React or provider code: rejected because the traceability graph assigns reducer, parser, grader, and deterministic rendering to this component and forbids duplicate progression authority.

## Decision 2: Treat the existing behavior contract and decomposed plan as normative

**Decision**: Use T09.1-T09.6, D01-D07, D11-D15, the response contract, and the source SHA `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2` as the planning baseline.

**Rationale**: The source package already resolves target selection, assessment lifecycle, exact grading, feedback sequencing, privacy, legacy handling, and release boundaries. W2 must make those decisions executable and inspectable rather than reinterpret them.

**Alternatives considered**:

- Add a new mastery state or answer-quality score: rejected by U04/U05 and the constitution's single-authority rule.
- Treat a successful legacy status as transfer verification: rejected by U05/U10 and the explicit legacy boundary.

## Decision 3: Expose pure public contracts to the component 102 projection owner

**Decision**: Validate private `TutorDecisionV3` assessment fields and define pure public assessment/lifecycle-result contracts containing only the assessment ID, stem, selection instruction/rendered text, A-D options, and deterministic outcome fields. Component 102 owns the API/private-to-public projection implementation and tests.

**Rationale**: The response contract and T09.3 require the answer key, transfer basis, rationale, and raw model output to remain private. Component 101 owns the pure types and domain outputs that make the boundary explicit; the declared component 102 owner must integrate and verify those contracts in `TransferAssessmentService` without 101 becoming a second facade writer.

**Alternatives considered**:

- Reuse the full private object in the 101 public result: rejected because copied payloads could leak keys or basis and would blur the domain/transport boundary.
- Use a second public mastery field: rejected by the existing progress-pair contract.

## Decision 4: Use fixture-driven deterministic coverage, not live model output

**Decision**: Store versioned golden fixtures for valid/invalid contracts, parser results, grader outcomes, render validation, reducer matrix cells, and named orchestrator sequences.

**Rationale**: W2 must prove exact deterministic behavior independently of providers, credentials, databases, browser automation, and Promptfoo. A fixture manifest also gives downstream 102/104 a stable consumer contract and keeps unrun external gates visible.

**Alternatives considered**:

- Use only hand-written happy-path tests: rejected because the request explicitly requires boundaries, exhaustive subsets, stale/duplicate handling, and sequence coverage.
- Use live model cases as W2 evidence: rejected because semantic generation belongs to W9/W10 and cannot prove parser/grader/reducer determinism.

## Decision 5: Preserve the existing phase ownership boundary

**Decision**: Plan W2 as pure domain behavior plus a provider/database-independent orchestrator seam. Do not implement or edit the component 102 service/API projection, migrations, RLS, authorization, provider prompts/calls, React UI, Promptfoo, or browser release checks.

**Rationale**: The user explicitly excludes those areas and the initiative package assigns them to W3-W11. W2 can define input/output contracts and test doubles without claiming those downstream gates passed.

**Alternatives considered**:

- Add persistence behavior to the reducer/service now: rejected because it would duplicate server authority and make deterministic unit evidence misleading.
- Run hosted or live tests during planning: rejected because credentials/external execution authority are outside this request.

## Decision 6: Do not update root agent context from this worktree

**Decision**: Record the Spec Kit context-update step as deferred to the integration owner; do not run `update-agent-context.sh` or modify `AGENTS.md`.

**Rationale**: The user explicitly identifies root `AGENTS.md` and integration context as integration-owned. The normal plan skill step would cross that ownership boundary. No new technology is introduced by this planning package.

**Alternatives considered**:

- Run the context update anyway: rejected because it could modify an integration-owned file and violate the worktree boundary.
