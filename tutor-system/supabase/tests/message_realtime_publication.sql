-- Tests enable_message_realtime.sql: exact publication membership and existing client/private permissions.
SELECT set_config('test.expected_message_count',(SELECT count(*)::text FROM public.messages),false);
SELECT set_config('test.expected_feedback_count',(SELECT count(*)::text FROM public.message_feedback),false);
SELECT set_config('test.expected_room_count',(SELECT count(*)::text FROM public.rooms),false);

BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT count(*) FROM public.messages;
SELECT count(*) FROM public.message_feedback;
SELECT count(*),count(password),count(scenario_config) FROM public.rooms;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.messages) <> current_setting('test.expected_message_count')::bigint
    OR (SELECT count(*) FROM public.message_feedback) <> current_setting('test.expected_feedback_count')::bigint
    OR (SELECT count(*) FROM public.rooms) <> current_setting('test.expected_room_count')::bigint THEN
    RAISE EXCEPTION 'ANON_READ_CONTRACT_CHANGED';
  END IF;
  BEGIN
    EXECUTE 'SELECT count(*) FROM private.transfer_assessments';
    RAISE EXCEPTION 'PRIVATE_ASSESSMENT_ACCESS_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.messages';
    RAISE EXCEPTION 'ANON_PUBLICATION_WRITE_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}',true);
SELECT count(*) FROM public.messages;
SELECT count(*) FROM public.message_feedback;
SELECT count(*),count(password),count(scenario_config) FROM public.rooms;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.messages) <> current_setting('test.expected_message_count')::bigint
    OR (SELECT count(*) FROM public.message_feedback) <> current_setting('test.expected_feedback_count')::bigint
    OR (SELECT count(*) FROM public.rooms) <> current_setting('test.expected_room_count')::bigint THEN
    RAISE EXCEPTION 'AUTHENTICATED_READ_CONTRACT_CHANGED';
  END IF;
  BEGIN
    EXECUTE 'SELECT count(*) FROM private.transfer_assessments';
    RAISE EXCEPTION 'PRIVATE_ASSESSMENT_ACCESS_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.messages';
    RAISE EXCEPTION 'AUTHENTICATED_PUBLICATION_WRITE_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT count(*) FROM public.messages;
SELECT count(*) FROM public.message_feedback;
SELECT count(*),count(password),count(scenario_config) FROM public.rooms;
SELECT count(*) FROM private.transfer_assessments;
ROLLBACK;

DO $$
BEGIN
  IF (SELECT array_agg(schemaname || '.' || tablename ORDER BY schemaname, tablename)
      FROM pg_publication_tables WHERE pubname='supabase_realtime')
      IS DISTINCT FROM ARRAY['public.message_feedback','public.messages','public.rooms'] THEN
    RAISE EXCEPTION 'MESSAGE_REALTIME_MEMBERSHIP_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_publication WHERE pubname='supabase_realtime'
    AND pubowner='postgres'::regrole AND NOT puballtables
    AND pubinsert AND pubupdate AND pubdelete AND pubtruncate AND NOT pubviaroot) THEN
    RAISE EXCEPTION 'PUBLICATION_OPTIONS_CHANGED';
  END IF;
END $$;
