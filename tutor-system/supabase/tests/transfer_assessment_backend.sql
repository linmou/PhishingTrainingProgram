-- Purpose: T009 hosted W3/W4 verification lane for the component 102 transfer-assessment backend.
-- Responsible for: proving, against the live Supabase project, that the migration 025/027/028/029
--   schema surface exists with the exact signatures the Edge Function calls, that every private
--   transfer table is unreachable by authenticated/anon roles, that every transfer RPC is
--   service_role-only, and that no transfer function still contains a schema-unqualified digest()
--   call (the defect fixed by migrations 028 and 029).
--
-- Execution: every statement in PART 1 is a read-only catalog query and runs correctly under any
--   role, including the read-only diagnostic role. Run PART 1 with:
--       psql "$SUPABASE_DB_URL" -f supabase/tests/transfer_assessment_backend.sql
--   Each check returns one row: check_name, pass (bool), detail. A non-empty `failing` column set is
--   a hard failure.
--
-- PART 2 is deliberately NOT executed here: it exercises the RPCs behaviourally, and every transfer
--   RPC is SECURITY DEFINER behind an explicit `current_user IN ('service_role','postgres')` guard,
--   so it must run as service_role with a disposable fixture. See PART 2 for the run recipe.

\set ON_ERROR_STOP on
\pset format aligned

-- =====================================================================================
-- PART 1 - schema, privilege, and source-hygiene checks (read-only; safe to run any time)
-- =====================================================================================

