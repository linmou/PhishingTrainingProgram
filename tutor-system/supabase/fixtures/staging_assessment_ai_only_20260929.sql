--!/usr/bin/env psql
-- Purpose: seed the named staging browser room with four transfer items for lifecycle verification.
BEGIN;

DO $fixture$
DECLARE
  v_room uuid := '3581ba48-d1a7-45a0-bbee-0c9e3e6e7515';
  v_tutor uuid := '327a8707-4dc0-4320-a4e3-318fbb0b327a';
  v_student uuid := '646675bd-493c-4092-a5b7-5225e93f6466';
  v_checklist uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id = v_room AND tutor_id = v_tutor)
    OR NOT EXISTS (SELECT 1 FROM public.sessions
      WHERE room_id = v_room AND student_id = v_student AND status = 'active')
    OR NOT EXISTS (SELECT 1 FROM public.messages
      WHERE room_id = v_room AND user_id = v_student AND user_role = 'student'
        AND content LIKE 'The alert uses an account name I recognize%')
  THEN RAISE EXCEPTION 'STAGING_ROOM_NOT_READY'; END IF;

  PERFORM set_config('app.transfer_operation', 'on', true);
  SELECT id INTO v_checklist FROM public.session_checklists
    WHERE room_id = v_room AND student_id = v_student
      AND progress_policy_version = 'transfer_v1' AND is_active FOR UPDATE;
  IF v_checklist IS NULL THEN
    INSERT INTO public.session_checklists(room_id,student_id,template_name,progress_policy_version,is_active)
    VALUES(v_room,v_student,'Staging AI-only assessment rerun','transfer_v1',true)
    RETURNING id INTO v_checklist;
  END IF;

  INSERT INTO public.checklist_items(checklist_id,area_text,item_type,priority,status,understanding_level)
  SELECT v_checklist, area_text, 'verification_step', 'critical', 'partially_covered', 'basic'
  FROM (VALUES
    ('Verify a familiar sender through the official app'),
    ('Verify a payment warning using a saved contact'),
    ('Reject urgency in an account reset link'),
    ('Check a delivery alert without its embedded link')
  ) AS fixture(area_text)
  WHERE NOT EXISTS (SELECT 1 FROM public.checklist_items i
    WHERE i.checklist_id = v_checklist AND i.area_text = fixture.area_text);
END;
$fixture$;

SELECT c.id AS checklist_id, c.room_id, c.student_id, count(i.id) AS eligible_items
FROM public.session_checklists c JOIN public.checklist_items i ON i.checklist_id = c.id
WHERE c.room_id = '3581ba48-d1a7-45a0-bbee-0c9e3e6e7515'
  AND c.student_id = '646675bd-493c-4092-a5b7-5225e93f6466'
  AND c.progress_policy_version = 'transfer_v1'
  AND i.status = 'partially_covered' AND i.understanding_level = 'basic'
GROUP BY c.id, c.room_id, c.student_id;

COMMIT;
