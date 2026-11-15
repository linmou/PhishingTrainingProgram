-- Ordered release: #101 canonical templates -> #96 independent tracking -> #100 assessment switch.
-- Run in one transaction. Exact original components and hashes are retained in migration-components/20261115_combined.

-- Issue #101: canonical task labels for new rooms; preserve existing room and learner snapshots.

-- Six standard phishing/privacy templates keep their existing room content and policy.
DO $templates$
DECLARE
  source jsonb := $catalog$[
  {
    "name": "Nintendo Switch Deal Scam",
    "scenario": "Nintendo Switch Deal ($19.99)",
    "points": [
      "Knowledge Point 1: Check if the deal is too good to be true. (Easiest)\nObservation task: A Nintendo Switch usually costs hundreds of dollars, but this post offers one for only $19.99.\nBehavior task: Stop and ask yourself: \"Why is this so cheap?\" If a deal seems too good to be true, be careful.",
      "Knowledge Point 2: Watch out for messages that rush you.\nObservation task: Words like \"HURRY UP\" and \"WILL NOT LAST\" try to make you act quickly.\nBehavior task: Take your time. Don't let a post rush you into clicking a link or buying something.",
      "Knowledge Point 3: Check who shared the deal.\nObservation task: The post is not from an official Nintendo account but someone named Lucy Simms\nBehavior task: Look at the person's profile. Check when the account was created, what else they have posted, and whether they are connected to Nintendo.",
      "Knowledge Point 4: Learn to spot suspicious links. (Harder)\nObservation task: The link uses \"goo.gl,\" which hides the real website. It does not show Nintendo's official website address.\nBehavior task: Don't click shortened or unfamiliar links. Look for Nintendo's official website address instead. A lock symbol or HTTPS alone does not prove a website is safe.",
      "Knowledge Point 5: Check the deal with the real company. (Most advanced)\nObservation task: There is no proof that Nintendo is really offering this deal.\nBehavior task: Visit Nintendo's official website or social media pages yourself. Check whether the deal is listed there. You can also ask a trusted adult to help."
    ]
  },
  {
    "name": "iTunes Gift Card Survey Scam",
    "scenario": "iTunes Gift Card Survey ($500)",
    "points": [
      "Knowledge Point 1: Check if the reward makes sense. (Easiest)\nObservation task: The post promises a $500 gift card for only five minutes of answering questions.\nBehavior task: Ask yourself: \"Would a company really give away so much money for such a small task?\" Be careful when a reward seems too big.",
      "Knowledge Point 2: Watch out for exciting promises.\nObservation task: Words like \"CRAZY DEAL!!\" and \"got instantly\" make the offer sound exciting and encourage people to act quickly.\nBehavior task: Don't let exciting words or promises make you forget to check whether something is real.",
      "Knowledge Point 3: Check who is sharing the reward.\nObservation task: Emma Garcia is sharing the offer, but there is no proof that she works for Apple or iTunes.\nBehavior task: Look at her profile and past posts. Be careful if the account often shares free gifts or amazing offers.",
      "Knowledge Point 4: Look carefully at the website link. (Harder)\nObservation task: The link uses \"bit.ly,\" which hides the real website address.\nBehavior task: Don't click the link. Go to Apple's official website yourself to check whether the offer is real.",
      "Knowledge Point 5: Check whether the company really offers the reward. (Most advanced)\nObservation task: The post has a gift card picture, but it does not show an official Apple announcement or explain the rules of the giveaway.\nBehavior task: Check Apple's official website and social media pages for the giveaway. Ask a trusted adult to help you check before sharing information or answering a survey."
    ]
  },
  {
    "name": "Account Security Alert Scam",
    "scenario": "Account Security Alert",
    "points": [
      "Knowledge Point 1: Be careful when a message tries to scare you. (Easiest)\nObservation task: The message says \"YOUR ACCOUNT IS AT RISK\" and uses lots of warning symbols to make you feel scared.\nBehavior task: Stay calm. Don't click anything just because a message says something bad will happen.",
      "Knowledge Point 2: Check who sent the warning.\nObservation task: The message comes from \"Socail Media Testdrive,\" which is not the name of a social media company. It also has a spelling mistake in \"Social.\"\nBehavior task: Check the sender's name carefully. Be suspicious of messages from unknown people or companies.",
      "Knowledge Point 3: Check whether the warning tells you which account is in danger.\nObservation task: The message says your account is at risk but does not say whether it means Instagram, TikTok, Snapchat, or another account.\nBehavior task: Ask yourself: \"Which account are they talking about?\" A vague warning from an unknown sender is suspicious.",
      "Knowledge Point 4: Check the website address before trusting it. (Harder)\nObservation task: The link goes to \"testdrive.info,\" not the official website of a social media company.\nBehavior task: Never click a link in a scary security message. Open the real app or type its official website address yourself.",
      "Knowledge Point 5: Check your account safely. (Most advanced)\nObservation task: A real account problem should be checked through the social media company itself, not through a random message.\nBehavior task: Log in through the official app or website. Check your account's security notifications and recent login activity. If you are still worried, ask a trusted adult for help or contact the platform through its official help center."
    ]
  },
  {
    "name": "Movie Meetup Social Engineering",
    "scenario": "Movie Meetup Social Engineering",
    "points": [
      "Knowledge Point 1: Be careful about sharing where you are going. (Easiest)\nObservation task: Ethan tells everyone which movie theater he plans to visit.\nBehavior task: Avoid sharing your exact location in public posts. You can say, \"I'm excited to watch the new Marvel movie!\" without saying where you will be.",
      "Knowledge Point 2: Don't share your plans too early.\nObservation task: Ethan says he will be at the theater THIS FRIDAY. This tells strangers where he plans to go in the future.\nBehavior task: Share photos or stories after you have left the place, instead of posting your plans ahead of time.",
      "Knowledge Point 3: Don't share your exact schedule. (Harder)\nObservation task: Ethan shares the exact time (8 p.m.) and place. Someone could use this information to find him.\nBehavior task: Keep your exact plans and times private. If you need to make plans with friends, use a private message or group chat.",
      "Knowledge Point 4: Think about who can see your posts. (Most advanced)\nObservation task: A public post can be seen by people Ethan does not know. They may also learn when he is away from home.\nBehavior task: Check your privacy settings. Share plans only with people you trust, and avoid posting information that tells strangers when you are away."
    ]
  },
  {
    "name": "Location Sharing Safety",
    "scenario": "Location Sharing Risks",
    "points": [
      "Knowledge Point 1: Never share your home address publicly. (Easiest)\nObservation task: Jasmine shares her full home address: 321 Jefferson Ave.\nBehavior task: Never post your full home address online. If you see a friend sharing theirs, let them know and encourage them to delete the post.",
      "Knowledge Point 2: Remember that photos can reveal where you live.\nObservation task: The picture shows Jasmine's actual house. Details like the house color, design, and nearby places can help people find it.\nBehavior task: Before posting a photo, check the background. Make sure it does not show your house, street, address, or other clues about where you live.",
      "Knowledge Point 3: Don't invite strangers to your home. (Harder)\nObservation task: Jasmine's public post invites people to come over. Anyone who sees it might try to visit.\nBehavior task: Never invite people you don't know to your home. Share invitations only with trusted friends through private messages or group chats.",
      "Knowledge Point 4: Share general places instead of exact locations. (Most advanced)\nObservation task: An exact street address tells people exactly where to find Jasmine.\nBehavior task: Use general words like \"my neighborhood\" or \"downtown\" instead of sharing your full address. Check your privacy settings so only people you trust can see your posts."
    ]
  },
  {
    "name": "Phone Number Phishing Training",
    "scenario": "Contact Information Exposure",
    "points": [
      "Knowledge Point 1: Keep your phone number private. (Easiest)\nObservation task: Jake shares his phone number in a public post.\nBehavior task: Never post your phone number where everyone can see it. Only share it privately with people you trust.",
      "Knowledge Point 2: Think about who can see your personal information.\nObservation task: A public phone number can be seen and saved by strangers, not just Jake's friends.\nBehavior task: Check who can see your posts. Keep personal information away from public pages.",
      "Knowledge Point 3: Know what strangers can do with your phone number. (Harder)\nObservation task: Strangers could use Jake's number to send unwanted messages, make spam calls, or try to trick him.\nBehavior task: Never reply to strange messages or calls. Don't share passwords or secret login codes with anyone who contacts you unexpectedly.",
      "Knowledge Point 4: Know that phone numbers can be used to access accounts. (Most advanced)\nObservation task: Some websites use phone numbers to help people log in or prove who they are. Scammers may try to use your number to get into your accounts.\nBehavior task: Never share a login or verification code with anyone. If you receive a code you did not ask for, tell a trusted adult.",
      "Knowledge Point 5: Know what to do if you accidentally share your number.\nObservation task: Once a phone number is posted publicly, other people may have already seen or saved it.\nBehavior task: Delete the post right away. Tell a trusted adult, watch out for strange calls or messages, and share your number privately with close friends instead."
    ]
  }
]$catalog$::jsonb;
  entry jsonb;
  row_data public.room_templates%ROWTYPE;
  config jsonb;
  prompt text;
  replacement text;
  start_marker constant text := '## Detection Areas to Focus On:';
  end_marker constant text := '## Default Safe Actions:';
  matches integer;