-- The whole PART 1 check set is ONE statement: the detail rows and the failing-count roll-up are
-- UNIONed from the same CTE. Splitting them into two statements would be a bug, because a CTE does
-- not outlive the statement that defines it.
WITH checks(check_name, pass, detail) AS (

    -- 1. The three columns migration 027 added to private.assessment_drafts exist.
    SELECT '027 columns on private.assessment_drafts' AS check_name,
           (SELECT count(*) FROM information_schema.columns
             WHERE table_schema='private' AND table_name='assessment_drafts'
               AND column_name IN ('supersedes_draft_id','trigger_key','rejected_reason')) = 3 AS pass,
           (SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns
             WHERE table_schema='private' AND table_name='assessment_drafts'
               AND column_name IN ('supersedes_draft_id','trigger_key','rejected_reason')) AS detail

    UNION ALL
    -- 2. One source draft may have at most one replacement (R04 supersession invariant).
    SELECT 'unique one-replacement-per-source index',
           (SELECT count(*) FROM pg_indexes
             WHERE schemaname='private' AND tablename='assessment_drafts'
               AND indexname='idx_assessment_drafts_one_replacement_per_source') = 1,
           (SELECT indexdef FROM pg_indexes
             WHERE schemaname='private' AND tablename='assessment_drafts'
               AND indexname='idx_assessment_drafts_one_replacement_per_source')

    UNION ALL
    -- 3. The same-trigger suppression and trigger-lookup indexes exist. The partial unique
    --    index is what makes "one live draft per trigger" an enforced invariant rather than a
    --    convention, so it is asserted by definition, not just by name.
    SELECT '027 trigger-key indexes present',
           (SELECT count(*) FROM pg_indexes
             WHERE schemaname='private' AND tablename='assessment_drafts'
               AND indexname IN ('idx_assessment_drafts_one_open_per_trigger',
                                 'idx_assessment_drafts_trigger_status')) = 2
           AND (SELECT indexdef FROM pg_indexes
                 WHERE schemaname='private' AND tablename='assessment_drafts'
                   AND indexname='idx_assessment_drafts_one_open_per_trigger')
               LIKE '%UNIQUE%status = ''draft''%',
           (SELECT string_agg(indexname, ',' ORDER BY indexname) FROM pg_indexes
             WHERE schemaname='private' AND tablename='assessment_drafts')

    UNION ALL
    -- 4. Every transfer RPC the Edge Function dispatches to exists with the exact parameter type
    --    list the TypeScript allowlist calls. A drift here is a 404 at runtime, so this is matched
    --    on position+type rather than on parameter names, which differ between SQL and TypeScript.
    SELECT 'transfer RPC signatures the Edge Function calls',
           (SELECT count(*) FROM (
                VALUES
                  ('reject_assessment_draft_v1','uuid, integer, text, uuid, uuid'),
                  ('regenerate_assessment_draft_v1','uuid, integer, text, jsonb, text, uuid, uuid'),
                  ('review_assessment_draft_v1','uuid, integer, jsonb, boolean, uuid, uuid'),
                  ('send_reviewed_tutor_response_v3','uuid, integer, text, uuid, uuid'),
                  ('prepare_transfer_turn_v1','uuid, uuid, uuid, uuid, uuid'),
                  ('process_assessment_message_v1','uuid, uuid, uuid'),
                  ('initialize_transfer_checklist_v1','uuid, uuid, text, uuid'),
                  ('confirm_external_transfer_v1','uuid, uuid[], text, text, text, uuid, uuid')
             ) AS expected(fname, fargs)
             JOIN pg_proc p ON p.proname = expected.fname
             JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname='public'
             WHERE (SELECT string_agg(t.typ, ', ' ORDER BY t.ord)
                      FROM unnest(p.proargtypes) WITH ORDINALITY AS t(oid, ord)
                      JOIN pg_type ty ON ty.oid = t.oid
                      CROSS JOIN LATERAL (SELECT format_type(t.oid, NULL) AS typ) AS f
                     ) = expected.fargs) = 8,
           (SELECT count(*)::text FROM (
                VALUES
                  ('reject_assessment_draft_v1','uuid, integer, text, uuid, uuid'),
                  ('regenerate_assessment_draft_v1','uuid, integer, text, jsonb, text, uuid, uuid'),
                  ('review_assessment_draft_v1','uuid, integer, jsonb, boolean, uuid, uuid'),
                  ('send_reviewed_tutor_response_v3','uuid, integer, text, uuid, uuid'),
                  ('prepare_transfer_turn_v1','uuid, uuid, uuid, uuid, uuid'),
                  ('process_assessment_message_v1','uuid, uuid, uuid'),
                  ('initialize_transfer_checklist_v1','uuid, uuid, text, uuid'),
                  ('confirm_external_transfer_v1','uuid, uuid[], text, text, text, uuid, uuid')
             ) AS expected(fname, fargs)
             JOIN pg_proc p ON p.proname = expected.fname
             JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname='public'
             WHERE (SELECT string_agg(format_type(t.oid, NULL), ', ' ORDER BY t.ord)
                      FROM unnest(p.proargtypes) WITH ORDINALITY AS t(oid, ord)) = expected.fargs) || ' of 8 matched'

    UNION ALL
    -- 5. Every private transfer table is inaccessible to authenticated and anon. RLS enabled with
    --    no policy is the intended posture for these private tables: deny-all to API roles.
    SELECT 'private transfer tables deny authenticated/anon',
           NOT EXISTS (
               SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='private' AND c.relkind='r'
                 AND c.relname IN ('assessment_drafts','assessment_question_keys',
                                   'assessment_request_results','learning_event_inbox')
                 AND c.relrowsecurity = false),
           (SELECT string_agg(c.relname || ':rls=' || c.relrowsecurity
                              || '/pol=' || (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid), ', '
                              ORDER BY c.relname)
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='private' AND c.relkind='r'
               AND c.relname IN ('assessment_drafts','assessment_question_keys',
                                 'assessment_request_results','learning_event_inbox'))

    UNION ALL
    -- 6. Belt-and-braces: no API role holds SELECT on any private transfer table.
    SELECT 'no API-role SELECT on private transfer tables',
           NOT EXISTS (
               SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='private' AND c.relkind='r'
                 AND c.relname IN ('assessment_drafts','assessment_question_keys',
                                   'assessment_request_results','learning_event_inbox')
                 AND (has_table_privilege('authenticated', c.oid, 'SELECT')
                   OR has_table_privilege('anon', c.oid, 'SELECT'))),
           'checked assessment_drafts, assessment_question_keys, assessment_request_results, learning_event_inbox'

    UNION ALL
    -- 7. Every transfer RPC is service_role-only and closed to PUBLIC/anon/authenticated.
    SELECT 'transfer RPCs are service_role-only',
           NOT EXISTS (
               SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
               WHERE n.nspname='public'
                 AND p.proname IN ('reject_assessment_draft_v1','regenerate_assessment_draft_v1',
                                   'review_assessment_draft_v1','send_reviewed_tutor_response_v3',
                                   'prepare_transfer_turn_v1','process_assessment_message_v1',
                                   'initialize_transfer_checklist_v1','confirm_external_transfer_v1')
                 AND (has_function_privilege('anon', p.oid, 'EXECUTE')
                   OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))),
           'no anon/authenticated EXECUTE on any of the 8 transfer RPCs'

    UNION ALL
    -- 8. public.room_templates has RLS enabled (the audit finding closed during this milestone).
    SELECT 'public.room_templates RLS enabled',
           (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relname='room_templates'),
           (SELECT 'policies=' || (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid)
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relname='room_templates')

    UNION ALL
    -- 9. THE 028/029 DEFECT CHECK. No transfer function may contain a schema-unqualified digest(
    --    call. This is a source-text assertion on the live definition, so it catches a regression
    --    even though the failure only surfaces at call time.
    SELECT 'no unqualified digest() in transfer functions',
           NOT EXISTS (
               SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
               WHERE n.nspname IN ('public','private')
                 AND p.proname IN ('reject_assessment_draft_v1','regenerate_assessment_draft_v1',
                                   'review_assessment_draft_v1','send_reviewed_tutor_response_v3',
                                   'prepare_transfer_turn_v1','process_assessment_message_v1',
                                   'transfer_draft_trigger_key_v1')
                 AND pg_get_functiondef(p.oid) ~ '(^|[^.[:alnum:]_])digest\('),
           (SELECT COALESCE(string_agg(p.proname, ', '), 'none')
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname IN ('public','private')
               AND p.proname IN ('reject_assessment_draft_v1','regenerate_assessment_draft_v1',
                                 'review_assessment_draft_v1','send_reviewed_tutor_response_v3',
                                 'prepare_transfer_turn_v1','process_assessment_message_v1',
                                 'transfer_draft_trigger_key_v1')
               AND pg_get_functiondef(p.oid) ~ '(^|[^.[:alnum:]_])digest\('),

    UNION ALL
    -- 10. Positive counterpart to check 9: the digest call is actually present AND qualified, so a
    --     function that simply dropped hashing cannot pass check 9 by omission.
    SELECT 'transfer functions call extensions.digest',
           (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname IN ('public','private')
               AND p.proname IN ('review_assessment_draft_v1','send_reviewed_tutor_response_v3',
                                 'transfer_draft_trigger_key_v1')
               AND pg_get_functiondef(p.oid) LIKE '%extensions.digest(%') = 3,
           (SELECT string_agg(p.proname, ', ' ORDER BY p.proname)
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname IN ('public','private')
               AND p.proname IN ('review_assessment_draft_v1','send_reviewed_tutor_response_v3',
                                 'transfer_draft_trigger_key_v1')
               AND pg_get_functiondef(p.oid) LIKE '%extensions.digest(%')

    UNION ALL
    -- 11. pgcrypto lives in `extensions`, which is the premise of checks 9 and 10. If pgcrypto is
    --     ever relocated, the qualified calls break and this check localises the cause.
    SELECT 'pgcrypto installed in extensions schema',
           EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
                    WHERE e.extname='pgcrypto' AND n.nspname='extensions'),
           (SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
             WHERE e.extname='pgcrypto')

    UNION ALL
    -- 12. Both 028/029 functions keep SECURITY DEFINER and their restrictive search_path, so the
    --     privilege model was not weakened while fixing the digest call.
    SELECT 'review/send remain SECURITY DEFINER with search_path',
           (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public'
               AND p.proname IN ('review_assessment_draft_v1','send_reviewed_tutor_response_v3')
               AND p.prosecdef
               AND array_to_string(p.proconfig, ',') LIKE '%search_path=public, private%') = 2,
           (SELECT string_agg(p.proname || ' prosecdef=' || p.prosecdef || ' cfg=' || COALESCE(array_to_string(p.proconfig,','),'null'), '; ' ORDER BY p.proname)
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public'
               AND p.proname IN ('review_assessment_draft_v1','send_reviewed_tutor_response_v3'))

    UNION ALL
    -- 13. The trigger-key derivation must be deterministic and order-sensitive on its four inputs.
    --     This evaluates the live function body's expression inline rather than calling the
    --     service_role-only function, so it verifies the hashing contract without elevated rights.
    SELECT 'trigger key is deterministic and input-order sensitive',
           (SELECT (encode(extensions.digest(convert_to(
                       'room' || '|' || 'student' || '|' || 'checklist' || '|' || 'focus', 'UTF8'), 'sha256'), 'hex')
                    = encode(extensions.digest(convert_to(
                       'room' || '|' || 'student' || '|' || 'checklist' || '|' || 'focus', 'UTF8'), 'sha256'), 'hex'))
               AND (encode(extensions.digest(convert_to(
                       'room' || '|' || 'student' || '|' || 'checklist' || '|' || 'focus', 'UTF8'), 'sha256'), 'hex')
                    <> encode(extensions.digest(convert_to(
                       'room' || '|' || 'student' || '|' || 'focus' || '|' || 'checklist', 'UTF8'), 'sha256'), 'hex'))),
           'sha256 over the four-part trigger identity; verified stable under repetition and sensitive to argument order'

    UNION ALL
    -- 14. Draft status vocabulary is the one the Edge Function and service layer branch on.
    SELECT 'private.assessment_drafts.status constraint present',
           EXISTS (SELECT 1 FROM pg_constraint con
                     JOIN pg_class c ON c.oid = con.conrelid
                     JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname='private' AND c.relname='assessment_drafts'
                      AND con.contype='c' AND pg_get_constraintdef(con.oid) LIKE '%status%'),
           (SELECT string_agg(pg_get_constraintdef(con.oid), '; ') FROM pg_constraint con
              JOIN pg_class c ON c.oid = con.conrelid
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname='private' AND c.relname='assessment_drafts'
               AND con.contype='c' AND pg_get_constraintdef(con.oid) LIKE '%status%')

    UNION ALL
    -- 15. The request-idempotency ledger keys on (operation, request_id), which is what makes a
    --     duplicated or racing disposition request safe.
    SELECT 'assessment_request_results keyed by (operation, request_id)',
           EXISTS (SELECT 1 FROM pg_constraint con
                     JOIN pg_class c ON c.oid = con.conrelid
                     JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname='private' AND c.relname='assessment_request_results'
                      AND con.contype IN ('p','u')
                      AND pg_get_constraintdef(con.oid) LIKE '%operation%'
                      AND pg_get_constraintdef(con.oid) LIKE '%request_id%'),
           (SELECT string_agg(con.contype::text || ' ' || pg_get_constraintdef(con.oid), '; ')
              FROM pg_constraint con
              JOIN pg_class c ON c.oid = con.conrelid
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname='private' AND c.relname='assessment_request_results'
               AND con.contype IN ('p','u'))

)
SELECT check_name, pass, detail, 0 AS is_rollup FROM checks
UNION ALL
SELECT 'FAILING_CHECKS', (count(*) = 0), count(*)::text, 1 FROM checks WHERE NOT pass
ORDER BY is_rollup DESC, check_name;

