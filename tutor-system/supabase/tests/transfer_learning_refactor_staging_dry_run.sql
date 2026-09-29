-- #!/usr/bin/env psql
-- Test responsibility: verify the transfer refactor migration against the dedicated staging room without committing changes.

DO $test$
DECLARE
  v_room uuid := '3581ba48-d1a7-45a0-bbee-0c9e3e6e7515';
  v_tutor uuid := '327a8707-4dc0-4320-a4e3-318fbb0b327a';
  v_student uuid := '646675bd-493c-4092-a5b7-5225e93f6466';
  v_message uuid := 'cd70c26a-3c12-407d-8d38-14325d0ff399';
  v_checklist uuid := '3e2e948d-43cd-4e9a-b208-851f03dfaa08';
  v_enabled boolean;
  v_result jsonb;
BEGIN
  SELECT transfer_learning_enabled INTO v_enabled FROM public.rooms WHERE id = v_room;
  IF v_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Existing transfer room was not backfilled';
  END IF;

  v_result := public.initialize_transfer_checklist_v1(
    v_room, v_student,
    '[{"area_text":"Verify through the official app","item_type":"verification_step","priority":"critical"}]'::jsonb,
    v_tutor
  );
  IF (v_result->>'checklist_id')::uuid IS DISTINCT FROM v_checklist THEN
    RAISE EXCEPTION 'Repeated target initialization changed the checklist';
  END IF;

  v_result := public.get_transfer_message_analysis_context_v1(v_room, v_message, v_tutor);
  IF (v_result->>'student_id')::uuid IS DISTINCT FROM v_student OR
     (v_result->>'checklist_id')::uuid IS DISTINCT FROM v_checklist OR
     jsonb_array_length(v_result->'items') = 0 THEN
    RAISE EXCEPTION 'Learner analysis context lost its approved scope';
  END IF;
END;
$test$;
