--!/usr/bin/env psql
-- Purpose: verify synthetic legacy key reconciliation after the transfer authority migration.

BEGIN;

DO $test$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'assessment_key'
  ) OR NOT EXISTS (
    SELECT 1 FROM private.transfer_assessments a
    JOIN public.messages m ON m.id = a.question_message_id
    WHERE a.question_message_id = 'f1020000-0000-4000-8000-000000000007'
      AND a.id = m.assessment_id
      AND a.student_id = 'f1020000-0000-4000-8000-000000000002'
      AND m.assessment_student_id = a.student_id
      AND a.checklist_id = 'f1020000-0000-4000-8000-000000000004'
      AND a.item_id = 'f1020000-0000-4000-8000-000000000005'
      AND a.correct_option_ids = ARRAY['B']
      AND a.learner_safe_explanation IS NULL
      AND a.lifecycle = 'legacy_incomplete'
      AND m.assessment_lifecycle = 'legacy_incomplete'
  ) THEN
    RAISE EXCEPTION 'synthetic legacy assessment was not reconciled privately';
  END IF;
END;
$test$;

SELECT 'synthetic_legacy_reconciliation' AS case_id, TRUE AS ok;
ROLLBACK;
