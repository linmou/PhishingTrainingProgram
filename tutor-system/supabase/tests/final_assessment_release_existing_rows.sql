--!/usr/bin/env psql
-- Purpose: verify final-assessment migration cancellation, history preservation, and idempotency against existing rows.
-- Run only on a disposable restored baseline with psql -v migration_file=<exact candidate SQL path>.
CREATE TEMP TABLE release_assessment_before AS SELECT id, lifecycle, question_message_id,
  attempt_count, to_jsonb(a) AS original FROM private.transfer_assessments a;
CREATE TEMP TABLE release_attempt_before AS SELECT id, to_jsonb(t) AS original
  FROM private.transfer_assessment_attempts t;
CREATE TEMP TABLE release_item_before AS SELECT id, to_jsonb(i) AS original FROM public.checklist_items i;
\i :migration_file
DO $test$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM release_assessment_before WHERE lifecycle='open') THEN
    RAISE EXCEPTION 'Existing-row test requires pre-release open assessments';
  END IF;
  IF (SELECT count(*) FROM private.transfer_assessments) <> (SELECT count(*) FROM release_assessment_before)
    OR (SELECT count(*) FROM private.transfer_assessment_attempts) <> (SELECT count(*) FROM release_attempt_before) THEN
    RAISE EXCEPTION 'Release changed historical assessment/attempt row counts';
  END IF;
  IF EXISTS (SELECT 1 FROM release_assessment_before b JOIN private.transfer_assessments a USING(id)
    WHERE b.lifecycle='open' AND (a.lifecycle<>'cancelled' OR a.closed_at IS NULL
      OR a.attempt_count<>b.attempt_count OR a.terminal_result IS NOT NULL)) THEN
    RAISE EXCEPTION 'Pre-policy open question remains ungradable or consumed an attempt';
  END IF;
  IF EXISTS (SELECT 1 FROM release_assessment_before b JOIN public.messages m ON m.id=b.question_message_id
    JOIN private.transfer_assessments a ON a.id=b.id WHERE b.lifecycle='open'
    AND (m.assessment_lifecycle IS DISTINCT FROM 'cancelled' OR m.assessment_closed_at IS DISTINCT FROM a.closed_at)) THEN
    RAISE EXCEPTION 'Public question disagrees with cancelled private lifecycle';
  END IF;
  IF EXISTS (SELECT 1 FROM release_assessment_before b JOIN private.transfer_assessments a USING(id)
    WHERE b.lifecycle<>'open' AND to_jsonb(a) IS DISTINCT FROM b.original)
    OR EXISTS (SELECT 1 FROM release_attempt_before b JOIN private.transfer_assessment_attempts t USING(id)
      WHERE to_jsonb(t) IS DISTINCT FROM b.original)
    OR EXISTS (SELECT 1 FROM release_item_before b JOIN public.checklist_items i USING(id)
      WHERE to_jsonb(i) IS DISTINCT FROM b.original) THEN
    RAISE EXCEPTION 'Release rewrote completed history, attempts, or learner progress';
  END IF;
  RAISE NOTICE 'PASS: old open questions cancelled; terminal history, attempts, and progress preserved';
END $test$;
CREATE TEMP TABLE release_assessment_after AS SELECT id,to_jsonb(a) AS original FROM private.transfer_assessments a;
\i :migration_file
DO $test$
BEGIN
  IF EXISTS (SELECT 1 FROM release_assessment_after b JOIN private.transfer_assessments a USING(id)
    WHERE to_jsonb(a) IS DISTINCT FROM b.original) THEN
    RAISE EXCEPTION 'Reapplying exact release SQL changed assessment history';
  END IF;
  RAISE NOTICE 'PASS: migration reapplication preserves assessment history';
END $test$;
