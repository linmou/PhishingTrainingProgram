-- Purpose: T009 hosted W3/W4 verification lane for the component 102 transfer-assessment backend.
-- Responsible for: proving, against the live Supabase project, that the reconciled lean schema
--   exists with the exact RPC signatures the Edge Function calls, that the removed objects stay
--   removed, that no kept function still references a dropped object, that every private transfer
--   table is unreachable by authenticated/anon roles, that every live transfer RPC is
--   service_role-only, and that no transfer function contains an unqualified digest() call.
--
-- Execution: every statement here is a read-only catalog query and runs correctly under any role,
--   including the read-only diagnostic role. It is written for the Supabase Dashboard SQL editor
--   (project zgbufaxooqxeabewktzd -> SQL Editor -> New query): paste the statement and Run. It
--   contains no psql meta-commands, so it also works through `psql -f` unchanged. Each check
--   returns one row: check_name, pass (bool), detail. The roll-up row FAILING_CHECKS carries the
--   failing count, so a non-zero `detail` there is a hard failure.
--
-- The behavioural lane is a separate, separately runnable file:
--   `transfer_assessment_rpc_behaviour.sql`.

-- =====================================================================================
-- PART 1 - schema, privilege, and source-hygiene checks (read-only; safe to run any time)
-- =====================================================================================

