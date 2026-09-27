--!/usr/bin/env psql
-- Purpose: verify every terminal write stage rolls back without partial assessment effects.

BEGIN;

CREATE FUNCTION private.transfer_assessment_test_fail()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fail$
BEGIN
  IF current_setting('app.transfer_fail_stage', true) = TG_ARGV[0] THEN
    RAISE EXCEPTION 'INJECTED_%', TG_ARGV[0] USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$fail$;

CREATE TRIGGER transfer_fail_event BEFORE INSERT ON private.learning_event_inbox
FOR EACH ROW EXECUTE FUNCTION private.transfer_assessment_test_fail('event');
CREATE TRIGGER transfer_fail_event_state BEFORE UPDATE ON private.learning_event_inbox
FOR EACH ROW EXECUTE FUNCTION private.transfer_assessment_test_fail('event_state');
CREATE TRIGGER transfer_fail_evidence BEFORE INSERT ON public.coverage_evidence
FOR EACH ROW EXECUTE FUNCTION private.transfer_assessment_test_fail('evidence');
CREATE TRIGGER transfer_fail_item BEFORE UPDATE ON public.checklist_items
FOR EACH ROW EXECUTE FUNCTION private.transfer_assessment_test_fail('item');
CREATE TRIGGER transfer_fail_history BEFORE INSERT ON public.checklist_updates
FOR EACH ROW EXECUTE FUNCTION private.transfer_assessment_test_fail('history');
CREATE TRIGGER transfer_fail_assessment BEFORE UPDATE ON private.transfer_assessments
FOR EACH ROW EXECUTE FUNCTION private.transfer_assessment_test_fail('assessment');
CREATE TRIGGER transfer_fail_message BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION private.transfer_assessment_test_fail('message');
CREATE TRIGGER transfer_fail_attempt BEFORE INSERT ON private.transfer_assessment_attempts
FOR EACH ROW EXECUTE FUNCTION private.transfer_assessment_test_fail('attempt');

SELECT set_config('app.transfer_operation', 'on', true);
INSERT INTO public.users(id, email, display_name, "current_role", status)
VALUES
  ('f1020000-0000-4000-8000-000000000201', 'transfer-fault-tutor@example.invalid', 'Fault Tutor', 'tutor', 'active'),
  ('f1020000-0000-4000-8000-000000000202', 'transfer-fault-student@example.invalid', 'Fault Student', 'student', 'active');
INSERT INTO public.rooms(id, tutor_id, title)
VALUES ('f1020000-0000-4000-8000-000000000203', 'f1020000-0000-4000-8000-000000000201', 'Terminal fault fixture');
INSERT INTO public.sessions(tutor_id, student_id, room_id, status)
VALUES (
  'f1020000-0000-4000-8000-000000000201',
  'f1020000-0000-4000-8000-000000000202',
  'f1020000-0000-4000-8000-000000000203', 'active'
);
INSERT INTO public.session_checklists(
  id, room_id, student_id, template_name, progress_policy_version, is_active
) VALUES (
  'f1020000-0000-4000-8000-000000000204',
  'f1020000-0000-4000-8000-000000000203',
  'f1020000-0000-4000-8000-000000000202',
  'Terminal fault fixture', 'transfer_v1', TRUE
);
INSERT INTO public.checklist_items(
  id, checklist_id, area_text, item_type, priority, status, understanding_level
) VALUES (
  'f1020000-0000-4000-8000-000000000205',
  'f1020000-0000-4000-8000-000000000204',
  'Verify an unexpected sender', 'verification_step', 'critical', 'partially_covered', 'basic'
);
INSERT INTO public.messages(id, room_id, user_id, content, user_role)
VALUES (
  'f1020000-0000-4000-8000-000000000206',
  'f1020000-0000-4000-8000-000000000203',
  'f1020000-0000-4000-8000-000000000202',
  'The sender looked familiar.', 'student'
);

CREATE TEMP TABLE transfer_fault_fixture(
  assessment_id UUID, question_id UUID, answer_id UUID
) ON COMMIT DROP;
DO $setup$
DECLARE
  v_result JSONB;
  v_question UUID;
  v_assessment UUID;
BEGIN
  v_result := public.send_reviewed_tutor_response_v4(
    jsonb_build_object(
      'decision', jsonb_build_object(
        'mode', 'assessment', 'instruction', 'transfer_assess',
        'target_item_id', 'f1020000-0000-4000-8000-000000000205'
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
          'source_evidence_message_ids', jsonb_build_array('f1020000-0000-4000-8000-000000000206')
        )
      )
    ),
    'f1020000-0000-4000-8000-000000000203',
    'f1020000-0000-4000-8000-000000000202',
    'f1020000-0000-4000-8000-000000000204',
    'f1020000-0000-4000-8000-000000000205',
    'f1020000-0000-4000-8000-000000000206',
    'f1020000-0000-4000-8000-000000000201', gen_random_uuid()
  );
  v_question := (v_result->'message'->>'id')::UUID;
  v_assessment := (v_result->'message'->'assessment'->>'id')::UUID;
  v_result := public.post_assessment_message_v2(
    'f1020000-0000-4000-8000-000000000203', 'B', v_question,
    v_assessment, ARRAY['B'], 'f1020000-0000-4000-8000-000000000202', gen_random_uuid()
  );
  INSERT INTO transfer_fault_fixture VALUES (
    v_assessment, v_question, (v_result->'message'->>'id')::UUID
  );
