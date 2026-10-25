# Assessment API Dependency Promotion

Intent: identify the server impact of imported frontend changes and record the focused checks required for exact-source promotion.

Date: 2026-10-25. Inspected integration head: `335fd48`. Release owner: root open-issues agent. No hosted writes or runtime code edits were performed for this investigation.

## Dependency And Behavior Trace

`supabase/functions/assessment-api/index.ts` imports `buildTransferTutorRequestContextV3` and `buildTransferAssessmentRequest` from `src/services/ecologicalTutorCall.ts`. That module imports `prompts/activeTutorAgentPrompt.ts`, whose learning-progress instruction changed in issue #2. The two functions called by the Edge handler canonicalize and serialize transfer context without reading that prompt. The changed prompt is used by `buildEcologicalChatCompletionMessages`, which the handler does not call. Assessment generation uses the separate `TRANSFER_ASSESSMENT_SYSTEM_PROMPT` in the Edge entrypoint.

The handler also imports `parseAssessmentEvent` from `assessmentRendering.ts`, and its assessment validator imports `renderAssessment` and `validateAssessmentRendering` from the same file. Issue #21 changes only `orderAssessmentMessages`; the handler does not call that function. The parser, rendering and validation implementations used by the handler are unchanged.

No changed server request, provider prompt, permission, grading, lifecycle or result behavior was identified from these dependency changes. The deployment helper still includes both changed files in its recursive source closure, so the hosted assessment source must be promoted to match the frozen release artifacts. Per-project bundle digests alone do not prove imported-file equality. The `ai-api` source closure is unchanged and does not import either changed module.

## Exact Artifacts

Assessment source manifest: `acb482c2f55a6d7b36ee95cea85d757e73b388473388f48e872b6d9a8ad0b024` (15 files).

| Source | SHA-256 |
| --- | --- |
| `src/services/assessmentRendering.ts` | `7801710bbdff219a43a50bf29448f525bfe1b3793a5f6b429e2ae3a2d4464985` |
| `src/services/ecologicalTutorCall.ts` | `5d04eb5d8e8b20dba69c8a4426b9e3b8107cff1a0c9ae8ebcaaa5c56bf5e7883` |
| `src/services/prompts/activeTutorAgentPrompt.ts` | `53f677542d22e541443c44cf807d4035509836b29763df7945491e250ae23b83` |
| `supabase/functions/assessment-api/index.ts` | `5088ec810fa11ec8627dc017ff661563674529e567de495b3f97b68091834fd2` |

Full local manifest: `/tmp/assessment-dependency-manifest-20261025.json`. Unchanged ai-api manifest: `3731b62f5357622305a65e5ce5e016ff35e16bd394ff13fbb46015911d096661` (three files), `/tmp/ai-dependency-manifest-20261025.json`. Root retains the release manifest under the integration worktree's `output/open-issues-release-20261025/`.

## Focused Verification

Run from the inspected integration worktree's `tutor-system/`:

```sh
rtk proxy /Users/admin/.deno/bin/deno test --allow-env --allow-net --allow-run supabase/functions/assessment-api/index.test.ts
rtk proxy /Users/admin/.deno/bin/deno check --cached-only supabase/functions/assessment-api/index.ts
rtk npm test -- --watchAll=false --runInBand --silent --runTestsByPath src/services/__tests__/ecologicalTutorCall.test.ts src/services/__tests__/transferTutorRequestV3.test.ts src/services/__tests__/assessmentRendering.test.ts src/services/__tests__/assessmentOrdering.regression.test.ts src/services/__tests__/transferAssessmentGoldenFixtures.test.ts
```

Results: 45 Deno handler tests passed, including the production Edge adapter type check; explicit Deno check passed; five Jest suites and 135 tests passed. Handler tests cover target selection, private-field stripping, request model/budget/JSON mode, format repair, rendering rejection, persistence failure, mandatory assessment preparation and lifecycle/identity contracts. Jest checks cover canonical request packaging, rendering, order equivalence and golden assessment fixtures.

The initial cached-only handler command failed because the Supabase SDK URL was absent from the Deno cache. The network-enabled run fetched that dependency and passed; no mock or source substitution was introduced. Logs: `/tmp/assessment-dependency-deno-20261025.log` (initial failure), `/tmp/assessment-dependency-deno-network-20261025.log` (45 passing), `/tmp/assessment-dependency-deno-check-20261025.log` (passing check). The Deno binary is `/Users/admin/.deno/bin/deno`, version 2.9.7, and is absent from the default shell PATH.

## Release Handoff

The existing `scripts/deploy-assessment-api.js` recursively hashes relative imports and uploads the complete closure through the Supabase Management API without Docker. `--bundle-only` validates provider secret names and requires the deployed function ID/version/update time to remain unchanged. `--deploy` activates the same collected sources with `verify_jwt=false`. It does not modify provider secrets. The staging deploy operation acquires or borrows the exact candidate's `PTP_COORDINATION_LEASE`; root holds that lease through affected acceptance checks.

Root first runs bundle-only validation for the frozen candidate, applies the separately validated publication SQL, then deploys the exact assessment closure. Preserve the returned source manifest and deployed version, and inspect downloaded per-file source hashes against the frozen manifest. Verify staging assessment preparation/provider/rendered output and the affected existing lifecycle contract; this dependency-only change introduces no new model behavior evaluation requirement, while the independent issue #2 frontend semantic acceptance remains open under its own record.

Production requires the latest workflow gates: current-head PR checks/review, valid combined staging evidence, explicit human merge authorization, consideration of Render's automatic frontend deployment, and matching integrated SQL/function/frontend artifacts. After the authorized merge, compare the complete 15-file closure to staging evidence, recheck runtime configuration and target preconditions, and deploy that identical source to production. Record affected live results and cleanup. Hosted deployment and acceptance remain root's responsibility and are not established by this local investigation.
