# Implementation Plan: W2 Deterministic Transfer Behavior and Golden Fixtures

**Branch**: `101-transfer-domain` | **Date**: 2026-09-11 | **Spec**: [spec.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/specs/101-transfer-domain/spec.md)
**Input**: Component scope supplied by the integration owner and the normative transfer-assessment package.

## Summary

Complete the deterministic transfer domain boundary already partially present in `tutor-system`: stable v3/public contracts, exact answer parsing and grading, bounded rendering/validation, the transfer progress reducer, and a pure answer-resolution/orchestrator seam. Add versioned golden fixtures and focused tests for every requested boundary and lifecycle sequence. Keep server persistence, authorization, providers, React UI, Promptfoo, and browser release evidence downstream.

## Technical Context

**Language/Version**: TypeScript 4.9 with the repository's strict CRA compiler settings  
**Primary Dependencies**: React Scripts 5, Jest, existing Supabase client types only at the facade boundary  
**Storage**: None in W2; inputs are immutable turn/context snapshots and fixtures  
**Testing**: Jest through `react-scripts test`; `npx tsc --noEmit` for type validation  
**Target Platform**: Existing `tutor-system` web application service/type modules  
**Project Type**: React + TypeScript application with pure service modules  
**Performance Goals**: Deterministic helper execution should remain local and synchronous; no provider or database latency is in scope  
**Constraints**: Four fixed options; exact-set grading; two stem sentences; 80 word-like segments; no key/basis/rationale in public projection; no new progress field; no provider/database/UI dependencies in pure logic  
**Scale/Scope**: One assessment per focused learner/context; one first-valid resolution per question; 28 reducer matrix cells plus the named fixture sequences  

## Constitution Check

*GATE: Must pass before implementation planning and be re-checked after design.*

| Principle | Status | Evidence |
|---|---|---|
| Preserve requirements and evidence | PASS | The spec maps T09/D01-D15 behavior to explicit FR/SC items; source SHA and initiative package are retained in `research.md`. |
| Keep authority server-side | PASS | W2 only defines pure validation/projection/sequencing contracts; persistence, authorization, keys, and idempotency remain downstream. |
| Test first and verify the real boundary | PASS WITH IMPLEMENTATION CONDITION | Tasks put fixture/test work before production edits; implementation must use the repository-required `fast-multi-agent-tdd` workflow. W2 evidence is labeled deterministic and cannot substitute for hosted gates. |
| Use stable, explicit contracts | PASS | `TutorDecisionV3`, `TransferTurnContext`, public projection, stable parser outcomes, reducer pairs, and fixture IDs are explicit in `contracts/`. |
| Prefer the smallest coherent design | PASS | Existing modules and service tests are extended; no new package, mastery field, or compatibility layer is proposed. |
| Feature remains disabled until release gates | PASS | W2 does not enable `TRANSFER_ASSESSMENT_ENABLED`; downstream release gates remain required. |
| Root/integration ownership | PASS WITH DEFERRED ACTION | The normal agent-context update is deferred; this component will not modify root `AGENTS.md` or run `update-agent-context.sh`. |

No constitutional violation requires a complexity justification.

## Repository Evidence and Design

The current worktree already contains the narrowed assessment/progress types, parser, grader, renderer, validator, reducer, v3 parser, transfer facade, and initial focused tests. The current answer resolver only covers the undelivered branch, and the existing focused tests do not yet provide the complete 28-cell matrix, exhaustive subset coverage including empty/full cases, full sequence coverage, or a complete fixture manifest. W2 closes those evidence gaps without asserting that downstream persistence or authorization is complete.

Ownership remains:

- `assessment.ts` and `learningProgress.ts`: public type and valid-pair contracts.
- `tutorDecisionContract.ts` and `assessmentValidation.ts`: structured v3 validation.
- `assessmentAnswerParser.ts`: explicit selection syntax and clarification classification.
- `assessmentGrading.ts`: exact-set equality.
- `assessmentRendering.ts`: canonical learner rendering and limits.
- `learningProgressTransitions.ts`: the only pure progress transition authority.
- `transferAssessmentOrchestrator.ts`: pure delivery/answer/feedback/no-chain sequencing; no storage writes.
- `transferAssessmentService.ts`: transport facade that injects the API boundary and delegates deterministic lifecycle decisions to the orchestrator.
- Golden fixtures/tests: executable evidence for all above boundaries and named sequences.

