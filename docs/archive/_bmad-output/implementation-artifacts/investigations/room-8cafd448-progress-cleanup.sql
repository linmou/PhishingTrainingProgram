-- Intent: record the user-authorized one-room learning-progress correction performed on 2026-10-15.
BEGIN;
SELECT set_config('app.transfer_operation','on',true);
WITH before_state AS MATERIALIZED (
 SELECT ci.* FROM checklist_items ci JOIN session_checklists sc ON sc.id=ci.checklist_id JOIN rooms r ON r.id=sc.room_id
 WHERE sc.id='0e7fe180-e310-4d1c-a20c-823a42103fa3' AND sc.room_id='8cafd448-386b-4391-b2e3-60dd842e4d80' AND sc.is_active AND NOT ci.deleted AND r.active_response_mode='tutoring' FOR UPDATE OF ci
), desired AS (
 SELECT b.*, CASE WHEN b.id='0f90baf8-8201-4708-b437-f6157d284823' THEN 'covered' WHEN b.id='2dbe46b3-5772-404c-be2f-2d27774b3a06' THEN 'partially_covered' ELSE 'pending' END target_status,
 CASE WHEN b.id='0f90baf8-8201-4708-b437-f6157d284823' THEN 'good' WHEN b.id='2dbe46b3-5772-404c-be2f-2d27774b3a06' THEN 'basic' ELSE 'none' END target_understanding FROM before_state b
), corrected AS (
 UPDATE checklist_items ci SET status=d.target_status,understanding_level=d.target_understanding,
 last_addressed=CASE WHEN ci.id='0f90baf8-8201-4708-b437-f6157d284823' THEN '2026-10-15 01:38:10.761746+00'::timestamptz WHEN ci.id='2dbe46b3-5772-404c-be2f-2d27774b3a06' THEN '2026-10-15 01:33:08.434838+00'::timestamptz ELSE NULL END,updated_at=now()
 FROM desired d WHERE ci.id=d.id AND (d.status,d.understanding_level) IS DISTINCT FROM (d.target_status,d.target_understanding)
 RETURNING ci.id,ci.checklist_id,ci.status,ci.understanding_level
), recorded AS (
 INSERT INTO checklist_updates(checklist_id,item_id,previous_status,new_status,previous_understanding,new_understanding,updated_by)
 SELECT c.checklist_id,c.id,b.status,c.status,b.understanding_level,c.understanding_level,'tutor' FROM corrected c JOIN before_state b ON b.id=c.id
 RETURNING item_id,previous_status,new_status,previous_understanding,new_understanding
) SELECT * FROM recorded;
COMMIT;
