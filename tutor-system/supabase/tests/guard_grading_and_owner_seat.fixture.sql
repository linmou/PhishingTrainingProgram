--!/usr/bin/env psql
-- Purpose: seed committed fixtures for the #110 Guard-grading and #112 owner-seat tests.
-- Run as the migration executor (postgres) inside an owned disposable database, BEFORE the candidate
-- migration: room 3's owner seat is pre-existing data that the migration must leave in place.

\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.transfer_operation', 'on', true);

INSERT INTO public.users(id, email, display_name, "current_role", status) VALUES
  ('f1100000-0000-4000-8000-000000000001', 'guard-seat-tutor@example.invalid', 'Guard Seat Tutor', 'tutor', 'active'),
  ('f1100000-0000-4000-8000-000000000002', 'guard-seat-student@example.invalid', 'Guard Seat Student', 'student', 'active'),
  ('f1100000-0000-4000-8000-000000000003', 'guard-seat-student2@example.invalid', 'Guard Seat Student 2', 'student', 'active');

-- Room 1 (#110): a learner, an open assessment and two committed answers, Guard off.
-- Room 2 (#112): empty seat. Room 3 (#112): a pre-existing owner seat (legacy data shape).
INSERT INTO public.rooms(id, tutor_id, title, transfer_learning_enabled) VALUES
  ('f1100000-0000-4000-8000-000000000011', 'f1100000-0000-4000-8000-000000000001', 'guard grading', TRUE),
  ('f1100000-0000-4000-8000-000000000021', 'f1100000-0000-4000-8000-000000000001', 'owner seat empty', TRUE),
  ('f1100000-0000-4000-8000-000000000031', 'f1100000-0000-4000-8000-000000000001', 'owner seat legacy', TRUE);

INSERT INTO public.sessions(tutor_id, student_id, room_id, status) VALUES
  ('f1100000-0000-4000-8000-000000000001', 'f1100000-0000-4000-8000-000000000002', 'f1100000-0000-4000-8000-000000000011', 'active');

-- Pre-existing owner seat, the shape of the one production row found on 2026-11-19.
INSERT INTO public.sessions(id, tutor_id, student_id, room_id, status) VALUES
  ('f1100000-0000-4000-8000-000000000032', 'f1100000-0000-4000-8000-000000000001',
   'f1100000-0000-4000-8000-000000000001', 'f1100000-0000-4000-8000-000000000031', 'active');

INSERT INTO public.session_checklists(id, room_id, student_id, template_name, progress_policy_version)
VALUES ('f1100000-0000-4000-8000-000000000012', 'f1100000-0000-4000-8000-000000000011',
        'f1100000-0000-4000-8000-000000000002', 'guard grading', 'transfer_v1');
INSERT INTO public.checklist_items(id, checklist_id, area_text, item_type, priority, status, understanding_level)
VALUES ('f1100000-0000-4000-8000-000000000013', 'f1100000-0000-4000-8000-000000000012',
        'Verify the source independently', 'understanding', 'critical', 'pending', 'none');
INSERT INTO public.messages(id, room_id, user_id, user_role, content)
VALUES ('f1100000-0000-4000-8000-000000000014', 'f1100000-0000-4000-8000-000000000011',
        'f1100000-0000-4000-8000-000000000002', 'student', 'I will verify independently through the official app.');

DO $setup$
DECLARE
  v_result jsonb;
  v_question uuid;
  v_assessment uuid;
BEGIN
  PERFORM public.start_learner_visit_v1('f1100000-0000-4000-8000-000000000011',
    'f1100000-0000-4000-8000-000000000002', 'f1100000-0000-4000-8000-000000000018');
  -- The learner demonstrates understanding, which makes the target due for an assessment.
  PERFORM public.apply_transfer_message_analysis_v1('f1100000-0000-4000-8000-000000000011',
    'f1100000-0000-4000-8000-000000000014', 'f1100000-0000-4000-8000-000000000001', gen_random_uuid(),
    jsonb_build_object('events', jsonb_build_array(jsonb_build_object(
        'item_id', 'f1100000-0000-4000-8000-000000000013', 'kind', 'demonstrated_understanding',
        'evidence_type', 'explanation', 'evidence_message_id', 'f1100000-0000-4000-8000-000000000014',
        'evidence_quote', 'I will verify independently through the official app.',
        'explanation', 'Accepted fixture evidence for the requested transition.')),
      'explanation', 'Deterministic fixture analysis.'));
  v_result := public.send_reviewed_transfer_assessment_v1(
    jsonb_build_object('target_item_id', 'f1100000-0000-4000-8000-000000000013', 'reason', 'Verify developed understanding.',
      'assessment', jsonb_build_object(
        'selection_type', 'single', 'stem', 'Which action verifies this new request independently?',
        'options', '[{"id":"A","text":"Reply"},{"id":"B","text":"Use the official app"},{"id":"C","text":"Pay immediately"},{"id":"D","text":"Forward"}]'::jsonb,
        'correct_option_ids', '["B"]'::jsonb,
        'learner_safe_explanation', 'Use a separate trusted channel.',
        'transfer_basis', jsonb_build_object('concept_rule', 'Independent verification',
          'source_context', 'Account warning email', 'changed_context', 'Guard grading fixture',
          'source_evidence_message_ids', jsonb_build_array('f1100000-0000-4000-8000-000000000014')))),
    'f1100000-0000-4000-8000-000000000011', 'f1100000-0000-4000-8000-000000000002',
    'f1100000-0000-4000-8000-000000000012', 'f1100000-0000-4000-8000-000000000013',
    'f1100000-0000-4000-8000-000000000014', 'f1100000-0000-4000-8000-000000000001',
    'f1100000-0000-4000-8000-000000000015');
  v_question := (v_result->'message'->>'id')::uuid;
  SELECT id INTO STRICT v_assessment FROM private.transfer_assessments WHERE question_message_id = v_question;
  -- Two committed answers: a wrong one (answer 1) and a correct one (answer 2).
  PERFORM public.post_assessment_message_v2('f1100000-0000-4000-8000-000000000011', 'A', v_question, v_assessment,
    ARRAY['A'], 'f1100000-0000-4000-8000-000000000002', 'f1100000-0000-4000-8000-000000000016');
  PERFORM public.post_assessment_message_v2('f1100000-0000-4000-8000-000000000011', 'B', v_question, v_assessment,
    ARRAY['B'], 'f1100000-0000-4000-8000-000000000002', 'f1100000-0000-4000-8000-000000000017');
END;
$setup$;

-- Helper table for the tests: the assessment and its two answers.
CREATE TABLE public.guard_seat_fixture AS
SELECT a.id AS assessment_id, a.student_id,
  (SELECT m.id FROM public.messages m WHERE m.assessment_request_id = 'f1100000-0000-4000-8000-000000000016') AS answer_wrong,
  (SELECT m.id FROM public.messages m WHERE m.assessment_request_id = 'f1100000-0000-4000-8000-000000000017') AS answer_right
FROM private.transfer_assessments a
WHERE a.item_id = 'f1100000-0000-4000-8000-000000000013' AND a.lifecycle = 'open';
GRANT SELECT ON public.guard_seat_fixture TO service_role;

DO $check$
BEGIN
  ASSERT (SELECT count(*) FROM public.guard_seat_fixture WHERE answer_wrong IS NOT NULL AND answer_right IS NOT NULL) = 1,
    'fixture did not create one open assessment with two answers';
END;
$check$;
COMMIT;
