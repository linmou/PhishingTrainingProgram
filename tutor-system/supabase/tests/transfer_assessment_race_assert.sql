--!/usr/bin/env psql
-- Purpose: verify persisted attempts and causal effects after a two-session race.

BEGIN;
CREATE TEMP TABLE race_selected ON COMMIT DROP AS
SELECT a.id AS assessment_id, a.attempt_count, a.lifecycle, a.item_id,
  CASE :'scenario'
    WHEN 'wrong_wrong' THEN 'retry'
    WHEN 'correct_wrong' THEN 'passed'
    WHEN 'wrong_correct' THEN 'passed_after_retry' END AS expected_outcome
FROM private.transfer_assessments a
WHERE a.delivery_request_id = CASE :'scenario'
  WHEN 'wrong_wrong' THEN 'f1020000-0000-4000-8000-000000000115'::UUID
  WHEN 'correct_wrong' THEN 'f1020000-0000-4000-8000-000000000125'::UUID
  WHEN 'wrong_correct' THEN 'f1020000-0000-4000-8000-000000000135'::UUID END;

DO $assert$
DECLARE
  v_case race_selected%ROWTYPE;
  v_attempts INTEGER;
  v_events INTEGER;
  v_evidence INTEGER;
  v_updates INTEGER;
  v_status TEXT;
BEGIN
  SELECT * INTO v_case FROM race_selected;
  IF NOT FOUND THEN RAISE EXCEPTION 'race fixture not found'; END IF;
  SELECT count(*) INTO v_attempts FROM private.transfer_assessment_attempts
  WHERE assessment_id = v_case.assessment_id;
  SELECT count(*) INTO v_events FROM private.learning_event_inbox
  WHERE event_payload->>'assessment_id' = v_case.assessment_id::TEXT;
  SELECT count(*) INTO v_evidence FROM public.coverage_evidence
  WHERE assessment_id = v_case.assessment_id;
  SELECT count(*) INTO v_updates FROM public.checklist_updates
  WHERE assessment_id = v_case.assessment_id;
  SELECT status INTO v_status FROM public.checklist_items WHERE id = v_case.item_id;
  IF (v_case.expected_outcome <> 'passed_after_retry'
       AND (v_attempts <> 1 OR v_case.attempt_count <> 1))
     OR (v_case.expected_outcome = 'retry' AND (
       v_case.lifecycle <> 'open' OR v_events <> 0 OR v_evidence <> 0
       OR v_updates <> 0 OR v_status <> 'partially_covered'
     )) OR (v_case.expected_outcome = 'passed' AND (
       v_case.lifecycle <> 'passed' OR v_events <> 1 OR v_evidence <> 1
       OR v_updates <> 1 OR v_status <> 'covered'
     )) OR (v_case.expected_outcome = 'passed_after_retry' AND (
       v_attempts <> 2 OR v_case.attempt_count <> 2 OR v_case.lifecycle <> 'passed'
       OR v_events <> 1 OR v_evidence <> 1 OR v_updates <> 1 OR v_status <> 'covered'
     )) THEN
    RAISE EXCEPTION 'race state mismatch: attempts %, events %, evidence %, updates %, item %',
      v_attempts, v_events, v_evidence, v_updates, v_status;
  END IF;
END;
$assert$;

SELECT 'two_session_race' AS case_id, TRUE AS ok;
ROLLBACK;
