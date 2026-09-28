--!/usr/bin/env psql
-- Purpose: Move transfer assessment grading storage out of learner-readable messages and remove the two approved test fixtures.

BEGIN;

DO $preflight$
DECLARE
  expected_message_ids CONSTANT uuid[] := ARRAY[
    '3c931640-62e9-4b83-8a5a-d90683a89d23'::uuid,
    'a4d0148e-a9d0-471a-9ea7-87a6fceb39e1'::uuid
  ];
  expected_assessment_ids CONSTANT uuid[] := ARRAY[
    'beaad782-777a-45cc-a8cb-a0966215469e'::uuid,
    'b94387eb-c733-4eb0-bc5a-378a40a8de9f'::uuid
  ];
  actual_message_ids uuid[];
  matching_message_count integer;
  matching_parent_count integer;
  feedback_count integer;
  child_message_count integer;
  answer_reference_count integer;
  ai_feedback_count integer;
  learning_event_count integer;
  coverage_evidence_count integer;
BEGIN
  IF to_regclass('private.transfer_assessments') IS NOT NULL THEN
    RAISE EXCEPTION 'ASSESSMENT_SCHEMA_BASELINE_CHANGED: private.transfer_assessments already exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'assessment_student_id'
  ) THEN
    RAISE EXCEPTION 'ASSESSMENT_SCHEMA_BASELINE_CHANGED: assessment_student_id already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'assessment_key'
  ) THEN
    RAISE EXCEPTION 'ASSESSMENT_SCHEMA_BASELINE_CHANGED: public.messages.assessment_key is absent';
  END IF;

  IF to_regprocedure('public.process_assessment_message_v1(uuid,uuid,uuid)') IS NULL
     OR to_regprocedure('public.send_reviewed_tutor_response_v3(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'ASSESSMENT_SCHEMA_BASELINE_CHANGED: expected key-dependent RPC signature is absent';
  END IF;

  SELECT COALESCE(array_agg(m.id ORDER BY m.id), ARRAY[]::uuid[])
  INTO actual_message_ids
  FROM public.messages AS m
  WHERE m.assessment_key IS NOT NULL;

  IF actual_message_ids IS DISTINCT FROM expected_message_ids THEN
    RAISE EXCEPTION 'ASSESSMENT_TEST_FIXTURES_CHANGED: keyed message IDs differ from the two approved test rows';
  END IF;

  WITH expected(id, assessment_id, parent_message_id) AS (
    VALUES
      (
        '3c931640-62e9-4b83-8a5a-d90683a89d23'::uuid,
        'beaad782-777a-45cc-a8cb-a0966215469e'::uuid,
        '09acb7f2-c7df-475a-886e-f72dff46c5fe'::uuid
      ),
      (
        'a4d0148e-a9d0-471a-9ea7-87a6fceb39e1'::uuid,
        'b94387eb-c733-4eb0-bc5a-378a40a8de9f'::uuid,
        '4e750c50-9d54-4bc0-93a9-ba02ac46e664'::uuid
      )
  )
  SELECT count(*)
  INTO matching_message_count
  FROM expected AS e
  JOIN public.messages AS m ON m.id = e.id
  WHERE m.assessment_id = e.assessment_id
    AND m.room_id = '3bfd637e-8981-4766-b16c-9c5e1d4f390a'::uuid
    AND m.user_role = 'tutor'::public.user_role
    AND m.parent_message_id = e.parent_message_id
    AND m.assessment_checklist_id = '498b7341-1e4c-426b-b9f2-710f3b5ee495'::uuid
    AND m.assessment_item_id = '4fbb696c-37ab-4928-b758-2d4d49fd8ee7'::uuid
    AND m.assessment_lifecycle = 'delivered'
    AND m.assessment_selection_type = 'single'
    AND cardinality(m.assessment_key) = 1
    AND m.assessment_answer_message_id IS NULL
    AND m.assessment_selected_option_ids IS NULL
    AND m.assessment_result IS NULL
    AND m.assessment_closed_at IS NULL;

  IF matching_message_count <> 2 THEN
    RAISE EXCEPTION 'ASSESSMENT_TEST_FIXTURES_CHANGED: approved messages do not match their recorded state';
  END IF;

  SELECT count(*)
  INTO matching_parent_count
  FROM public.messages AS p
  WHERE p.id IN (
      '09acb7f2-c7df-475a-886e-f72dff46c5fe'::uuid,
      '4e750c50-9d54-4bc0-93a9-ba02ac46e664'::uuid
    )
    AND p.room_id = '3bfd637e-8981-4766-b16c-9c5e1d4f390a'::uuid
    AND p.user_role = 'student'::public.user_role;

  IF matching_parent_count <> 2 THEN
    RAISE EXCEPTION 'ASSESSMENT_TEST_FIXTURES_CHANGED: approved messages no longer have their recorded student parents';
  END IF;

  SELECT count(*)
  INTO feedback_count
  FROM public.message_feedback AS f
  WHERE f.message_id = ANY(expected_message_ids);

  IF feedback_count <> 1
     OR NOT EXISTS (
       SELECT 1
       FROM public.message_feedback AS f
       WHERE f.id = 'da3fcf74-67c1-4548-8122-cc50c33221a2'::uuid
         AND f.message_id = 'a4d0148e-a9d0-471a-9ea7-87a6fceb39e1'::uuid
     ) THEN
    RAISE EXCEPTION 'ASSESSMENT_TEST_FIXTURES_CHANGED: approved message feedback differs from the recorded single dependent row';
  END IF;

  SELECT count(*) INTO child_message_count
  FROM public.messages AS child
  WHERE child.parent_message_id = ANY(expected_message_ids);

  SELECT count(*) INTO answer_reference_count
  FROM public.messages AS answer
  WHERE answer.assessment_answer_message_id = ANY(expected_message_ids);

  SELECT count(*) INTO ai_feedback_count
  FROM public.ai_suggestion_feedback AS f
  WHERE f.parent_message_id = ANY(expected_message_ids)
     OR f.tutor_message_id = ANY(expected_message_ids)
     OR f.assessment_id = ANY(expected_assessment_ids);

  SELECT count(*) INTO learning_event_count
  FROM private.learning_event_inbox AS e
  WHERE e.source_message_id = ANY(expected_message_ids);

  SELECT count(*) INTO coverage_evidence_count
  FROM public.coverage_evidence AS e
  WHERE e.message_id = ANY(expected_message_ids)
     OR e.assessment_id = ANY(expected_assessment_ids);

  IF child_message_count <> 0
     OR answer_reference_count <> 0
     OR ai_feedback_count <> 0
     OR learning_event_count <> 0
     OR coverage_evidence_count <> 0 THEN
    RAISE EXCEPTION 'ASSESSMENT_TEST_FIXTURES_CHANGED: an approved message has dependent assessment evidence';
  END IF;
END;
$preflight$;

CREATE TABLE private.transfer_assessments (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  question_message_id uuid NOT NULL UNIQUE
    REFERENCES public.messages(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id),
  student_id uuid NOT NULL REFERENCES public.users(id),
  checklist_id uuid NOT NULL REFERENCES public.session_checklists(id),
  item_id uuid NOT NULL REFERENCES public.checklist_items(id),
  focus_student_message_id uuid NOT NULL REFERENCES public.messages(id),
  selection_type text NOT NULL
    CHECK (selection_type IN ('single', 'multiple')),
  correct_option_ids text[] NOT NULL,
  learner_safe_explanation text,
  transfer_basis jsonb,
  reviewed_private_payload jsonb,
  lifecycle text NOT NULL
    CHECK (lifecycle IN ('open', 'passed', 'failed', 'cancelled', 'legacy_incomplete')),
  attempt_count integer NOT NULL DEFAULT 0
    CHECK (attempt_count BETWEEN 0 AND 2),
  terminal_answer_message_id uuid UNIQUE
    REFERENCES public.messages(id) ON DELETE SET NULL,
  terminal_result text CHECK (terminal_result IN ('passed', 'failed')),
  closed_at timestamptz,
  delivery_request_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transfer_assessments_key_shape CHECK (
    (selection_type = 'single' AND cardinality(correct_option_ids) = 1)
    OR (selection_type = 'multiple' AND cardinality(correct_option_ids) BETWEEN 2 AND 3)
  ),
  CONSTRAINT transfer_assessments_private_fields CHECK (
    lifecycle = 'legacy_incomplete'
    OR (
      learner_safe_explanation IS NOT NULL
      AND btrim(learner_safe_explanation) <> ''
      AND transfer_basis IS NOT NULL
      AND reviewed_private_payload IS NOT NULL
      AND delivery_request_id IS NOT NULL
    )
  ),
  CONSTRAINT transfer_assessments_terminal_state CHECK (
    (lifecycle IN ('open', 'legacy_incomplete') AND terminal_result IS NULL AND closed_at IS NULL)
    OR (
      lifecycle IN ('passed', 'failed')
      AND terminal_result = lifecycle
      AND terminal_answer_message_id IS NOT NULL
      AND closed_at IS NOT NULL
    )
    OR (lifecycle = 'cancelled' AND terminal_result IS NULL AND closed_at IS NOT NULL)
  )
);

ALTER TABLE private.transfer_assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.transfer_assessments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE private.transfer_assessments TO service_role;

ALTER TABLE public.messages ADD COLUMN assessment_student_id uuid;

REVOKE ALL ON FUNCTION public.process_assessment_message_v1(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.send_reviewed_tutor_response_v3(jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

DO $cleanup$
DECLARE
  deleted_feedback_count integer;
  deleted_message_count integer;
BEGIN
  DELETE FROM public.message_feedback
  WHERE message_id IN (
    '3c931640-62e9-4b83-8a5a-d90683a89d23'::uuid,
    'a4d0148e-a9d0-471a-9ea7-87a6fceb39e1'::uuid
  );

  GET DIAGNOSTICS deleted_feedback_count = ROW_COUNT;
  IF deleted_feedback_count <> 1 THEN
    RAISE EXCEPTION 'ASSESSMENT_TEST_FIXTURES_CHANGED: expected to delete exactly one dependent feedback row';
  END IF;

  DELETE FROM public.messages
  WHERE id IN (
    '3c931640-62e9-4b83-8a5a-d90683a89d23'::uuid,
    'a4d0148e-a9d0-471a-9ea7-87a6fceb39e1'::uuid
  );

  GET DIAGNOSTICS deleted_message_count = ROW_COUNT;
  IF deleted_message_count <> 2 THEN
    RAISE EXCEPTION 'ASSESSMENT_TEST_FIXTURES_CHANGED: expected to delete exactly two approved test messages';
  END IF;
END;
$cleanup$;

ALTER TABLE public.messages DROP COLUMN assessment_key;

DO $postflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'assessment_key'
  ) THEN
    RAISE EXCEPTION 'ASSESSMENT_MIGRATION_POSTCONDITION_FAILED: assessment_key remains public';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.messages
    WHERE id IN (
      '3c931640-62e9-4b83-8a5a-d90683a89d23'::uuid,
      'a4d0148e-a9d0-471a-9ea7-87a6fceb39e1'::uuid
    )
  ) THEN
    RAISE EXCEPTION 'ASSESSMENT_MIGRATION_POSTCONDITION_FAILED: approved test message remains';
  END IF;

  IF NOT (SELECT c.relrowsecurity FROM pg_class AS c WHERE c.oid = 'private.transfer_assessments'::regclass)
     OR has_table_privilege('anon', 'private.transfer_assessments', 'SELECT')
     OR has_table_privilege('authenticated', 'private.transfer_assessments', 'SELECT')
     OR NOT has_table_privilege('service_role', 'private.transfer_assessments', 'SELECT') THEN
    RAISE EXCEPTION 'ASSESSMENT_MIGRATION_POSTCONDITION_FAILED: private table access boundary is incorrect';
  END IF;

  IF has_function_privilege('service_role', 'public.process_assessment_message_v1(uuid,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.send_reviewed_tutor_response_v3(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ASSESSMENT_MIGRATION_POSTCONDITION_FAILED: an obsolete key-dependent RPC remains executable by service_role';
  END IF;
END;
$postflight$;

COMMIT;
