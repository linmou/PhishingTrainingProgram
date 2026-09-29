--!/usr/bin/env psql
-- Purpose: inspect the dedicated staging browser room's provider and assessment outcomes.
SELECT attempt_ordinal, validation_outcome, error_code, finish_reason,
  raw_response->'choices'->0->'message'->>'content' AS candidate
FROM private.transfer_provider_attempts
WHERE room_id = '92081ace-7370-4fbf-bbb4-39aa10bf7f73'
ORDER BY created_at DESC, attempt_ordinal DESC
LIMIT 8;

SELECT id, question_message_id, item_id, lifecycle, attempt_count, terminal_result,
  terminal_answer_message_id, created_at, closed_at
FROM private.transfer_assessments
WHERE room_id = '92081ace-7370-4fbf-bbb4-39aa10bf7f73'
ORDER BY created_at;

SELECT a.assessment_id, a.attempt_number, a.selected_option_ids,
  a.answer_outcome, a.processing_state, a.answer_message_id, a.learning_event_id
FROM private.transfer_assessment_attempts a
JOIN private.transfer_assessments q ON q.id = a.assessment_id
WHERE q.room_id = '92081ace-7370-4fbf-bbb4-39aa10bf7f73'
ORDER BY q.created_at, a.attempt_number;

SELECT item_id, event_kind, processing_state, source_message_id, linked_update_id,
  linked_evidence_id, created_at
FROM private.learning_event_inbox
WHERE room_id = '92081ace-7370-4fbf-bbb4-39aa10bf7f73'
ORDER BY created_at;

SELECT id, area_text, status, understanding_level, attempts_count
FROM public.checklist_items
WHERE checklist_id = '211e1b68-eaf8-440b-870b-5b7014b0b479'
ORDER BY created_at;
