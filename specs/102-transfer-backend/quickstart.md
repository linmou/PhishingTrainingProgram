# Backend Verification Quickstart

<!-- Intent: define the exact verification order and evidence needed to accept component 102 without overstating unrun hosted or downstream gates. -->

## Preconditions

- Component 101's promoted SHA is merged into this branch before implementation.
- Use a disposable supported hosted Supabase scope. Do not reset or mutate a production project.
- Configure a trusted `AssessmentPrincipalVerifier` adapter and server-only `OAI_API_KEY`, `OAI_BASE_URL`, `OAI_MODEL=qwen3.5-flash`.
- Keep `TRANSFER_ASSESSMENT_ENABLED=false` until all initiative gates pass.

## Planning Gate

```bash
rtk git status --short --branch
rtk proxy sh .specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
```

## Focused Deterministic Tests

```bash
rtk proxy sh -c 'cd tutor-system && CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/services/__tests__/transferAssessmentApiContract.test.ts src/services/__tests__/transferAssessmentLocalService.test.ts src/services/__tests__/transferAssessmentMigration.test.ts src/services/__tests__/transferAssessmentService.test.ts src/services/__tests__/transferTutorRequestV3.test.ts'
rtk proxy sh -c 'cd tutor-system && deno test --allow-env --allow-net supabase/functions/assessment-api/index.test.ts'
rtk proxy sh -c 'cd tutor-system && npm run build'
```

The test-first record must show the relevant tests failing before implementation and passing afterward. CRA tests begin with purpose comments and no shebang because imported CRA TypeScript cannot parse one; the executable Deno test uses both a shebang and purpose comment.

## Hosted Schema and Transaction Evidence

1. Record hosted scope identifier, pre-migration schema revision, migration list, transfer table/column/function/grant/policy inventory, and existing assessment row counts without secrets.
2. Apply `20260922000000_transfer_assessment_server_authority.sql` only to the disposable scope.
3. Run `supabase/tests/transfer_assessment_backend.sql` for schema, privacy, grants, direct writes, public key removal, legacy-incomplete reconciliation, and rollback.
4. Run `supabase/tests/transfer_assessment_rpc_behaviour.sql` for delivery retry, first wrong, pass on attempt 1/2, second wrong, duplicate answer/request, concurrent distinct submissions, third submission, wrong scope, Guard behavior, evidence/history, and forced rollback.
5. Regenerate `src/types/database.ts` from that schema and compare the exact private/public/RPC signatures to `contracts/rpc-contract.md`.

Record exact commands, timestamp, tested migration/SHA, exit code, test count, and immutable log path. Static SQL/Jest checks do not substitute for hosted execution.

## Authorization and Provider Evidence

1. Exercise absent verifier, invalid proof, forged body IDs, valid teacher, target learner, other learner, observer, cross-room, direct RPC, and legacy operation cases.
2. Capture the provider request using a controlled fake endpoint and assert exact configured URL/model, `max_tokens=1200`, canonical v3 request serialization, required explanation instruction, and absence of grading labels/keys.
3. Exercise missing model, missing key/base URL, malformed JSON, invalid explanation, one repaired response, second invalid response, truncation, HTTP error, and network error.
4. Scan response DTOs, public/realtime rows, logs, exports, source imports, and browser build assets for credentials, key, explanation, transfer basis, rationale, and raw provider output. Permit key/explanation only in the authorized terminal second-failure response fixture.

## Documentation and Handoff

Before commit, review and update `tutor-system/README.md`, `claude_docs/database-schema.md`, `claude_docs/supabase-service.md`, and `claude_docs/ai-behaviors/tutor-response-contract.md` where behavior changed. Add `claude_docs/doc_update_record/documentation_update_record_v2026_09_22_transfer_backend.md` with date, change, commands, results, and implementation commit reference. The integration owner separately records 101->102, 102->103, and 102->104 handoff evidence.

## Blocked Evidence

If hosted access, verifier wiring, provider configuration, or any command is absent/failing, record the lane as blocked/failed. Do not enable the feature, substitute a mock for hosted acceptance, switch models, or restore browser grading.
