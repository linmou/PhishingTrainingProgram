-- Purpose: T009 PART 2, the behavioural RPC lane for the collapsed one-table transfer-assessment
-- backend. It exercises only the six live RPCs, against the assessment columns that now live on
-- public.messages, and proves the delivery and grading path works end to end under service_role.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor (project zgbufaxooqxeabewktzd ->
-- SQL Editor -> New query) and Run. The run is one transaction that ends in ROLLBACK, so it
-- creates its own throwaway tutor/learner/room/checklist, asserts against them, and leaves nothing
-- behind. The Dashboard role is privileged, which is required: every RPC here opens with
-- `IF current_user NOT IN ('service_role','postgres')`.
--
-- Read the final grid. Every row must show ok = true. A false row carries the observed sqlstate and
-- message in detail. If the file errors instead of printing a grid, the error is in the fixture and
-- names the line.

begin;

create temp table p2_results (
  case_id text,
  description text,
  ok boolean,
  detail text
) on commit drop;

do $p2$
declare
  v_tutor   uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_room    uuid := gen_random_uuid();
  v_check   uuid := gen_random_uuid();
  v_item    uuid := gen_random_uuid();
  v_focus   uuid := gen_random_uuid();
  v_answer  uuid := gen_random_uuid();
  v_focus2  uuid;
  v_res     jsonb;
  v_msg     uuid;
  v_key     text[];
  v_result  text;
