# Component 102 Implementation Evidence

<!-- Intent: preserve reproducible local results and explicit external blockers for the server-authoritative backend. -->

**Date**: 2026-09-22  
**Branch**: `102-transfer-backend`  
**Baseline before implementation**: `2248000`  
**Promoted component-101 prerequisite**: `87118a3` (contains implementation `91d8036`)  
**Implementation commit**: `419f785`

## Environment And Migration Inventory

- Hosted scope identifier: unavailable; no disposable hosted Supabase project or connection was supplied.
- Pre-migration hosted schema revision, grants, policies, functions, and assessment row counts: not observed for the same reason.
- Local baseline consists of archived migrations `025` through `046`; they remain under `supabase/archived_migrations/` and were not reactivated or modified.
- The forward migration assumes the hosted state includes the message assessment columns produced by archived migrations `038`, `044`, `045`, and `046`, including the legacy public `assessment_key` that is moved private before removal.
- Legacy rows with recoverable key and unambiguous transfer checklist scope become `legacy_incomplete`; no explanation, valid attempt, or terminal evidence is fabricated.

## Test-First Record

| Stage | Command | Result |
|---|---|---|
| Baseline | `CI=true npm test -- --watchAll=false --runInBand --runTestsByPath ...five focused files...` | Exit 1: four suites passed (45 tests); migration suite failed because it opened archived `025_transfer_assessment_storage.sql`. |
| New contract failures | Same focused command after adding Packet V2 assertions | Exit 1: 18 expected failures; request parity remained green. Failures were missing exact target DTO, transport facade, canonical processed DTO, private-field stripping, and forward migration. |
| Implemented contracts | Same focused command | Exit 0: 5 suites, 32 tests passed. |
| Component-101 regression | `CI=true npm test -- --watchAll=false --runInBand --runTestsByPath transferAssessmentOrchestrator.test.ts transferAssessmentGoldenFixtures.test.ts assessmentGrading.test.ts assessmentAnswerParser.test.ts` | Exit 0: 4 suites, 170 tests passed. |
| Edge syntax | TypeScript `transpileModule` over `index.ts` and `index.test.ts` after stripping executable shebang | Exit 0: both files parsed. |
| Migration static | Focused migration suite | Exit 0: 5 checks passed. |
| Production build | `npm run build` | Exit 1 at `src/test-support/transferRoomFixtures.ts:146`: component-103 fixture still supplies removed `rendered_text` and does not supply required `student_id`. No component-102 compile error was reported before this owned handoff mismatch. |

## Implemented Boundary

- Browser service invokes only the six trusted operations and has no direct table access, provider transport, grading, progress mutation, browser identity authority, local attempt count, or model fallback.
- Public assessment projection is exactly `{id, student_id, selection_type, stem, options}` at runtime. `student_id` is routing metadata only.
- Edge processing reads a private persisted snapshot, calls component 101's `resolveTransferAnswer`, and submits the result to a row-locked expected-count/expected-resolution RPC. `CONCURRENT_MODIFICATION` causes a bounded reread and re-resolution.
- First wrong commits attempt 1 without a learning event or feedback. Pass and second failure commit attempt, lifecycle, causal learning event, progress/history, and result together. Only committed failure returns key plus learner-safe explanation.
- Provider configuration is server-only and requires exact `qwen3.5-flash`; one format repair is permitted and every attempt is privately audited without credentials.
- `TRANSFER_ASSESSMENT_ENABLED=false` remains documented and the default deployment state.

## External And Downstream Lanes

- Deno handler execution: blocked because `deno` is not installed (`deno: No such file or directory`). The Deno tests cover injected verifier failure, exact projection, required config, provider request/repair/error paths, CAS retry, and authoritative outcomes but are not claimed as run.
- Hosted schema/RLS/RPC/race/rollback execution: blocked because no disposable hosted scope or service-role connection was supplied. The two SQL scripts were updated but are not claimed as run.
- Live provider: blocked because no server-only provider credentials or controlled endpoint was supplied. No live-provider claim is made.
- Generated hosted database types: blocked until the forward migration can run against the supported hosted schema. The checked-in type file reflects the reviewed contract, not a claimed hosted generation.
- Component 102 to 103: `src/test-support/transferRoomFixtures.ts` must remove `rendered_text` and add stable `student_id`; the current 103-owned fixture blocks the production build.
- Component 102 to 104: evaluation must import the existing canonical v3 request builders and validate the backend-owned explanation prompt; no copied provider or grading path is allowed.
- Integration E01 support required: real 101 resolver output must be passed through the 102 handler/RPC boundary, and actual 102 public DTOs must be consumed by 103 and 104 tests. Component 102 did not add integration-owned `tests/integration/**`.
