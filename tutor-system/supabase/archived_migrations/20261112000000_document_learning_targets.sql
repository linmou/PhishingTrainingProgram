-- Issue #73: install the document's cyberbullying targets for new checklists.
-- Source: General Learning Goals.docx, SHA-256 fd0a0f49106e1b37795886dc39f974c3e99758e0007df5c2b0ba5d730dd6655b.
-- Preserve the target version, text, evidence and progress of existing learners.
BEGIN;

CREATE OR REPLACE FUNCTION public.cyberbullying_learning_targets(p_target_version text)
RETURNS TABLE(target_key text, area_text text, item_type text, priority text)
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_target_version = 'cyberbullying_v1' THEN
    RETURN QUERY SELECT t.target_key,t.area_text,t.item_type,t.priority FROM (VALUES
    (1, 'recognize_cyberbullying_impact', 'Recognize harmful online behavior and explain its impact on the person targeted.', 'understanding', 'important'),
    (2, 'show_empathy_support', 'Acknowledge the targeted person’s feelings and offer a concrete supportive response.', 'behavior', 'important'),
    (3, 'stand_up_constructively', 'Challenge bullying with a calm, respectful response that avoids escalating the conflict.', 'behavior', 'important'),
    (4, 'avoid_reinforcing_bullying', 'Choose responses that avoid joining in, amplifying, or rewarding harmful behavior.', 'behavior', 'important'),
    (5, 'choose_safe_next_step', 'Choose an appropriate next step such as supporting the person privately, saving evidence, reporting, blocking, or seeking trusted help.', 'behavior', 'important')
    ) AS t(sort_order,target_key,area_text,item_type,priority) ORDER BY t.sort_order;
  ELSIF p_target_version = 'cyberbullying_doc_20261112' THEN
    RETURN QUERY SELECT t.target_key,t.area_text,t.item_type,t.priority FROM (VALUES
    (1, 'recognize_cyberbullying_impact', 'Knowledge Point 1: Recognize cyberbullying. (Easiest)
What to understand: Online bullying can hurt people''s feelings, make them feel scared or lonely, and make them not want to go online.
What to do: Recognize that these actions are not okay. Don''t dismiss them as just a joke if someone is being hurt.', 'understanding', 'important'),
    (2, 'show_empathy_support', 'Knowledge Point 2: Show kindness and support the person being bullied.
What to understand: The person being bullied may feel sad, embarrassed, scared, or alone.
What to do: Send them a kind private message, such as "I''m sorry this happened. Are you okay?" Let them know they are not alone. Offer to help them find a trusted adult.', 'behavior', 'important'),
    (3, 'avoid_reinforcing_bullying', 'Knowledge Point 3: Don''t join in or help spread bullying.
What to understand: Even if you don''t write the mean message, sharing it or laughing at it can make the bullying worse.
What to do: Don''t like, share, forward, or comment on hurtful posts. Don''t laugh along or encourage the bully. If it is safe, show that you don''t support the behavior.', 'behavior', 'important'),
    (4, 'stand_up_constructively', 'Knowledge Point 4: Speak up calmly without making things worse. (Harder)
What to understand: Fighting back with mean words or starting an online argument can make the situation worse.
What to do: If it is safe, respond calmly with a short message, such as "That''s not okay. Please stop." Don''t insult, threaten, or argue with the bully. If you think speaking up could put you or someone else in danger, don''t confront them. Get help from a trusted adult instead.', 'behavior', 'important'),
    (5, 'choose_safe_next_step', 'Knowledge Point 5: Choose a safe next step and get help. (Most advanced)
What to understand: You don''t have to solve cyberbullying by yourself. There are safe ways to protect the person being bullied.
What to do:
Save evidence: Take screenshots of hurtful messages or posts before they disappear. Don''t forward or repost them.
Report: Use the platform''s report button to tell the social media company about the bullying.
Block: Block the person who is bullying so they cannot keep contacting you.
Get trusted help: Tell a parent, teacher, school counselor, or another trusted adult. Ask them to help decide what to do next.
Support the victim: Continue checking on the person being bullied and remind them that they are not alone.', 'behavior', 'important')
    ) AS t(sort_order,target_key,area_text,item_type,priority) ORDER BY t.sort_order;
  ELSE
    RAISE EXCEPTION 'UNKNOWN_TARGET_VERSION';
  END IF;
END;
$function$;

-- This overload exposes only the same static catalog content as the existing RPC.
-- Match that RPC's public read privileges; existing function ACLs are preserved.
GRANT EXECUTE ON FUNCTION public.cyberbullying_learning_targets(text)
TO PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cyberbullying_learning_targets()
RETURNS TABLE(target_key text, area_text text, item_type text, priority text)
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT * FROM public.cyberbullying_learning_targets('cyberbullying_doc_20261112');
$function$;

CREATE OR REPLACE FUNCTION private.protect_cyberbullying_targets()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'private'
AS $function$
DECLARE cid uuid; rid uuid; subject text; version text;
BEGIN
  IF TG_TABLE_NAME='session_checklists' THEN
    rid:=CASE WHEN TG_OP='DELETE' THEN OLD.room_id ELSE NEW.room_id END;
  ELSE
    cid:=CASE WHEN TG_OP='DELETE' THEN OLD.checklist_id ELSE NEW.checklist_id END;
    SELECT room_id,target_version INTO rid,version FROM session_checklists WHERE id=cid;
  END IF;
  SELECT practice_type INTO subject FROM rooms WHERE id=rid;
  IF subject IS DISTINCT FROM 'cyberbullying' THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'SHARED_TARGETS_REQUIRED'; END IF;
  IF TG_TABLE_NAME='session_checklists' THEN
    IF coalesce(NEW.target_version,'') NOT IN ('cyberbullying_v1','cyberbullying_doc_20261112')
      OR NEW.progress_policy_version IS DISTINCT FROM 'transfer_v1'
      OR NEW.student_id IS NULL THEN RAISE EXCEPTION 'SHARED_TARGETS_REQUIRED'; END IF;
    IF TG_OP='UPDATE' AND (
      NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.room_id IS DISTINCT FROM OLD.room_id
      OR NEW.target_version IS DISTINCT FROM OLD.target_version
    ) THEN RAISE EXCEPTION 'LEARNER_SCOPE_IMMUTABLE'; END IF;
  ELSE
    IF NEW.deleted OR NOT EXISTS(
      SELECT 1 FROM public.cyberbullying_learning_targets(version) t
      WHERE t.target_key=NEW.target_key AND t.area_text=NEW.area_text
        AND t.item_type=NEW.item_type AND t.priority=NEW.priority
    ) THEN RAISE EXCEPTION 'SHARED_TARGETS_REQUIRED'; END IF;
    IF TG_OP='UPDATE' AND (
      NEW.checklist_id IS DISTINCT FROM OLD.checklist_id OR NEW.target_key IS DISTINCT FROM OLD.target_key
    ) THEN RAISE EXCEPTION 'LEARNER_SCOPE_IMMUTABLE'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.initialize_cyberbullying_progress_v1(p_room_id uuid, p_student_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  c uuid;
  version text;
  old_operation text := coalesce(current_setting('app.transfer_operation',true),'');
  old_initialization text := coalesce(current_setting('app.cyberbullying_initialization',true),'');
BEGIN
  PERFORM 1 FROM rooms WHERE id=p_room_id AND practice_type='cyberbullying' AND is_active FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(
    SELECT 1 FROM sessions WHERE room_id=p_room_id AND student_id=p_student_id AND status='active'
  ) THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  PERFORM set_config('app.transfer_operation','on',true);
  PERFORM set_config('app.cyberbullying_initialization','on',true);
  SELECT id,target_version INTO c,version FROM session_checklists
    WHERE room_id=p_room_id AND student_id=p_student_id
      AND is_active AND progress_policy_version='transfer_v1' FOR UPDATE;
  IF c IS NULL THEN
    version:='cyberbullying_doc_20261112';
    INSERT INTO session_checklists(room_id,student_id,progress_policy_version,template_name,is_active,target_version)
    VALUES(p_room_id,p_student_id,'transfer_v1','Cyberbullying learning targets',true,version)
    RETURNING id INTO c;
  END IF;
  INSERT INTO checklist_items(checklist_id,target_key,area_text,item_type,priority,status,
    understanding_level,tutor_notes,attempts_count,original_template_area,deleted)
  SELECT c,t.target_key,t.area_text,t.item_type,t.priority,'pending','none','',0,true,false
    FROM public.cyberbullying_learning_targets(version) t
  ON CONFLICT(checklist_id,target_key) WHERE target_key IS NOT NULL AND NOT deleted DO NOTHING;
  UPDATE session_checklists SET total_items=5,updated_at=now() WHERE id=c;
  PERFORM set_config('app.transfer_operation',old_operation,true);
  PERFORM set_config('app.cyberbullying_initialization',old_initialization,true);
  RETURN c;
END;
$function$;

-- Six standard phishing/privacy templates keep their existing room content and policy.
DO $templates$
DECLARE
  source jsonb := $catalog$[
  {
    "name": "Nintendo Switch Deal Scam",
    "scenario": "Nintendo Switch Deal ($19.99)",
    "points": [
      "Knowledge Point 1: Check if the deal is too good to be true. (Easiest)\nWhat to notice: A Nintendo Switch usually costs hundreds of dollars, but this post offers one for only $19.99.\nWhat to do: Stop and ask yourself: \"Why is this so cheap?\" If a deal seems too good to be true, be careful.",
      "Knowledge Point 2: Watch out for messages that rush you.\nWhat to notice: Words like \"HURRY UP\" and \"WILL NOT LAST\" try to make you act quickly.\nWhat to do: Take your time. Don't let a post rush you into clicking a link or buying something.",
      "Knowledge Point 3: Check who shared the deal.\nWhat to notice: The post comes from someone named Lucy Simms, not an official Nintendo account.\nWhat to do: Look at the person's profile. Check when the account was created, what else they have posted, and whether they are connected to Nintendo.",
      "Knowledge Point 4: Learn to spot suspicious links. (Harder)\nWhat to notice: The link uses \"goo.gl,\" which hides the real website. It does not show Nintendo's official website address.\nWhat to do: Don't click shortened or unfamiliar links. Look for Nintendo's official website address instead. A lock symbol or HTTPS alone does not prove a website is safe.",
      "Knowledge Point 5: Check the deal with the real company. (Most advanced)\nWhat to notice: There is no proof that Nintendo is really offering this deal.\nWhat to do: Visit Nintendo's official website or social media pages yourself. Check whether the deal is listed there. You can also ask a trusted adult to help."
    ]
  },
  {
    "name": "iTunes Gift Card Survey Scam",
    "scenario": "iTunes Gift Card Survey ($500)",
    "points": [
      "Knowledge Point 1: Check if the reward makes sense. (Easiest)\nWhat to notice: The post promises a $500 gift card for only five minutes of answering questions.\nWhat to do: Ask yourself: \"Would a company really give away so much money for such a small task?\" Be careful when a reward seems too big.",
      "Knowledge Point 2: Watch out for exciting promises.\nWhat to notice: Words like \"CRAZY DEAL!!\" and \"got instantly\" make the offer sound exciting and encourage people to act quickly.\nWhat to do: Don't let exciting words or promises make you forget to check whether something is real.",
      "Knowledge Point 3: Check who is sharing the reward.\nWhat to notice: Emma Garcia is sharing the offer, but there is no proof that she works for Apple or iTunes.\nWhat to do: Look at her profile and past posts. Be careful if the account often shares free gifts or amazing offers.",
      "Knowledge Point 4: Look carefully at the website link. (Harder)\nWhat to notice: The link uses \"bit.ly,\" which hides the real website address.\nWhat to do: Don't click the link. Go to Apple's official website yourself to check whether the offer is real.",
      "Knowledge Point 5: Check whether the company really offers the reward. (Most advanced)\nWhat to notice: The post has a gift card picture, but it does not show an official Apple announcement or explain the rules of the giveaway.\nWhat to do: Check Apple's official website and social media pages for the giveaway. Ask a trusted adult to help you check before sharing information or answering a survey."
    ]
  },
  {
    "name": "Account Security Alert Scam",
    "scenario": "Account Security Alert",
    "points": [
      "Knowledge Point 1: Be careful when a message tries to scare you. (Easiest)\nWhat to notice: The message says \"YOUR ACCOUNT IS AT RISK\" and uses lots of warning symbols to make you feel scared.\nWhat to do: Stay calm. Don't click anything just because a message says something bad will happen.",
      "Knowledge Point 2: Check who sent the warning.\nWhat to notice: The message comes from \"Socail Media Testdrive,\" which is not the name of a social media company. It also has a spelling mistake in \"Social.\"\nWhat to do: Check the sender's name carefully. Be suspicious of messages from unknown people or companies.",
      "Knowledge Point 3: Check whether the warning tells you which account is in danger.\nWhat to notice: The message says your account is at risk but does not say whether it means Instagram, TikTok, Snapchat, or another account.\nWhat to do: Ask yourself: \"Which account are they talking about?\" A vague warning from an unknown sender is suspicious.",
      "Knowledge Point 4: Check the website address before trusting it. (Harder)\nWhat to notice: The link goes to \"testdrive.info,\" not the official website of a social media company.\nWhat to do: Never click a link in a scary security message. Open the real app or type its official website address yourself.",
      "Knowledge Point 5: Check your account safely. (Most advanced)\nWhat to notice: A real account problem should be checked through the social media company itself, not through a random message.\nWhat to do: Log in through the official app or website. Check your account's security notifications and recent login activity. If you are still worried, ask a trusted adult for help or contact the platform through its official help center."
    ]
  },
  {
    "name": "Movie Meetup Social Engineering",
    "scenario": "Movie Meetup Social Engineering",
    "points": [
      "Knowledge Point 1: Be careful about sharing where you are going. (Easiest)\nWhat to notice: Ethan tells everyone which movie theater he plans to visit.\nWhat to do: Avoid sharing your exact location in public posts. You can say, \"I'm excited to watch the new Marvel movie!\" without saying where you will be.",
      "Knowledge Point 2: Don't share your plans too early.\nWhat to notice: Ethan says he will be at the theater THIS FRIDAY. This tells strangers where he plans to go in the future.\nWhat to do: Share photos or stories after you have left the place, instead of posting your plans ahead of time.",
      "Knowledge Point 3: Don't share your exact schedule. (Harder)\nWhat to notice: Ethan shares the exact time (8 p.m.) and place. Someone could use this information to find him.\nWhat to do: Keep your exact plans and times private. If you need to make plans with friends, use a private message or group chat.",
      "Knowledge Point 4: Think about who can see your posts. (Most advanced)\nWhat to notice: A public post can be seen by people Ethan does not know. They may also learn when he is away from home.\nWhat to do: Check your privacy settings. Share plans only with people you trust, and avoid posting information that tells strangers when you are away."
    ]
  },
  {
    "name": "Location Sharing Safety",
    "scenario": "Location Sharing Risks",
    "points": [
      "Knowledge Point 1: Never share your home address publicly. (Easiest)\nWhat to notice: Jasmine shares her full home address: 321 Jefferson Ave.\nWhat to do: Never post your full home address online. If you see a friend sharing theirs, let them know and encourage them to delete the post.",
      "Knowledge Point 2: Remember that photos can reveal where you live.\nWhat to notice: The picture shows Jasmine's actual house. Details like the house color, design, and nearby places can help people find it.\nWhat to do: Before posting a photo, check the background. Make sure it does not show your house, street, address, or other clues about where you live.",
      "Knowledge Point 3: Don't invite strangers to your home. (Harder)\nWhat to notice: Jasmine's public post invites people to come over. Anyone who sees it might try to visit.\nWhat to do: Never invite people you don't know to your home. Share invitations only with trusted friends through private messages or group chats.",
      "Knowledge Point 4: Share general places instead of exact locations. (Most advanced)\nWhat to notice: An exact street address tells people exactly where to find Jasmine.\nWhat to do: Use general words like \"my neighborhood\" or \"downtown\" instead of sharing your full address. Check your privacy settings so only people you trust can see your posts."
    ]
  },
  {
    "name": "Phone Number Phishing Training",
    "scenario": "Contact Information Exposure",
    "points": [
      "Knowledge Point 1: Keep your phone number private. (Easiest)\nWhat to notice: Jake shares his phone number in a public post.\nWhat to do: Never post your phone number where everyone can see it. Only share it privately with people you trust.",
      "Knowledge Point 2: Think about who can see your personal information.\nWhat to notice: A public phone number can be seen and saved by strangers, not just Jake's friends.\nWhat to do: Check who can see your posts. Keep personal information away from public pages.",
      "Knowledge Point 3: Know what strangers can do with your phone number. (Harder)\nWhat to notice: Strangers could use Jake's number to send unwanted messages, make spam calls, or try to trick him.\nWhat to do: Never reply to strange messages or calls. Don't share passwords or secret login codes with anyone who contacts you unexpectedly.",
      "Knowledge Point 4: Know that phone numbers can be used to access accounts. (Most advanced)\nWhat to notice: Some websites use phone numbers to help people log in or prove who they are. Scammers may try to use your number to get into your accounts.\nWhat to do: Never share a login or verification code with anyone. If you receive a code you did not ask for, tell a trusted adult.",
      "Knowledge Point 5: Know what to do if you accidentally share your number.\nWhat to notice: Once a phone number is posted publicly, other people may have already seen or saved it.\nWhat to do: Delete the post right away. Tell a trusted adult, watch out for strange calls or messages, and share your number privately with close friends instead."
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

COMMIT;
