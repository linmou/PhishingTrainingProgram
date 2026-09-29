--!/usr/bin/env psql
-- Purpose: inspect the dedicated staging browser room's provider and assessment outcomes.
SELECT jsonb_build_object(
  'provider_responses', (SELECT jsonb_agg(jsonb_build_object(
    'request_id', request_id, 'focus_student_message_id', focus_student_message_id,
    'attempt_ordinal', attempt_ordinal, 'validation_outcome', validation_outcome,
    'error_code', error_code, 'finish_reason', finish_reason,
    'provider_content', raw_response #>> '{choices,0,message,content}'
  ) ORDER BY created_at)
  FROM private.transfer_provider_attempts
  WHERE room_id = '3581ba48-d1a7-45a0-bbee-0c9e3e6e7515'),
  'assessments', (SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'question_message_id', question_message_id, 'item_id', item_id,
    'lifecycle', lifecycle, 'attempt_count', attempt_count,
    'terminal_result', terminal_result, 'terminal_answer_message_id', terminal_answer_message_id
  ) ORDER BY created_at)
  FROM private.transfer_assessments
  WHERE room_id = '3581ba48-d1a7-45a0-bbee-0c9e3e6e7515'),
  'attempts', (SELECT jsonb_agg(jsonb_build_object(
    'assessment_id', a.assessment_id, 'attempt_number', a.attempt_number,
    'selected_option_ids', a.selected_option_ids, 'answer_outcome', a.answer_outcome,
    'processing_state', a.processing_state, 'answer_message_id', a.answer_message_id,
    'learning_event_id', a.learning_event_id
  ) ORDER BY q.created_at, a.attempt_number)
  FROM private.transfer_assessment_attempts a
  JOIN private.transfer_assessments q ON q.id = a.assessment_id
  WHERE q.room_id = '3581ba48-d1a7-45a0-bbee-0c9e3e6e7515'),
  'events', (SELECT jsonb_agg(jsonb_build_object(
    'item_id', item_id, 'event_kind', event_kind, 'processing_state', processing_state,
    'source_message_id', source_message_id, 'linked_update_id', linked_update_id,
    'linked_evidence_id', linked_evidence_id
  ) ORDER BY created_at)
  FROM private.learning_event_inbox
  WHERE room_id = '3581ba48-d1a7-45a0-bbee-0c9e3e6e7515'),
  'items', (SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'area_text', area_text, 'status', status,
    'understanding_level', understanding_level, 'attempts_count', attempts_count
  ) ORDER BY created_at)
  FROM public.checklist_items
  WHERE checklist_id IN (SELECT id FROM public.session_checklists
    WHERE room_id = '3581ba48-d1a7-45a0-bbee-0c9e3e6e7515'))
) AS state;
