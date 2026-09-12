-- Purpose: T009 hosted verification lane for the component 102 transfer-assessment backend.
-- Responsible for: proving, against the live Supabase project, that the collapsed one-table
--   storage model is deployed as specified: the assessment lives on the tutor message, the four
--   removed tables are absent, the six live RPCs exist with the exact signatures the Edge Function
--   calls, no kept function body references a dropped object, and every private table is
--   unreachable by API roles.
--
-- Execution: every statement here is read-only catalog queries, so it runs correctly under any
--   role including a read-only diagnostic connection. Paste the whole statement into the Supabase
--   SQL editor (project zgbufaxooqxeabewktzd -> SQL Editor -> New query) and Run. Each check
--   returns one row: check_name, pass, detail. The roll-up row FAILING_CHECKS carries the failing
--   count, so a non-zero `detail` there is a hard failure.
--
-- The behavioural lane, which needs a service_role connection, is the separate file
--   `transfer_assessment_rpc_behaviour.sql`.

WITH checks(check_name, pass, detail) AS (

    -- 1. The one private table the component keeps.
    SELECT 'learning_event_inbox is the only transfer-private table',
           (SELECT count(*) FROM information_schema.tables
             WHERE table_schema='private' AND table_name='learning_event_inbox' AND table_type='BASE TABLE') = 1
           AND (SELECT count(*) FROM information_schema.tables
                 WHERE table_schema='private'
                   AND table_name IN ('assessment_drafts','assessment_question_keys','assessment_request_results')) = 0,
           'learning_event_inbox present; the three other private transfer tables absent'

    UNION ALL
    -- 2. The public question table is gone.
    SELECT 'public.assessment_questions is gone',
           NOT EXISTS (SELECT 1 FROM information_schema.tables
                        WHERE table_schema='public' AND table_name='assessment_questions'),
           'dropped by migration 038'

    UNION ALL
    -- 3. The assessment now lives on the tutor message. assessment_selection_type joined the set in
    -- migration 045 (R15): without it a reloaded learner page cannot render the canonical
    -- single-versus-multiple instruction, because the column was never persisted by 038.
    SELECT 'messages carries the assessment columns',
           (SELECT count(*) FROM information_schema.columns
             WHERE table_schema='public' AND table_name='messages'
               AND column_name IN ('assessment_options','assessment_key','assessment_lifecycle',
                                   'assessment_answer_message_id','assessment_selected_option_ids',
                                   'assessment_result','assessment_closed_at',
                                   'assessment_checklist_id','assessment_item_id',
                                   'assessment_selection_type')) = 10,
           (SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns
             WHERE table_schema='public' AND table_name='messages' AND column_name LIKE 'assessment_%')

    UNION ALL
    -- 3a. The selection type is constrained when present, and writable only as single/multiple.
    -- Absence is legal: a tutoring or Guard turn carries no assessment.
    SELECT 'assessment selection type is constrained',
           EXISTS (SELECT 1 FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
                    JOIN pg_namespace n ON n.oid=c.relnamespace
                   WHERE n.nspname='public' AND c.relname='messages'
                     AND con.conname='messages_assessment_selection_type_check'),
           'null for non-assessment turns; single or multiple for an assessment'

    UNION ALL
    -- 4. The lifecycle and result vocabularies are constrained.
    SELECT 'assessment lifecycle and result are constrained',
           EXISTS (SELECT 1 FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
                    JOIN pg_namespace n ON n.oid=c.relnamespace
                   WHERE n.nspname='public' AND c.relname='messages'
                     AND con.conname='messages_assessment_lifecycle_check')
           AND EXISTS (SELECT 1 FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
                    JOIN pg_namespace n ON n.oid=c.relnamespace
                   WHERE n.nspname='public' AND c.relname='messages'
                     AND con.conname='messages_assessment_result_check'),
           'lifecycle in delivered/answered/cancelled/invalidated; result in pass/fail'

    UNION ALL
    -- 5. One open assessment per learner is enforced in the function, not by an index. The
    --    index that used to sit here keyed on the message author, which for an assessment is the
    --    tutor, so it scoped the rule per tutor and blocked a second learner in the same room.
    --    This check asserts the index is gone AND that the function carries the guard, because
    --    dropping the index without the guard would silently remove the rule.
    SELECT 'one open assessment per learner is enforced in the function',
           NOT EXISTS (SELECT 1 FROM pg_indexes
                        WHERE schemaname='public' AND tablename='messages'
                          AND indexname='one_open_assessment_per_student')
           AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                        WHERE n.nspname='public' AND p.proname='send_reviewed_tutor_response_v3'
                          AND pg_get_functiondef(p.oid) ~ 'ASSESSMENT_ALREADY_OPEN'
                          AND pg_get_functiondef(p.oid) ~ 'assessment_checklist_id'),
           'the mis-scoped index is dropped and the per-learner guard lives in send_reviewed'

    UNION ALL
    -- 6. The six operations the Edge Function calls exist with the exact parameter type lists.
    --    send_reviewed carries the reviewed payload because there is no draft row to read it from.
    SELECT 'six live RPC signatures match the Edge Function',
           (SELECT count(*) FROM (VALUES
                ('initialize_transfer_checklist_v1','uuid, uuid, text, uuid'),
                ('post_assessment_message_v1','uuid, text, uuid, uuid, uuid, uuid'),
                ('prepare_transfer_turn_v1','uuid, uuid, uuid, uuid, uuid'),
                ('send_reviewed_tutor_response_v3','jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid'),
                ('process_assessment_message_v1','uuid, uuid, uuid'),
                ('apply_learning_event_v1','jsonb')) AS e(f,a)
              JOIN pg_proc p ON p.proname=e.f
              JOIN pg_namespace n ON n.oid=p.pronamespace AND n.nspname='public'
              WHERE (SELECT string_agg(format_type(t.oid,NULL),', ' ORDER BY t.ord)
                       FROM unnest(p.proargtypes) WITH ORDINALITY t(oid,ord)) = e.a) = 6,
           (SELECT count(*)::text || ' of 6 matched' FROM (VALUES
                ('initialize_transfer_checklist_v1','uuid, uuid, text, uuid'),
                ('post_assessment_message_v1','uuid, text, uuid, uuid, uuid, uuid'),
                ('prepare_transfer_turn_v1','uuid, uuid, uuid, uuid, uuid'),
                ('send_reviewed_tutor_response_v3','jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid'),
                ('process_assessment_message_v1','uuid, uuid, uuid'),
                ('apply_learning_event_v1','jsonb')) AS e(f,a)
              JOIN pg_proc p ON p.proname=e.f
              JOIN pg_namespace n ON n.oid=p.pronamespace AND n.nspname='public'
              WHERE (SELECT string_agg(format_type(t.oid,NULL),', ' ORDER BY t.ord)
                       FROM unnest(p.proargtypes) WITH ORDINALITY t(oid,ord)) = e.a)

    UNION ALL
    -- 7. Every function that existed only for a dropped table must be gone.
    SELECT 'removed operations are absent',
           (SELECT count(*) FROM pg_proc p WHERE p.proname IN
              ('reject_assessment_draft_v1','regenerate_assessment_draft_v1','transfer_draft_trigger_key_v1',
               'confirm_external_transfer_v1','review_assessment_draft_v1','cancel_assessment_question_v1',
               'invalidate_assessment_question_v1')) = 0,
           (SELECT COALESCE(string_agg(p.proname, ', '), 'none') FROM pg_proc p WHERE p.proname IN
              ('reject_assessment_draft_v1','regenerate_assessment_draft_v1','transfer_draft_trigger_key_v1',
               'confirm_external_transfer_v1','review_assessment_draft_v1','cancel_assessment_question_v1',
               'invalidate_assessment_question_v1'))

    UNION ALL
    -- 8. THE CHECK THAT MATTERS MOST. plpgsql bodies are stored as text and are not
    --    dependency-tracked, so DROP TABLE succeeds against a body that still reads it and the
    --    failure only appears at call time. This is what caught review_assessment_draft_v1 when
    --    migration 038 dropped assessment_drafts without dropping it.
    --    It scans the whole stored body, comments included, so a comment that names a dropped table
    --    trips it too. That is deliberate: keeping the check a plain text scan is what makes it
    --    robust, and the cost is that migration comments must not name removed objects. It caught
    --    exactly that in the first version of migration 044.
    SELECT 'no kept function references a dropped object',
           NOT EXISTS (
               SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
               WHERE n.nspname IN ('public','private') AND p.prokind='f'
                 AND (pg_get_functiondef(p.oid) ~ 'assessment_questions'
                   OR pg_get_functiondef(p.oid) ~ 'assessment_drafts'
                   OR pg_get_functiondef(p.oid) ~ 'assessment_question_keys'
                   OR pg_get_functiondef(p.oid) ~ 'assessment_request_results'
                   OR pg_get_functiondef(p.oid) ~ 'transfer_draft_trigger_key_v1')),
           (SELECT COALESCE(string_agg(x.proname, ', '), 'none') FROM (
                SELECT DISTINCT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname IN ('public','private') AND p.prokind='f'
                   AND (pg_get_functiondef(p.oid) ~ 'assessment_questions'
                     OR pg_get_functiondef(p.oid) ~ 'assessment_drafts'
                     OR pg_get_functiondef(p.oid) ~ 'assessment_question_keys'
                     OR pg_get_functiondef(p.oid) ~ 'assessment_request_results'
                     OR pg_get_functiondef(p.oid) ~ 'transfer_draft_trigger_key_v1')) x)

    UNION ALL
    -- 9. Every private transfer table is unreachable by API roles.
    SELECT 'private transfer table denies authenticated/anon',
           NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                        WHERE n.nspname='private' AND c.relkind='r' AND c.relname='learning_event_inbox'
                          AND (c.relrowsecurity = false
                            OR has_table_privilege('authenticated', c.oid, 'SELECT')
                            OR has_table_privilege('anon', c.oid, 'SELECT'))),
           (SELECT 'rls=' || c.relrowsecurity || ' policies=' || (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid)
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='private' AND c.relname='learning_event_inbox')

    UNION ALL
    -- 10. All six live RPCs are service_role-only.
    SELECT 'live RPCs are service_role-only',
           NOT EXISTS (
               SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
               WHERE n.nspname='public'
                 AND p.proname IN ('initialize_transfer_checklist_v1','post_assessment_message_v1',
                                   'prepare_transfer_turn_v1','send_reviewed_tutor_response_v3',
                                   'process_assessment_message_v1','apply_learning_event_v1')
                 AND (has_function_privilege('anon', p.oid, 'EXECUTE')
                   OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))),
           'no anon/authenticated EXECUTE on any of the six live RPCs'

    UNION ALL
    -- 11. public.room_templates keeps the RLS the audit finding required.
    SELECT 'public.room_templates RLS enabled',
           (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relname='room_templates'),
           (SELECT 'policies=' || (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid)
              FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relname='room_templates')

    UNION ALL
    -- 12. The 028/029 digest defect must not return.
    SELECT 'no unqualified digest() in send_reviewed',
           NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                        WHERE n.nspname='public' AND p.proname='send_reviewed_tutor_response_v3'
                          AND pg_get_functiondef(p.oid) ~ '(^|[^.[:alnum:]_])digest\('),
           'pgcrypto lives in the extensions schema, so an unqualified digest( cannot resolve'

    UNION ALL
    -- 13. The digest requirement only holds if pgcrypto is still where the qualified call expects.
    SELECT 'pgcrypto installed in extensions schema',
           EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
                    WHERE e.extname='pgcrypto' AND n.nspname='extensions'),
           (SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
             WHERE e.extname='pgcrypto')

    UNION ALL
    -- 14. The delivery function keeps SECURITY DEFINER and its restrictive search_path.
    SELECT 'send_reviewed is SECURITY DEFINER with search_path',
           (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='send_reviewed_tutor_response_v3'
               AND p.prosecdef
               AND array_to_string(p.proconfig, ',') LIKE '%search_path=public, private%') = 1,
           (SELECT p.proname || ' prosecdef=' || p.prosecdef FROM pg_proc p
             JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='send_reviewed_tutor_response_v3')

    UNION ALL
    -- 15. The transfer tables are empty, which is what made the collapse safe.
    SELECT 'transfer tables are empty',
           (SELECT count(*) FROM private.learning_event_inbox) = 0
           AND (SELECT count(*) FROM public.messages WHERE assessment_lifecycle IS NOT NULL) = 0,
           (SELECT format('inbox=%s assessment_messages=%s',
                          (SELECT count(*) FROM private.learning_event_inbox),
                          (SELECT count(*) FROM public.messages WHERE assessment_lifecycle IS NOT NULL)))

    UNION ALL
    -- 16. The author's own role decides the stored message role. Migration 038 hardcoded 'tutor'
    --     here, which made every learner message ungradeable: process_assessment_message_v1 refuses
    --     any answer whose user_role is not 'student'. Both halves are asserted together, because
    --     either one alone leaves the answer path broken or ungraded.
    SELECT 'post_message stores the author role and the grader requires student',
           EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                    WHERE n.nspname='public' AND p.proname='post_assessment_message_v1'
                      AND pg_get_functiondef(p.oid) ~ 'current_role')
           AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                    WHERE n.nspname='public' AND p.proname='process_assessment_message_v1'
                      AND pg_get_functiondef(p.oid) ~ 'user_role <> ''student'''),
           'post_message derives user_role from users.current_role; the grader still requires student'

)
SELECT check_name, pass, detail, 0 AS is_rollup FROM checks
UNION ALL
SELECT 'FAILING_CHECKS', (count(*) = 0), count(*)::text, 1 FROM checks WHERE NOT pass
ORDER BY is_rollup DESC, check_name;