BEGIN
  FOR entry IN SELECT value FROM jsonb_array_elements(source) LOOP
    SELECT count(*) INTO matches FROM public.room_templates
    WHERE tutor_id='00000000-0000-0000-0000-000000000000'
      AND template_name=entry->>'name';
    IF matches<>1 THEN
      RAISE EXCEPTION 'TEMPLATE_INVENTORY_MISMATCH: % has % rows',entry->>'name',matches;
    END IF;
    SELECT * INTO STRICT row_data FROM public.room_templates
    WHERE tutor_id='00000000-0000-0000-0000-000000000000'
      AND template_name=entry->>'name' FOR UPDATE;
    config:=row_data.ai_config_template;
    IF jsonb_typeof(config) IS DISTINCT FROM 'object'
       OR jsonb_typeof(config->'prompt_config') IS DISTINCT FROM 'object'
       OR config->>'scenario' IS DISTINCT FROM entry->>'scenario'
       OR jsonb_typeof(config->'system_prompt') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'TEMPLATE_CONFIG_MISMATCH: %',entry->>'name';
    END IF;
    prompt:=config->>'system_prompt';
    IF cardinality(string_to_array(prompt,start_marker))<>2
       OR cardinality(string_to_array(prompt,end_marker))<>2
       OR strpos(prompt,start_marker)>=strpos(prompt,end_marker) THEN
      RAISE EXCEPTION 'TEMPLATE_KNOWLEDGE_BOUNDARY_MISMATCH: %',entry->>'name';
    END IF;
    SELECT string_agg('- '||value,E'\n\n' ORDER BY ordinality) INTO replacement
      FROM jsonb_array_elements_text(entry->'points') WITH ORDINALITY;
    prompt:=split_part(prompt,start_marker,1)||start_marker||E'\n\n'||replacement
      ||E'\n\n'||end_marker||split_part(prompt,end_marker,2);
    config:=jsonb_set(config,'{prompt_config,detection_areas}',entry->'points');
    config:=jsonb_set(config,'{prompt_config,verification_steps}','[]'::jsonb);
    config:=jsonb_set(config,'{system_prompt}',to_jsonb(prompt));
    UPDATE public.room_templates SET ai_config_template=config,updated_at=now()
      WHERE id=row_data.id AND ai_config_template IS DISTINCT FROM config;
  END LOOP;
