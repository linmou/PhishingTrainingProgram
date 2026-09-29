# Component 102 Local Verification Quickstart

<!-- Intent: define the exact verification order and evidence needed to accept component 102 without overstating unrun hosted or downstream gates. -->

This runbook records local component-102 v2 verification on disposable restored copies. It does not verify the production v1 RPC path. Some commands refer to historical component-worktree files that are not in the current checkout; use this as evidence provenance, not as a current execution guide. Current production catalog and schema findings are in [implementation evidence](implementation-evidence.md).

## Preconditions

- Component 101's promoted SHA is merged into this branch before implementation.
- Use a disposable PostgreSQL 17 restored copy with Supabase-like roles for the component SQL gate. Deployed Supabase verification remains an integration gate.
- The local handler tests use an injected verifier and controlled fake provider. Deployed requests send the current `tutor_system_user.id` in `x-application-user-id`; the verifier resolves role and room membership from the database. This app identity is editable in the browser and does not prove caller identity. The Edge Function requires `REACT_APP_OAI_API_KEY`, `REACT_APP_OAI_BASE_URL`, and `OAI_MODEL=qwen3.5-flash` in its environment.
- `TRANSFER_ASSESSMENT_ENABLED` defaults to `true` for verification; set it to `false` to disable transfer assessment explicitly.

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

Record each command's exit code and tested SHA. CRA tests begin with purpose comments and no shebang because imported CRA TypeScript cannot parse one; the executable Deno test uses both a shebang and purpose comment. A build failure in a downstream-owned file is recorded as this branch's build outcome; the integration build is tracked at its combined SHA.

## Local Restored-Copy Database Evidence

Use a disposable PostgreSQL 17 restored copy for the component gate. Record its identity, source schema snapshot, migration and script blobs, role fixtures, exact commands, exit codes, assertion counts, and rollback state. Before deployment, the integration owner inventories the actual Supabase target, confirms a restorable backup, and runs this read-only legacy-key count on that exact database:

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

When `uncovered_rows > 0`, inspect the relationships with this read-only query. It returns identifiers and scope checks, never answer-key values:

```sql
SELECT m.id AS question_message_id,
       m.room_id AS question_room_id,
       m.assessment_checklist_id,
       m.assessment_item_id,
       m.parent_message_id,
       sc.student_id AS checklist_student_id,
       sc.room_id AS checklist_room_id,
       sc.progress_policy_version,
       ci.id IS NOT NULL AS item_belongs_to_checklist,
       parent.room_id AS parent_room_id,
       parent.user_id AS parent_student_id,
       parent.user_role AS parent_role,
       parent.room_id = m.room_id AS parent_room_matches,
       parent.user_id = sc.student_id AS parent_learner_matches
FROM public.messages m
LEFT JOIN public.session_checklists sc ON sc.id = m.assessment_checklist_id
LEFT JOIN public.checklist_items ci
  ON ci.checklist_id = sc.id AND ci.id = m.assessment_item_id
LEFT JOIN public.messages parent ON parent.id = m.parent_message_id
WHERE m.assessment_key IS NOT NULL
ORDER BY m.id;
```

Stop if the query fails because the hosted schema differs, `uncovered_rows > 0`, or a verified restorable pre-migration backup/PITR point is absent. The migration also raises `LEGACY_TRANSFER_KEY_SCOPE_UNCOVERED` before copying any key when its own coverage check finds such a row. It copies eligible keys into `private.transfer_assessments` and then drops `public.messages.assessment_key`; a reverse migration cannot recover dropped keys. First rehearse migration and SQL behavioral tests on a disposable restored clone, confirm the legacy-incomplete private row count and key values against the preflight inventory, and retain the restore point before any user-authorized target run.

1. Apply `20260922000000_transfer_assessment_server_authority.sql` to the approved disposable restored copy after the stop conditions pass.
2. Run `supabase/tests/transfer_assessment_backend.sql` for schema, privacy, grants, direct writes, public key removal, legacy-incomplete reconciliation, and rollback.
3. Run `supabase/tests/transfer_assessment_rpc_behaviour.sql` for delivery retry, first wrong, pass on attempt 1/2, second wrong, duplicate answer/request, stale submissions, third submission, wrong scope, Guard behavior, evidence/history, and rollback. It writes test fixtures inside a transaction; do not run it on PhishingTutor. Separate scripts below cover actual two-session races and eight injected write failures.
4. Run `supabase/tests/transfer_assessment_catalog_contract.sql` and compare local RPC identities and private columns with `contracts/rpc-contract.md` and `src/types/database.ts`. Record missing generated private types for the hosted integration gate.

Invoke each SQL script with `psql -X -v ON_ERROR_STOP=1 "$DISPOSABLE_DATABASE_URL" -f <script>` so a raised assertion stops the run with a nonzero exit. Also run the two-session race, direct-role, delivery-race, and eight-stage terminal-fault scripts below. Record exact commands, timestamp, tested migration/SHA, exit code, test count, and available transcript paths. Native SQL checks close the component database gate only; deployed Supabase and generated-type checks remain separate.

For valid legacy-key reconciliation, use a separate disposable pre-migration restore with no keyed rows. Run `supabase/tests/transfer_assessment_legacy_fixture_before.sql`, apply the same forward migration, then run `supabase/tests/transfer_assessment_legacy_fixture_after.sql`, all with the `psql` flags above. The first script commits one synthetic keyed question with matching room, checklist learner, item, and parent student message; the second asserts a private `legacy_incomplete` row and removal of the public key column. Do not run this fixture on the source project or the cleaned rehearsal clone. Record its restore identity, migration blob, script blobs, exit codes, and rollback/cleanup separately.

