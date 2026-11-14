# Assessment toggle: finding attribution and proposed issues

Date: 2026-11-14. Baseline: `3becd9b`. Repair: `fb599f5`, `a4cf26a`, plus test-fixture deduplication.

These are proposals, not published GitHub issues. Source scope is AIAssistantSettings.tsx and its test file under tutor-system/src/components. Tools also analyze package dependencies and Git history. Do not equate their wider findings with defects introduced by this repair.

Evidence: `/tmp/ptp-assessment-smells-baseline`, `/tmp/ptp-assessment-smells-final`, `/tmp/ptp-assessment-smells-refactor` (summary.json, code_smell_report.md and raw outputs). Baseline and candidate use the same two-file scope and install policy. Original checkout remains at the baseline; unrelated untracked files were not modified.

## Current-change findings

- Two scoped test lint violations were fixed (both existed before this repair; one was in a modified test). Scoped ESLint passes.
- The first repair added one clone: baseline 16 clones / 271 duplicate lines; candidate 17 / 277. Refactored the new regression-test fixtures into one helper. All 18 tests pass after refactoring. Final scan returns 16 clones / 271 duplicated lines, exactly the baseline counts. Scoped lint is clean.
- No production component lint finding. No import or dependency-manifest changes. Remaining package-level findings below exist independently of the repair.

## Proposed issue 1 — Restore the baseline TypeScript check

Priority: P2. Confirmed legacy static-check failure; repair diagnostics were byte-identical to baseline.

Evidence: `tutor-system/src/services/__tests__/simplifiedAIContext.test.ts:305`, `storage-integration.test.ts:95`, `tutor-system/src/utils/__tests__/testValidation.test.ts:10` and other compiler locations in raw/tsc_no_emit.stdout.txt. These are examples, not the complete error inventory.

Impact: full type checking cannot act as a clean regression gate.

Acceptance: classify all baseline diagnostics, correct fixtures/types/imports without suppressing errors globally, and make `tsc --noEmit` pass along with affected tests.

## Proposed issue 2 — Triage and upgrade vulnerable package dependencies

Priority: P1 triage. Confirmed legacy dependency-audit findings; exploitability is unverified.

Evidence: baseline and repair both report 119 vulnerable package entries (8 critical, 59 high, 28 moderate, 24 low) and identical affected package names. package.json and package-lock.json are unchanged. Critical entries include direct dependency jspdf and transitive packages under development tools.

Impact: potential exposure depends on installed versions and runtime reachability; severity counts alone do not prove exploitable production behavior.

Acceptance: distinguish production and development exposure, prioritize reachable high/critical advisories, upgrade in reviewed batches, run affected PDF/export, app and evaluation checks, and document remaining exceptions. Do not run an indiscriminate forced upgrade.

## Proposed issue 3 — Break or document four existing import cycles

Priority: P2. Confirmed legacy structure; raw/madge_circular.json identical between baseline and repair.

Cycles: supabase ↔ transferAssessmentService; types/index ↔ prompts/types; aiService → checklistService → checklistIntegration → llmExtractionService → aiService; aiService → checklistService → coverageDetectionService → aiService. Files are under tutor-system/src.

Impact: potential initialization-order and maintenance coupling; no runtime failure established by this scan.

Acceptance: inspect runtime versus type-only edges, remove unnecessary runtime dependencies, document any intentional cycle, and rerun graph and affected service tests. Preserve API/auth behavior.

## Proposed issue 4 — Repair dependency-analysis coverage and declarations

Priority: P2. Legacy/tooling boundary. depcheck output is identical after normalizing worktree paths; exit 255 was classified as failed by the monitor, despite parseable findings.

Evidence: raw/depcheck.json reports missing declarations including @jest/globals and js-yaml, and unused candidates including jspdf and web-vitals. These are candidates, not safe deletion instructions. Knip's scoped unused-file candidate is the settings test which demonstrably executes.

Acceptance: validate consumer paths and framework entrypoints, correct dependency declarations or analyzer configuration, interpret tool exit codes correctly, and obtain a supported dependency-health result. Keep executed tests.

## Proposed issue 5 — Resolve behavioral analyzer import omissions

Priority: P2 analyzer compatibility. Confirmed with the project TypeScript 4.9.5 compiler API: all 23 reported import targets exist, and all 23 resolve to the exact target when the explicit .ts suffix is omitted in a diagnostic probe. The analyzer calls ts.resolveModuleName with project options, which returns undefined for these explicit-.ts specifiers. Source comments explicitly retain .ts extensions for Deno and suppress the TypeScript 4.9 incompatibility with @ts-ignore. This is an existing shared-source/toolchain compatibility gap, not missing files or a regression introduced by the repair. No source imports were rewritten by the probe.

Impact: incomplete static coverage, not proof that application imports fail at runtime.

Acceptance: make the behavioral adapter support the documented shared Deno/CRA import convention with explicit provenance and resolution tests, or adopt a separately validated shared-source toolchain configuration. Re-run graph coverage. Do not rewrite Deno-required source imports merely to hide analyzer omissions. This probe establishes target existence and the resolution mismatch, not complete runtime correctness.

## Proposed issue 6 — Triage historical secret-scanner candidates

Priority: P1 triage; unconfirmed secret exposure.

Evidence: history-wide Gitleaks findings appear in pre-existing documentation/evaluation/configuration files. No finding references the repair commits or changed code files. Generic-key rules can match hashes and other non-secret identifiers. Secret values are intentionally omitted here.

Acceptance: privately classify candidates as real credentials versus false positives, rotate only confirmed credentials and follow repository incident procedure where needed, narrowly document justified suppressions, and rerun scanner. Never copy potential secrets into public issue bodies.

## Deferred low-priority cleanup

Baseline settings code/tests contain 16 duplication candidates. Production prompt-configuration assembly is repeated in generation/save paths. Investigate reuse only if it reduces maintenance risk; preserve student role locks and prompt semantics, and avoid over-abstracting test fixtures.

## PR gate

Monitor coverage remains incomplete. User subsequently explicitly authorized PR publication after baseline attribution; disclose these limitations in the PR. This is not a monitor pass or a merge-gate waiver. Owner: root agent on fix/assessment-toggle-persistence. Full live conversation verification remains open.