END;
$templates$;



-- Staging already runs the exact #96 baseline; production does not. Apply the
-- preserved component only on the inspected pre-#96 baseline, never reapply it
-- to staging. Unexpected source drift aborts the entire outer transaction.
DO $tracking_release$
DECLARE context_hash text; initialization_hash text;
BEGIN
  SELECT md5(pg_get_functiondef('public.get_transfer_message_analysis_context_v1(uuid,uuid,uuid)'::regprocedure)) INTO context_hash;
  SELECT md5(pg_get_functiondef('public.initialize_transfer_checklist_v1(uuid,uuid,jsonb,uuid)'::regprocedure)) INTO initialization_hash;
  IF context_hash='84a532b11f2d5b09e6ce755e3814fe9d' AND initialization_hash='e4f8b8eff23f074554f3a87e155c7306' THEN
    IF EXISTS (SELECT 1 FROM (VALUES ('public.session_checklists'),('public.checklist_items'),('public.coverage_evidence'),('public.checklist_updates')) t(name)
      CROSS JOIN (VALUES ('anon'),('authenticated')) r(name)
      WHERE has_table_privilege(r.name,t.name,'INSERT,UPDATE,DELETE,TRUNCATE')) THEN
      RAISE EXCEPTION 'TRACKING_GRANTS_BASELINE_CHANGED';
    END IF;
  ELSIF context_hash='3f81ae509e5c3c734af9e769e4d52015' AND initialization_hash='a5109cfc94b1d3635db0303c72133503' THEN
    EXECUTE $tracking_component$
-- Issue 96: tracking is independent of assessment eligibility.
-- No historical rows are changed or rejudged.

