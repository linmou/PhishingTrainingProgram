--!/usr/bin/env psql
-- Purpose: verify one stem-only public delivery matches one private assessment after the room-lock race.

BEGIN;

DO $assert$
BEGIN
  IF (SELECT count(*) FROM private.transfer_assessments
      WHERE room_id = 'f1020000-0000-4000-8000-000000000303') <> 1
     OR (SELECT count(*) FROM public.messages
       WHERE assessment_request_id = 'f1020000-0000-4000-8000-000000000309') <> 1
     OR EXISTS (SELECT 1 FROM public.messages
       WHERE assessment_request_id = 'f1020000-0000-4000-8000-000000000310')
     OR EXISTS (SELECT 1 FROM private.transfer_assessments
       WHERE delivery_request_id = 'f1020000-0000-4000-8000-000000000310')
     OR NOT EXISTS (
       SELECT 1 FROM private.transfer_assessments a
       JOIN public.messages m ON m.id = a.question_message_id
       WHERE a.delivery_request_id = 'f1020000-0000-4000-8000-000000000309'
         AND a.student_id = 'f1020000-0000-4000-8000-000000000302'
         AND m.assessment_student_id = a.student_id
         AND m.assessment_id = a.id
         AND m.content = 'Which action is safest?'
         AND jsonb_array_length(m.assessment_options) = 4
         AND a.correct_option_ids = ARRAY['B']
         AND a.learner_safe_explanation IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'delivery race left a mismatched or partial public/private pair';
  END IF;
END;
$assert$;

SELECT 'delivery_room_lock_atomicity' AS case_id, TRUE AS ok;
ROLLBACK;