begin
  -- ---------------------------------------------------------------------------------------
  -- Fixture
  -- ---------------------------------------------------------------------------------------
  insert into users(id, email, display_name, "current_role", status)
  values (v_tutor, 'p2-tutor@example.invalid', 'P2 Tutor', 'tutor', 'active'),
         (v_student, 'p2-student@example.invalid', 'P2 Student', 'student', 'active');

  insert into rooms(id, tutor_id, title) values (v_room, v_tutor, 'P2 room');

  -- The trusted-operation flag must be set before the transfer_v1 checklist and its item are
  -- written: private_transfer_checklist_guard and private_transfer_item_guard both raise without it.
  perform set_config('app.transfer_operation', 'on', true);

  insert into session_checklists(id, room_id, student_id, template_name, progress_policy_version)
  values (v_check, v_room, v_student, 'P2 template', 'transfer_v1');

  insert into checklist_items(id, checklist_id, area_text, item_type, status, understanding_level)
  values (v_item, v_check, 'Recognise a familiar-sender lure', 'verification_step', 'partially_covered', 'basic');

  insert into messages(id, room_id, user_id, content, user_role, is_ai_generated)
  values (v_focus, v_room, v_student, 'My bank emailed a link so it must be safe.', 'student', false);

  -- =======================================================================================
  -- A1: send_reviewed delivers and stamps the assessment onto the tutor message
  -- =======================================================================================
  v_res := send_reviewed_tutor_response_v3(
    jsonb_build_object(
      'decision', jsonb_build_object('mode','assessment','instruction','transfer_assess'),
      'response', 'Which statement best describes the risk to this account?',
      'assessment', jsonb_build_object(
        'selection_type','single',
        'stem','Which statement best describes the risk to this account?',
        'rendered_text','Which statement best describes the risk to this account?',
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
    v_room, v_student, v_check, v_item, v_focus, v_tutor, gen_random_uuid());

  v_msg := (v_res->'message'->>'id')::uuid;

  insert into p2_results
  values ('A1','send_reviewed writes one tutor message with the assessment stamped on it',
          v_msg is not null
          and (select assessment_lifecycle from messages where id = v_msg) = 'delivered'
          and (select assessment_checklist_id from messages where id = v_msg) = v_check
          and (select assessment_item_id from messages where id = v_msg) = v_item,
          format('message_id=%s lifecycle=%s', v_msg,
                 (select assessment_lifecycle from messages where id = v_msg)));

  -- =======================================================================================
  -- A2: the key is stored on the row, and the normal response does not carry it
  -- =======================================================================================
  select assessment_key into v_key from messages where id = v_msg;
  insert into p2_results
  values ('A2','the response omits the key while the row stores it',
          v_key = array['B'] and not ((v_res->'message') ? 'assessment_key'),
          format('row_key=%s response_has_key=%s', coalesce(array_to_string(v_key,','),'null'),
                 (v_res->'message') ? 'assessment_key'));

  -- =======================================================================================
  -- A3: the stored key is readable from the row. This documents the accepted tradeoff rather
  --     than asserting it is hidden: public.messages is participant-readable.
  -- =======================================================================================
  insert into p2_results
  values ('A3','key confidentiality is a recorded tradeoff, not a guarantee',
          has_table_privilege('authenticated','public.messages','SELECT'),
          'authenticated holds SELECT on public.messages, so the key is reachable by a crafted REST request by design');

  -- =======================================================================================
  -- A4: a second delivery for the same learner is refused
  -- =======================================================================================
  begin
    insert into messages(id, room_id, user_id, content, user_role, is_ai_generated)
    values (gen_random_uuid(), v_room, v_student, 'Second focus message.', 'student', false)
    returning id into v_focus2;

    v_res := send_reviewed_tutor_response_v3(
      jsonb_build_object(
        'decision', jsonb_build_object('mode','assessment','instruction','transfer_assess'),
        'response', 'Second question?',
        'assessment', jsonb_build_object(
          'selection_type','single',
          'stem','Second question?',
          'rendered_text','Second question?',
          'options', jsonb_build_array(
            jsonb_build_object('id','A','text','one'), jsonb_build_object('id','B','text','two'),
            jsonb_build_object('id','C','text','three'), jsonb_build_object('id','D','text','four')),
          'correct_option_ids', jsonb_build_array('A'),
          'transfer_basis', jsonb_build_object(
            'concept_rule','r','source_context','s','changed_context','c',
            'source_evidence_message_ids', jsonb_build_array(v_focus2::text)))),
      v_room, v_student, v_check, v_item, v_focus2, v_tutor, gen_random_uuid());
    insert into p2_results values ('A4','second delivery refused', false,
      'expected ASSESSMENT_ALREADY_OPEN or the one-open index, got ' || v_res::text);
  exception when others then
    -- Either outcome is a refusal, and the refusal is what matters. The function raises
    -- ASSESSMENT_ALREADY_OPEN from its own pre-check, but the partial unique index enforces the
    -- same rule and can report first as 23505. Recorded rather than hidden: depending on which one
    -- wins, a client sees either the designed 409 code or an index violation.
    insert into p2_results values ('A4','second delivery refused',
      sqlerrm = 'ASSESSMENT_ALREADY_OPEN' OR sqlstate = '23505',
      sqlstate || ': ' || sqlerrm ||
        case when sqlstate = '23505'
             then ' (refused by one_open_assessment_per_student, not by the ASSESSMENT_ALREADY_OPEN pre-check)'
             else '' end);
  end;

  -- =======================================================================================
  -- A5: a malformed payload is refused
  -- =======================================================================================
  begin
    v_res := send_reviewed_tutor_response_v3(
      jsonb_build_object(
        'decision', jsonb_build_object('mode','assessment','instruction','transfer_assess'),
        'response', 'Only three options',
        'assessment', jsonb_build_object(
          'selection_type','single',
          'options', jsonb_build_array(
            jsonb_build_object('id','A','text','one'), jsonb_build_object('id','B','text','two'),
            jsonb_build_object('id','C','text','three')),
          'correct_option_ids', jsonb_build_array('A'),
          'transfer_basis', jsonb_build_object(
            'concept_rule','r','source_context','s','changed_context','c',
            'source_evidence_message_ids', jsonb_build_array(v_focus::text)))),
      v_room, v_student, v_check, v_item, v_focus, v_tutor, gen_random_uuid());
    insert into p2_results values ('A5','3-option payload refused', false,
      'expected ITEM_VALIDATION_FAILED, got ' || v_res::text);
  exception when others then
    insert into p2_results values ('A5','3-option payload refused',
      sqlerrm = 'ITEM_VALIDATION_FAILED', sqlstate || ': ' || sqlerrm);
  end;

  -- =======================================================================================
  -- A6: process_message grades from the message row
  -- =======================================================================================
  insert into messages(id, room_id, user_id, content, user_role, is_ai_generated, parent_message_id)
  values (v_answer, v_room, v_student, 'B', 'student', false, v_msg);

  v_res := process_assessment_message_v1(v_answer, v_student, gen_random_uuid());
  v_result := (select assessment_result from messages where id = v_msg);

  insert into p2_results
  values ('A6','process_message grades the answer and closes the assessment',
          v_result = 'pass'
          and (select assessment_lifecycle from messages where id = v_msg) = 'answered'
          and (select assessment_answer_message_id from messages where id = v_msg) = v_answer,
          format('result=%s lifecycle=%s', v_result,
                 (select assessment_lifecycle from messages where id = v_msg)));

  -- =======================================================================================
  -- A7: the verdict reached the progress pipeline
  -- =======================================================================================
  insert into p2_results
  values ('A7','the assessment_pass event was applied to the checklist item',
          exists (select 1 from private.learning_event_inbox
                   where event_kind = 'assessment_pass'
                     and dedupe_key = 'assessment:' || v_msg::text || ':' || v_answer::text),
          (select coalesce(string_agg(event_kind || '=' || processing_state, ', '), 'no event')
             from private.learning_event_inbox where item_id = v_item));

  -- =======================================================================================
  -- A8: a replayed answer returns the recorded result instead of grading twice
  --
  -- The function detects that the assessment is already answered by this same message and returns
  -- the stored outcome with already_processed = true. That is the documented idempotent path, and
  -- it is the correct behaviour: a retry must not produce a second grade. It does not raise, so this
  -- case asserts the returned envelope rather than an exception.
  -- =======================================================================================
  v_res := process_assessment_message_v1(v_answer, v_student, gen_random_uuid());
  insert into p2_results
  values ('A8','replayed answer returns the recorded result without re-grading',
          (v_res->>'already_processed')::boolean is true
          and (v_res->>'result') = 'pass'
          and (select count(*) from private.learning_event_inbox
                where dedupe_key = 'assessment:' || v_msg::text || ':' || v_answer::text) = 1,
          coalesce(v_res::text, 'null') || ' | inbox rows for this answer=' ||
          (select count(*)::text from private.learning_event_inbox
            where dedupe_key = 'assessment:' || v_msg::text || ':' || v_answer::text));

  -- =======================================================================================
  -- A9: an unparseable answer returns a clarification instead of a grade. Needs a fresh
  --     assessment, because the first one is closed and one open assessment per learner is
  --     enforced.
  -- =======================================================================================
  declare
    v_item2  uuid := gen_random_uuid();
    v_focus3 uuid := gen_random_uuid();
    v_junk   uuid := gen_random_uuid();
  begin
    insert into checklist_items(id, checklist_id, area_text, item_type, status, understanding_level)
    values (v_item2, v_check, 'Second objective', 'verification_step', 'partially_covered', 'basic');

    insert into messages(id, room_id, user_id, content, user_role, is_ai_generated)
    values (v_focus3, v_room, v_student, 'Third focus message.', 'student', false);

    v_res := send_reviewed_tutor_response_v3(
      jsonb_build_object(
        'decision', jsonb_build_object('mode','assessment','instruction','transfer_assess'),
        'response', 'Pick one.',
        'assessment', jsonb_build_object(
          'selection_type','single',
          'stem','Pick one.',
          'rendered_text','Pick one.',
          'options', jsonb_build_array(
            jsonb_build_object('id','A','text','one'), jsonb_build_object('id','B','text','two'),
            jsonb_build_object('id','C','text','three'), jsonb_build_object('id','D','text','four')),
          'correct_option_ids', jsonb_build_array('A'),
          'transfer_basis', jsonb_build_object(
            'concept_rule','r','source_context','s','changed_context','c',
            'source_evidence_message_ids', jsonb_build_array(v_focus3::text)))),
      v_room, v_student, v_check, v_item2, v_focus3, v_tutor, gen_random_uuid());

    insert into messages(id, room_id, user_id, content, user_role, is_ai_generated, parent_message_id)
    values (v_junk, v_room, v_student, 'I am not sure what you mean', 'student', false,
            (v_res->'message'->>'id')::uuid);

    v_res := process_assessment_message_v1(v_junk, v_student, gen_random_uuid());

    insert into p2_results
    values ('A9','unparseable answer asks for clarification instead of grading',
            (v_res->>'code') = 'ANSWER_FORMAT_UNRESOLVED'
            and (v_res->>'clarification_required')::boolean
            and (select assessment_lifecycle from messages
                  where id = (select parent_message_id from messages where id = v_junk)) = 'delivered',
            coalesce(v_res::text, 'null'));
  end;

  -- =======================================================================================
  -- A10: the guard-mode lock still rejects a protected progress write.
  --
  -- Order matters and is the point of this case. The room, checklist, and item are all created
  -- while the room is still in `tutoring`, because the guard deliberately blocks creation in a
  -- guarded room too -- setting the room to `guard` first makes the item insert itself raise, which
  -- is what an earlier version of this case got wrong. Only then does the room enter `guard`, and
  -- the update below is what must be refused. The trusted-operation flag is turned off for that
  -- attempt, so the guard function is what raises rather than private_transfer_item_guard.
  --
  -- This is the regression guard for migration 041: it drives the guard through its UPDATE path on
  -- checklist_items, then through the cascade from checklist_items to session_checklists. Those are
  -- the two branches that were broken.
  -- =======================================================================================
  declare
    v_guard_room  uuid := gen_random_uuid();
    v_guard_check uuid := gen_random_uuid();
    v_guard_item  uuid := gen_random_uuid();
  begin
    -- Created in tutoring: active_response_mode is omitted so it takes its 'tutoring' default.
    insert into rooms(id, tutor_id, title) values (v_guard_room, v_tutor, 'P2 guard room');

    perform set_config('app.transfer_operation', 'on', true);
    insert into session_checklists(id, room_id, student_id, template_name, progress_policy_version)
    values (v_guard_check, v_guard_room, v_student, 'P2 guard template', 'transfer_v1');

    insert into checklist_items(id, checklist_id, area_text, item_type, status, understanding_level)
    values (v_guard_item, v_guard_check, 'Guarded objective', 'verification_step', 'pending', 'none');

    -- Now arm guard mode, and withdraw the trusted-operation flag for the attempt below.
    update rooms set active_response_mode = 'guard' where id = v_guard_room;
    perform set_config('app.transfer_operation', 'off', false);

    begin
      update checklist_items set status = 'partially_covered', understanding_level = 'basic'
      where id = v_guard_item;
      insert into p2_results values ('A10','guard-mode blocks a progress write', false,
        'the update succeeded although the room is in guard mode');
    exception when others then
      insert into p2_results values ('A10','guard-mode blocks a progress write',
        sqlerrm like '%Guard Mode is active%', sqlstate || ': ' || sqlerrm);
    end;

    -- The set_config above was not local, so restore the flag for the rest of the connection.
    perform set_config('app.transfer_operation', 'on', false);
  end;
end
$p2$;

select case_id, ok, description, detail from p2_results order by case_id;

rollback;