-- The whole check set is ONE statement: the detail rows and the failing-count roll-up are UNIONed
-- from the same CTE. Splitting them into two statements would be a bug, because a CTE does not
-- outlive the statement that defines it.
WITH checks(check_name, pass, detail) AS (

    -- 1. The five tables the lean design keeps are present.
    SELECT 'lean transfer tables present',
           (SELECT count(*) FROM information_schema.tables
             WHERE table_schema='private'
               AND table_name IN ('assessment_drafts','assessment_question_keys',
                                  'learning_event_inbox','assessment_request_results')
               AND table_type='BASE TABLE') = 4
           AND (SELECT count(*) FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='assessment_questions'
                   AND table_type='BASE TABLE') = 1,
           (SELECT string_agg(table_schema || '.' || table_name, ', ' ORDER BY table_schema, table_name)
              FROM information_schema.tables
             WHERE (table_schema='private' AND table_name IN ('assessment_drafts','assessment_question_keys',
                                                              'learning_event_inbox','assessment_request_results'))
                OR (table_schema='public' AND table_name='assessment_questions'))

    UNION ALL
    -- 2. The request-idempotency ledger must exist. It is not an assessment artefact: it records
    --    (operation, request_id) -> response for every request-bearing RPC, and post_message and
    --    process_message read it as their first database access.
    SELECT 'request idempotency ledger present and keyed correctly',
           EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema='private' AND table_name='assessment_request_results')
           AND EXISTS (SELECT 1 FROM pg_constraint con
                        JOIN pg_class c ON c.oid=con.conrelid
                        JOIN pg_namespace n ON n.oid=c.relnamespace
                       WHERE n.nspname='private' AND c.relname='assessment_request_results'
                         AND con.contype='p'
                         AND pg_get_constraintdef(con.oid) LIKE '%operation%'
                         AND pg_get_constraintdef(con.oid) LIKE '%request_id%'),
           'momentarily dropped by 032, restored by 034'

    UNION ALL
    -- 3. The lean draft columns. Neither the trigger/supersession columns nor the two hashes remain.
    SELECT 'draft columns are the lean set',
           (SELECT count(*) FROM information_schema.columns
             WHERE table_schema='private' AND table_name='assessment_drafts'
               AND column_name IN ('trigger_key','supersedes_draft_id','rejected_reason','raw_hash','final_hash')) = 0
           AND (SELECT count(*) FROM information_schema.columns
                 WHERE table_schema='private' AND table_name='assessment_drafts') = 15,
           (SELECT 'dropped_still_present=' || count(*)::text FROM information_schema.columns
             WHERE table_schema='private' AND table_name='assessment_drafts'
               AND column_name IN ('trigger_key','supersedes_draft_id','rejected_reason','raw_hash','final_hash'))

    UNION ALL
    -- 4. The write-only hash columns are gone from the question and key tables.
    SELECT 'payload hash columns are gone',
           (SELECT count(*) FROM information_schema.columns
             WHERE table_schema='public' AND table_name='assessment_questions'
               AND column_name='public_payload_hash') = 0
           AND (SELECT count(*) FROM information_schema.columns
                 WHERE table_schema='private' AND table_name='assessment_question_keys'
                   AND column_name='private_payload_hash') = 0,
           'public_payload_hash and private_payload_hash were written and never read'

    UNION ALL
    -- 5. The unreferenced ordering column is gone.
    SELECT 'learning_event_inbox.effective_order is gone',
           NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema='private' AND table_name='learning_event_inbox'
                          AND column_name='effective_order'),
           'effective_order appeared in no function, query, or document'

    UNION ALL
    -- 6. The draft status vocabulary is the three reachable states.
    SELECT 'draft status constraint is the lean vocabulary',
           (SELECT pg_get_constraintdef(con.oid) FROM pg_constraint con
              JOIN pg_class c ON c.oid=con.conrelid
              JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='private' AND c.relname='assessment_drafts'
               AND con.conname='assessment_drafts_status_check') LIKE '%draft%'
           AND (SELECT pg_get_constraintdef(con.oid) FROM pg_constraint con
                  JOIN pg_class c ON c.oid=con.conrelid
                  JOIN pg_namespace n ON n.oid=c.relnamespace
                 WHERE n.nspname='private' AND c.relname='assessment_drafts'
                   AND con.conname='assessment_drafts_status_check') NOT LIKE '%rejected%',
           (SELECT pg_get_constraintdef(con.oid) FROM pg_constraint con
              JOIN pg_class c ON c.oid=con.conrelid
              JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='private' AND c.relname='assessment_drafts'
               AND con.conname='assessment_drafts_status_check')

    UNION ALL
    -- 7. The seven operations the Edge Function calls exist with the exact parameter type lists.
    --    send_reviewed is asserted at four arguments: the lean schema removed its expected-hash
    --    argument.
    SELECT 'live RPC signatures match the Edge Function',
           (SELECT count(*) FROM (
                VALUES
                  ('initialize_transfer_checklist_v1','uuid, uuid, text, uuid'),
                  ('post_assessment_message_v1','uuid, text, uuid, uuid, uuid, uuid'),
                  ('prepare_transfer_turn_v1','uuid, uuid, uuid, uuid, uuid'),
                  ('review_assessment_draft_v1','uuid, integer, jsonb, boolean, uuid, uuid'),
                  ('send_reviewed_tutor_response_v3','uuid, integer, uuid, uuid'),
                  ('process_assessment_message_v1','uuid, uuid, uuid'),
                  ('apply_learning_event_v1','jsonb')
             ) AS expected(fname, fargs)
             JOIN pg_proc p ON p.proname = expected.fname
             JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname='public'
             WHERE (SELECT string_agg(format_type(t.oid, NULL), ', ' ORDER BY t.ord)
                      FROM unnest(p.proargtypes) WITH ORDINALITY AS t(oid, ord)) = expected.fargs) = 7,
           (SELECT count(*)::text || ' of 7 matched' FROM (
                VALUES
                  ('initialize_transfer_checklist_v1','uuid, uuid, text, uuid'),
                  ('post_assessment_message_v1','uuid, text, uuid, uuid, uuid, uuid'),
                  ('prepare_transfer_turn_v1','uuid, uuid, uuid, uuid, uuid'),
                  ('review_assessment_draft_v1','uuid, integer, jsonb, boolean, uuid, uuid'),
                  ('send_reviewed_tutor_response_v3','uuid, integer, uuid, uuid'),
                  ('process_assessment_message_v1','uuid, uuid, uuid'),
                  ('apply_learning_event_v1','jsonb')
             ) AS expected(fname, fargs)
             JOIN pg_proc p ON p.proname = expected.fname
             JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname='public'
             WHERE (SELECT string_agg(format_type(t.oid, NULL), ', ' ORDER BY t.ord)
                      FROM unnest(p.proargtypes) WITH ORDINALITY AS t(oid, ord)) = expected.fargs)

    UNION ALL
    -- 8. The removed operations must stay removed. `confirm_external_transfer_v1` is included
    --    because it belonged to a removed operation and was only dropped by migration 036.
    SELECT 'removed operations are absent',
           (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE p.proname IN ('reject_assessment_draft_v1','regenerate_assessment_draft_v1',
                                 'transfer_draft_trigger_key_v1','confirm_external_transfer_v1')) = 0,
           (SELECT COALESCE(string_agg(p.proname, ', '), 'none') FROM pg_proc p
              JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE p.proname IN ('reject_assessment_draft_v1','regenerate_assessment_draft_v1',
                                 'transfer_draft_trigger_key_v1','confirm_external_transfer_v1'))

    UNION ALL
    -- 9. No kept function may still reference an object that was dropped. plpgsql bodies are not
    --    dependency-tracked, so a dangling reference stays silent until the function is called.
    --    This check is what catches the post/process ledger break and the prepare-turn helper break
    --    without waiting for a runtime failure.
    SELECT 'no kept function references a dropped object',
           NOT EXISTS (
               SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
               WHERE n.nspname IN ('public','private') AND p.prokind='f'
                 AND (pg_get_functiondef(p.oid) ~ 'transfer_draft_trigger_key_v1'
                      OR pg_get_functiondef(p.oid) ~ 'supersedes_draft_id'
                      OR pg_get_functiondef(p.oid) ~ 'rejected_reason'
                      OR pg_get_functiondef(p.oid) ~ '\mtrigger_key\M'
                      OR pg_get_functiondef(p.oid) ~ '\mraw_hash\M'
                      OR pg_get_functiondef(p.oid) ~ 'final_hash'
                      OR pg_get_functiondef(p.oid) ~ 'public_payload_hash'
                      OR pg_get_functiondef(p.oid) ~ 'private_payload_hash')),
           (SELECT COALESCE(string_agg(x.proname, ', '), 'none') FROM (
                SELECT DISTINCT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname IN ('public','private') AND p.prokind='f'
                   AND (pg_get_functiondef(p.oid) ~ 'transfer_draft_trigger_key_v1'
                        OR pg_get_functiondef(p.oid) ~ 'supersedes_draft_id'
                        OR pg_get_functiondef(p.oid) ~ 'rejected_reason'
                        OR pg_get_functiondef(p.oid) ~ '\mtrigger_key\M'
                        OR pg_get_functiondef(p.oid) ~ '\mraw_hash\M'
                        OR pg_get_functiondef(p.oid) ~ 'final_hash'
                        OR pg_get_functiondef(p.oid) ~ 'public_payload_hash'
                        OR pg_get_functiondef(p.oid) ~ 'private_payload_hash')) x)

    UNION ALL
    -- 10. Every private transfer table is inaccessible to authenticated and anon. RLS enabled with
    --     no policy is the intended posture: deny-all to API roles.
    SELECT 'private transfer tables deny authenticated/anon',
           NOT EXISTS (
               SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='private' AND c.relkind='r'
                 AND c.relname IN ('assessment_drafts','assessment_question_keys',
                                   'learning_event_inbox','assessment_request_results')
                 AND c.relrowsecurity = false),
           (SELECT string_agg(c.relname || ':rls=' || c.relrowsecurity, ', ' ORDER BY c.relname)
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='private' AND c.relkind='r'
               AND c.relname IN ('assessment_drafts','assessment_question_keys',
                                 'learning_event_inbox','assessment_request_results'))

    UNION ALL
    -- 11. No API role holds SELECT on any private transfer table.
    SELECT 'no API-role SELECT on private transfer tables',
           NOT EXISTS (
               SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='private' AND c.relkind='r'
                 AND c.relname IN ('assessment_drafts','assessment_question_keys',
                                   'learning_event_inbox','assessment_request_results')
                 AND (has_table_privilege('authenticated', c.oid, 'SELECT')
                   OR has_table_privilege('anon', c.oid, 'SELECT'))),
           'checked all four private transfer tables'

    UNION ALL
    -- 12. Every live transfer RPC is service_role-only and closed to PUBLIC/anon/authenticated.
    SELECT 'transfer RPCs are service_role-only',
           NOT EXISTS (
               SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
               WHERE n.nspname='public'
                 AND p.proname IN ('initialize_transfer_checklist_v1','post_assessment_message_v1',
                                   'prepare_transfer_turn_v1','review_assessment_draft_v1',
                                   'send_reviewed_tutor_response_v3','process_assessment_message_v1',
                                   'apply_learning_event_v1')
                 AND (has_function_privilege('anon', p.oid, 'EXECUTE')
                   OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))),
           'no anon/authenticated EXECUTE on any of the 7 live transfer RPCs'

    UNION ALL
    -- 13. public.room_templates has RLS enabled (the audit finding closed during this milestone).
    SELECT 'public.room_templates RLS enabled',
           (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relname='room_templates'),
           (SELECT 'policies=' || (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid)
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relname='room_templates')

    UNION ALL
    -- 14. THE 028/029 DEFECT CHECK. No kept transfer function may contain a schema-unqualified
    --     digest( call. This is a source-text assertion on the live definition, so it catches a
    --     regression even though the failure only surfaces at call time.
    SELECT 'no unqualified digest() in transfer functions',
           NOT EXISTS (
               SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
               WHERE n.nspname IN ('public','private')
                 AND p.proname IN ('review_assessment_draft_v1','send_reviewed_tutor_response_v3')
                 AND pg_get_functiondef(p.oid) ~ '(^|[^.[:alnum:]_])digest\('),
           (SELECT COALESCE(string_agg(p.proname, ', '), 'none')
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname IN ('public','private')
               AND p.proname IN ('review_assessment_draft_v1','send_reviewed_tutor_response_v3')
               AND pg_get_functiondef(p.oid) ~ '(^|[^.[:alnum:]_])digest\(')

    UNION ALL
    -- 15. pgcrypto lives in `extensions`, which is the premise of check 14.
    SELECT 'pgcrypto installed in extensions schema',
           EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
                    WHERE e.extname='pgcrypto' AND n.nspname='extensions'),
           (SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
             WHERE e.extname='pgcrypto')

    UNION ALL
    -- 16. The review and send functions keep SECURITY DEFINER and their restrictive search_path,
    --     so the privilege model was not weakened by the reconciliation.
    SELECT 'review/send remain SECURITY DEFINER with search_path',
           (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public'
               AND p.proname IN ('review_assessment_draft_v1','send_reviewed_tutor_response_v3')
               AND p.prosecdef
               AND array_to_string(p.proconfig, ',') LIKE '%search_path=public, private%') = 2,
           (SELECT string_agg(p.proname || ' prosecdef=' || p.prosecdef, '; ' ORDER BY p.proname)
              FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public'
               AND p.proname IN ('review_assessment_draft_v1','send_reviewed_tutor_response_v3'))

    UNION ALL
    -- 17. One unresolved question per learner is what makes grading idempotent, so the partial
    --     unique index must exist.
    SELECT 'one unresolved assessment per learner is enforced',
           EXISTS (SELECT 1 FROM pg_indexes
                    WHERE schemaname='public' AND tablename='assessment_questions'
                      AND indexname='one_unresolved_assessment_per_student'
                      AND indexdef LIKE '%delivered%'),
           (SELECT indexdef FROM pg_indexes
             WHERE schemaname='public' AND tablename='assessment_questions'
               AND indexname='one_unresolved_assessment_per_student')

    UNION ALL
    -- 18. The immutable key insert-once guard must survive the reconciliation.
    SELECT 'delivered keys stay immutable',
           EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
                    JOIN pg_namespace n ON n.oid=c.relnamespace
                   WHERE n.nspname='private' AND c.relname='assessment_question_keys'
                     AND t.tgname='assessment_key_is_immutable' AND NOT t.tgisinternal),
           'assessment_key_is_immutable guards UPDATE and DELETE on the private key table'

    UNION ALL
    -- 19. The whole transfer table set holds no rows, which is what made the reconciliation safe.
    SELECT 'transfer tables are empty',
           (SELECT count(*) FROM private.assessment_drafts) = 0
           AND (SELECT count(*) FROM private.assessment_question_keys) = 0
           AND (SELECT count(*) FROM private.learning_event_inbox) = 0
           AND (SELECT count(*) FROM public.assessment_questions) = 0,
           (SELECT format('drafts=%s keys=%s inbox=%s questions=%s',
                          (SELECT count(*) FROM private.assessment_drafts),
                          (SELECT count(*) FROM private.assessment_question_keys),
                          (SELECT count(*) FROM private.learning_event_inbox),
                          (SELECT count(*) FROM public.assessment_questions)))

)
SELECT check_name, pass, detail, 0 AS is_rollup FROM checks
UNION ALL
SELECT 'FAILING_CHECKS', (count(*) = 0), count(*)::text, 1 FROM checks WHERE NOT pass
ORDER BY is_rollup DESC, check_name;

-- =====================================================================================
-- PART 2 - behavioural RPC lane
-- =====================================================================================
-- PART 2 is a complete, runnable script in its own file:
--
--     supabase/tests/transfer_assessment_rpc_behaviour.sql
--
-- Why it is separate: each transfer RPC opens with
--     IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'FORBIDDEN'
-- so a read-only or authenticated connection can only ever observe FORBIDDEN, never the
-- behaviour. Running it under the wrong role would produce a misleading green. The separate
-- file states the run method and wraps the whole run in a transaction that ends in ROLLBACK.
