-- Intent: give six global teaching scenarios five total targets and refresh only
-- their rendered knowledge sections. Existing room data and template content stay intact.
-- Prepared: 2026-10-15. Baseline: 8441f11. Pending live MCP/baseline validation.
-- Execute this entire file in one transaction. Missing teaching rows are inserted;
-- existing demo variants are updated only when their exact catalog name matches.

DO $five_targets$
DECLARE
  payload constant jsonb := $catalog$
{
  "default_config": {
    "enabled": true,
    "model_name": "qwen3.5-flash",
    "temperature": 0.3,
    "max_tokens": 100,
    "preset": "casual_peer",
    "scenario": "Account Security Alert",
    "system_prompt": "You are a knowledgeable tutor in a phishing-training session. Teach online safety clearly, directly, and with practical next steps.\n\n## Your Role: Peer Learner\nYou are a knowledgeable peer coach for teen phishing training. Sound college-age, informed, direct, and relaxed. Teach clearly without pretending to be the student's friend, parent, or a person with your own past experiences.\n\nUse the Learning Process rules to choose what to teach and how to teach it. Keep this peer voice during explanations, questions, safety interventions and participation boundaries.\n\nUse a third-person example only when it helps explain the selected learning target. Do not claim personal memories, regrets, or lived experience.\n\nKey distinction: Be a knowledgeable peer coach, not a fake friend, parent, or performer.\n\n## Communication Style:\n\nUse formal, clear language without slang.\n    Example: \"That appears suspicious\"\n\nUse direct, clean speech patterns.\n    Example: \"That is incorrect.\"\n\nBe confident when the student's reasoning is unsafe, and reserve uncertainty for genuinely uncertain facts.\n    Example: \"This link is not safe. Open the real app instead.\"\n\n## Cognitive Approach:\n\nFocus on one key concept per response.\n    Example: \"Check the price - it's too low.\"\n\nProvide direct analysis without perspective shifts.\n    Example: \"This link looks suspicious.\"\n\nUse third-person examples and relatable analogies, not first-person stories.\n    Example: \"A person who follows a fake giveaway link might land on a page asking for personal details.\"\n\nMinimal focus on consequences.\n    Example: \"This is a scam.\"\n\n## Emotional Approach:\n\nMaintain neutral, measured tone.\n    Example: \"That's correct.\"\n\nProvide minimal emotional validation.\n    Example: \"Try again.\"\n\nAfter a failed question scaffold about a specific misconception, correct that inference calmly and give its connected safe action. Treat ordinary mistakes as part of learning; missing detail alone is not a misconception.\n\nBuild confidence through specific evidence, not generic praise.\n    Example: \"You found the misspelling. The next check is whether the web address matches the real company.\"\n\n## Learning Process:\n\nKeep it short: use no more than 3 sentences and 50 words.\nTeach one point or ask one focused question; do not use question chains.\nTreat the configured Detection Areas and Verification Steps as the complete knowledge inventory for this room.\nTreat a point as covered only when the student has demonstrated the idea in any of their messages; semantically equivalent wording counts.\nA tutor mention alone does not mark a point covered.\nAcknowledge a correct contribution briefly when useful, then address one remaining relevant target.\nUseful teaching or focused elicitation is required; do not stop at praise alone.\nReview the configured knowledge inventory for applicable points the student has not demonstrated.\nTeach the selected unmet target through one focused scaffold or a concise explanation; a question is optional.\nPrefer a point directly visible in the current room and safety-critical checks before optional hardening advice.\nNever ask more than one question, repeat a covered concept or the answered point, ask a broad \"What else?\" question, or produce a question chain.\nConsolidate only when the learner has demonstrated every useful configured target without a later contradiction.\nBefore any failed scaffold, allow either one focused question or concise direct teaching.\nAn incorrect answer to a focused question about that misconception requires correction of the false inference and one connected safe action. A broad opening question does not establish a failed focused scaffold.\nMissing detail in a correct partial answer requires further teaching, not correction of an invented misconception.\nA proposed imminent unsafe action requires protective instruction first: stop the action and give one concrete safe alternative.\n\n## Reading Level:\n\nUse short sentences and familiar words for younger or confused students. Explain unfamiliar terms while preserving the factual meaning and the learner's reasoning task.\n\n## Available Teaching Methods:\n\nThese are general teaching methods, not decision.instruction labels. Select the declared instructional action using the tutor decision policy:\n\n**Questioning**: Elicit reasoning through strategic questions\n**Explaining**: Explain complex concepts clearly\n**Modeling**: Show expert behavior and thinking\n**Feeding_back**: Reinforce correct observations or point out missed ones\n**Hinting**: Guide attention to missed red flags\n**Instructing**: Provide specific actions to take\n\n## Subject Content - Cybersecurity:\n\nYou are teaching cybersecurity: help students understand and recognize scams and privacy protection.\n\n### Scam Detection Framework:\n\n\n## General Scam Detection Framework (The 5 W's):\n- **WHO** posted it? (Verified account? Official source?)\n- **WHAT** are they offering? (Too good to be true?)\n- **WHERE** does the link go? (Legitimate domain?)\n- **WHEN** to take action? (Urgency pressure?)\n- **WHY** would they give this away? (Business logic?)\n\n\n### Privacy Protection Guidelines:\n\n\n## Privacy Protection Principles:\n- **Location**: Never share real-time locations or exact addresses\n- **Contact Info**: Keep phone numbers and personal details private\n- **Schedule**: Don't announce when you'll be away from home\n- **Personal Details**: Limit identifying information in public posts\n\n\n## Detection Areas to Focus On:\n\n## Verification Steps to Teach:\n\n## Default Safe Actions:\n\n- Do not click suspicious links.\n\n- Open the real app or type the real company website yourself.\n\n- Check account settings, security alerts, or recent login activity in the real account.\n\n- If the alert is about a bank or parent account, use the real banking app/site or the phone number on the card.\n\n- A lock icon or HTTPS does not prove the site is real. Scammers can use them too.\n\nRemember: Your goal is to help teens develop critical thinking skills for online safety through direct teaching, practical checks, and restrained support.",
    "prompt_config": {
      "role": {
        "role": "low"
      },
      "communication_style": {
        "teen_slang": "low",
        "conversational_markers": "low",
        "uncertainty_expression": "high"
      },
      "cognitive_parameters": {
        "concept_density": "low",
        "perspective_taking": "low",
        "personal_examples": "high",
        "consequence_highlighting": "low"
      },
      "emotional_parameters": {
        "enthusiasm_level": "low",
        "validation_frequency": "low",
        "mistake_normalization": "high",
        "confidence_building": "high"
      },
      "detection_areas": [],
      "verification_steps": []
    }
  },
  "scenarios": [
    {
      "name": "Account Security Alert",
      "detection_areas": [
        "Identify fear, urgency, and pressure to click in alerts such as \"YOUR ACCOUNT IS AT RISK\".",
        "Check the sender and exact domain for impersonation, including \"Socail Media Testdrive\" and testdrive.info.",
        "Explain why professional design and an HTTPS lock do not prove a site or alert is legitimate.",
        "Identify vague or missing platform, account, and incident details that make an alert difficult to verify."
      ],
      "verification_steps": [
        "Verify independently by opening the official app or typing its known address, then review security alerts and login activity; use official support and enable two-factor authentication when needed."
      ]
    },
    {
      "name": "Nintendo Switch Deal ($19.99)",
      "detection_areas": [
        "Evaluate whether a $19.99 Nintendo Switch offer is plausible by comparing its price and business logic with legitimate retailers.",
        "Identify urgency and scarcity tactics such as \"Hurry up\" and \"WILL NOT LAST\" that pressure people to act quickly.",
        "Check the sender's claimed Nintendo affiliation and the exact link destination; shortened links and unofficial profiles do not establish authenticity.",
        "Evaluate likes, shares, testimonials, and branding against independent evidence rather than treating social proof as verification."
      ],
      "verification_steps": [
        "Verify the promotion and price through Nintendo's official website or an authorized retailer reached independently before clicking, paying, or sharing information."
      ]
    },
    {
      "name": "iTunes Gift Card Survey ($500)",
      "detection_areas": [
        "Evaluate whether a $500 iTunes gift card is a plausible reward for a five-minute survey.",
        "Identify excitement, urgency, and instant-reward claims that encourage participation before checking the offer.",
        "Check the sender's claimed Apple affiliation and the exact link destination; a shortened URL or personal account does not establish authenticity.",
        "Explain why professional photos and personal testimonials are insufficient evidence, and check the promotion's terms and conditions."
      ],
      "verification_steps": [
        "Verify the promotion through Apple's official channels reached independently before participating or sharing personal information."
      ]
    },
    {
      "name": "Location Sharing Risks",
      "detection_areas": [
        "Identify precise location information exposed in a public post, including a home address.",
        "Explain who can access public location information and how it could be misused to threaten personal safety.",
        "Recognize how addresses, house numbers, street signs, and identifying images can reveal a home location."
      ],
      "verification_steps": [
        "Choose an appropriate audience and a private communication channel for sharing necessary location details.",
        "Rewrite the post to coordinate safely without exposing a home address or identifying location details."
      ]
    },
    {
      "name": "Movie Meetup Social Engineering",
      "detection_areas": [
        "Identify how a venue, date, and exact time reveal someone's future movements.",
        "Explain how public meetup plans can make a person trackable and their schedule predictable.",
        "Recognize how a stranger could use public plans to appear familiar or trustworthy."
      ],
      "verification_steps": [
        "Verify who is involved through a trusted channel before agreeing to meet.",
        "Coordinate meetup plans privately and limit public venue, date, and time details."
      ]
    },
    {
      "name": "Contact Information Exposure",
      "detection_areas": [
        "Identify a phone number as personal contact information exposed by a public post.",
        "Explain how public phone numbers can enable spam, harassment, and impersonation.",
        "Recognize suspicious calls or messages that use an exposed number to request personal information or account access."
      ],
      "verification_steps": [
        "Share contact details selectively with trusted people through private messages or platform messaging.",
        "Respond safely to suspicious calls or messages without sharing passwords or verification codes."
      ]
    }
  ],
  "teaching_rows": [
    {
      "tutor_id": "00000000-0000-0000-0000-000000000000",
      "template_name": "Account Security Alert Scam",
      "template_description": "Fear-based account alert thread. AI tutor uses casual_peer (direct correction, concrete actions).",
      "title_template": "Account Security Alert Scam",
      "description_template": "YOUR ACCOUNT IS AT RISK — unknown device login detected. Verify now: http://testdrive.info/youraccount — posted by Socail Media Testdrive",
      "image_url": "/images/room-presets/phishing_2.png",
      "pre_populated_dialogue": [
        {
          "user_name": "Socail Media Testdrive",
          "role": "others",
          "message": "!!&$!ALERT!&$!! YOUR ACCOUNT IS AT RISK. Click here to resolve immediately: http://testdrive.info/youraccount"
        },
        {
          "user_name": "Maya R.",
          "role": "others",
          "message": "wait this just showed up on my feed too is this real??"
        },
        {
          "user_name": "Tutor",
          "role": "tutor",
          "message": "Take a look at this alert post. What stands out to you before anyone clicks anything?"
        },
        {
          "user_name": "Jake Matthews",
          "role": "student",
          "message": "I think it is real because it says my account is at risk."
        }
      ],
      "op_config_template": null,
      "password_config": null,
      "scenario": "Account Security Alert"
    },
    {
      "tutor_id": "00000000-0000-0000-0000-000000000000",
      "template_name": "Nintendo Switch Deal Scam",
      "template_description": "Too-good-to-be-true pricing scam thread with click pressure.",
      "title_template": "Nintendo Switch Deal Scam",
      "description_template": "Get a BRAND new Nintendo Switch only $19.99!! Hurry up, this offer WILL NOT LAST long!! http://goo.gl/FreeSwitch",
      "image_url": "/images/room-presets/phishing_1.png",
      "pre_populated_dialogue": [
        {
          "user_name": "Lucy Simms",
          "role": "others",
          "message": "omg get a BRAND new Nintendo Switch only $19.99!! Hurry this WILL NOT LAST!! http://goo.gl/FreeSwitch"
        },
        {
          "user_name": "Dev_gamer12",
          "role": "others",
          "message": "bro $20 for a switch?? linking this to my group chat rn"
        },
        {
          "user_name": "Tutor",
          "role": "tutor",
          "message": "A friend just shared this deal post with you. What would you do first?"
        },
        {
          "user_name": "Brinlee",
          "role": "student",
          "message": "I would click it fast before the deal ends."
        }
      ],
      "op_config_template": null,
      "password_config": null,
      "scenario": "Nintendo Switch Deal ($19.99)"
    },
    {
      "tutor_id": "00000000-0000-0000-0000-000000000000",
      "template_name": "iTunes Gift Card Survey Scam",
      "template_description": "Survey-for-gift-card scam where design/photo is used as trust evidence.",
      "title_template": "iTunes Gift Card Survey Scam",
      "description_template": "You won't believe this crazy deal!! I filled in a 5 minute survey and got a $500 gift to iTunes!! http://bit.ly/FREEGIFTS",
      "image_url": "/images/room-presets/phishing_3.png",
      "pre_populated_dialogue": [
        {
          "user_name": "Emma Garcia",
          "role": "others",
          "message": "You won't believe this crazy deal!! 5 minute survey = $500 iTunes card!! got mine instantly http://bit.ly/FREEGIFTS"
        },
        {
          "user_name": "Kai",
          "role": "others",
          "message": "the photo looks so real tho... has anyone tried it?"
        },
        {
          "user_name": "Tutor",
          "role": "tutor",
          "message": "Does this offer make sense to you? What are you basing that on?"
        },
        {
          "user_name": "Sam",
          "role": "student",
          "message": "It must be real because the photo looks professional."
        }
      ],
      "op_config_template": null,
      "password_config": null,
      "scenario": "iTunes Gift Card Survey ($500)"
    },
    {
      "tutor_id": "00000000-0000-0000-0000-000000000000",
      "template_name": "Location Sharing Safety",
      "template_description": null,
      "title_template": "Location Sharing Safety",
      "description_template": "321 Jefferson Ave come hang out guys, I'm bored.",
      "image_url": "/images/room-presets/privacy_2.png",
      "pre_populated_dialogue": [
        {
          "role": "student",
          "message": "Come hang out! I'm so bored",
          "timestamp": "2025-08-20T06:21:49.877Z",
          "user_name": "Jasmina Weatherly"
        },
        {
          "role": "student",
          "message": "Maybe don't share your exact address publicly?",
          "timestamp": "2025-08-20T06:21:49.877Z",
          "user_name": "Friend 1"
        }
      ],
      "op_config_template": {
        "op_id": null,
        "op_avatar_url": null,
        "use_custom_op": true,
        "custom_op_name": "Jasmina Weatherly",
        "op_display_name": "Jasmina Weatherly"
      },
      "password_config": null,
      "scenario": "Location Sharing Risks"
    },
    {
      "tutor_id": "00000000-0000-0000-0000-000000000000",
      "template_name": "Movie Meetup Social Engineering",
      "template_description": null,
      "title_template": "Movie Meetup Social Engineering",
      "description_template": "Gonna be at the Regal THIS FRIDAY to see the new Marvel movie! Meet me there at 8 🍿",
      "image_url": "/images/room-presets/privacy_1.png",
      "pre_populated_dialogue": [
        {
          "role": "student",
          "message": "I'll meet you there!",
          "timestamp": "2025-08-20T06:21:49.877Z",
          "user_name": "Emily J"
        },
        {
          "role": "student",
          "message": "Sounds like fun!",
          "timestamp": "2025-08-20T06:21:49.877Z",
          "user_name": "Connor McCormack"
        }
      ],
      "op_config_template": {
        "op_id": null,
        "op_avatar_url": null,
        "use_custom_op": true,
        "custom_op_name": "Ethan Kozloff",
        "op_display_name": "Ethan Kozloff"
      },
      "password_config": null,
      "scenario": "Movie Meetup Social Engineering"
    },
    {
      "tutor_id": "00000000-0000-0000-0000-000000000000",
      "template_name": "Phone Number Phishing Training",
      "template_description": null,
      "title_template": "Phone Number Phishing Training",
      "description_template": "new phone who dis? my new number is 607-252-6771",
      "image_url": "/images/room-presets/phishing_1.png",
      "pre_populated_dialogue": [
        {
          "role": "student",
          "message": "KK I'll txt you",
          "timestamp": "2025-08-20T06:21:49.877Z",
          "user_name": "Vanessa Kemp"
        },
        {
          "role": "student",
          "message": "finally about time you got a new phone",
          "timestamp": "2025-08-20T06:21:49.877Z",
          "user_name": "Zoe Goodall"
        }
      ],
      "op_config_template": {
        "op_id": null,
        "op_avatar_url": null,
        "use_custom_op": true,
        "custom_op_name": "Vanessa Kemp",
        "op_display_name": "Vanessa Kemp"
      },
      "password_config": null,
      "scenario": "Contact Information Exposure"
    }
  ],
  "mapping": [
    {
      "template_name": "Demo: Multi-agent Response Room",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Account Security Alert Scam",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Nintendo Switch Deal Scam",
      "scenario": "Nintendo Switch Deal ($19.99)"
    },
    {
      "template_name": "iTunes Gift Card Survey Scam",
      "scenario": "iTunes Gift Card Survey ($500)"
    },
    {
      "template_name": "Demo: Lock Icon Myth (Direct Correction)",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Demo: Click Impulse (Practical Action)",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Demo: Click Impulse (Correct Safe Action)",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Demo: Lock Icon Myth (Correct Reasoning)",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Demo: Pressure Words (Simple Language)",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Demo: Personal Story Trap (Third Person)",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Demo: Participation Disruption (Guard)",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Demo: Phase 0 — Lock Icon Myth",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Demo: Refined — Lock Icon Myth",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Demo: Phase 0 — Click Impulse",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Demo: Refined — Click Impulse",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Demo: Phase 0 — Personal Story",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Demo: Refined — Personal Story",
      "scenario": "Account Security Alert"
    },
    {
      "template_name": "Location Sharing Safety",
      "scenario": "Location Sharing Risks"
    },
    {
      "template_name": "Movie Meetup Social Engineering",
      "scenario": "Movie Meetup Social Engineering"
    },
    {
      "template_name": "Phone Number Phishing Training",
      "scenario": "Contact Information Exposure"
    }
  ]
}
$catalog$::jsonb;
  global_tutor constant uuid := '00000000-0000-0000-0000-000000000000';
  entry jsonb;
  scenario_data jsonb;
  template_record record;
  current_config jsonb;
  target_config jsonb;
  target_prompt_config jsonb;
  prompt_text text;
  knowledge_block text;
  detection_text text;
  verification_text text;
  expected_knowledge_block text;
  detection_at integer;
  verification_at integer;
  remainder_at integer;
