-- Purpose: T009 PART 2, the behavioural RPC lane for the component 102 transfer-assessment backend.
-- Responsible for: proving, against the live Supabase project, that the versioned transfer RPCs
--   behave as their contract requires: draft-review validation and revision conflict, reviewed
--   delivery with the private key kept out of the public question, reject with same-trigger
--   suppression, regenerate with supersession, and request-idempotent replay.
--
-- HOW TO RUN (no psql and no service_role key required):
--   1. Apply migration 029 first. Until it is applied, the review and send cases below fail with
--      `function digest(bytea, unknown) does not exist`, which is the defect 029 fixes.
--   2. Open the Supabase Dashboard for project zgbufaxooqxeabewktzd -> SQL Editor -> New query.
--   3. Paste this ENTIRE file and Run. The Dashboard connects as a privileged role, which is
--      required: every transfer RPC opens with `IF current_user NOT IN ('service_role','postgres')`.
--   4. Read the final result grid. Every row must show ok = true. A row with ok = false names the
--      contract that broke, and `detail` carries the observed error.
--
-- SAFETY: the whole run is one transaction that ends in ROLLBACK. It creates its own disposable
--   tutor, student, room, checklist, items, and messages, asserts against them, and then discards
--   everything. It cannot leave production data behind. If any statement raises unexpectedly,
--   run `ROLLBACK;` to be certain.

begin;

create temp table t009_results (
  case_id text,
  description text,
  ok boolean,
  detail text
) on commit drop;

do $t009$
declare
  v_tutor   uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_room    uuid := gen_random_uuid();
  v_check   uuid := gen_random_uuid();
  v_item    uuid := gen_random_uuid();
  v_focus   uuid := gen_random_uuid();
  v_draft   uuid;
  v_draft2  uuid;
  v_res     jsonb;
  v_rev     integer;
  v_hash    text;
  v_key_count integer;
  v_public  jsonb;
  v_opt_ids  text;
  v_req     uuid;
