--!/usr/bin/env psql
-- Purpose: seed a delivery race and verify rejected targets/payloads leave no public or private pair.

BEGIN;
SELECT set_config('app.transfer_operation', 'on', true);
INSERT INTO public.users(id, email, display_name, "current_role", status)
VALUES
  ('f1020000-0000-4000-8000-000000000301', 'transfer-delivery-tutor@example.invalid', 'Delivery Tutor', 'tutor', 'active'),
  ('f1020000-0000-4000-8000-000000000302', 'transfer-delivery-student@example.invalid', 'Delivery Student', 'student', 'active');
INSERT INTO public.rooms(id, tutor_id, title)
VALUES ('f1020000-0000-4000-8000-000000000303', 'f1020000-0000-4000-8000-000000000301', 'Delivery race fixture');
INSERT INTO public.sessions(tutor_id, student_id, room_id, status)
VALUES (
  'f1020000-0000-4000-8000-000000000301',
  'f1020000-0000-4000-8000-000000000302',
  'f1020000-0000-4000-8000-000000000303', 'active'
);
INSERT INTO public.session_checklists(
  id, room_id, student_id, template_name, progress_policy_version, is_active
) VALUES (
  'f1020000-0000-4000-8000-000000000304',
  'f1020000-0000-4000-8000-000000000303',
  'f1020000-0000-4000-8000-000000000302',
  'Delivery race fixture', 'transfer_v1', TRUE
);
INSERT INTO public.checklist_items(
  id, checklist_id, area_text, item_type, priority, status, understanding_level
) VALUES (
  'f1020000-0000-4000-8000-000000000305',
  'f1020000-0000-4000-8000-000000000304',
  'Verify a suspicious sender', 'verification_step', 'critical', 'partially_covered', 'basic'
);
INSERT INTO public.messages(id, room_id, user_id, content, user_role)
VALUES (
  'f1020000-0000-4000-8000-000000000306',
  'f1020000-0000-4000-8000-000000000303',
  'f1020000-0000-4000-8000-000000000302',
  'I trusted the account name.', 'student'
);

DO $checks$
DECLARE
  v_payload JSONB;
  v_error TEXT;
BEGIN
  v_payload := jsonb_build_object(
    'decision', jsonb_build_object(
      'mode', 'assessment', 'instruction', 'transfer_assess',
      'target_item_id', 'f1020000-0000-4000-8000-000000000305'
    ),
    'response', 'Which action is safest?',
    'assessment', jsonb_build_object(
      'selection_type', 'single', 'stem', 'Which action is safest?',
      'options', jsonb_build_array(
        jsonb_build_object('id', 'A', 'text', 'Open the link'),
        jsonb_build_object('id', 'B', 'text', 'Verify through the official app'),
        jsonb_build_object('id', 'C', 'text', 'Reply with credentials'),
        jsonb_build_object('id', 'D', 'text', 'Forward it')
      ),
      'correct_option_ids', jsonb_build_array('B'),
      'learner_safe_explanation', 'Verify through the official app because familiarity is not proof.',
      'transfer_basis', jsonb_build_object(
        'source_evidence_message_ids', jsonb_build_array('f1020000-0000-4000-8000-000000000306')
      )
    )
  );
  BEGIN
    PERFORM public.send_reviewed_tutor_response_v4(
      v_payload, 'f1020000-0000-4000-8000-000000000303',
      'f1020000-0000-4000-8000-000000000301',
      'f1020000-0000-4000-8000-000000000304',
      'f1020000-0000-4000-8000-000000000305',
      'f1020000-0000-4000-8000-000000000306',
      'f1020000-0000-4000-8000-000000000301',
      'f1020000-0000-4000-8000-000000000307'
    );
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'INVALID_SCOPE'
     OR EXISTS (SELECT 1 FROM public.messages
       WHERE assessment_request_id = 'f1020000-0000-4000-8000-000000000307')
     OR EXISTS (SELECT 1 FROM private.transfer_assessments
       WHERE delivery_request_id = 'f1020000-0000-4000-8000-000000000307') THEN
    RAISE EXCEPTION 'target mismatch created a delivery effect: %', v_error;
  END IF;

  v_error := NULL;
  BEGIN
    PERFORM public.send_reviewed_tutor_response_v4(
      jsonb_set(v_payload, '{assessment,learner_safe_explanation}', 'null'::JSONB),
      'f1020000-0000-4000-8000-000000000303',
      'f1020000-0000-4000-8000-000000000302',
      'f1020000-0000-4000-8000-000000000304',
      'f1020000-0000-4000-8000-000000000305',
      'f1020000-0000-4000-8000-000000000306',
      'f1020000-0000-4000-8000-000000000301',
      'f1020000-0000-4000-8000-000000000308'
    );
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'ITEM_VALIDATION_FAILED'
     OR EXISTS (SELECT 1 FROM public.messages
       WHERE assessment_request_id = 'f1020000-0000-4000-8000-000000000308')
     OR EXISTS (SELECT 1 FROM private.transfer_assessments
       WHERE delivery_request_id = 'f1020000-0000-4000-8000-000000000308') THEN
    RAISE EXCEPTION 'invalid reviewed payload created a delivery effect: %', v_error;
  END IF;
END;
$checks$;

SELECT 'target_and_payload_rejection' AS case_id, TRUE AS ok;
COMMIT;
