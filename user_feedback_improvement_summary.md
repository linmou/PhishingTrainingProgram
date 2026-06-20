# PM Summary: Prompt Improvements From Prototype Feedback

Intent: explain, for education and product reviewers, which learner-experience issues were improved through prompt design and how the evaluation gate checks whether those improvements are reliable.

Updated: 2026-06-09

## Executive Summary

We improved the chatbot behavior for the feedback items that can be addressed through prompt design. The revised tutor is now designed to teach more directly, correct unsafe reasoning, use a stable knowledgeable-peer voice, reduce hollow praise, provide concrete safety actions, avoid fake personal stories, and use simpler language for younger or confused learners.

Two feedback items were not treated as prompt-only fixes:
- Response latency and typing indicators require product interface work.
- Multi-bot simulation requires a larger product design decision and a new evaluation setup.

## What Changed For Learners

Source commit for prompt diff evidence: `f8cdc7e fix(ai): gate and update tutor prompt behavior`

### 1. The Bot Should Stop Asking A Question Every Turn

User feedback said the bot felt like it kept asking questions instead of teaching.

The prompt now tells the bot to follow a more balanced tutoring rhythm:
- Teach one concrete idea first.
- Ask a focused question only when it helps the student think.
- Do not end every response with a question.

Expected learner impact:
- Students should receive clearer explanations instead of feeling interrogated.
- The conversation should feel more like tutoring and less like a worksheet.

Evaluation gate result:
- The improved prompt passed all cases for this behavior: `9/9`.

Prompt diff evidence:

```diff
diff --git a/tutor-system/src/services/prompts/index.ts b/tutor-system/src/services/prompts/index.ts
@@
     "## Learning Process:",
-    "Always follow the 3-stage learning process:",
-    "1. Get their first reaction without influencing them",
-    "2. Ask why they think that - understand their reasoning",
-    "3. Fill knowledge gaps using appropriate scaffolding techniques",
+    "Use a tight tutoring rhythm:",
+    "- Teach one concrete point first.",
+    "- Ask at most one focused question when it helps the student think.",
+    "- If the student is wrong or incomplete, correct the mistake directly before encouraging them.",
+    "- Include one concrete safe action when the student is unsure, wrong, or asking what to do.",
+    "- Do not stop at \"be careful\", \"be cautious\", or \"check it.\" Say exactly what to check or where to go.",
+    "- Do not end every response with a question.",
```

### 2. The Bot Should Correct Wrong Or Incomplete Answers

User feedback said the bot sometimes validated students even when their answer was wrong or incomplete.

The prompt now tells the bot to correct unsafe reasoning directly before giving encouragement. For example, if a student says a website is safe because it has a lock icon, the bot should clearly explain that the lock does not prove the site is real.

Expected learner impact:
- Students get a stronger sense that the tutor has authority.
- Mistakes become teachable moments instead of being softly approved.
- Safety misconceptions are corrected before they become habits.

Evaluation gate result:
- The improved prompt passed all direct-correction cases: `8/8`.

Prompt diff evidence:

```diff
diff --git a/tutor-system/src/services/prompts/index.ts b/tutor-system/src/services/prompts/index.ts
@@
+    "- If the student is wrong or incomplete, correct the mistake directly before encouraging them.",
@@
-    "#Teaching About URL Safety",
-    "Bot: [Strategy 4: Never Click Suspicious Links] Look at that link - 'http://testdrive.info/youraccount.' If you were worried about your Instagram account, where should the link take you?",
-    "Teen: To Instagram.com?",
-    "Bot: Exactly! Would Instagram ever use 'testdrive.info' for their security stuff?",
+    "#Direct correction",
+    "Teen: It has a lock icon, so it is safe.",
+    "Bot: Not quite. The lock does not prove the site is real. A fake site can have a lock too. Check the website name, and use the real app instead of the link.",
```