END;
$setup$;

CREATE TEMP TABLE transfer_fault_results(stage TEXT PRIMARY KEY, ok BOOLEAN, detail TEXT) ON COMMIT DROP;
DO $test$
DECLARE
  v_stage TEXT;
  v_fixture transfer_fault_fixture%ROWTYPE;
  v_error TEXT;
BEGIN
  SELECT * INTO v_fixture FROM transfer_fault_fixture;
  FOREACH v_stage IN ARRAY ARRAY[
    'event', 'evidence', 'item', 'history', 'event_state', 'assessment', 'message', 'attempt'
  ]
  LOOP
    PERFORM set_config('app.transfer_fail_stage', v_stage, true);
    v_error := NULL;
    BEGIN
      PERFORM public.process_assessment_message_v2(
        v_fixture.assessment_id, v_fixture.answer_id,
        'f1020000-0000-4000-8000-000000000202', gen_random_uuid(),
        0, 'open', 'passed', ARRAY['B'],
        jsonb_build_object('status', 'covered', 'understanding_level', 'good'), 'assessment_pass'
      );
    EXCEPTION WHEN OTHERS THEN
      v_error := SQLERRM;
    END;
    PERFORM set_config('app.transfer_fail_stage', '', true);
    INSERT INTO transfer_fault_results VALUES (
      v_stage,
      v_error = 'INJECTED_' || v_stage
        AND (SELECT lifecycle FROM private.transfer_assessments WHERE id = v_fixture.assessment_id) = 'open'
        AND (SELECT attempt_count FROM private.transfer_assessments WHERE id = v_fixture.assessment_id) = 0
        AND (SELECT assessment_lifecycle FROM public.messages WHERE id = v_fixture.question_id) = 'delivered'
        AND (SELECT status FROM public.checklist_items
          WHERE id = 'f1020000-0000-4000-8000-000000000205') = 'partially_covered'
        AND (SELECT attempts_count FROM public.checklist_items
          WHERE id = 'f1020000-0000-4000-8000-000000000205') = 0
        AND NOT EXISTS (SELECT 1 FROM private.transfer_assessment_attempts
          WHERE assessment_id = v_fixture.assessment_id)
        AND NOT EXISTS (SELECT 1 FROM private.learning_event_inbox
          WHERE event_payload->>'assessment_id' = v_fixture.assessment_id::TEXT)
        AND NOT EXISTS (SELECT 1 FROM public.coverage_evidence
          WHERE assessment_id = v_fixture.assessment_id)
        AND NOT EXISTS (SELECT 1 FROM public.checklist_updates
          WHERE assessment_id = v_fixture.assessment_id),
      COALESCE(v_error, 'unexpected success')
    );
  END LOOP;
  IF (SELECT count(*) FROM transfer_fault_results WHERE ok) <> 8 THEN
    RAISE EXCEPTION 'terminal fault rollback checks failed';
  END IF;
END;
$test$;

SELECT * FROM transfer_fault_results ORDER BY stage;

DROP TRIGGER transfer_fail_event ON private.learning_event_inbox;
DROP TRIGGER transfer_fail_event_state ON private.learning_event_inbox;
DROP TRIGGER transfer_fail_evidence ON public.coverage_evidence;
DROP TRIGGER transfer_fail_item ON public.checklist_items;
DROP TRIGGER transfer_fail_history ON public.checklist_updates;
DROP TRIGGER transfer_fail_assessment ON private.transfer_assessments;
DROP TRIGGER transfer_fail_message ON public.messages;
DROP TRIGGER transfer_fail_attempt ON private.transfer_assessment_attempts;

DO $normal$
DECLARE
  v_fixture transfer_fault_fixture%ROWTYPE;
  v_result JSONB;
BEGIN
  SELECT * INTO v_fixture FROM transfer_fault_fixture;
  v_result := public.process_assessment_message_v2(
    v_fixture.assessment_id, v_fixture.answer_id,
    'f1020000-0000-4000-8000-000000000202', gen_random_uuid(),
    0, 'open', 'passed', ARRAY['B'],
    jsonb_build_object('status', 'covered', 'understanding_level', 'good'), 'assessment_pass'
  );
  IF v_result->>'answer_outcome' <> 'passed'
     OR (SELECT lifecycle FROM private.transfer_assessments
       WHERE id = v_fixture.assessment_id) <> 'passed'
     OR (SELECT count(*) FROM private.transfer_assessment_attempts
       WHERE assessment_id = v_fixture.assessment_id) <> 1
     OR (SELECT count(*) FROM private.learning_event_inbox
       WHERE event_payload->>'assessment_id' = v_fixture.assessment_id::TEXT) <> 1
     OR (SELECT count(*) FROM public.coverage_evidence
       WHERE assessment_id = v_fixture.assessment_id) <> 1
     OR (SELECT count(*) FROM public.checklist_updates
       WHERE assessment_id = v_fixture.assessment_id) <> 1 THEN
    RAISE EXCEPTION 'normal terminal call failed after removing fault triggers';
  END IF;
END;
$normal$;

SELECT 'terminal_faults_and_recovery' AS case_id, TRUE AS ok;
ROLLBACK;
