#!/bin/sh
# Run inside an owned disposable database after applying the candidate migration.
set -eu
: "${MIGRATION_TEST_DB:?Use scripts/database/disposable-database.js}"
: "${PG_VALIDATION_LEASE_FILE:?Disposable database lease is required}"
psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.issue96_concurrency_fixture(tutor uuid,learner uuid,room uuid);
DO $test$
DECLARE t uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); r uuid:=gen_random_uuid();
BEGIN
 INSERT INTO public.users(id,display_name,"current_role",status) VALUES
  (t,'Concurrency tutor','tutor','active'),(l,'Concurrency learner','student','active');
 INSERT INTO public.rooms(id,tutor_id,title,transfer_learning_enabled) VALUES(r,t,'Concurrent target setup',false);
 PERFORM public.join_room_v1(r,l);
 INSERT INTO public.issue96_concurrency_fixture VALUES(t,l,r);
END;
$test$;
GRANT SELECT ON public.issue96_concurrency_fixture TO service_role;
SQL
initialize() {
 psql -X -v ON_ERROR_STOP=1 <<'SQL'
SET request.headers = '{"x-practice-contract":"cyberbullying-v2"}';
SET ROLE service_role;
SELECT public.initialize_transfer_checklist_v1(room,learner,
 '[{"area_text":"Verify independently","item_type":"detection_area","priority":"important"}]',tutor)
FROM public.issue96_concurrency_fixture;
SQL
}
initialize &
first=$!
initialize &
second=$!
# Inspect both outcomes even if one fails.
first_status=0; second_status=0
wait "$first" || first_status=$?
wait "$second" || second_status=$?
if [ "$first_status" -ne 0 ] || [ "$second_status" -ne 0 ]; then exit 1; fi
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $test$
BEGIN
 ASSERT (SELECT count(*) FROM public.session_checklists WHERE room_id=(SELECT room FROM public.issue96_concurrency_fixture))=1,
  'concurrent initialization created duplicate checklists';
 ASSERT (SELECT count(*) FROM public.checklist_items WHERE checklist_id IN
  (SELECT id FROM public.session_checklists WHERE room_id=(SELECT room FROM public.issue96_concurrency_fixture)))=1,
  'concurrent initialization duplicated targets';
END;
$test$;
SQL