## Implementation Phases

### Phase 0: Contract and fixture freeze

1. Read the component spec, data model, contracts, existing source, and normative T09 sections.
2. Define fixture record types and stable suite/scenario identifiers.
3. Add failing tests for public/private projection and v3 mode compatibility before changing implementation.
4. Preserve unknown downstream results as pending; do not fabricate database, provider, or browser evidence.

### Phase 1: Deterministic domain behavior

1. Complete the v3 and turn-context type/validation boundary, including public projection privacy.
2. Extend parser coverage for explicit labels, exact option text, Unicode/format boundaries, ambiguity, content questions, and malformed selections.
3. Extend exact-set grading to exhaustive subsets, duplicate/order normalization, single/multiple cardinality, and empty selection.
4. Extend rendering/validation for option order, instruction text, sentence and segment boundaries, and exact option count.
5. Complete the reducer matrix and stateful repair/contradiction/spontaneous-transfer sequences.

### Phase 2: Answer resolution and orchestrator sequencing

1. Add a pure lifecycle result model for undelivered, unresolved, passed, failed, assisted, duplicate, and stale inputs.
2. Implement first-valid resolution, optional-explanation precedence, feedback-first follow-up, repair gating, different-context selection, and no-chain suppression.
3. Keep Guard/protective priority as an input boundary; do not let a wrong answer alone enter Guard.
4. Replay all named golden sequences, including clarification, assistance, contradiction, spontaneous transfer, duplicates, stale state, and no repair.

### Phase 3: Verification and handoff

1. Run focused W2 tests, TypeScript checking, regression tests, and build.
2. Record exact counts, failures, and deferred downstream gates.
3. Review nearest behavior-contract documentation only for implementation changes; this planning package makes no production behavior change and does not update integration-owned docs or context.

## File Plan

### Existing production files to extend during implementation

- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/types/assessment.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/types/learningProgress.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/assessmentAnswerParser.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/assessmentGrading.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/assessmentRendering.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/assessmentValidation.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/learningProgressTransitions.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/tutorDecisionContract.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/transferAssessmentService.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/transferAssessmentOrchestrator.ts` (new pure module)

### Test and fixture files to add or extend during implementation

- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/__tests__/fixtures/transferAssessmentGoldenFixtures.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/__tests__/assessmentAnswerParser.test.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/__tests__/assessmentGrading.test.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/__tests__/assessmentRendering.test.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/__tests__/learningProgressTransitions.test.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/__tests__/tutorDecisionContract.transfer.test.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/__tests__/transferAssessmentService.test.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts`

### Documentation review during implementation

- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/claude_docs/ai-behaviors/tutor-response-contract.md`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/claude_docs/doc_update_record/documentation_update_record_v20260911_transfer_domain.md` (create only when the implemented public contract changes)

## Dependency and Boundary Notes

- The reducer/parser/grader/renderer/validator tests can be developed in parallel after the fixture shape is frozen because they have separate ownership boundaries.
- `transferAssessmentOrchestrator.ts` implementation depends on stable parser, grader, reducer, contract, and fixture outputs.
- W2 does not depend on a database or provider, but downstream 102 depends on these exact public/progression contracts.
- The service facade may call an injected API double in tests; no mock result may be described as proof of SQL/RLS or authorization.
- The `TransferAssessmentService.toPublicAssessment` projection is a privacy boundary and must be tested even if its transport is not.

## Post-Design Constitution Re-check

PASS. The design keeps one reducer authority, excludes private answer material from the public DTO, records exact evidence in fixtures, avoids a second state field, and leaves activation disabled. The only workflow action intentionally not performed is the integration-owned agent-context update.

## Complexity Tracking

No violations. The plan extends existing modules and introduces one fixture package plus one pure orchestrator module to keep sequencing separate from transport.