CREATE OR REPLACE FUNCTION public.initialize_transfer_checklist_v1(p_room_id uuid, p_student_id uuid, p_items jsonb, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_checklist_id uuid;
  v_item jsonb;
  v_setting text := COALESCE(current_setting('app.transfer_operation', true), '');
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') OR NOT EXISTS (
    SELECT 1 FROM public.rooms WHERE id = p_room_id AND tutor_id = p_actor_id
  ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sessions WHERE room_id = p_room_id AND student_id = p_student_id AND status = 'active')
    THEN RAISE EXCEPTION 'WRONG_LEARNER'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) <> 'object'
      OR btrim(COALESCE(v_item->>'area_text', '')) = ''
      OR v_item->>'item_type' NOT IN ('detection_area', 'verification_step', 'understanding', 'behavior')
      OR v_item->>'priority' NOT IN ('critical', 'important', 'optional')
    THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
  END LOOP;

  PERFORM set_config('app.transfer_operation', 'on', true);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));
  SELECT id INTO v_checklist_id
  FROM public.session_checklists
  WHERE room_id = p_room_id AND student_id = p_student_id
    AND progress_policy_version = 'transfer_v1' AND is_active
  ORDER BY created_at, id
  LIMIT 1 FOR UPDATE;
  IF v_checklist_id IS NULL THEN
    INSERT INTO public.session_checklists(room_id, student_id, progress_policy_version, template_name, is_active)
    VALUES (p_room_id, p_student_id, 'transfer_v1', 'Room learning targets', true)
    RETURNING id INTO v_checklist_id;
  END IF;

  PERFORM set_config('app.transfer_operation', 'on', true);
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.checklist_items
      WHERE checklist_id = v_checklist_id AND NOT deleted
        AND lower(btrim(area_text)) = lower(btrim(v_item->>'area_text'))
        AND item_type = v_item->>'item_type'
    ) THEN
      INSERT INTO public.checklist_items(
        checklist_id, area_text, item_type, priority, status, understanding_level,
        tutor_notes, attempts_count, original_template_area, deleted
      ) VALUES (
        v_checklist_id, btrim(v_item->>'area_text'), v_item->>'item_type', v_item->>'priority',
        'pending', 'none', '', 0, false, false
      );
    END IF;
  END LOOP;
  UPDATE public.session_checklists SET total_items = (
    SELECT count(*) FROM public.checklist_items WHERE checklist_id = v_checklist_id AND NOT deleted
  ), updated_at = now() WHERE id = v_checklist_id;
  PERFORM set_config('app.transfer_operation', v_setting, true);
  RETURN jsonb_build_object('checklist_id', v_checklist_id);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_transfer_message_analysis_context_v1(p_room_id uuid, p_message_id uuid, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_message messages%ROWTYPE;
  v_checklist session_checklists%ROWTYPE;
  v_marker private.learning_event_inbox%ROWTYPE;
  v_items jsonb;
  v_dialogue jsonb;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_message FROM messages WHERE id = p_message_id AND room_id = p_room_id;
  IF NOT FOUND OR v_message.user_role <> 'student' OR v_message.assessment_id IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_SCOPE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id) OR
     NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id) AND
     p_actor_id <> v_message.user_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF EXISTS(SELECT 1 FROM rooms WHERE id=p_room_id AND practice_type='cyberbullying') THEN
    PERFORM public.initialize_cyberbullying_progress_v1(p_room_id,v_message.user_id);
  END IF;
  SELECT * INTO v_checklist FROM session_checklists
  WHERE room_id = p_room_id AND student_id = v_message.user_id
    AND progress_policy_version = 'transfer_v1' AND is_active;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM session_checklists WHERE room_id=p_room_id AND progress_policy_version='legacy_v1') THEN
      RETURN jsonb_build_object('analysis_complete',true,'historical_read_only',true);
    END IF;
    RAISE EXCEPTION 'TARGET_SETUP_REQUIRED';
  END IF;
  IF v_message.created_at < v_checklist.created_at AND EXISTS (
    SELECT 1 FROM session_checklists WHERE room_id=p_room_id AND progress_policy_version='legacy_v1'
  ) THEN
    RETURN jsonb_build_object('analysis_complete',true,'historical_read_only',true);
  END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'area_text', area_text, 'item_type', item_type,
    'priority', priority, 'status', status, 'understanding_level', understanding_level
  ) ORDER BY id) INTO v_items FROM checklist_items
  WHERE checklist_id = v_checklist.id AND NOT deleted;
  IF v_items IS NULL THEN RAISE EXCEPTION 'TARGET_SETUP_REQUIRED'; END IF;

  SELECT COALESCE(jsonb_agg(turn ORDER BY source_order, setup_order, turn_at, message_order), '[]'::jsonb)
  INTO v_dialogue
  FROM (
    SELECT jsonb_build_object(
      'id', 'prepop-' || p_room_id::text || '-' || (setup.ordinal - 1)::text,
      'source', 'room_setup', 'user_id', NULL, 'user_role', setup.entry->>'role',
      'speaker_name', setup.entry->>'user_name', 'content', setup.entry->>'message'
    ) AS turn, 0 AS source_order, setup.ordinal AS setup_order,
      NULL::timestamptz AS turn_at, NULL::uuid AS message_order
    FROM rooms r
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.pre_populated_dialogue) = 'array'
        THEN r.pre_populated_dialogue ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS setup(entry, ordinal)
    WHERE r.id = p_room_id
    UNION ALL
    SELECT jsonb_build_object(
      'id', m.id, 'source', 'message', 'user_id', m.user_id,
      'user_role', m.user_role, 'speaker_name',coalesce(m.persona_name,u.display_name), 'character',m.character, 'persona_id',m.persona_id, 'content',m.content
    ), 1, 0::bigint, m.created_at, m.id
    FROM messages m LEFT JOIN users u ON u.id=m.user_id
    WHERE m.room_id = p_room_id
      AND (m.created_at, m.id) <= (v_message.created_at, v_message.id)
  ) dialogue;

  SELECT * INTO v_marker FROM private.learning_event_inbox
  WHERE dedupe_key = 'analysis:' || p_message_id::text;
  RETURN jsonb_build_object(
    'room_id', p_room_id, 'practice_type',(SELECT practice_type FROM rooms WHERE id=p_room_id),
    'scenario',(SELECT scenario_config FROM rooms WHERE id=p_room_id), 'student_id', v_message.user_id,
    'checklist_id', v_checklist.id,
    'message', jsonb_build_object('id', v_message.id, 'room_id', v_message.room_id,
      'user_id', v_message.user_id, 'user_role', v_message.user_role, 'content', v_message.content),
    'items', v_items,
    'dialogue_history', v_dialogue,
    'analysis_complete', COALESCE(v_marker.processing_state IN ('applied', 'no_change'), false),
    'analysis_deferred', COALESCE(v_marker.processing_state = 'deferred_guard', false)
  );
