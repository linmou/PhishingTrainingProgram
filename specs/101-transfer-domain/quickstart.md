# Server-Authoritative Attempt Verification Quickstart

**Intent**: Give the implementation owner exact local commands and evidence expectations for the deterministic component.
**Date**: 2026-09-22

Run from `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/tutor-system` after dependencies are installed.

## Focused W2 suites

```bash
CI=true npm test -- --watchAll=false --runInBand --runTestsByPath \
  src/services/__tests__/learningProgressTransitions.test.ts \
  src/services/__tests__/assessmentAnswerParser.test.ts \
  src/services/__tests__/assessmentGrading.test.ts \
  src/services/__tests__/assessmentRendering.test.ts \
  src/services/__tests__/tutorDecisionContract.transfer.test.ts \
  src/services/__tests__/transferAssessmentOrchestrator.test.ts \
  src/services/__tests__/transferAssessmentGoldenFixtures.test.ts
```

The focused result must include required-explanation validation, unresolved-public privacy, correct-first, incorrect-correct, incorrect-incorrect, duplicate-at-each-stage, terminal third submission, reload/tab-equivalent snapshots, and all existing parser/grader/reducer regression cases.

## Type and regression checks

```bash
npx tsc --noEmit
CI=true npm run test:regression -- --runInBand
npm run build
```

The repository does not define a dedicated mypy check because this component is TypeScript; `npx tsc --noEmit` is the type check for modified contracts. Do not run live provider, hosted database, migration push, browser release, or Promptfoo commands as part of W2 verification.

## Evidence requirements

- Record command, exit status, test file set, and observed counts in the implementation handoff.
- Preserve fixture manifest/version, state/result input-output pairs, and any failure output; do not omit errored cases from a denominator.
- Record that first-incorrect fixtures have unchanged progress and no terminal feedback, passed fixtures set learner feedback authorization false, and second-incorrect failed fixtures alone set it true.
- Label these tests as deterministic/mock-only. They do not prove SQL/RLS, authorization, provider configuration, browser privacy, or deployment compatibility.
- Keep `TRANSFER_ASSESSMENT_ENABLED` disabled.
