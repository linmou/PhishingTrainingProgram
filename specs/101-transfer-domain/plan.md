# Implementation Plan: Server-Authoritative Transfer Attempts

**Branch**: `101-transfer-domain` | **Date**: 2026-09-22 | **Spec**: [spec.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/specs/101-transfer-domain/spec.md)  
**Input**: Approved V2 allocation, server-authoritative attempt policy, `assessment_ui_change.md`, and revised UI specification commit `94f0dce`.

## Summary

Upgrade the existing deterministic transfer domain so one delivered assessment has a server-owned snapshot with at most two consumed valid selections. Add the private `learner_safe_explanation` contract, retry and terminal result discriminants, terminal-feedback privacy, shared barrel exports, and golden fixtures. Reuse the existing parser, exact-set grader, progress reducer, and pure orchestrator. Keep persistence/concurrency, authorization/projection, React, prompt generation, semantic evaluation, and browser evidence downstream.

## Technical Context

**Language/Version**: TypeScript 4.9 with the repository's strict CRA compiler settings  
**Primary Dependencies**: React Scripts 5, Jest, existing Supabase client types only at the facade boundary  
**Storage**: None in component 101; the pure input models the snapshot component 102 must persist atomically  
**Testing**: Jest through `react-scripts test`; `npx tsc --noEmit` for type validation  
**Target Platform**: Existing `tutor-system` web application service/type modules  
**Project Type**: React + TypeScript application with pure service modules  
**Performance Goals**: Deterministic helper execution should remain local and synchronous; no provider or database latency is in scope  
**Constraints**: At most two valid selections; first wrong is retryable without progress; correct on either attempt passes; second wrong fails; terminal-only correct-answer/explanation feedback; four fixed options; exact-set grading; unchanged 28-cell progress reducer; no edits to 102-owned facade/storage; no new progress field; no provider/database/UI dependency in pure logic  
**Scale/Scope**: One open assessment per focused learner/context; attempt counts `0 | 1 | 2`; resolution `open | passed | failed`; named two-attempt, duplicate, stale, invalid, Guard, reload/tab-equivalent, and third-submission fixtures  

## Constitution Check

*GATE: Must pass before implementation planning and be re-checked after design.*

| Principle | Status | Evidence |
|---|---|---|
| Preserve requirements and evidence | PASS | The spec records the approved V2 policy and maps every attempt/explanation outcome to FR/SC items and named fixtures. |
| Keep authority server-side | PASS | The domain snapshot is the contract component 102 persists across reloads/tabs; the browser is never attempt, key, or progress authority. |
| Test first and verify the real boundary | PASS WITH IMPLEMENTATION CONDITION | Tasks put fixture/test work before production edits; implementation must use the repository-required `fast-multi-agent-tdd` workflow. W2 evidence is labeled deterministic and cannot substitute for hosted gates. |
| Use stable, explicit contracts | PASS | `PrivateAssessment`, `TransferAttemptSnapshot`, retry/terminal results, terminal feedback, reducer pairs, and fixture IDs are explicit in `contracts/`; component 102 owns persistence and projection. |
| Prefer the smallest coherent design | PASS | Existing modules and service tests are extended; no new package, mastery field, or compatibility layer is proposed. |
| Feature remains disabled until release gates | PASS | W2 does not enable `TRANSFER_ASSESSMENT_ENABLED`; downstream release gates remain required. |
| Root/integration ownership | PASS WITH DEFERRED ACTION | The normal agent-context update is deferred; this component will not modify root `AGENTS.md` or run `update-agent-context.sh`. |

No constitutional violation requires a complexity justification.

## Repository Evidence and Design

The worktree already contains the original one-attempt domain implementation and its focused deterministic tests. `resolveTransferAnswer` currently applies `assessment_fail` on the first incorrect valid selection, `PrivateAssessment` has no learner-safe explanation, and shared exports have no attempt snapshot or terminal feedback type. This upgrade changes only those domain contracts and sequences. Existing parser, grader, renderer, and reducer behavior stays intact and acts as regression evidence.

Ownership remains:

- `assessment.ts` and `types/index.ts`: private/public assessment, attempt, result, feedback, and barrel contracts.
- `tutorDecisionContract.ts` and `assessmentValidation.ts`: structured v3/explanation validation.
- `assessmentAnswerParser.ts`: explicit selection syntax and clarification classification.
- `assessmentGrading.ts`: exact-set equality.
- `assessmentRendering.ts`: canonical learner rendering and limits.
- `learningProgressTransitions.ts`: the only pure progress transition authority.
- `transferAssessmentOrchestrator.ts`: pure two-attempt, disclosure, progress, duplicate, and no-chain sequencing; no storage writes.
- Golden fixtures/tests: executable evidence for all above boundaries and named sequences.
- Component 102: owns `transferAssessmentService.ts`, its tests, API operations, transport adaptation, and private-to-public projection; it consumes 101's pure contracts/orchestrator outputs.

## Implementation Phases

### Phase 0: Contract and fixture freeze

1. Read the component spec, data model, contracts, existing source, and normative T09 sections.
2. Freeze `TransferAttemptSnapshot`, retry/terminal result, and `TransferTerminalFeedback` discriminants in contract tests.
3. Add failing tests for required explanation validation, unresolved-public privacy, and terminal-only feedback before changing implementation.
4. Preserve unknown downstream results as pending; do not fabricate database, provider, or browser evidence.

### Phase 1: Shared assessment and result contracts

1. Add required `learner_safe_explanation` to `PrivateAssessment` and reject missing, blank, or non-string values at the existing validation boundary.
2. Define the server-owned attempt snapshot and discriminated retry, terminal, and non-consuming result types in `assessment.ts`.
3. Export the new domain types through `types/index.ts` without exporting private fields through `PublicAssessment`.
4. Preserve the existing parser, exact-set grader, rendering rules, and progress reducer unchanged.

### Phase 2: Answer resolution and orchestrator sequencing

1. Make the resolver accept the server-owned attempt snapshot and return its next immutable snapshot.
2. Return `retryable` with unchanged progress and no terminal feedback after the first incorrect valid selection.
3. Return terminal `passed` for a correct first or second attempt and terminal `failed` only for a second incorrect attempt, applying the reducer exactly once.
4. Reject duplicate/terminal/third submissions without consuming attempts; preserve non-consuming behavior for undelivered, stale, malformed, ambiguous, assistance, and Guard-deferred inputs.
5. Replay correct-first, incorrect-correct, incorrect-incorrect, duplicate-at-each-stage, reload/tab-equivalent snapshot, terminal replay, repair, contradiction, spontaneous-transfer, and no-chain fixtures.

### Phase 3: Verification and handoff

1. Run focused W2 tests, TypeScript checking, regression tests, and build.
2. Record exact counts, failures, and deferred downstream gates.
3. Review nearest behavior-contract documentation only for implementation changes; this planning package makes no production behavior change and does not update integration-owned docs or context.

## File Plan

### Existing production files to extend during implementation

- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/types/assessment.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/types/index.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/assessmentValidation.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/tutorDecisionContract.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/transferAssessmentOrchestrator.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/transferAssessmentGoldenFixtures.ts`

### Test and fixture files to add or extend during implementation

- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/__tests__/tutorDecisionContract.transfer.test.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/__tests__/learningProgressTransitions.test.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/__tests__/transferAssessmentOrchestrator.test.ts`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts`

### Documentation review during implementation

- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/claude_docs/ai-behaviors/tutor-response-contract.md`
- `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system/claude_docs/doc_update_record/documentation_update_record_v20260911_transfer_domain.md` (create only when the implemented public contract changes)

## Dependency and Boundary Notes

- Explanation contract tests and attempt-sequence tests touch different test files and can be prepared in parallel after the shared result names are frozen.
- `transferAssessmentOrchestrator.ts` depends on the promoted attempt/result types and reuses the existing parser, grader, and reducer outputs.
- Component 101 does not depend on a database or provider, but component 102 depends on these exact state and terminal-feedback contracts.
- Component 101 must not edit `tutor-system/src/services/transferAssessmentService.ts` or `tutor-system/src/services/__tests__/transferAssessmentService.test.ts`; component 102 integrates and tests the pure orchestrator and public output contracts at the API/projection boundary.
- No pure fixture or mock result may be described as proof of transport projection, SQL/RLS, or authorization.

## Post-Design Constitution Re-check

PASS. The design makes the persisted server snapshot the attempt authority, keeps one progress reducer, excludes key/explanation material from unresolved public shapes, records exact evidence in fixtures, avoids a second mastery field, and leaves activation disabled. The integration-owned agent-context update remains deferred.

## Complexity Tracking

No violations. The plan extends existing types, validators, orchestrator, and fixtures; it introduces no new package or compatibility layer.