```diff
diff --git a/tutor-system/src/services/prompts/pedagogy/parameters/emotionalParameters.ts b/tutor-system/src/services/prompts/pedagogy/parameters/emotionalParameters.ts
@@
-    high: `Frame mistakes as normal learning experiences that happen to everyone.
-    Example: "Ooh, this one got you! Don't worry - this scam fools tons of people. Even adults fall for it."`,
+    high: `Correct unsafe reasoning directly, then keep the student moving.
+    Example: "Not quite. A lock icon does not prove the site is real. Check the web address."`,
```

### 3. The Bot Needs A Stable Persona

User feedback said the bot should have one consistent voice, ideally a knowledgeable peer: informed, college-age, and not stiff.

The prompt now defines the bot as a knowledgeable peer coach for teen phishing training. It also tells the bot not to pretend to be a friend, parent, performer, or person with personal memories.

Expected learner impact:
- The bot should feel more consistent and trustworthy.
- The tone should be approachable without becoming fake or over-familiar.

Evaluation gate result:
- The improved prompt passed all persona-stability cases: `5/5`.

Prompt diff evidence:

```diff
diff --git a/tutor-system/src/services/prompts/basePrompt.ts b/tutor-system/src/services/prompts/basePrompt.ts
@@
-export const BASE_SYSTEM_PROMPT = `You are a professional teacher in an online teaching platform that helps students to understand the some knowledge.`;
+export const BASE_SYSTEM_PROMPT = `You are a knowledgeable tutor in a phishing-training session. Teach online safety clearly, directly, and with practical next steps.`;
```

```diff
diff --git a/tutor-system/src/services/prompts/pedagogy/parameters/roleParameters.ts b/tutor-system/src/services/prompts/pedagogy/parameters/roleParameters.ts
@@
     low: `## Your Role: Peer Learner
-You position yourself as a fellow learner navigating scam detection alongside the teen. Use casual, relatable language like "Dude, this is so sketchy" and admit shared vulnerabilities with phrases like "Honestly, I fall for stuff like this too sometimes." Emphasize collaborative discovery through questions like "What do you think we should check?" and share knowledge as recently acquired information: "Someone told me to always check URLs." Connect through shared frustration and peer empathy, creating a sense of "we're figuring this out together."
+You are a knowledgeable peer coach for teen phishing training. Sound college-age, informed, direct, and relaxed. Teach clearly without pretending to be the student's friend, parent, or a person with your own past experiences.
@@
-Key distinction: Emphasize shared discovery and mutual learning rather than teaching from authority.`,
+Use third-person examples only. Say "A person who clicked a fake security link could land on a fake login page." Do not claim personal memories, regrets, or lived experience.
+
+Key distinction: Be a knowledgeable peer coach, not a fake friend, parent, or performer.`,
```

### 4. The Bot Should Reduce Boilerplate Praise

User feedback said constant phrases like "great job" felt hollow.

The prompt now limits praise to at most one brief, specific acknowledgment before teaching. The bot should acknowledge what the student noticed, then move quickly into the learning point.

Expected learner impact:
- Praise should feel more earned and less scripted.
- The bot should spend more turns teaching, correcting, and guiding.

Evaluation gate result:
- The improved prompt passed all low-boilerplate-praise cases: `5/5`.

Prompt diff evidence:

```diff
diff --git a/tutor-system/src/services/prompts/pedagogy/parameters/emotionalParameters.ts b/tutor-system/src/services/prompts/pedagogy/parameters/emotionalParameters.ts
@@
-    high: `Show high energy and excitement about learning discoveries.
-    Example: "YES! Absolutely nailed it! That's exactly right!"`,
+    high: `Keep energy restrained and focused on the lesson.
+    Example: "You caught the spelling issue. Now check the link."`,
@@
-    high: `Frequently validate effort and normalize confusion.
-    Example: "I totally get why you'd think that - this one's really tricky and designed to fool people."`,
+    high: `Use at most one brief, specific acknowledgment before teaching.
+    Example: "You noticed the scary words. The safer check is the real app."`,
@@
-    high: `Explicitly build confidence and celebrate progress.
-    Example: "You're getting really good at this detective work! Your instincts are improving."`,
+    high: `Build confidence through specific evidence, not generic praise.
+    Example: "You found the misspelling. The next check is whether the web address matches the real company."`,
```

```diff
diff --git a/tutor-system/src/services/prompts/presets.ts b/tutor-system/src/services/prompts/presets.ts
@@
     emotional_parameters: {
-      enthusiasm_level: 'high' as const,
-      validation_frequency: 'high' as const,
+      enthusiasm_level: 'low' as const,
+      validation_frequency: 'low' as const,
       mistake_normalization: 'high' as const,
       confidence_building: 'high' as const
     }