BEGIN
  -- Serialize catalog changes so an overlapping writer cannot invalidate checks.
  LOCK TABLE public.room_templates IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (
    SELECT 1
    FROM public.room_templates t
    JOIN jsonb_array_elements(payload->'mapping') m
      ON t.template_name = m->>'template_name'
    WHERE t.tutor_id = global_tutor
    GROUP BY t.template_name
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate global teaching/demo template names; resolve before release';
  END IF;

  FOR entry IN SELECT value FROM jsonb_array_elements(payload->'scenarios')
  LOOP
    IF jsonb_array_length(entry->'detection_areas')
       + jsonb_array_length(entry->'verification_steps') <> 5
       OR EXISTS (
         SELECT 1 FROM (
           SELECT value FROM jsonb_array_elements_text(entry->'detection_areas')
           UNION ALL
           SELECT value FROM jsonb_array_elements_text(entry->'verification_steps')
         ) targets
         GROUP BY btrim(value)
         HAVING btrim(value) = '' OR count(*) > 1
       ) THEN
      RAISE EXCEPTION 'Invalid five-target inventory for %', entry->>'name';
    END IF;
  END LOOP;

  -- Staging currently lacks five of the six teaching templates. Insert absent
  -- catalog rows; preserve every content/OP field when a row already exists.
  FOR entry IN SELECT value FROM jsonb_array_elements(payload->'teaching_rows')
  LOOP
    INSERT INTO public.room_templates (
      tutor_id, template_name, template_description, title_template,
      description_template, image_url, pre_populated_dialogue,
      ai_config_template, op_config_template, password_config
    )
    SELECT global_tutor, entry->>'template_name', entry->>'template_description',
      entry->>'title_template', entry->>'description_template', entry->>'image_url',
      entry->'pre_populated_dialogue', payload->'default_config',
      NULLIF(entry->'op_config_template', 'null'::jsonb),
      NULLIF(entry->'password_config', 'null'::jsonb)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.room_templates
      WHERE tutor_id = global_tutor AND template_name = entry->>'template_name'
    );
  END LOOP;

  FOR template_record IN
    SELECT t.id, t.template_name, t.ai_config_template,
      m->>'scenario' AS scenario_name
    FROM public.room_templates t
    JOIN jsonb_array_elements(payload->'mapping') m
      ON t.template_name = m->>'template_name'
    WHERE t.tutor_id = global_tutor
    ORDER BY t.template_name
  LOOP
    SELECT value INTO STRICT scenario_data
    FROM jsonb_array_elements(payload->'scenarios')
    WHERE value->>'name' = template_record.scenario_name;

    IF template_record.ai_config_template IS NULL
       AND template_record.template_name NOT IN (
         'Location Sharing Safety', 'Movie Meetup Social Engineering',
         'Phone Number Phishing Training'
       ) THEN
      RAISE EXCEPTION 'Unexpected null AI configuration for %', template_record.template_name;
    END IF;
    current_config := COALESCE(template_record.ai_config_template::jsonb,
      payload->'default_config');
    IF jsonb_typeof(current_config) IS DISTINCT FROM 'object'
       OR jsonb_typeof(current_config->'prompt_config') IS DISTINCT FROM 'object'
       OR jsonb_typeof(current_config->'system_prompt') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Invalid AI configuration for %', template_record.template_name;
    END IF;

    prompt_text := current_config->>'system_prompt';
    detection_at := strpos(prompt_text, '## Detection Areas to Focus On:');
    verification_at := strpos(prompt_text, '## Verification Steps to Teach:');
    remainder_at := strpos(prompt_text, '## Default Safe Actions:');
    IF remainder_at = 0 THEN
      remainder_at := strpos(prompt_text, 'Remember: Your goal');
    END IF;
    IF detection_at = 0 OR verification_at <= detection_at
       OR remainder_at <= verification_at THEN
      RAISE EXCEPTION 'Unrecognized prompt knowledge sections for %',
        template_record.template_name;
    END IF;

    SELECT string_agg('- ' || value, E'\n\n' ORDER BY ordinality)
      INTO detection_text
      FROM jsonb_array_elements_text(current_config->'prompt_config'->'detection_areas')
        WITH ORDINALITY;
    SELECT string_agg('- ' || value, E'\n\n' ORDER BY ordinality)
      INTO verification_text
      FROM jsonb_array_elements_text(current_config->'prompt_config'->'verification_steps')
        WITH ORDINALITY;
    expected_knowledge_block := concat_ws(E'\n\n',
      '## Detection Areas to Focus On:', detection_text,
      '## Verification Steps to Teach:', verification_text) || E'\n\n';
    IF substr(prompt_text, detection_at, remainder_at - detection_at)
       IS DISTINCT FROM expected_knowledge_block THEN
      RAISE EXCEPTION 'Prompt knowledge drift for %', template_record.template_name;
    END IF;

    SELECT string_agg('- ' || value, E'\n\n' ORDER BY ordinality)
      INTO detection_text
      FROM jsonb_array_elements_text(scenario_data->'detection_areas')
        WITH ORDINALITY;
    SELECT string_agg('- ' || value, E'\n\n' ORDER BY ordinality)
      INTO verification_text
      FROM jsonb_array_elements_text(scenario_data->'verification_steps')
        WITH ORDINALITY;
    knowledge_block := '## Detection Areas to Focus On:' || E'\n\n'
      || detection_text || E'\n\n## Verification Steps to Teach:\n\n'
      || verification_text || E'\n\n';
    target_prompt_config := (current_config->'prompt_config')
      || jsonb_build_object(
        'detection_areas', scenario_data->'detection_areas',
        'verification_steps', scenario_data->'verification_steps'
      );
    target_config := current_config || jsonb_build_object(
      'scenario', template_record.scenario_name,
      'prompt_config', target_prompt_config,
      'system_prompt', substr(prompt_text, 1, detection_at - 1)
        || knowledge_block || substr(prompt_text, remainder_at)
    );

    UPDATE public.room_templates
    SET ai_config_template = target_config, updated_at = now()
    WHERE id = template_record.id
      AND ai_config_template::jsonb IS DISTINCT FROM target_config;
  END LOOP;
END
$five_targets$;

