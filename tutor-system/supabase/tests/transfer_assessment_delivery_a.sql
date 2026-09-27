--!/usr/bin/env psql
-- Purpose: hold the first reviewed assessment delivery until a second delivery blocks on the room.

\set ON_ERROR_STOP on
SET application_name = 'transfer_assessment_race_a';
BEGIN;

SELECT public.send_reviewed_tutor_response_v4(
  jsonb_build_object(
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
  ),
  'f1020000-0000-4000-8000-000000000303',
  'f1020000-0000-4000-8000-000000000302',
  'f1020000-0000-4000-8000-000000000304',
  'f1020000-0000-4000-8000-000000000305',
  'f1020000-0000-4000-8000-000000000306',
  'f1020000-0000-4000-8000-000000000301',
  'f1020000-0000-4000-8000-000000000309'
)->'message'->'assessment'->>'id' IS NOT NULL AS delivered \gset

\if :delivered
\else
  DO $fail$ BEGIN RAISE EXCEPTION 'first delivery did not return an assessment'; END; $fail$;
\endif

\prompt 'Start delivery B, confirm its Lock wait with race_observer.sql, then press Enter to commit A: ' delivery_barrier
COMMIT;
