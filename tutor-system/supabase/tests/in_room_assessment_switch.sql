-- Run against a disposable hosted restore after the issue #100 migration.
-- Existing fixture rows are modified only inside this rolled-back transaction.
BEGIN;
DO $$
DECLARE r public.rooms%ROWTYPE;
BEGIN
  SELECT * INTO STRICT r FROM public.rooms WHERE practice_type = 'phishing' LIMIT 1;
  UPDATE public.rooms SET in_room_assessment_enabled = false WHERE id = r.id;
  BEGIN
    PERFORM public.prepare_transfer_assessment_context_v1(r.id, r.id, r.id, r.tutor_id, r.id);
    RAISE EXCEPTION 'Expected disabled preparation to fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'IN_ROOM_ASSESSMENT_DISABLED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.send_reviewed_transfer_assessment_v1('{}', r.id, r.id, r.id, r.id, r.id, r.tutor_id, r.id);
    RAISE EXCEPTION 'Expected disabled delivery to fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'IN_ROOM_ASSESSMENT_DISABLED' THEN RAISE; END IF;
  END;
  UPDATE public.rooms SET in_room_assessment_enabled = true WHERE id = r.id;
  BEGIN
    PERFORM public.prepare_transfer_assessment_context_v1(r.id, r.id, r.id, r.tutor_id, r.id);
    RAISE EXCEPTION 'Expected invalid source scope';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'INVALID_SCOPE' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;

BEGIN;
DO $$
DECLARE r public.rooms%ROWTYPE; new_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.rooms WHERE in_room_assessment_enabled IS DISTINCT FROM coalesce(transfer_learning_enabled,false)) THEN
    RAISE EXCEPTION 'Backfill did not preserve old settings';
  END IF;
  SELECT * INTO STRICT r FROM public.rooms WHERE practice_type='phishing' LIMIT 1;
  INSERT INTO public.rooms(title,tutor_id) VALUES ('issue100 local default assertion',r.tutor_id) RETURNING id INTO new_id;
  IF NOT (SELECT in_room_assessment_enabled FROM public.rooms WHERE id=new_id) THEN RAISE EXCEPTION 'New room default is not on'; END IF;
  UPDATE public.rooms SET in_room_assessment_enabled=false WHERE id=new_id;
  IF NOT (SELECT transfer_learning_enabled FROM public.rooms WHERE id=new_id) THEN RAISE EXCEPTION 'Assessment setting changed legacy flag'; END IF;
  IF has_function_privilege('anon','public.prepare_transfer_assessment_context_v1(uuid,uuid,uuid,uuid,uuid)','EXECUTE') OR
     has_function_privilege('authenticated','public.send_reviewed_transfer_assessment_v1(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Private assessment RPC exposed';
  END IF;
  IF NOT has_function_privilege('service_role','public.prepare_transfer_assessment_context_v1(uuid,uuid,uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Service role lost assessment access';
  END IF;
END $$;
ROLLBACK;

BEGIN;
UPDATE public.rooms SET in_room_assessment_enabled=false WHERE practice_type='phishing';
SET LOCAL ROLE service_role;
DO $$
DECLARE r public.rooms%ROWTYPE;
BEGIN
  SELECT * INTO STRICT r FROM public.rooms WHERE practice_type='phishing' LIMIT 1;
  BEGIN
    PERFORM public.prepare_transfer_assessment_context_v1(r.id,r.id,r.id,r.tutor_id,r.id);
    RAISE EXCEPTION 'service_role bypassed disabled assessment';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'IN_ROOM_ASSESSMENT_DISABLED' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.prepare_transfer_assessment_context_v1(NULL,NULL,NULL,NULL,NULL);
    RAISE EXCEPTION 'anon executed private assessment RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.send_reviewed_transfer_assessment_v1('{}',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
    RAISE EXCEPTION 'authenticated executed private assessment RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
