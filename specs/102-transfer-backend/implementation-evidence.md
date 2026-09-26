# Component 102 Implementation Evidence

<!-- Intent: preserve reproducible local results and explicit external blockers for the server-authoritative backend. -->

**Date**: 2026-09-22  
**Branch**: `102-transfer-backend`  
**Baseline before implementation**: `2248000`  
**Promoted component-101 prerequisite**: `87118a3` (contains implementation `91d8036`)  
**Implementation commits**: `419f785`, hardened by `de3777b`, trusted non-assessment paths completed by `c23fc9e`

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
| Implemented contracts and component-101 regression | One focused `--runTestsByPath` command over all nine component-102/101 files | Exit 0: 9 suites, 202 tests passed after replay-scope hardening. |
| Edge syntax | TypeScript `transpileModule` over `index.ts` and `index.test.ts` after stripping executable shebang | Exit 0: both files parsed. |
| Migration static | Focused migration suite | Exit 0: 5 checks passed. |
| Production build | `npm run build` | Exit 1 at `src/test-support/transferRoomFixtures.ts:146`: component-103 fixture still supplies removed `rendered_text` and does not supply required `student_id`. No component-102 compile error was reported before this owned handoff mismatch. |

## Implemented Boundary

- Browser service invokes only the six trusted operations and has no direct table access, provider transport, grading, progress mutation, browser identity authority, local attempt count, or model fallback.
- The trusted `post_message` and `send_reviewed` operations preserve ordinary room messages and reviewed tutoring/Guard turns; only assessment branches create private grading authority.
- Public assessment projection is exactly `{id, student_id, selection_type, stem, options}` at runtime. `student_id` is routing metadata only.
- Edge processing reads a private persisted snapshot, calls component 101's `resolveTransferAnswer`, and submits the result to a row-locked expected-count/expected-resolution RPC. `CONCURRENT_MODIFICATION` causes a bounded reread and re-resolution.
- `tutor-system/deno.json` enables Deno sloppy-import resolution for the existing CRA domain graph, so the Edge boundary can import the one component-101 resolver rather than copy its lifecycle rules.
- First wrong commits attempt 1 without a learning event or feedback. Pass and second failure commit attempt, lifecycle, causal learning event, progress/history, and result together. Only committed failure returns key plus learner-safe explanation.
- Provider configuration is server-only and requires exact `qwen3.5-flash`; one format repair is permitted and every attempt is privately audited without credentials.
- `TRANSFER_ASSESSMENT_ENABLED=false` remains documented and the default deployment state.

## External And Downstream Lanes

- Deno handler execution at the implementation commit was blocked because `deno` was not installed. The dispatch verification below used Deno 2.9.6 through `npx`; runtime tests passed with type checking disabled, while the checked command failed before test execution.
- Hosted schema/RLS/RPC/race/rollback execution: blocked because no disposable hosted scope or service-role connection was supplied. The two SQL scripts were updated but are not claimed as run.
- Live provider: blocked because no server-only provider credentials or controlled endpoint was supplied. No live-provider claim is made.
- Generated hosted database types: blocked until the forward migration can run against the supported hosted schema. The checked-in type file reflects the reviewed contract, not a claimed hosted generation.
- Component 102 to 103: `src/test-support/transferRoomFixtures.ts` must remove `rendered_text` and add stable `student_id`; the current 103-owned fixture blocks the production build.
- Component 102 to 104: evaluation must import the existing canonical v3 request builders and validate the backend-owned explanation prompt; no copied provider or grading path is allowed.
- Integration E01 support required: real 101 resolver output must be passed through the 102 handler/RPC boundary, and actual 102 public DTOs must be consumed by 103 and 104 tests. Component 102 did not add integration-owned `tests/integration/**`.

## Dispatch 102 Verification (2026-09-26)

**Tested code SHA**: `fc28b841d26724cfd43c38f57dabf6ed43bc2374` on `102-transfer-backend`; the clean starting HEAD contains both `c23fc9eb1e7b0b931a82d025753c16c02172f905` and `fc28b841d26724cfd43c38f57dabf6ed43bc2374`. **Worktree**: this component worktree only. No hosted database, deployed function, or live provider was invoked. The existing ignored `tutor-system/.env` matched the source file byte for byte (`cmp -s` exit 0); `.gitignore:28` ignores it. No values were displayed or committed.

Commands below ran from `tutor-system/` unless a path is specified. Their result lines are the retained local log in this document; commands were not redirected to separate files.

