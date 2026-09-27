--!/usr/bin/env psql
-- Purpose: compare local migrated catalog signatures and storage fields with the 102 RPC contract.

BEGIN;

CREATE TEMP TABLE transfer_catalog_expected(
  operation TEXT PRIMARY KEY, identity_signature TEXT NOT NULL, result_type TEXT NOT NULL
) ON COMMIT DROP;
INSERT INTO transfer_catalog_expected VALUES
  ('initialize_transfer_checklist_v1',
    'public.initialize_transfer_checklist_v1(uuid,uuid,text,uuid)', 'uuid'),
  ('prepare_transfer_turn_v1',
    'public.prepare_transfer_turn_v1(uuid,uuid,uuid,uuid,uuid)', 'jsonb'),
  ('apply_learning_event_v1',
    'public.apply_learning_event_v1(jsonb)', 'jsonb'),
  ('send_reviewed_tutor_response_v4',
    'public.send_reviewed_tutor_response_v4(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid)', 'jsonb'),
  ('post_assessment_message_v2',
    'public.post_assessment_message_v2(uuid,text,uuid,uuid,text[],uuid,uuid)', 'jsonb'),
  ('get_transfer_assessment_processing_context_v1',
    'public.get_transfer_assessment_processing_context_v1(uuid,uuid,uuid)', 'jsonb'),
  ('process_assessment_message_v2',
    'public.process_assessment_message_v2(uuid,uuid,uuid,uuid,integer,text,text,text[],jsonb,text)', 'jsonb'),
  ('record_transfer_provider_attempt_v1',
    'public.record_transfer_provider_attempt_v1(uuid,uuid,uuid,uuid,uuid,integer,text,text,integer,text,jsonb,jsonb,text,text,text)', 'uuid');

SELECT e.operation, e.identity_signature,
  p.prorettype::regtype AS actual_result_type,
  p.proargnames AS actual_arg_names,
  p.prosecdef AS security_definer
FROM transfer_catalog_expected e
LEFT JOIN pg_proc p ON p.oid = to_regprocedure(e.identity_signature)
ORDER BY e.operation;

SELECT n.nspname AS schema_name, t.relname AS table_name,
  a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS sql_type,
  a.attnotnull AS not_null
FROM pg_attribute a
JOIN pg_class t ON t.oid = a.attrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'private'
  AND t.relname IN (
    'transfer_assessments', 'transfer_assessment_attempts', 'transfer_provider_attempts'
  )
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY n.nspname, t.relname, a.attnum;

DO $assert$
BEGIN
  IF EXISTS (
    SELECT 1 FROM transfer_catalog_expected e
    LEFT JOIN pg_proc p ON p.oid = to_regprocedure(e.identity_signature)
    WHERE p.oid IS NULL OR p.prorettype::regtype::TEXT <> e.result_type
       OR p.prosecdef IS NOT TRUE
  ) OR (
    SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'private'
      AND table_name IN (
        'transfer_assessments', 'transfer_assessment_attempts', 'transfer_provider_attempts'
      )
  ) <> 3 OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'assessment_key'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages'
      AND column_name = 'assessment_student_id' AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'private' AND table_name = 'transfer_assessments'
      AND column_name = 'learner_safe_explanation'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'private' AND table_name = 'transfer_assessment_attempts'
      AND column_name = 'learning_event_id'
  ) THEN
    RAISE EXCEPTION 'local transfer catalog contract differs from expected signatures or fields';
  END IF;
END;
$assert$;

SELECT 'local_catalog_contract' AS case_id, TRUE AS ok;
ROLLBACK;
