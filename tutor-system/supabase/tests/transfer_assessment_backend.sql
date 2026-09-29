-- Purpose: verify the deployed transfer-assessment schema, privacy grants, and versioned RPC boundary.

BEGIN;

CREATE TEMP TABLE transfer_v2_schema_checks ON COMMIT DROP AS
WITH checks(check_name, pass, detail) AS (
  SELECT 'private assessment tables exist',
    (SELECT count(*) FROM information_schema.tables
      WHERE table_schema = 'private'
        AND table_name IN ('transfer_assessments', 'transfer_assessment_attempts', 'transfer_provider_attempts')) = 3,
    'expected three Packet V2 private tables'

  UNION ALL
  SELECT 'public target exists and public key is removed',
    EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'assessment_student_id')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'assessment_key'),
    'assessment_student_id present; assessment_key absent'

  UNION ALL
  SELECT 'private tables are unavailable to API roles',
    (SELECT bool_and(NOT has_table_privilege(role_name, table_name, privilege_name))
     FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name)
     CROSS JOIN (VALUES
       ('private.transfer_assessments'),
       ('private.transfer_assessment_attempts'),
       ('private.transfer_provider_attempts')
     ) AS target_tables(table_name)
     CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS privileges(privilege_name))
    AND NOT has_schema_privilege('anon', 'private', 'USAGE')
    AND NOT has_schema_privilege('authenticated', 'private', 'USAGE'),
    'anon/authenticated have no private schema or table read/write privilege'

  UNION ALL
  SELECT 'attempt uniqueness and bound constraints exist',
    EXISTS (SELECT 1 FROM pg_indexes
      WHERE schemaname = 'private' AND tablename = 'transfer_assessment_attempts'
        AND indexdef ILIKE '%assessment_id%attempt_number%')
    AND EXISTS (SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'private' AND t.relname = 'transfer_assessments'
        AND pg_get_constraintdef(c.oid) ILIKE '%attempt_count%0%2%'),
    'unique ordinal and attempt_count 0..2 are enforced'

  UNION ALL
  SELECT 'service-only versioned RPCs exist',
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN (
        'send_reviewed_tutor_response_v4', 'post_assessment_message_v2',
        'get_transfer_assessment_processing_context_v1', 'process_assessment_message_v2',
        'record_transfer_provider_attempt_v1')) = 5,
    'five Packet V2 storage RPCs exist'

  UNION ALL
  SELECT 'API roles cannot execute mutation RPCs',
    (SELECT bool_and(NOT has_function_privilege(role_name, signature, 'EXECUTE'))
     FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name)
     CROSS JOIN (VALUES
       ('public.send_reviewed_tutor_response_v4(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid)'),
       ('public.post_assessment_message_v2(uuid,text,uuid,uuid,text[],uuid,uuid)'),
       ('public.get_transfer_assessment_processing_context_v1(uuid,uuid,uuid)'),
       ('public.process_assessment_message_v2(uuid,uuid,uuid,uuid,integer,text,text,text[],jsonb,text)'),
       ('public.record_transfer_provider_attempt_v1(uuid,uuid,uuid,uuid,uuid,integer,text,text,integer,text,jsonb,jsonb,text,text,text)')
     ) AS target_functions(signature)),
    'anon/authenticated execute privileges revoked for all five authority RPCs'

  UNION ALL
  SELECT 'obsolete grading RPCs are unavailable to API roles',
    NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('process_assessment_message_v1', 'send_reviewed_tutor_response_v3')
        AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    ),
    'legacy functions may remain only when fully revoked'

  UNION ALL
  SELECT 'private tables are outside exposed schemas',
    current_setting('pgrst.db_schemas', true) IS NULL
      OR position('private' in current_setting('pgrst.db_schemas', true)) = 0,
    'PostgREST exposed schema list excludes private'
)
SELECT check_name, pass, detail FROM checks;

SELECT check_name, pass, detail FROM transfer_v2_schema_checks ORDER BY check_name;

DO $test$
BEGIN
  IF EXISTS (SELECT 1 FROM transfer_v2_schema_checks WHERE NOT pass OR pass IS NULL) THEN
    RAISE EXCEPTION 'transfer assessment schema checks failed';
  END IF;
END;
$test$;

ROLLBACK;
