--!/usr/bin/env psql
-- File: private_transfer_assessment_storage_migration.sql
-- Purpose: verify private assessment storage, fixture cleanup, RPC revocation, and service-role DML.

DO $assert$
DECLARE
  expected_message_ids CONSTANT uuid[] := ARRAY[
    '3c931640-62e9-4b83-8a5a-d90683a89d23'::uuid,
    'a4d0148e-a9d0-471a-9ea7-87a6fceb39e1'::uuid
  ];
BEGIN
  IF to_regclass('private.transfer_assessments') IS NULL THEN
    RAISE EXCEPTION 'private transfer assessment table is missing';
  END IF;

  IF NOT (SELECT c.relrowsecurity FROM pg_class AS c
          WHERE c.oid = 'private.transfer_assessments'::regclass) THEN
    RAISE EXCEPTION 'private transfer assessment RLS is disabled';
  END IF;

  IF has_schema_privilege('anon', 'private', 'USAGE')
     OR has_schema_privilege('authenticated', 'private', 'USAGE')
     OR has_table_privilege('anon', 'private.transfer_assessments', 'SELECT')
     OR has_table_privilege('anon', 'private.transfer_assessments', 'INSERT')
     OR has_table_privilege('anon', 'private.transfer_assessments', 'UPDATE')
     OR has_table_privilege('anon', 'private.transfer_assessments', 'DELETE')
     OR has_table_privilege('authenticated', 'private.transfer_assessments', 'SELECT')
     OR has_table_privilege('authenticated', 'private.transfer_assessments', 'INSERT')
     OR has_table_privilege('authenticated', 'private.transfer_assessments', 'UPDATE')
     OR has_table_privilege('authenticated', 'private.transfer_assessments', 'DELETE') THEN
    RAISE EXCEPTION 'client roles have access to private assessment storage';
  END IF;

  IF NOT has_schema_privilege('service_role', 'private', 'USAGE')
     OR NOT has_table_privilege('service_role', 'private.transfer_assessments', 'SELECT')
     OR NOT has_table_privilege('service_role', 'private.transfer_assessments', 'INSERT')
     OR NOT has_table_privilege('service_role', 'private.transfer_assessments', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'private.transfer_assessments', 'DELETE') THEN
    RAISE EXCEPTION 'service_role is missing private assessment DML access';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages'
      AND column_name = 'assessment_student_id' AND data_type = 'uuid' AND is_nullable = 'YES'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'assessment_key'
  ) THEN
    RAISE EXCEPTION 'messages assessment columns do not match the migration result';
  END IF;

  IF EXISTS (SELECT 1 FROM public.messages WHERE id = ANY(expected_message_ids))
     OR EXISTS (SELECT 1 FROM public.message_feedback
                WHERE id = 'da3fcf74-67c1-4548-8122-cc50c33221a2'::uuid) THEN
    RAISE EXCEPTION 'approved assessment fixture messages or feedback remain';
  END IF;

  IF has_function_privilege('anon', 'public.process_assessment_message_v1(uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.process_assessment_message_v1(uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.process_assessment_message_v1(uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.send_reviewed_tutor_response_v3(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.send_reviewed_tutor_response_v3(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.send_reviewed_tutor_response_v3(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'obsolete key-dependent RPC remains executable';
  END IF;
END;
$assert$;

BEGIN;
SET LOCAL ROLE service_role;

DO $constraint_tests$
DECLARE
  actual_sqlstate text;
  actual_constraint text;
BEGIN
  BEGIN
    INSERT INTO private.transfer_assessments (
      question_message_id, room_id, student_id, checklist_id, item_id,
      focus_student_message_id, selection_type, correct_option_ids,
      learner_safe_explanation, transfer_basis, reviewed_private_payload,
      lifecycle, delivery_request_id
    ) VALUES (
      '09acb7f2-c7df-475a-886e-f72dff46c5fe'::uuid,
      '3bfd637e-8981-4766-b16c-9c5e1d4f390a'::uuid,
      '6e71088d-7445-456f-a39b-1c69aaab6e71'::uuid,
      '498b7341-1e4c-426b-b9f2-710f3b5ee495'::uuid,
      '4fbb696c-37ab-4928-b758-2d4d49fd8ee7'::uuid,
      '09acb7f2-c7df-475a-886e-f72dff46c5fe'::uuid,
      'single', ARRAY['A', 'B'], 'Valid explanation.', '{}'::jsonb, '{}'::jsonb,
      'open', '5f4e5db1-28f7-4d2c-94e1-95124479bcbd'::uuid
    );
    RAISE EXCEPTION 'invalid key shape was accepted';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS actual_sqlstate = RETURNED_SQLSTATE,
      actual_constraint = CONSTRAINT_NAME;
    IF actual_sqlstate <> '23514'
       OR actual_constraint <> 'transfer_assessments_key_shape' THEN
      RAISE EXCEPTION 'key shape rejected by %, SQLSTATE %', actual_constraint, actual_sqlstate;
    END IF;
    RAISE NOTICE 'key shape rejection: SQLSTATE %, constraint %', actual_sqlstate, actual_constraint;
  END;
  IF EXISTS (SELECT 1 FROM private.transfer_assessments
             WHERE delivery_request_id = '5f4e5db1-28f7-4d2c-94e1-95124479bcbd'::uuid) THEN
    RAISE EXCEPTION 'invalid key-shape row remains';
  END IF;

  BEGIN
    INSERT INTO private.transfer_assessments (
      question_message_id, room_id, student_id, checklist_id, item_id,
      focus_student_message_id, selection_type, correct_option_ids,
      learner_safe_explanation, transfer_basis, reviewed_private_payload,
      lifecycle, attempt_count, delivery_request_id
    ) VALUES (
      '09acb7f2-c7df-475a-886e-f72dff46c5fe'::uuid,
      '3bfd637e-8981-4766-b16c-9c5e1d4f390a'::uuid,
      '6e71088d-7445-456f-a39b-1c69aaab6e71'::uuid,
      '498b7341-1e4c-426b-b9f2-710f3b5ee495'::uuid,
      '4fbb696c-37ab-4928-b758-2d4d49fd8ee7'::uuid,
      '09acb7f2-c7df-475a-886e-f72dff46c5fe'::uuid,
      'single', ARRAY['B'], 'Valid explanation.', '{}'::jsonb, '{}'::jsonb,
      'open', 3, '5f4e5db1-28f7-4d2c-94e1-95124479bcbe'::uuid
    );
    RAISE EXCEPTION 'attempt count above two was accepted';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS actual_sqlstate = RETURNED_SQLSTATE,
      actual_constraint = CONSTRAINT_NAME;
    IF actual_sqlstate <> '23514'
       OR actual_constraint <> 'transfer_assessments_attempt_count_check' THEN
      RAISE EXCEPTION 'attempt count rejected by %, SQLSTATE %', actual_constraint, actual_sqlstate;
    END IF;
    RAISE NOTICE 'attempt count rejection: SQLSTATE %, constraint %', actual_sqlstate, actual_constraint;
  END;
  IF EXISTS (SELECT 1 FROM private.transfer_assessments
             WHERE delivery_request_id = '5f4e5db1-28f7-4d2c-94e1-95124479bcbe'::uuid) THEN
    RAISE EXCEPTION 'invalid attempt-count row remains';
  END IF;

  BEGIN
    INSERT INTO private.transfer_assessments (
      question_message_id, room_id, student_id, checklist_id, item_id,
      focus_student_message_id, selection_type, correct_option_ids,
      learner_safe_explanation, transfer_basis, reviewed_private_payload,
      lifecycle, delivery_request_id
    ) VALUES (
      '09acb7f2-c7df-475a-886e-f72dff46c5fe'::uuid,
      '3bfd637e-8981-4766-b16c-9c5e1d4f390a'::uuid,
      '6e71088d-7445-456f-a39b-1c69aaab6e71'::uuid,
      '498b7341-1e4c-426b-b9f2-710f3b5ee495'::uuid,
      '4fbb696c-37ab-4928-b758-2d4d49fd8ee7'::uuid,
      '09acb7f2-c7df-475a-886e-f72dff46c5fe'::uuid,
      'single', ARRAY['B'], NULL, '{}'::jsonb, '{}'::jsonb,
      'open', '5f4e5db1-28f7-4d2c-94e1-95124479bcbb'::uuid
    );
    RAISE EXCEPTION 'missing private explanation was accepted';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS actual_sqlstate = RETURNED_SQLSTATE,
      actual_constraint = CONSTRAINT_NAME;
    IF actual_sqlstate <> '23514'
       OR actual_constraint <> 'transfer_assessments_private_fields' THEN
      RAISE EXCEPTION 'private fields rejected by %, SQLSTATE %', actual_constraint, actual_sqlstate;
    END IF;
    RAISE NOTICE 'private fields rejection: SQLSTATE %, constraint %', actual_sqlstate, actual_constraint;
  END;
  IF EXISTS (SELECT 1 FROM private.transfer_assessments
             WHERE delivery_request_id = '5f4e5db1-28f7-4d2c-94e1-95124479bcbb'::uuid) THEN
    RAISE EXCEPTION 'invalid private-fields row remains';
  END IF;

  BEGIN
    INSERT INTO private.transfer_assessments (
      question_message_id, room_id, student_id, checklist_id, item_id,
      focus_student_message_id, selection_type, correct_option_ids,
      learner_safe_explanation, transfer_basis, reviewed_private_payload,
      lifecycle, delivery_request_id
    ) VALUES (
      '09acb7f2-c7df-475a-886e-f72dff46c5fe'::uuid,
      '3bfd637e-8981-4766-b16c-9c5e1d4f390a'::uuid,
      '6e71088d-7445-456f-a39b-1c69aaab6e71'::uuid,
      '498b7341-1e4c-426b-b9f2-710f3b5ee495'::uuid,
      '4fbb696c-37ab-4928-b758-2d4d49fd8ee7'::uuid,
      '09acb7f2-c7df-475a-886e-f72dff46c5fe'::uuid,
      'single', ARRAY['B'], 'Valid explanation.', '{}'::jsonb, '{}'::jsonb,
      'passed', '5f4e5db1-28f7-4d2c-94e1-95124479bcba'::uuid
    );
    RAISE EXCEPTION 'inconsistent terminal state was accepted';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS actual_sqlstate = RETURNED_SQLSTATE,
      actual_constraint = CONSTRAINT_NAME;
    IF actual_sqlstate <> '23514'
       OR actual_constraint <> 'transfer_assessments_terminal_state' THEN
      RAISE EXCEPTION 'terminal state rejected by %, SQLSTATE %', actual_constraint, actual_sqlstate;
    END IF;
    RAISE NOTICE 'terminal state rejection: SQLSTATE %, constraint %', actual_sqlstate, actual_constraint;
  END;
  IF EXISTS (SELECT 1 FROM private.transfer_assessments
             WHERE delivery_request_id = '5f4e5db1-28f7-4d2c-94e1-95124479bcba'::uuid) THEN
    RAISE EXCEPTION 'invalid terminal-state row remains';
  END IF;
END;
$constraint_tests$;

INSERT INTO private.transfer_assessments (
  question_message_id,
  room_id,
  student_id,
  checklist_id,
  item_id,
  focus_student_message_id,
  selection_type,
  correct_option_ids,
  learner_safe_explanation,
  transfer_basis,
  reviewed_private_payload,
  lifecycle,
  delivery_request_id
) VALUES (
  '09acb7f2-c7df-475a-886e-f72dff46c5fe'::uuid,
  '3bfd637e-8981-4766-b16c-9c5e1d4f390a'::uuid,
  '6e71088d-7445-456f-a39b-1c69aaab6e71'::uuid,
  '498b7341-1e4c-426b-b9f2-710f3b5ee495'::uuid,
  '4fbb696c-37ab-4928-b758-2d4d49fd8ee7'::uuid,
  '09acb7f2-c7df-475a-886e-f72dff46c5fe'::uuid,
  'single',
  ARRAY['B'],
  'Verify using a trusted channel.',
  '{"source":"migration-test"}'::jsonb,
  '{"expected":"B"}'::jsonb,
  'open',
  '5f4e5db1-28f7-4d2c-94e1-95124479bcba'::uuid
);

DO $service_read$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM private.transfer_assessments
    WHERE delivery_request_id = '5f4e5db1-28f7-4d2c-94e1-95124479bcba'::uuid
      AND correct_option_ids = ARRAY['B']
  ) THEN
    RAISE EXCEPTION 'service_role could not read its inserted private assessment';
  END IF;
END;
$service_read$;

UPDATE private.transfer_assessments
SET lifecycle = 'cancelled', closed_at = now()
WHERE delivery_request_id = '5f4e5db1-28f7-4d2c-94e1-95124479bcba'::uuid;

DO $service_update$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM private.transfer_assessments
    WHERE delivery_request_id = '5f4e5db1-28f7-4d2c-94e1-95124479bcba'::uuid
      AND lifecycle = 'cancelled' AND closed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'service_role could not update its private assessment';
  END IF;
END;
$service_update$;

DELETE FROM private.transfer_assessments
WHERE delivery_request_id = '5f4e5db1-28f7-4d2c-94e1-95124479bcba'::uuid;

ROLLBACK;

DO $rollback_assert$
BEGIN
  IF EXISTS (
    SELECT 1 FROM private.transfer_assessments
    WHERE delivery_request_id = '5f4e5db1-28f7-4d2c-94e1-95124479bcba'::uuid
  ) THEN
    RAISE EXCEPTION 'service-role test row survived transaction rollback';
  END IF;
END;
$rollback_assert$;

SELECT 'private_transfer_assessment_storage_migration' AS case_id, TRUE AS ok;