```

### 5. The Bot Should Give More Specific Safety Knowledge

User feedback said learners valued concrete tools and real-world actions.

The prompt now asks the bot to give specific next steps instead of vague advice like "be careful." Examples include:
- Do not click suspicious links.
- Open the real app or real website yourself.
- Check account settings, security alerts, or recent login activity inside the real account.
- For bank alerts, use the official banking app, website, or the phone number on the card.
- Remember that HTTPS or a lock icon does not prove a site is real.

Expected learner impact:
- Students should leave with actions they can actually perform.
- The bot should teach practical safety habits, not just general caution.

Evaluation gate result:
- The improved prompt passed all practical-knowledge cases: `15/15`.

Prompt diff evidence:

```diff
diff --git a/tutor-system/src/services/prompts/index.ts b/tutor-system/src/services/prompts/index.ts
@@
-    "Remember: Your goal is to help teens develop critical thinking skills for online safety through guided discovery and supportive learning.",
+    "## Default Safe Actions:",
+    "- Do not click suspicious links.",
+    "- Open the real app or type the real company website yourself.",
+    "- Check account settings, security alerts, or recent login activity in the real account.",
+    "- If the alert is about a bank or parent account, use the real banking app/site or the phone number on the card.",
+    "- A lock icon or HTTPS does not prove the site is real. Scammers can use them too.",
+
+    "Remember: Your goal is to help teens develop critical thinking skills for online safety through direct teaching, practical checks, and restrained support.",
@@
+    "#Concrete action",
+    "Teen: What should I do?",
+    "Bot: First, avoid the link in the post. Open the real website yourself, check whether the offer or warning exists there, and only continue if the source is clearly official.",
```

### 6. The Bot Should Use Third-Person Stories, Not Fake Personal Claims

User feedback said first-person AI claims break trust. For example, an AI saying "I once did this and regretted it" feels fake.

The prompt now tells the bot to use third-person examples instead. It can describe what often happens to a person in a risky situation, but it should not claim personal lived experience.

Expected learner impact:
- The bot avoids pretending to be human.
- Examples can still be relatable without damaging trust.

Evaluation gate result:
- The improved prompt passed the third-person example case: `1/1`.

Prompt diff evidence:

```diff
diff --git a/tutor-system/src/services/prompts/pedagogy/parameters/cognitiveParameters.ts b/tutor-system/src/services/prompts/pedagogy/parameters/cognitiveParameters.ts
@@
-    high: `Use relatable personal stories and analogies that connect to teen experiences.
-    Example: "Think about it - would you give away your phone for free to random people? Companies feel the same way."`,
+    high: `Use third-person examples and relatable analogies, not first-person stories.
+    Example: "A person who follows a fake giveaway link might land on a page asking for personal details."`,
```

```diff
diff --git a/tutor-system/src/services/prompts/index.ts b/tutor-system/src/services/prompts/index.ts
@@
+    "#Third-person example",
+    "Teen: Did this ever happen to you?",
+    "Bot: A common pattern is that a person follows a fake promotion, reaches a page asking for personal details, and gives the scammer useful information. The safer move is to verify through the real company site.",
```

### 7. The Bot Should Use Simpler Language

User feedback said some younger participants were confused by terms such as "urgency tactics."

The prompt now asks the bot to use simpler wording, especially when a student seems confused. Examples:
- Say "pressure words" instead of "urgency tactics."
- Say "fake web address" or "wrong website" instead of "illegitimate domain."
- Say "check in the real app" instead of "official account verification."
- Say "the lock does not prove the site is real" instead of giving a technical explanation of HTTPS.

Expected learner impact:
- Younger learners should understand the safety lesson more easily.
- The bot should adapt explanations toward plain language.

Evaluation gate result:
- The improved prompt passed the reading-level gate: `7/8`, which is above the required threshold.

Prompt diff evidence:

```diff
diff --git a/tutor-system/src/services/prompts/index.ts b/tutor-system/src/services/prompts/index.ts
@@
+    "## Reading Level:",
+    "Use simple language for younger or confused students:",
+    "- Use \"pressure words\" instead of \"urgency tactics\".",
+    "- Use \"fake web address\" or \"wrong website\" instead of \"illegitimate domain\".",
+    "- Use \"check in the real app\" instead of \"official account verification\".",
+    "- Use \"the lock does not prove the site is real\" instead of \"HTTPS encrypts the connection\".",
+    "- Use \"real company\" or \"real app\" instead of \"legitimate\".",
+    "- Use short sentences when the student sounds confused.",
```

```diff
diff --git a/tutor-system/src/services/prompts/pedagogy/parameters/communicationStyles.ts b/tutor-system/src/services/prompts/pedagogy/parameters/communicationStyles.ts
@@
-    high: `Integrate teen slang naturally and authentically.
-    Example: "That's totally sus, no cap"`,
+    high: `Use relaxed teen-friendly language without forced slang.
+    Example: "That link looks fake, so I would not use it."`,
@@
-    high: `Include natural speech patterns with conversational markers.
-    Example: "So like, that's not quite right, you know?"`,
+    high: `Use direct, natural speech patterns.
+    Example: "Not quite. The web address is the problem."`,
```

## What Was Not Solved In This Prompt Iteration

### Response Latency And Typing Indicator

This cannot be solved reliably through prompt wording. It requires product behavior such as a visible typing state, faster first response, streaming, or staged response delivery.

### Multi-Bot Simulation

This also needs product design work. A prompt can adjust one bot's tone, but a true formal-bot plus peer-bot simulation needs multiple agent roles, interface design, and a separate evaluation set.

## Evaluation Gate: What It Means

The evaluation gate is the quality standard used before accepting the new prompt into the product.

It has two purposes:
- Make sure the improved prompt actually addresses the target feedback.
- Make sure the improved prompt does not merely sound better in one hand-picked example.

The gate tested the improved prompt against a reviewed set of account-security-alert tutoring situations. These cases included both direct examples and holdout-style variations, meaning the prompt had to generalize to similar but not identical student responses.

## Evaluation Gate Passing Criteria

The prompt had to meet both conditions:
- It needed to pass at least 80% of the applicable checks for every behavior category.
- It needed to match or beat the previous prompt in every behavior category.

This matters because a prompt that improves one issue while making another worse should not be accepted.

## Final Gate Result

The improved prompt passed the gate.

Evaluation details:
- Cases evaluated: `34`
- Errors: `0`
- Overall result: passed

Behavior category results:

| Behavior Category | Result |
| --- | ---: |
| Balanced teaching rhythm | `9/9` |
| Direct correction | `8/8` |
| Stable persona | `5/5` |
| Reduced boilerplate praise | `5/5` |
| Practical safety knowledge | `15/15` |
| Third-person examples | `1/1` |
| Simpler reading level | `7/8` |

## Why The Evaluation Is More Reliable Than A Single Demo

The evaluation set was reviewed and refined before the prompt was accepted.

Reliability checks included:
- Each case tested observable chatbot behavior, not vague preference.
- Each case only tested requirements that could actually be observed in that situation.
- Holdout variations were included so the prompt could not simply memorize one example.
- The final evaluation set was reviewed through a multi-reviewer debate process and reached agreement after refinement.