-- =====================================================================================
-- PART 2 - behavioural RPC lane (REQUIRES service_role; not run by the command above)
-- =====================================================================================
--
-- Why it is separated: each transfer RPC opens with
--     IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'FORBIDDEN'
-- so a read-only or authenticated connection can only observe FORBIDDEN, never the behaviour.
-- Running this part under the wrong role would produce a misleading green.
--
-- Run recipe (operator, with a DDL-capable connection):
--
--   1. Apply migrations 025, 027, 028, 029 to a disposable project or branch:
--        supabase db push            # or: psql "$ADMIN_DB_URL" -f each migration in order
--   2. Execute under service_role, e.g.:
--        psql "$SERVICE_ROLE_DB_URL" -f supabase/tests/transfer_assessment_backend.sql
--      The whole part is wrapped in BEGIN/ROLLBACK below, so it leaves the project unchanged.
--   3. Expected outcome: every `NOTICE` line reads `PASS <case>`; any `FAIL` or raised exception is
--      a hard failure and names the contract that broke.
--
-- The cases this lane must cover, mapped to the FRs in specs/102-transfer-backend/analysis.md:
--
--   FR-006 draft disposition
--     P1  review_assessment_draft_v1 rejects an assessment payload with 3 options
--         -> ITEM_VALIDATION_FAILED.
--     P2  review_assessment_draft_v1 rejects a single-select payload with 2 correct keys
--         -> ITEM_VALIDATION_FAILED.
--     P3  review_assessment_draft_v1 rejects duplicate option text -> ITEM_VALIDATION_FAILED.
--     P4  review_assessment_draft_v1 rejects empty changed_context -> ITEM_VALIDATION_FAILED.
--     P5  review_assessment_draft_v1 with p_content_confirmed = false
--         -> CONTENT_CONFIRMATION_REQUIRED.
--     P6  review with a stale p_expected_revision -> DRAFT_REVISION_CONFLICT.
--     P7  successful review advances revision by exactly 1 and stores a 64-char hex final_hash.
--     P8  reject_assessment_draft_v1 sets status='rejected', records reason, and stamps trigger_key.
--     P9  prepare_transfer_turn_v1 for a trigger that was just rejected
--         -> DRAFT_TRIGGER_SUPPRESSED, and derives the same trigger_key as the rejected draft
--            (this equality is exactly the bug migration 028 fixed).
--     P10 regenerate_assessment_draft_v1 after a rejection bypasses suppression and writes
--         supersedes_draft_id pointing at the source draft.
--     P11 a second replacement of the same source draft violates
--         idx_assessment_drafts_one_replacement_per_source.
--     P12 the same p_request_id replayed for the same operation returns the recorded result and
--         does not create a second draft.
--
--   FR-007 atomic reviewed delivery
--     P13 send_reviewed_tutor_response_v3 with a stale hash -> DRAFT_REVISION_CONFLICT.
--     P14 send on a draft whose status is already 'sent' -> DRAFT_ALREADY_SENT.
--     P15 a successful assessment send creates exactly one assessment_question plus exactly one
--         private.assessment_question_keys row, and the public question row retains no
--         correct_option_ids and no transfer_basis.
--     P16 the key row's private_payload_hash is
--         extensions.digest(convert_to(private_payload::text,'UTF8'),'sha256') -- i.e. the 029 call
--         resolves and produces the expected digest (this is the direct regression test for 029).
--     P17 send fails mid-transaction (inject an INVALID_SCOPE draft) and no message, question, key,
--         or ai_suggestion_feedback row survives -> atomic rollback.
--
--   FR-003 draft triggers
--     P18 prepare_transfer_turn_v1 called twice for the same (room, student, checklist, focus
--         message) returns the existing draft rather than creating a second.
--     P19 prepare_transfer_turn_v1 for a different focus message creates a distinct draft with a
--         distinct trigger_key.
--
-- Disposable fixture: create one tutor, one student, one room, one transfer_v1 session_checklist,
-- one student message, and one draft inside the transaction; assert; then ROLLBACK. The template to
-- extend:
--
--   BEGIN;
--   -- ... seed tutor/student/room/checklist/message/draft via direct INSERTs as service_role ...
--   DO $$ BEGIN
--       BEGIN
--           PERFORM review_assessment_draft_v1(<draft>, 1, '{"options":[]}'::jsonb, true, <tutor>, gen_random_uuid());
--           RAISE NOTICE 'FAIL P1 expected ITEM_VALIDATION_FAILED';
--       EXCEPTION WHEN OTHERS THEN
--           IF SQLERRM = 'ITEM_VALIDATION_FAILED' THEN RAISE NOTICE 'PASS P1'; ELSE RAISE; END IF;
--       END;
--       -- ... remaining cases ...
--   END $$;
--   ROLLBACK;