END;
$function$;


-- Browsers retain read/export access. Manual edits use the verified actor API.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.session_checklists,
  public.checklist_items, public.coverage_evidence, public.checklist_updates
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_checklist_from_template(uuid,text),
  public.initialize_checklist_from_template(uuid,uuid,text),
  public.update_checklist_progress(uuid),
  public.extract_checklist_from_prompt(text,uuid,uuid),
  public.soft_delete_checklist_item(uuid) FROM PUBLIC, anon, authenticated;

$tracking_component$;
  ELSE
    RAISE EXCEPTION 'TRACKING_FUNCTION_BASELINE_CHANGED';
  END IF;
  IF EXISTS (SELECT 1 FROM (VALUES
      ('public.initialize_checklist_from_template(uuid,text)'),
      ('public.initialize_checklist_from_template(uuid,uuid,text)'),
      ('public.update_checklist_progress(uuid)'),
      ('public.extract_checklist_from_prompt(text,uuid,uuid)'),
      ('public.soft_delete_checklist_item(uuid)')) f(name)
    CROSS JOIN (VALUES ('anon'),('authenticated')) r(name)
    WHERE has_function_privilege(r.name,f.name,'EXECUTE')) THEN
    RAISE EXCEPTION 'TRACKING_LEGACY_RPC_GRANTS_CHANGED';
  END IF;
END $tracking_release$;

-- Issue #100: preserve existing choices; new rooms default assessment on.
ALTER TABLE public.rooms ADD COLUMN in_room_assessment_enabled boolean NOT NULL DEFAULT true;
UPDATE public.rooms SET in_room_assessment_enabled = false
WHERE transfer_learning_enabled IS DISTINCT FROM true;
COMMENT ON COLUMN public.rooms.in_room_assessment_enabled IS 'Controls only preparation and delivery of new in-room assessments; never learning-target tracing.';

