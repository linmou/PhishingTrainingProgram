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
rtk proxy sh -c 'cd tutor-system && /Users/admin/.npm/_npx/05b6ef7b13673c57/node_modules/deno/deno test --cached-only --allow-env --allow-read --allow-run --unstable-sloppy-imports supabase/functions/assessment-api/index.test.ts'
rtk proxy sh -c 'cd tutor-system && npm run build'
```

The test-first record must show the relevant tests failing before implementation and passing afterward. CRA tests begin with purpose comments and no shebang because imported CRA TypeScript cannot parse one; the executable Deno test uses both a shebang and purpose comment.

## Hosted Schema and Transaction Evidence

The owner of the disposable hosted scope, not this component run, executes this lane. Before applying the migration, record the scope identifier, schema revision, migration list, relevant table/column/function/grant/policy inventory, and this read-only legacy-key count on the exact database to be migrated:

```sql
WITH keyed AS (
  SELECT id, room_id, assessment_key, assessment_checklist_id,
         assessment_item_id, parent_message_id, assessment_selection_type
  FROM public.messages
  WHERE assessment_key IS NOT NULL
)
SELECT count(*) AS keyed_rows,
       count(*) FILTER (WHERE NOT (
         cardinality(k.assessment_key) > 0
         AND (k.assessment_selection_type IS NULL
              OR k.assessment_selection_type IN ('single', 'multiple'))
         AND EXISTS (
           SELECT 1
           FROM public.session_checklists sc
           JOIN public.checklist_items ci
             ON ci.checklist_id = sc.id AND ci.id = k.assessment_item_id
           JOIN public.messages parent
             ON parent.id = k.parent_message_id
            AND parent.room_id = k.room_id
            AND parent.user_id = sc.student_id
            AND parent.user_role = 'student'
           WHERE sc.id = k.assessment_checklist_id
             AND sc.room_id = k.room_id
             AND sc.progress_policy_version = 'transfer_v1'
             AND sc.student_id IS NOT NULL
         )
       )) AS uncovered_rows
FROM keyed k;
```

Stop if the query fails because the hosted schema differs, `uncovered_rows > 0`, or a verified restorable pre-migration backup/PITR point is absent. The migration also raises `LEGACY_TRANSFER_KEY_SCOPE_UNCOVERED` before copying any key when its own coverage check finds such a row. It copies eligible keys into `private.transfer_assessments` and then drops `public.messages.assessment_key`; a reverse migration cannot recover dropped keys. First rehearse migration and SQL behavioral tests on a disposable restored clone, confirm the legacy-incomplete private row count and key values against the preflight inventory, and retain the restore point before any user-authorized target run.

1. Apply `20260922000000_transfer_assessment_server_authority.sql` only to the approved disposable scope after the stop conditions pass.
2. Run `supabase/tests/transfer_assessment_backend.sql` for schema, privacy, grants, direct writes, public key removal, legacy-incomplete reconciliation, and rollback.
3. Run `supabase/tests/transfer_assessment_rpc_behaviour.sql` for delivery retry, first wrong, pass on attempt 1/2, second wrong, duplicate answer/request, concurrent distinct submissions, third submission, wrong scope, Guard behavior, evidence/history, and forced rollback. It writes test fixtures inside a transaction; do not run it on PhishingTutor.
4. Regenerate `src/types/database.ts` from that schema and compare the exact private/public/RPC signatures to `contracts/rpc-contract.md`.

Invoke each SQL script with `psql -X -v ON_ERROR_STOP=1 "$DISPOSABLE_DATABASE_URL" -f <script>` so a raised assertion stops the run with a nonzero exit. The current scripts do not yet cover the full matrix in steps 2-3; keep T009, T011, T020, T027, and T033 open until those cases are encoded and executed. Record exact commands, timestamp, tested migration/SHA, exit code, test count, and immutable log path. Static SQL/Jest checks do not substitute for hosted execution.

## Authorization and Provider Evidence

1. Exercise absent verifier, invalid proof, forged body IDs, valid teacher, target learner, other learner, observer, cross-room, direct RPC, and legacy operation cases.
2. Capture the provider request using a controlled fake endpoint and assert exact configured URL/model, `max_tokens=1200`, canonical v3 request serialization, required explanation instruction, and absence of grading labels/keys.
3. Exercise missing model, missing key/base URL, malformed JSON, invalid explanation, one repaired response, second invalid response, truncation, HTTP error, and network error.
4. Scan response DTOs, public/realtime rows, logs, exports, source imports, and browser build assets for credentials, key, explanation, transfer basis, rationale, and raw provider output. Permit key/explanation only in the authorized terminal second-failure response fixture.

## Documentation and Handoff

Before commit, review and update `tutor-system/README.md`, `claude_docs/database-schema.md`, `claude_docs/supabase-service.md`, and `claude_docs/ai-behaviors/tutor-response-contract.md` where behavior changed. Add `claude_docs/doc_update_record/documentation_update_record_v2026_09_22_transfer_backend.md` with date, change, commands, results, and implementation commit reference. The integration owner separately records 101->102, 102->103, and 102->104 handoff evidence.

## Blocked Evidence

If hosted access, verifier wiring, provider configuration, or any command is absent/failing, record the lane as blocked/failed. Do not enable the feature, substitute a mock for hosted acceptance, switch models, or restore browser grading.