begin
  -- ---------------------------------------------------------------------------------------
  -- Disposable fixture: one tutor, one learner, one transfer_v1 checklist with one item, and
  -- one focus learner message. Created as the privileged Dashboard role.
  -- ---------------------------------------------------------------------------------------
  -- NOTE: "current_role" must be double-quoted. It is a reserved keyword in Postgres (like
  -- current_user), so an unquoted reference is a syntax error, not a column name.
  insert into users(id, email, display_name, "current_role", status)
  values (v_tutor, 't009-tutor@example.invalid', 'T009 Tutor', 'tutor', 'active'),
         (v_student, 't009-student@example.invalid', 'T009 Student', 'student', 'active');

  insert into rooms(id, tutor_id, title) values (v_room, v_tutor, 'T009 room');

  -- A transfer_v1 checklist is write-protected. private_transfer_checklist_guard raises
  -- TRANSFER_CHECKLIST_WRITE_REQUIRED on the checklist itself, and private_transfer_item_guard
  -- raises TRANSFER_ITEM_WRITE_REQUIRED on any item insert or state change, both unless the
  -- trusted-operation flag is set. The production code sets exactly this flag around its own
  -- trusted writes, so the fixture reproduces that context rather than bypassing the guard.
  -- set_config's third argument makes this transaction-local, so it disappears with the final
  -- ROLLBACK. It must be set before the checklist insert, because that guard reads it too.
  perform set_config('app.transfer_operation', 'on', true);

  insert into session_checklists(id, room_id, student_id, template_name, progress_policy_version)
  values (v_check, v_room, v_student, 'T009 template', 'transfer_v1');

  insert into checklist_items(id, checklist_id, area_text, item_type, status, understanding_level)
  values (v_item, v_check, 'Recognise a familiar-sender lure', 'concept', 'partially_covered', 'basic');

  insert into messages(id, room_id, user_id, content, user_role, is_ai_generated)
  values (v_focus, v_room, v_student, 'My bank emailed a link so it must be safe.', 'student', false);

  -- A draft in `draft` status at revision 1, as prepare_transfer_turn_v1 would leave it.
  insert into private.assessment_drafts(
    room_id, student_id, checklist_id, item_id, focus_student_message_id,
    raw_model_output, revision, raw_hash, status)
  values (v_room, v_student, v_check, v_item, v_focus,
          '{"decision":{"mode":"assessment","instruction":"transfer_assess"},"response":"Which statement best describes the risk?"}'::jsonb,
          1, repeat('a', 64), 'draft')
  returning id into v_draft;

  -- =======================================================================================
  -- FR-006: draft review validation
  -- =======================================================================================

  -- P1: a payload with three options must be rejected.
  begin
    v_res := review_assessment_draft_v1(v_draft, 1,
      jsonb_build_object(
        'decision', jsonb_build_object('mode','assessment','instruction','transfer_assess'),
        'response', 'Bad option count',
        'assessment', jsonb_build_object(
          'selection_type','single',
          'options', jsonb_build_array(
            jsonb_build_object('id','A','text','one'),
            jsonb_build_object('id','B','text','two'),
            jsonb_build_object('id','C','text','three')),
          'correct_option_ids', jsonb_build_array('A'),
          'transfer_basis', jsonb_build_object('concept_rule','r','source_context','s','changed_context','c','source_evidence_message_ids', jsonb_build_array('m')))),
      true, v_tutor, gen_random_uuid());
    insert into t009_results values ('P1','3-option payload rejected', false, 'expected ITEM_VALIDATION_FAILED, got ' || v_res::text);
  exception when others then
    insert into t009_results values ('P1','3-option payload rejected', sqlerrm = 'ITEM_VALIDATION_FAILED', sqlstate || ': ' || sqlerrm);
  end;

  -- P2: a single-select payload with two correct keys must be rejected.
  begin
    v_res := review_assessment_draft_v1(v_draft, 1,
      jsonb_build_object(
        'decision', jsonb_build_object('mode','assessment','instruction','transfer_assess'),
        'response', 'Bad key cardinality',
        'assessment', jsonb_build_object(
          'selection_type','single',
          'options', jsonb_build_array(
            jsonb_build_object('id','A','text','one'), jsonb_build_object('id','B','text','two'),
            jsonb_build_object('id','C','text','three'), jsonb_build_object('id','D','text','four')),
          'correct_option_ids', jsonb_build_array('A','B'),
          'transfer_basis', jsonb_build_object('concept_rule','r','source_context','s','changed_context','c','source_evidence_message_ids', jsonb_build_array('m')))),
      true, v_tutor, gen_random_uuid());
    insert into t009_results values ('P2','single-select with two keys rejected', false, 'expected ITEM_VALIDATION_FAILED, got ' || v_res::text);
  exception when others then
    insert into t009_results values ('P2','single-select with two keys rejected', sqlerrm = 'ITEM_VALIDATION_FAILED', sqlstate || ': ' || sqlerrm);
  end;

  -- P3: an empty changed_context must be rejected.
  begin
    v_res := review_assessment_draft_v1(v_draft, 1,
      jsonb_build_object(
        'decision', jsonb_build_object('mode','assessment','instruction','transfer_assess'),
        'response', 'Empty changed context',
        'assessment', jsonb_build_object(
          'selection_type','single',
          'options', jsonb_build_array(
            jsonb_build_object('id','A','text','one'), jsonb_build_object('id','B','text','two'),
            jsonb_build_object('id','C','text','three'), jsonb_build_object('id','D','text','four')),
          'correct_option_ids', jsonb_build_array('A'),
          'transfer_basis', jsonb_build_object('concept_rule','r','source_context','s','changed_context','  ','source_evidence_message_ids', jsonb_build_array('m')))),
      true, v_tutor, gen_random_uuid());
    insert into t009_results values ('P3','empty changed_context rejected', false, 'expected ITEM_VALIDATION_FAILED, got ' || v_res::text);
  exception when others then
    insert into t009_results values ('P3','empty changed_context rejected', sqlerrm = 'ITEM_VALIDATION_FAILED', sqlstate || ': ' || sqlerrm);
  end;

  -- P4: an unconfirmed review must be rejected even when the payload is valid.
  begin
    v_res := review_assessment_draft_v1(v_draft, 1,
      jsonb_build_object(
        'decision', jsonb_build_object('mode','assessment','instruction','transfer_assess'),
        'response', 'Unconfirmed',
        'assessment', jsonb_build_object(
          'selection_type','single',
          'options', jsonb_build_array(
            jsonb_build_object('id','A','text','one'), jsonb_build_object('id','B','text','two'),
            jsonb_build_object('id','C','text','three'), jsonb_build_object('id','D','text','four')),
          'correct_option_ids', jsonb_build_array('A'),
          'transfer_basis', jsonb_build_object('concept_rule','r','source_context','s','changed_context','c','source_evidence_message_ids', jsonb_build_array('m')))),
      false, v_tutor, gen_random_uuid());
    insert into t009_results values ('P4','unconfirmed review rejected', false, 'expected CONTENT_CONFIRMATION_REQUIRED, got ' || v_res::text);
  exception when others then
    insert into t009_results values ('P4','unconfirmed review rejected', sqlerrm = 'CONTENT_CONFIRMATION_REQUIRED', sqlstate || ': ' || sqlerrm);
  end;

  -- P5: a stale expected revision must be rejected.
  begin
    v_res := review_assessment_draft_v1(v_draft, 99,
      jsonb_build_object(
        'decision', jsonb_build_object('mode','assessment','instruction','transfer_assess'),
        'response', 'Stale',
        'assessment', jsonb_build_object(
          'selection_type','single',
          'options', jsonb_build_array(
            jsonb_build_object('id','A','text','one'), jsonb_build_object('id','B','text','two'),
            jsonb_build_object('id','C','text','three'), jsonb_build_object('id','D','text','four')),
          'correct_option_ids', jsonb_build_array('A'),
          'transfer_basis', jsonb_build_object('concept_rule','r','source_context','s','changed_context','c','source_evidence_message_ids', jsonb_build_array('m')))),
      true, v_tutor, gen_random_uuid());
    insert into t009_results values ('P5','stale revision rejected', false, 'expected DRAFT_REVISION_CONFLICT, got ' || v_res::text);
  exception when others then
    insert into t009_results values ('P5','stale revision rejected', sqlerrm = 'DRAFT_REVISION_CONFLICT', sqlstate || ': ' || sqlerrm);
  end;

  -- P6: a valid review advances the revision by exactly one and stores a 64-char hex hash.
  v_res := review_assessment_draft_v1(v_draft, 1,
    jsonb_build_object(
      'decision', jsonb_build_object('mode','assessment','instruction','transfer_assess'),
      'response', 'Which statement best describes the risk to this account?',
      'assessment', jsonb_build_object(
        'selection_type','single',
        'options', jsonb_build_array(
          jsonb_build_object('id','A','text','A familiar account proves the link is safe'),
          jsonb_build_object('id','B','text','The account could have been compromised'),
          jsonb_build_object('id','C','text','Every prize message is necessarily a scam'),
          jsonb_build_object('id','D','text','Opening the link proves the sender identity')),
        'correct_option_ids', jsonb_build_array('B'),
        'transfer_basis', jsonb_build_object(
          'concept_rule','A familiar sender is not proof of safety.',
          'source_context','The learner judged a link safe because the sender was familiar.',
          'changed_context','A bank alert asks the learner to confirm a password after a transfer.',
          'source_evidence_message_ids', jsonb_build_array(v_focus::text)))),
    true, v_tutor, gen_random_uuid());
  v_rev  := (v_res->>'revision')::integer;
  v_hash := v_res->>'final_hash';
  insert into t009_results
  values ('P6','valid review advances revision and stores a sha256 hash',
          v_rev = 2 and v_hash ~ '^[0-9a-f]{64}$',
          format('revision=%s hash_length=%s', v_rev, length(v_hash)));

  -- =======================================================================================
  -- FR-007: atomic reviewed delivery
  -- =======================================================================================

  -- P7: send with a wrong hash must be rejected and must write nothing.
  begin
    v_res := send_reviewed_tutor_response_v3(v_draft, 2, repeat('0', 64), v_tutor, gen_random_uuid());
    insert into t009_results values ('P7','stale hash send rejected', false, 'expected DRAFT_REVISION_CONFLICT, got ' || v_res::text);
  exception when others then
    insert into t009_results values ('P7','stale hash send rejected', sqlerrm = 'DRAFT_REVISION_CONFLICT', sqlstate || ': ' || sqlerrm);
  end;

  -- P8: the correct send creates exactly one question and one key row, and the PUBLIC question
  --     row must not carry correct_option_ids or transfer_basis.
  v_req := gen_random_uuid();
  v_res := send_reviewed_tutor_response_v3(v_draft, 2, v_hash, v_tutor, v_req);

  select count(*) into v_key_count
  from private.assessment_question_keys k
  where k.draft_id = v_draft;

  select to_jsonb(q) - 'public_payload_hash' into v_public
  from assessment_questions q
  where q.tutor_message_id = (v_res->'message'->>'id')::uuid;

  insert into t009_results
  values ('P8','send creates one question and one private key row',
          v_key_count = 1 and v_public->>'id' is not null,
          format('key_rows=%s public_question_present=%s', v_key_count, v_public ? 'id'));

  insert into t009_results
  values ('P9','public question carries no key and no transfer basis',
          not (v_public ? 'correct_option_ids') and not (v_public ? 'transfer_basis'),
          format('public_keys=%s', (select string_agg(k, ',' order by k) from jsonb_object_keys(v_public) k)));

  -- P10: the private key row holds exactly the reviewed key.
  select array_to_string(correct_option_ids, ',') into v_opt_ids
  from private.assessment_question_keys where draft_id = v_draft;
  insert into t009_results
  values ('P10','private key row holds the reviewed key',
          v_opt_ids = 'B', format('correct_option_ids=%s', v_opt_ids));

  -- P11: sending the same draft twice reports it was already sent.
  begin
    v_res := send_reviewed_tutor_response_v3(v_draft, 2, v_hash, v_tutor, gen_random_uuid());
    insert into t009_results values ('P11','second send rejected as already sent', false, 'expected DRAFT_ALREADY_SENT, got ' || v_res::text);
  exception when others then
    insert into t009_results values ('P11','second send rejected as already sent', sqlerrm = 'DRAFT_ALREADY_SENT', sqlstate || ': ' || sqlerrm);
  end;

  -- =======================================================================================
  -- FR-006: reject, same-trigger suppression, and explicit regeneration
  -- =======================================================================================

  insert into private.assessment_drafts(
    room_id, student_id, checklist_id, item_id, focus_student_message_id,
    raw_model_output, revision, raw_hash, status)
  values (v_room, v_student, v_check, v_item, v_focus,
          '{"decision":{"mode":"assessment"}}'::jsonb, 1, repeat('b', 64), 'draft')
  returning id into v_draft2;

  v_res := reject_assessment_draft_v1(v_draft2, 1, 'teacher_rejected', v_tutor, gen_random_uuid());
  insert into t009_results
  values ('P12','reject records rejected status and suppresses the trigger',
          (v_res->>'status') = 'rejected' and (v_res->>'same_trigger_suppressed')::boolean,
          v_res::text);

  insert into t009_results
  values ('P13','rejected draft stores a trigger key',
          (select trigger_key is not null and status = 'rejected' from private.assessment_drafts where id = v_draft2),
          (select format('status=%s trigger_key_set=%s', status, trigger_key is not null) from private.assessment_drafts where id = v_draft2));

  -- P14: explicit regeneration supersedes the source and starts a fresh draft at revision 1.
  v_res := regenerate_assessment_draft_v1(
    v_draft2, 2, repeat('b', 64),
    '{"decision":{"mode":"assessment"},"response":"regenerated"}'::jsonb,
    repeat('c', 64), v_tutor, gen_random_uuid());

  insert into t009_results
  values ('P14','regeneration supersedes the source and links the replacement',
          (v_res->>'source_status') = 'superseded'
          and (v_res->>'replacement_revision')::integer = 1
          and (select supersedes_draft_id from private.assessment_drafts where id = (v_res->>'replacement_draft_id')::uuid) = v_draft2,
          v_res::text);

  insert into t009_results
  values ('P15','replacement trigger key matches the rejected source trigger key',
          (select r.trigger_key = s.trigger_key
             from private.assessment_drafts r
             join private.assessment_drafts s on s.id = v_draft2
            where r.id = (v_res->>'replacement_draft_id')::uuid),
          'same-trigger suppression depends on this equality');

  -- =======================================================================================
  -- Request idempotency
  -- =======================================================================================

  v_req := gen_random_uuid();
  begin
    insert into private.assessment_drafts(
      room_id, student_id, checklist_id, item_id, focus_student_message_id,
      raw_model_output, revision, raw_hash, status)
    values (v_room, v_student, v_check, v_item, v_focus,
            '{"decision":{"mode":"assessment"}}'::jsonb, 1, repeat('d', 64), 'draft')
    returning id into v_draft2;

    v_res := reject_assessment_draft_v1(v_draft2, 1, 'teacher_rejected', v_tutor, v_req);
    v_res := reject_assessment_draft_v1(v_draft2, 1, 'teacher_rejected', v_tutor, v_req);
    insert into t009_results values ('P16','replayed reject request returns the recorded result',
      (v_res->>'draft_id') = v_draft2::text and (v_res->>'request_id') = v_req::text, v_res::text);
  exception when others then
    insert into t009_results values ('P16','replayed reject request returns the recorded result', false, sqlstate || ': ' || sqlerrm);
  end;
end
$t009$;

select case_id, ok, description, detail from t009_results order by case_id;

rollback;
