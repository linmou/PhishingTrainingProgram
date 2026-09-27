--!/usr/bin/env psql
-- Purpose: seed one valid synthetic legacy assessment on a disposable pre-migration restore.

BEGIN;
SELECT set_config('app.transfer_operation', 'on', true);

INSERT INTO public.users(id, email, display_name, "current_role", status)
VALUES
  ('f1020000-0000-4000-8000-000000000001', 'transfer-legacy-fixture-tutor@example.invalid', 'Legacy Fixture Tutor', 'tutor', 'active'),
  ('f1020000-0000-4000-8000-000000000002', 'transfer-legacy-fixture-student@example.invalid', 'Legacy Fixture Student', 'student', 'active');

INSERT INTO public.rooms(id, tutor_id, title)
VALUES ('f1020000-0000-4000-8000-000000000003', 'f1020000-0000-4000-8000-000000000001', 'Synthetic Legacy Transfer');

INSERT INTO public.sessions(tutor_id, student_id, room_id, status)
VALUES (
  'f1020000-0000-4000-8000-000000000001',
  'f1020000-0000-4000-8000-000000000002',
  'f1020000-0000-4000-8000-000000000003', 'active'
);

INSERT INTO public.session_checklists(
  id, room_id, student_id, template_name, progress_policy_version, is_active
) VALUES (
  'f1020000-0000-4000-8000-000000000004',
  'f1020000-0000-4000-8000-000000000003',
  'f1020000-0000-4000-8000-000000000002',
  'Synthetic Legacy Transfer', 'transfer_v1', TRUE
);

INSERT INTO public.checklist_items(
  id, checklist_id, area_text, item_type, priority, status, understanding_level
) VALUES (
  'f1020000-0000-4000-8000-000000000005',
  'f1020000-0000-4000-8000-000000000004',
  'Verify sender through an independent channel',
  'verification_step', 'critical', 'partially_covered', 'basic'
);

INSERT INTO public.messages(id, room_id, user_id, content, user_role)
VALUES (
  'f1020000-0000-4000-8000-000000000006',
  'f1020000-0000-4000-8000-000000000003',
  'f1020000-0000-4000-8000-000000000002',
  'I trusted the familiar sender.', 'student'
);

INSERT INTO public.messages(
  id, room_id, user_id, content, user_role, parent_message_id,
  assessment_key, assessment_selection_type, assessment_checklist_id,
  assessment_item_id, assessment_lifecycle
) VALUES (
  'f1020000-0000-4000-8000-000000000007',
  'f1020000-0000-4000-8000-000000000003',
  'f1020000-0000-4000-8000-000000000001',
  'Which action verifies this message?', 'tutor',
  'f1020000-0000-4000-8000-000000000006',
  ARRAY['B'], 'single',
  'f1020000-0000-4000-8000-000000000004',
  'f1020000-0000-4000-8000-000000000005', 'delivered'
);

COMMIT;
