--!/usr/bin/env psql
-- Purpose: seed two persisted assessment races on an isolated migrated database clone.

BEGIN;
SELECT set_config('app.transfer_operation', 'on', true);

INSERT INTO public.users(id, email, display_name, "current_role", status)
VALUES
  ('f1020000-0000-4000-8000-000000000101', 'transfer-race-tutor@example.invalid', 'Race Tutor', 'tutor', 'active'),
  ('f1020000-0000-4000-8000-000000000102', 'transfer-race-student@example.invalid', 'Race Student', 'student', 'active');

DO $setup$
DECLARE
  v_case RECORD;
  v_result JSONB;
  v_question UUID;
  v_assessment UUID;
  v_payload JSONB;
BEGIN
  FOR v_case IN
    SELECT * FROM (VALUES
      ('wrong_wrong',
        'f1020000-0000-4000-8000-000000000111'::UUID,
        'f1020000-0000-4000-8000-000000000112'::UUID,
        'f1020000-0000-4000-8000-000000000113'::UUID,
        'f1020000-0000-4000-8000-000000000114'::UUID,
        'f1020000-0000-4000-8000-000000000115'::UUID,
        'f1020000-0000-4000-8000-000000000116'::UUID,
        'f1020000-0000-4000-8000-000000000117'::UUID),
      ('correct_wrong',
        'f1020000-0000-4000-8000-000000000121'::UUID,
        'f1020000-0000-4000-8000-000000000122'::UUID,
        'f1020000-0000-4000-8000-000000000123'::UUID,
        'f1020000-0000-4000-8000-000000000124'::UUID,
        'f1020000-0000-4000-8000-000000000125'::UUID,
        'f1020000-0000-4000-8000-000000000126'::UUID,
        'f1020000-0000-4000-8000-000000000127'::UUID)
    ) AS cases(name, room_id, checklist_id, item_id, focus_id, delivery_id, answer_a_id, answer_b_id)
  LOOP
    INSERT INTO public.rooms(id, tutor_id, title)
    VALUES (v_case.room_id, 'f1020000-0000-4000-8000-000000000101', v_case.name);
    INSERT INTO public.sessions(tutor_id, student_id, room_id, status)
    VALUES (
      'f1020000-0000-4000-8000-000000000101',
      'f1020000-0000-4000-8000-000000000102', v_case.room_id, 'active'
    );
    INSERT INTO public.session_checklists(
      id, room_id, student_id, template_name, progress_policy_version, is_active
    ) VALUES (
      v_case.checklist_id, v_case.room_id,
      'f1020000-0000-4000-8000-000000000102', v_case.name, 'transfer_v1', TRUE
    );
    INSERT INTO public.checklist_items(
      id, checklist_id, area_text, item_type, priority, status, understanding_level
    ) VALUES (
      v_case.item_id, v_case.checklist_id, 'Verify the source independently',
      'verification_step', 'critical', 'partially_covered', 'basic'
    );
    INSERT INTO public.messages(id, room_id, user_id, content, user_role)
    VALUES (
      v_case.focus_id, v_case.room_id,
      'f1020000-0000-4000-8000-000000000102', 'The sender looked familiar.', 'student'
    );
    v_payload := jsonb_build_object(
      'decision', jsonb_build_object(
        'mode', 'assessment', 'instruction', 'transfer_assess',
        'target_item_id', v_case.item_id::TEXT
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
          'source_evidence_message_ids', jsonb_build_array(v_case.focus_id::TEXT)
        )
      )
    );
    v_result := public.send_reviewed_tutor_response_v4(
      v_payload, v_case.room_id, 'f1020000-0000-4000-8000-000000000102',
      v_case.checklist_id, v_case.item_id, v_case.focus_id,
      'f1020000-0000-4000-8000-000000000101', v_case.delivery_id
    );
    v_question := (v_result->'message'->>'id')::UUID;
    v_assessment := (v_result->'message'->'assessment'->>'id')::UUID;
    PERFORM public.post_assessment_message_v2(
      v_case.room_id, CASE WHEN v_case.name = 'correct_wrong' THEN 'B' ELSE 'A' END,
      v_question, v_assessment,
      CASE WHEN v_case.name = 'correct_wrong' THEN ARRAY['B'] ELSE ARRAY['A'] END,
      'f1020000-0000-4000-8000-000000000102', v_case.answer_a_id
    );
    PERFORM public.post_assessment_message_v2(
      v_case.room_id, 'A', v_question, v_assessment, ARRAY['A'],
      'f1020000-0000-4000-8000-000000000102', v_case.answer_b_id
    );
  END LOOP;
END;
$setup$;

COMMIT;