### Two-Session Race Lane

Use two independent `psql` connections to the same disposable restored scope. Create an isolated room, learner, transfer checklist/item, and delivered assessment through the versioned RPCs; post two distinct wrong answer messages and retain the assessment, answer, learner, and request UUIDs. Do not reuse the rollback-only fixtures in `transfer_assessment_rpc_behaviour.sql`.

The reproducible SQL lane seeds three separate rooms with `supabase/tests/transfer_assessment_race_setup.sql` on a disposable migrated clone. For each `scenario` value, `wrong_wrong`, `correct_wrong`, then `wrong_correct`, run `transfer_assessment_race_a.sql` in interactive session A using `psql -X -v ON_ERROR_STOP=1 -v scenario=wrong_wrong "$DISPOSABLE_DATABASE_URL" -f <script>`. It pauses at `\prompt` with its transaction open. Start `transfer_assessment_race_b.sql` with the same `-v scenario` in session B. From a third connection, run `transfer_assessment_race_observer.sql` and require its Lock assertion to pass before pressing Enter in A. Once both sessions exit 0, run `transfer_assessment_race_assert.sql` with the same scenario. In `wrong_correct`, B retries its stale correct answer at expected count 1. The A/B scripts check the first outcome and B's `CONCURRENT_MODIFICATION`; the final script checks actual attempts, events, evidence, history, and item state. Run `transfer_assessment_direct_roles.sql` on the same disposable clone for anon/authenticated v2 RPC, legacy v1 RPC, private table, and progress zero-mutation checks. Dispose of the clone after recording evidence; these persistent race fixtures are not part of the rollback-only SQL suite.

For delivery concurrency, run `transfer_assessment_delivery_setup.sql` on a separate disposable migrated clone. It asserts target mismatch and invalid explanation create no pair. Run `transfer_assessment_delivery_a.sql` in interactive session A, then `transfer_assessment_delivery_b.sql` in session B; use `transfer_assessment_race_observer.sql` in a third connection to confirm B waits on a lock before releasing A. Run `transfer_assessment_delivery_assert.sql` after both exit. The losing request must leave zero public/private rows. Run `transfer_assessment_catalog_contract.sql` on a migrated clone to list local RPC signatures and private columns; this local check does not replace hosted generated types.

1. Connection A: `BEGIN;` then call `process_assessment_message_v2` for wrong answer A with expected count `0`, resolution `open`, outcome `retry`, `ARRAY['A']`, the unchanged progress snapshot, and NULL transition. Keep the transaction open after its attempt-one result.
2. Connection B: call the same RPC for wrong answer B with expected count `0`, resolution `open`, outcome `retry` and a distinct request UUID. It must wait on A's row lock. Commit A; B must return `CONCURRENT_MODIFICATION` and leave exactly one attempt, zero learning events, and lifecycle `open`.
3. In B, reread the processing context and call the RPC for answer B with expected count `1`, resolution `open`, outcome `failed`, `ARRAY['A']`, the component-101 failure progress, and `assessment_fail`. Verify two distinct attempt rows, lifecycle `failed`, exactly one terminal learning event, and feedback only in the committed terminal response.
4. Repeat with a fresh assessment and one correct plus one wrong posted answer. Let the correct call hold A's transaction open; B must return `CONCURRENT_MODIFICATION` after A commits, and retry must see the terminal pass without allocating an attempt. Reverse commit order on another fresh assessment: wrong first produces attempt one, then the correct retry passes on attempt two. Compare actual progress/history and event counts before and after each run.

Capture both connection transcripts and the final row-count query with the tested migration SHA. A single sequential call that passes a stale expected count checks CAS behavior but does not prove the two-session race.

Run `supabase/tests/transfer_assessment_terminal_faults.sql` with `psql -X -v ON_ERROR_STOP=1` on a disposable migrated clone for eight write-stage failure injections. It creates and removes test triggers inside one transaction, asserts zero partial effects after every injected failure, verifies a normal terminal pass after trigger removal, and ends `ROLLBACK`. Record its script blob, eight results, normal recovery, exit code, and absence of fixture rows/triggers afterward.

## External Authorization and Provider Evidence

1. Exercise absent verifier, invalid proof, forged body IDs, valid teacher, target learner, other learner, observer, cross-room, direct RPC, and legacy operation cases.
2. Capture the provider request using a controlled fake endpoint and assert exact configured URL/model, `max_tokens=1200`, canonical v3 request serialization, required explanation instruction, and absence of grading labels/keys.
3. Exercise missing model, missing key/base URL, malformed JSON, invalid explanation, one repaired response, second invalid response, truncation, HTTP error, and network error.
4. Scan response DTOs, public/realtime rows, logs, exports, source imports, and browser build assets for credentials, key, explanation, transfer basis, rationale, and raw provider output. Permit key/explanation only in the authorized terminal second-failure response fixture.

## Documentation and Handoff

Before commit, review and update `tutor-system/README.md`, `claude_docs/database-schema.md`, `claude_docs/supabase-service.md`, and `claude_docs/ai-behaviors/tutor-response-contract.md` where behavior changed. Add `claude_docs/doc_update_record/documentation_update_record_v2026_09_22_transfer_backend.md` with date, change, commands, results, and implementation commit reference. The integration owner separately records 101->102, 102->103, and 102->104 handoff evidence.

## Blocked Evidence

If hosted access, verifier wiring, provider configuration, or any command is absent/failing, record the lane as blocked/failed. Do not enable the feature, substitute a mock for hosted acceptance, switch models, or restore browser grading.
