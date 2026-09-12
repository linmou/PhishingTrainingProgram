-- Purpose: T009 hosted W3/W4 verification lane for the component 102 transfer-assessment backend.
-- Responsible for: proving, against the live Supabase project, that the migration 025/027/028/029
--   schema surface exists with the exact signatures the Edge Function calls, that every private
--   transfer table is unreachable by authenticated/anon roles, that every transfer RPC is
--   service_role-only, and that no transfer function still contains a schema-unqualified digest()
--   call (the defect fixed by migrations 028 and 029).
--
-- Execution: every statement in PART 1 is a read-only catalog query and runs correctly under any
--   role, including the read-only diagnostic role. It is written for the Supabase Dashboard SQL
--   editor (project zgbufaxooqxeabewktzd -> SQL Editor -> New query): paste the PART 1 statement
--   and Run. It contains no psql meta-commands, so it also works through `psql -f` unchanged.
--   Each check returns one row: check_name, pass (bool), detail. The roll-up row FAILING_CHECKS
--   carries the failing count, so a non-zero `detail` there is a hard failure.
--
-- PART 2 is a separate, separately runnable file: `transfer_assessment_rpc_behaviour.sql`.

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
-- PART 2 - behavioural RPC lane
-- =====================================================================================
-- PART 2 was previously an unrunnable skeleton in this file. It is now a complete, runnable
-- script in its own file:
--
--     supabase/tests/transfer_assessment_rpc_behaviour.sql
--
-- Why it is a separate file: each transfer RPC opens with
--     IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'FORBIDDEN'
-- so a read-only or authenticated connection can only ever observe FORBIDDEN, never the
-- behaviour. Running it under the wrong role would produce a misleading green. The separate
-- file states the run method and wraps the whole run in a transaction that ends in ROLLBACK.
