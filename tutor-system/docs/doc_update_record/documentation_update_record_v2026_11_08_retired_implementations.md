# Retired implementation ownership — issues #58 and #65

Intent: record the consumer decisions and verification for retiring disconnected AI/context and room-feature wrappers.

Updated: 2026-11-08. Baseline commit: `a69b836b7a46d801beb8139415691f4cb3b494ae`.

Owner: Codex `retire_alternatives`; integration/release owner: parent Codex agent.
Scope: frontend internal-source cleanup and deterministic tests. No database,
Edge Function, permission, model, prompt, or hosted runtime configuration change.

## Ownership decisions

The [reference inventory](../../reference/legacy-ai/README.md) records each known
consumer and the private application's API boundary. The supported AI/context
implementation remains `aiService.ts` → `simplifiedAIContext.ts`. Alternative
implementations are preserved outside `src` as `.ts.txt` references; the AI
sources retain identical Git blobs and SHA-256 hashes. Frozen evaluation files
and historical summaries are unchanged.

The existing `enhancedContextIntegration.test.ts` now exercises fresh room/message
context and failure propagation. The existing Edge-boundary suite reads the
archived original source at its new path. No test file is removed.

The unconsumed `useRoomFeatures` wrapper is retained as reference text. Its
log-only lifecycle methods and constant health result are removed from
`RoomFeaturesService`; live checklist, AI and coverage access stays in that
facade. Current documentation makes lifecycle ownership explicit.

## Verification

Status: focused local checks passed; repository-wide TypeScript baseline remains failing.

Selected checks: focused active context/Edge-boundary integration tests, existing
checklist creation/refresh/update/custom-area suites, application typecheck and
production build. Mypy does not apply to this TypeScript-only change; TypeScript
is the relevant static check. No new lifecycle contract is introduced.

| Command/check | Observed result |
| --- | --- |
| `CI=true REACT_APP_SUPABASE_URL=http://127.0.0.1:54321 REACT_APP_SUPABASE_ANON_KEY=ci-placeholder npm test -- --watchAll=false --runInBand --runTestsByPath src/services/__tests__/enhancedContextIntegration.test.ts src/services/__tests__/aiService.edgeBoundary.test.ts src/services/__tests__/simplifiedAIContext.test.ts src/components/__tests__/ChecklistPanel.test.tsx src/components/__tests__/ChecklistPanel.transfer.test.tsx src/__tests__/checklist_management.test.ts src/__tests__/checklist_management.bdd.test.tsx` | 7 suites, 81 tests passed; exit 0. No hosted requests. |
| `npx tsc --noEmit` | Exit 2; 439 diagnostics. Exact diagnostic lines match the parent's `a69b836` baseline output: zero added or removed diagnostics, including none in changed files. Baseline evidence: integration worktree `output/issues-57-66/baseline-tsc.log`. |
| `CI=false REACT_APP_SUPABASE_URL=http://127.0.0.1:54321 REACT_APP_SUPABASE_ANON_KEY=ci-placeholder npm run build` | Exit 0; production bundle compiled with warnings in unchanged ImageUpload, useChecklist, RoomPagePost, imageUpload, and parameterConfig sources. |
| `git diff --check` | Exit 0. |
| `git hash-object` of both AI references versus `git rev-parse HEAD:<old-path>` | Exact matches: `02d3800c80db38f3883b5e0e46424168f8f2950e` and `699923e68a012c51d5d96e87ef169d04bad16bc7`. |

The migrated six-test context suite covers source-table reads on each call,
scenario/example/discussion composition, role attribution, empty discussion,
room failures and message failures. The unchanged active context suite covers
pagination and learner-specific assessment readiness; existing checklist suites
exercise the retained facade's current consumer flows. Expected failure-path
console errors and React `act` deprecation warnings were emitted by passing tests.

The parent integration agent owns combined-candidate CI/review and any affected
frontend browser acceptance. No Supabase artifact requires deployment for this
source-retirement scope.
