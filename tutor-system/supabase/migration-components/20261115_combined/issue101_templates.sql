-- Issue #101: canonical task labels for new rooms; preserve existing room and learner snapshots.
BEGIN;

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

COMMIT;