CREATE OR REPLACE FUNCTION public.enforce_practice_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
 IF TG_OP='UPDATE' AND NEW.practice_type IS DISTINCT FROM OLD.practice_type THEN
   RAISE EXCEPTION 'PRACTICE_TYPE_IMMUTABLE';
 END IF;
 IF NEW.practice_type='cyberbullying' AND (
   jsonb_typeof(NEW.scenario_config) IS DISTINCT FROM 'object'
   OR btrim(coalesce(NEW.scenario_config->>'id',''))=''
   OR btrim(coalesce(NEW.scenario_config->>'source_commit',''))=''
   OR jsonb_typeof(NEW.scenario_config->'post') IS DISTINCT FROM 'object'
   OR btrim(coalesce(NEW.scenario_config->'post'->>'text',''))=''
   OR btrim(coalesce(NEW.scenario_config->'post'->>'image',''))=''
   OR btrim(coalesce(NEW.scenario_config->'post'->'author'->>'id',''))=''
   OR btrim(coalesce(NEW.scenario_config->'post'->'author'->>'name',''))=''
   OR jsonb_typeof(NEW.scenario_config->'initial_comments') IS DISTINCT FROM 'array'
 ) THEN RAISE EXCEPTION 'SCENARIO_REQUIRED'; END IF;
 IF TG_TABLE_NAME='rooms' AND NEW.practice_type='cyberbullying' THEN
   NEW.transfer_learning_enabled := false;
   NEW.in_room_assessment_enabled := false;
 END IF;
 RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.prepare_transfer_assessment_context_v1(p_room_id uuid, p_focus_student_message_id uuid, p_checklist_id uuid, p_actor_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_message messages%ROWTYPE;
  v_checklist session_checklists%ROWTYPE;
  v_room rooms%ROWTYPE;
  v_marker private.learning_event_inbox%ROWTYPE;
  v_items jsonb;
  v_eligible jsonb;
  v_selected uuid;
  v_visit_start timestamptz;
  v_blocked boolean;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT v_room.in_room_assessment_enabled THEN RAISE EXCEPTION 'IN_ROOM_ASSESSMENT_DISABLED'; END IF;
  SELECT * INTO v_message FROM messages
  WHERE id = p_focus_student_message_id AND room_id = p_room_id AND user_role = 'student'
    AND assessment_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  SELECT * INTO v_checklist FROM session_checklists WHERE id = p_checklist_id
    AND room_id = p_room_id AND student_id = v_message.user_id
    AND progress_policy_version = 'transfer_v1' AND is_active;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM checklist_items WHERE checklist_id = v_checklist.id AND NOT deleted
  ) THEN RAISE EXCEPTION 'TARGET_SETUP_REQUIRED'; END IF;
  SELECT * INTO v_marker FROM private.learning_event_inbox
  WHERE dedupe_key = 'analysis:' || p_focus_student_message_id::text;
  IF NOT FOUND OR v_marker.processing_state NOT IN ('applied', 'no_change', 'deferred_guard') THEN
    RAISE EXCEPTION 'ANALYSIS_INCOMPLETE';
  END IF;
  IF v_marker.processing_state = 'deferred_guard' AND v_room.guard_mode = false THEN
    RAISE EXCEPTION 'ANALYSIS_INCOMPLETE';
  END IF;

  SELECT max(started_at) INTO v_visit_start FROM private.learner_visits
    WHERE room_id = p_room_id AND student_id = v_message.user_id;
  v_blocked := v_room.guard_mode = true;

  SELECT jsonb_agg(jsonb_build_object(
    'id', ci.id, 'area_text', ci.area_text, 'priority', ci.priority,
    'status', ci.status, 'understanding_level', ci.understanding_level,
    'relevant_evidence_message_ids', COALESCE((
      SELECT jsonb_agg(DISTINCT ce.message_id) FROM coverage_evidence ce
      WHERE ce.item_id = ci.id AND ce.message_id IS NOT NULL
    ), '[]'::jsonb),
    'repair_message_id', (
      SELECT le.source_message_id FROM private.learning_event_inbox le
      WHERE le.item_id = ci.id AND le.event_kind = 'post_repair_signal'
        AND le.processing_state = 'applied' ORDER BY le.applied_at DESC LIMIT 1
    )
  ) ORDER BY ci.id) INTO v_items FROM checklist_items ci
  WHERE ci.checklist_id = v_checklist.id AND NOT ci.deleted;

  SELECT COALESCE(jsonb_agg(ci.id ORDER BY
    CASE ci.priority WHEN 'critical' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
    ci.id), '[]'::jsonb) INTO v_eligible FROM checklist_items ci
  WHERE ci.checklist_id = v_checklist.id AND NOT ci.deleted
    AND ci.status = 'covered' AND ci.understanding_level = 'good'
    AND EXISTS (
      SELECT 1 FROM coverage_evidence ce JOIN messages m ON m.id = ce.message_id
      WHERE ce.item_id = ci.id AND m.room_id = p_room_id
        AND m.user_id = v_message.user_id AND m.user_role = 'student'
    ) AND EXISTS (
      SELECT 1 FROM private.learning_event_inbox due
      JOIN public.messages evidence ON evidence.id = due.source_message_id
      WHERE due.event_id = private.transfer_assessment_due_event(ci.id)
        AND evidence.room_id = p_room_id AND evidence.user_id = v_message.user_id
        AND (evidence.created_at, evidence.id) <= (v_message.created_at, v_message.id)
    ) AND NOT v_blocked
    AND NOT EXISTS (
      SELECT 1 FROM private.transfer_assessments ta
      WHERE ta.room_id = p_room_id AND ta.student_id = v_message.user_id AND ta.item_id = ci.id
        AND (ta.lifecycle = 'open'
          OR (ta.lifecycle <> 'cancelled' AND ta.created_at >= COALESCE(v_visit_start, '-infinity'::timestamptz))
          OR (ta.lifecycle IN ('passed', 'failed') AND ta.closed_at >= COALESCE(v_visit_start, '-infinity'::timestamptz)))
    );
  SELECT (value #>> '{}')::uuid INTO v_selected
  FROM jsonb_array_elements(v_eligible) value LIMIT 1;

  RETURN jsonb_build_object(
    'room_id', p_room_id, 'student_id', v_message.user_id,
    'checklist_id', v_checklist.id,
    'focus_student_message_id', v_message.id,
    'selected_target_item_id', v_selected,
    'no_assessment_due', v_selected IS NULL,
    'context', jsonb_build_object(
      'room_id', p_room_id, 'checklist_id', v_checklist.id,
      'focus_student_id', v_message.user_id,
      'focus_student_message', jsonb_build_object('id', v_message.id,
        'room_id', p_room_id, 'user_id', v_message.user_id,
        'user_role', 'student', 'content', v_message.content),
      'prior_guard_mode', v_room.guard_mode,
      'checklist_items', v_items,
      'eligible_assessment_item_ids', v_eligible,
      'unresolved_assessment', NULL,
      'feedback_required', false,
      'progress_snapshot_hash', md5(v_items::text || v_message.id::text)
    )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.send_reviewed_transfer_assessment_v1(p_reviewed_payload jsonb, p_room_id uuid, p_student_id uuid, p_checklist_id uuid, p_item_id uuid, p_focus_student_message_id uuid, p_actor_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_context jsonb;
  v_legacy_payload jsonb;
  v_result jsonb;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  PERFORM 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT (SELECT in_room_assessment_enabled FROM rooms WHERE id = p_room_id) THEN
    RAISE EXCEPTION 'IN_ROOM_ASSESSMENT_DISABLED';
  END IF;
  PERFORM 1 FROM rooms WHERE id = p_room_id AND guard_mode = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSESSMENT_NOT_ELIGIBLE'; END IF;
  PERFORM 1 FROM checklist_items WHERE id = p_item_id AND checklist_id = p_checklist_id
    AND NOT deleted FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
  v_context := public.prepare_transfer_assessment_context_v1(
    p_room_id, p_focus_student_message_id, p_checklist_id, p_actor_id, p_request_id
  );
  IF (v_context->>'selected_target_item_id')::uuid IS DISTINCT FROM p_item_id OR
     (v_context->>'student_id')::uuid IS DISTINCT FROM p_student_id OR
     p_reviewed_payload->>'target_item_id' IS DISTINCT FROM p_item_id::text OR
     btrim(COALESCE(p_reviewed_payload->>'reason', '')) = '' OR
     btrim(COALESCE(p_reviewed_payload->'assessment'->>'stem', '')) = '' THEN
    RAISE EXCEPTION 'ASSESSMENT_NOT_ELIGIBLE';
  END IF;
  IF jsonb_typeof(p_reviewed_payload->'assessment'->'transfer_basis'->'source_evidence_message_ids') <> 'array' OR
     jsonb_array_length(p_reviewed_payload->'assessment'->'transfer_basis'->'source_evidence_message_ids') = 0 OR
     EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(
         p_reviewed_payload->'assessment'->'transfer_basis'->'source_evidence_message_ids'
       ) evidence_id
       LEFT JOIN messages m ON m.id = evidence_id::uuid
       WHERE m.id IS NULL OR m.room_id <> p_room_id OR
         m.user_id <> p_student_id OR m.user_role <> 'student' OR
         NOT EXISTS (
           SELECT 1 FROM coverage_evidence ce
           WHERE ce.item_id = p_item_id AND ce.message_id = m.id
         )
     ) THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
  IF EXISTS (
    SELECT 1 FROM private.transfer_assessments ta
    WHERE ta.room_id = p_room_id AND ta.student_id = p_student_id
      AND ta.item_id = p_item_id AND ta.lifecycle = 'failed'
      AND lower(btrim(ta.transfer_basis->>'changed_context')) =
        lower(btrim(p_reviewed_payload->'assessment'->'transfer_basis'->>'changed_context'))
  ) THEN RAISE EXCEPTION 'ASSESSMENT_NOT_ELIGIBLE'; END IF;
  v_legacy_payload := jsonb_build_object(
    'reason', p_reviewed_payload->>'reason',
    'learning_evidence', '[]'::jsonb,
    'decision', jsonb_build_object('mode', 'assessment',
      'instruction', 'transfer_assess', 'target_item_id', p_item_id),
    'response', p_reviewed_payload->'assessment'->>'stem',
    'assessment', p_reviewed_payload->'assessment'
  );
  v_result := public.send_reviewed_tutor_response_v4(
    v_legacy_payload, p_room_id, p_student_id, p_checklist_id,
    p_item_id, p_focus_student_message_id, p_actor_id, p_request_id
  );
  RETURN v_result;
END;
$function$
;


-- Keep the new server gate behind the existing trusted tutor boundary. Table-level
-- privileges override column grants, so retain ordinary writes through explicit
-- grants for every existing room column while excluding the assessment switch.
REVOKE INSERT, UPDATE ON public.rooms FROM PUBLIC, anon, authenticated;
DO $$
DECLARE writable_columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO writable_columns
  FROM pg_attribute WHERE attrelid='public.rooms'::regclass AND attnum>0
    AND NOT attisdropped AND attname<>'in_room_assessment_enabled';
  EXECUTE format('GRANT INSERT (%s), UPDATE (%s) ON public.rooms TO anon, authenticated',
    writable_columns, writable_columns);
END $$;

CREATE OR REPLACE FUNCTION public.set_in_room_assessment_enabled_v1(
  p_room_id uuid, p_enabled boolean, p_actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, private
AS $$
DECLARE updated public.rooms%ROWTYPE;
BEGIN
  IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  UPDATE public.rooms SET in_room_assessment_enabled=p_enabled
  WHERE id=p_room_id AND tutor_id=p_actor_id AND EXISTS (
    SELECT 1 FROM public.users WHERE id=p_actor_id AND "current_role"='tutor'
  ) RETURNING * INTO updated;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN jsonb_build_object('room',to_jsonb(updated));
END $$;
REVOKE ALL ON FUNCTION public.set_in_room_assessment_enabled_v1(uuid,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_in_room_assessment_enabled_v1(uuid,boolean,uuid) TO service_role;

-- The inspected production baseline retains two old tracing/setup predicates
-- already absent on staging. Remove only those predicates, preserving each
-- project's other checklist/history behavior, ownership, OIDs and grants.
DO $$
DECLARE fn record; definition text; expected_hashes text[];
BEGIN
  FOR fn IN SELECT oid,proname FROM pg_proc WHERE oid IN (
    'public.initialize_transfer_checklist_v1(uuid,uuid,jsonb,uuid)'::regprocedure,
    'public.get_transfer_message_analysis_context_v1(uuid,uuid,uuid)'::regprocedure
  ) LOOP
    definition:=pg_get_functiondef(fn.oid);
    IF fn.proname='initialize_transfer_checklist_v1' THEN
      expected_hashes:=ARRAY['e4f8b8eff23f074554f3a87e155c7306','a5109cfc94b1d3635db0303c72133503'];
      IF md5(definition)<>ALL(expected_hashes) THEN RAISE EXCEPTION 'CHECKLIST_INITIALIZATION_BASELINE_CHANGED'; END IF;
      definition:=replace(definition,
        'WHERE id = p_room_id AND tutor_id = p_actor_id AND transfer_learning_enabled',
        'WHERE id = p_room_id AND tutor_id = p_actor_id');
    ELSE
      expected_hashes:=ARRAY['84a532b11f2d5b09e6ce755e3814fe9d','3f81ae509e5c3c734af9e769e4d52015'];
      IF md5(definition)<>ALL(expected_hashes) THEN RAISE EXCEPTION 'MESSAGE_ANALYSIS_BASELINE_CHANGED'; END IF;
      definition:=replace(definition,
        'WHERE id = p_room_id AND (transfer_learning_enabled OR practice_type=''cyberbullying'')',
        'WHERE id = p_room_id');
    END IF;
    EXECUTE definition;
  END LOOP;
END $$;