| Lane | Exact command | Exit | Result |
|---|---|---:|---|
| Planning | `rtk proxy sh .specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` (repo root) | 0 | Resolved `specs/102-transfer-backend` and its available design artifacts. |
| Quickstart Jest | `rtk proxy sh -c 'CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/services/__tests__/transferAssessmentApiContract.test.ts src/services/__tests__/transferAssessmentLocalService.test.ts src/services/__tests__/transferAssessmentMigration.test.ts src/services/__tests__/transferAssessmentService.test.ts src/services/__tests__/transferTutorRequestV3.test.ts'` | 0 | 5 suites passed; 32 tests passed; 0 failed. |
| 101/102 regression | `rtk proxy sh -c 'CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/services/__tests__/transferAssessmentApiContract.test.ts src/services/__tests__/transferAssessmentLocalService.test.ts src/services/__tests__/transferAssessmentMigration.test.ts src/services/__tests__/transferAssessmentService.test.ts src/services/__tests__/transferTutorRequestV3.test.ts src/services/__tests__/transferAssessmentGoldenFixtures.test.ts src/services/__tests__/learningProgressTransitions.test.ts src/services/__tests__/tutorDecisionContract.transfer.test.ts src/services/__tests__/ecologicalTutorCall.test.ts'` | 0 | 9 suites passed; 179 tests passed; 0 failed. The earlier 202-test count belongs to a different historical invocation. |
| Checked Edge suite | `rtk proxy npx --yes deno test --allow-env --allow-net --unstable-sloppy-imports supabase/functions/assessment-api/index.test.ts` | 1 | 0 tests ran. Deno 2.9.6 reported `TS2352` at `supabase/functions/assessment-api/index.ts:548`: the Postgrest builder cannot be cast directly to `Promise<RpcResult>`. |
| Diagnostic Edge runtime | `rtk proxy npx --yes deno test --no-check --allow-env --allow-net --unstable-sloppy-imports supabase/functions/assessment-api/index.test.ts` | 0 | 9 passed; 0 failed. This includes provider request/repair/failure and the two `c23fc9e` ordinary-turn/audit-failure cases. Type safety remains unverified. Deno generated `tutor-system/deno.lock` version 5 for repeatable dependency resolution. |
| Production build | `rtk proxy npm run build` | 1 | `TS2322` at `src/test-support/transferRoomFixtures.ts:146`: component-103 fixture supplies `rendered_text` to `PublicAssessmentDTO`; it also lacks the required public target `student_id`. No successful bundle or build-asset privacy scan exists. |

**All ten previously unchecked tasks audited against this evidence**:

| Task | Status and missing evidence |
|---|---|
| T001 | Remains open: baseline `2248000` and promoted 101 SHA `87118a3` are recorded above, but no disposable hosted scope, pre-migration schema/grant inventory, or existing row counts are available. |
| T017 | Remains open: local delivery tests pass; hosted delivery, schema revision, transaction, and public/private row evidence are absent. |
| T025 | Remains open: local attempt contracts pass; hosted persisted rows, two-tab races, and terminal effects are absent. |
| T032 | Remains open: local authorization/projection checks pass; hosted attack matrix, zero-mutation counts, and completed build-asset scan are absent. |
| T037 | Remains open: static terminal/Guard checks pass; hosted rollback, Guard, race, and per-case row counts are absent. |
| T042 | Remains open: controlled fake-provider tests pass at runtime; checked Deno execution, full provider privacy scan, and live provider metadata are absent. No live response is claimed. |
| T043 | Remains open: Jest passes, but checked Deno fails `TS2352` and the build fails the component-103 fixture `TS2322`. |
| T044 | Remains open: checked-in RPC names can be inspected, but `src/types/database.ts` has not been generated from a migrated supported hosted schema. |
| T045 | Remains open: `.env.example` declares `TRANSFER_ASSESSMENT_ENABLED=false`; handler checks the flag, absent verifier, and exact model, and local tests cover absent verifier/model. Hosted rollback and full no-fallback/privacy evidence are absent. |
| T047 | Handoff prepared in this record and the dispatch report: the clean commit, exact local commands/results, public contracts, prerequisites, and edge risks are reported without editing orchestration records. |

The Deno `TS2352` source correction remains unmade: the mandatory `fast-multi-agent-tdd` workflow requires a genuine behavior-failing Red test before an executable edit, while this diagnostic is a type-check failure and the existing runtime suite is green. The component-103 fixture belongs to its recorded owner. Neither failure is counted as a backend pass.

**Integration handoff**: Public assessment remains exactly `{id, student_id, selection_type, stem, options}`, with canonical `ProcessedMessageDTO` and the six trusted operations; private keys, explanation, attempts, and progress authority stay server-side. E01 (101->102) needs the real resolver-to-handler/RPC test. The 102->103 gate needs the fixture updated to include `student_id` and omit `rendered_text`, followed by a green production build and UI handoff. The 102->104 gate needs canonical v3 request-builder consumption and provider/explanation evaluation without copying backend authority. The integration owner must run those gates against the promoted SHA; this component's local pass is not integration promotion.

**E01/E02 runner and test gap**: `rtk proxy npx --yes --package deno -c 'command -v deno'` exited 0 and resolved `/Users/admin/.npm/_npx/05b6ef7b13673c57/node_modules/.bin/deno`, whose binary is `/Users/admin/.npm/_npx/05b6ef7b13673c57/node_modules/deno/deno` (`realpath` exit 0). The portable invocation is the `npx --yes deno test` command in the table; `--no-check` is diagnostic only. The existing `index.test.ts` CAS case injects a stub `resolveAnswer`; it does not close E01. Integration should inject the real `resolveTransferAnswer` into `createAssessmentApiHandler`, return a stored assessment, answer, and attempt snapshot from `get_transfer_assessment_processing_context_v1`, capture the same call's `process_assessment_message_v2` arguments, and assert that the real resolver's disposition, progress, transition, and selected IDs reach the commit RPC and its committed result is projected to the response. E02 should pass that actual handler projection to its consumer in the same test or run. No integration-owned test was edited here.

The generated `deno.lock` contains versioned dependency references and integrity hashes; it contains no environment values. It is included in the component commit so Deno reruns resolve the same dependencies and the worktree remains clean.

**Controlled live prerequisites**: A designated disposable supported Supabase project, its scope identifier and pre-migration inventory, a service-role connection for the SQL/RPC scripts, a deployed `AssessmentPrincipalVerifier` trusted-session adapter, and a bounded test identity/room set are required. Provider execution additionally requires server-only `OAI_API_KEY`, `OAI_BASE_URL`, and exact `OAI_MODEL=qwen3.5-flash`, with a controlled endpoint and credential-free request/response logging. Keep `TRANSFER_ASSESSMENT_ENABLED=false` for release until hosted authorization, storage, race, rollback, provider, integration, UI, evaluation, and browser gates pass.
