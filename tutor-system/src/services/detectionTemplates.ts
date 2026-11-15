/**
 * Learning targets adapted from General Learning Goals.docx; task labels are canonical.
 * Source SHA-256: fd0a0f49106e1b37795886dc39f974c3e99758e0007df5c2b0ba5d730dd6655b
 * Target wording and selection follow owner review; Nintendo retains all five points.
 */

export const SCENARIO_TEMPLATES = {
  "Nintendo Switch Deal ($19.99)": {
    detection_areas: [
      "Knowledge Point 1: Check if the deal is too good to be true. (Easiest)\nObservation task: A Nintendo Switch usually costs hundreds of dollars, but this post offers one for only $19.99.\nBehavior task: Stop and ask yourself: \"Why is this so cheap?\" If a deal seems too good to be true, be careful.",
      "Knowledge Point 2: Watch out for messages that rush you.\nObservation task: Words like \"HURRY UP\" and \"WILL NOT LAST\" try to make you act quickly.\nBehavior task: Take your time. Don't let a post rush you into clicking a link or buying something.",
      "Knowledge Point 3: Check who shared the deal.\nObservation task: The post is not from an official Nintendo account but someone named Lucy Simms\nBehavior task: Look at the person's profile. Check when the account was created, what else they have posted, and whether they are connected to Nintendo.",
      "Knowledge Point 4: Learn to spot suspicious links. (Harder)\nObservation task: The link uses \"goo.gl,\" which hides the real website. It does not show Nintendo's official website address.\nBehavior task: Don't click shortened or unfamiliar links. Look for Nintendo's official website address instead. A lock symbol or HTTPS alone does not prove a website is safe.",
      "Knowledge Point 5: Check the deal with the real company. (Most advanced)\nObservation task: There is no proof that Nintendo is really offering this deal.\nBehavior task: Visit Nintendo's official website or social media pages yourself. Check whether the deal is listed there. You can also ask a trusted adult to help."
    ],
    verification_steps: [] as string[],
    type: 'scam'
  },
  "iTunes Gift Card Survey ($500)": {
    detection_areas: [
      "Knowledge Point 1: Check if the reward makes sense. (Easiest)\nObservation task: The post promises a $500 gift card for only five minutes of answering questions.\nBehavior task: Ask yourself: \"Would a company really give away so much money for such a small task?\" Be careful when a reward seems too big.",
      "Knowledge Point 2: Watch out for exciting promises.\nObservation task: Words like \"CRAZY DEAL!!\" and \"got instantly\" make the offer sound exciting and encourage people to act quickly.\nBehavior task: Don't let exciting words or promises make you forget to check whether something is real.",
      "Knowledge Point 3: Check who is sharing the reward.\nObservation task: Emma Garcia is sharing the offer, but there is no proof that she works for Apple or iTunes.\nBehavior task: Look at her profile and past posts. Be careful if the account often shares free gifts or amazing offers.",
      "Knowledge Point 4: Look carefully at the website link. (Harder)\nObservation task: The link uses \"bit.ly,\" which hides the real website address.\nBehavior task: Don't click the link. Go to Apple's official website yourself to check whether the offer is real.",
      "Knowledge Point 5: Check whether the company really offers the reward. (Most advanced)\nObservation task: The post has a gift card picture, but it does not show an official Apple announcement or explain the rules of the giveaway.\nBehavior task: Check Apple's official website and social media pages for the giveaway. Ask a trusted adult to help you check before sharing information or answering a survey."
    ],
    verification_steps: [] as string[],
    type: 'scam'
  },
  "Account Security Alert": {
    detection_areas: [
      "Knowledge Point 1: Be careful when a message tries to scare you. (Easiest)\nObservation task: The message says \"YOUR ACCOUNT IS AT RISK\" and uses lots of warning symbols to make you feel scared.\nBehavior task: Stay calm. Don't click anything just because a message says something bad will happen.",
      "Knowledge Point 2: Check who sent the warning.\nObservation task: The message comes from \"Socail Media Testdrive,\" which is not the name of a social media company. It also has a spelling mistake in \"Social.\"\nBehavior task: Check the sender's name carefully. Be suspicious of messages from unknown people or companies.",
      "Knowledge Point 3: Check whether the warning tells you which account is in danger.\nObservation task: The message says your account is at risk but does not say whether it means Instagram, TikTok, Snapchat, or another account.\nBehavior task: Ask yourself: \"Which account are they talking about?\" A vague warning from an unknown sender is suspicious.",
      "Knowledge Point 4: Check the website address before trusting it. (Harder)\nObservation task: The link goes to \"testdrive.info,\" not the official website of a social media company.\nBehavior task: Never click a link in a scary security message. Open the real app or type its official website address yourself.",
      "Knowledge Point 5: Check your account safely. (Most advanced)\nObservation task: A real account problem should be checked through the social media company itself, not through a random message.\nBehavior task: Log in through the official app or website. Check your account's security notifications and recent login activity. If you are still worried, ask a trusted adult for help or contact the platform through its official help center."
    ],
    verification_steps: [] as string[],
    type: 'scam'
  },
  "General Scam Indicators": {
    detection_areas: [
      "Judge whether an offer is plausible: prices or rewards that are too good to be true, and a business reason that does not add up (why would they give this away?).",
      "Identify urgent or pressuring language designed to push quick action before the offer can be checked.",
      "Check the sender and link: generic usernames, missing official branding, and shortened or mismatched URLs do not establish authenticity.",
      "Recognize requests for personal information or passwords as a warning sign, and withhold them until the request is verified.",
      "Verify the offer through an official channel reached independently, such as the company's own website or logging in directly, or ask a trusted adult, before acting."
    ],
    verification_steps: [] as string[],
    type: 'scam'
  },
  "Location Sharing Risks": {
    detection_areas: [
      "Knowledge Point 1: Never share your home address publicly. (Easiest)\nObservation task: Jasmine shares her full home address: 321 Jefferson Ave.\nBehavior task: Never post your full home address online. If you see a friend sharing theirs, let them know and encourage them to delete the post.",
      "Knowledge Point 2: Remember that photos can reveal where you live.\nObservation task: The picture shows Jasmine's actual house. Details like the house color, design, and nearby places can help people find it.\nBehavior task: Before posting a photo, check the background. Make sure it does not show your house, street, address, or other clues about where you live.",
      "Knowledge Point 3: Don't invite strangers to your home. (Harder)\nObservation task: Jasmine's public post invites people to come over. Anyone who sees it might try to visit.\nBehavior task: Never invite people you don't know to your home. Share invitations only with trusted friends through private messages or group chats.",
      "Knowledge Point 4: Share general places instead of exact locations. (Most advanced)\nObservation task: An exact street address tells people exactly where to find Jasmine.\nBehavior task: Use general words like \"my neighborhood\" or \"downtown\" instead of sharing your full address. Check your privacy settings so only people you trust can see your posts."
    ],
    verification_steps: [] as string[],
    type: 'privacy'
  },
  "Movie Meetup Social Engineering": {
    detection_areas: [
      "Knowledge Point 1: Be careful about sharing where you are going. (Easiest)\nObservation task: Ethan tells everyone which movie theater he plans to visit.\nBehavior task: Avoid sharing your exact location in public posts. You can say, \"I'm excited to watch the new Marvel movie!\" without saying where you will be.",
      "Knowledge Point 2: Don't share your plans too early.\nObservation task: Ethan says he will be at the theater THIS FRIDAY. This tells strangers where he plans to go in the future.\nBehavior task: Share photos or stories after you have left the place, instead of posting your plans ahead of time.",
      "Knowledge Point 3: Don't share your exact schedule. (Harder)\nObservation task: Ethan shares the exact time (8 p.m.) and place. Someone could use this information to find him.\nBehavior task: Keep your exact plans and times private. If you need to make plans with friends, use a private message or group chat.",
      "Knowledge Point 4: Think about who can see your posts. (Most advanced)\nObservation task: A public post can be seen by people Ethan does not know. They may also learn when he is away from home.\nBehavior task: Check your privacy settings. Share plans only with people you trust, and avoid posting information that tells strangers when you are away."
    ],
    verification_steps: [] as string[],
    type: 'privacy'
  },
  "Contact Information Exposure": {
    detection_areas: [
      "Knowledge Point 1: Keep your phone number private. (Easiest)\nObservation task: Jake shares his phone number in a public post.\nBehavior task: Never post your phone number where everyone can see it. Only share it privately with people you trust.",
      "Knowledge Point 2: Think about who can see your personal information.\nObservation task: A public phone number can be seen and saved by strangers, not just Jake's friends.\nBehavior task: Check who can see your posts. Keep personal information away from public pages.",
      "Knowledge Point 3: Know what strangers can do with your phone number. (Harder)\nObservation task: Strangers could use Jake's number to send unwanted messages, make spam calls, or try to trick him.\nBehavior task: Never reply to strange messages or calls. Don't share passwords or secret login codes with anyone who contacts you unexpectedly.",
      "Knowledge Point 4: Know that phone numbers can be used to access accounts. (Most advanced)\nObservation task: Some websites use phone numbers to help people log in or prove who they are. Scammers may try to use your number to get into your accounts.\nBehavior task: Never share a login or verification code with anyone. If you receive a code you did not ask for, tell a trusted adult.",
      "Knowledge Point 5: Know what to do if you accidentally share your number.\nObservation task: Once a phone number is posted publicly, other people may have already seen or saved it.\nBehavior task: Delete the post right away. Tell a trusted adult, watch out for strange calls or messages, and share your number privately with close friends instead."
    ],
    verification_steps: [] as string[],
    type: 'privacy'
  },
};

export type ScenarioTemplate = keyof typeof SCENARIO_TEMPLATES;

export function isScenarioTemplate(value: unknown): value is ScenarioTemplate {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SCENARIO_TEMPLATES, value);
}

/** Reject invalid template references before materializing a room configuration. */
export function requireScenarioTemplate(value: unknown): ScenarioTemplate {
  if (!isScenarioTemplate(value)) {
    throw new Error(`Unknown or missing scenario reference: ${String(value)}`);
  }
  return value;
}

/** One shared target inventory for every Cyberbullying scenario. */
export const CYBERBULLYING_TARGET_VERSION = 'cyberbullying_doc_20261112';
export const CYBERBULLYING_LEARNING_TARGETS = [
  {
    "key": "recognize_cyberbullying_impact",
    "title": "Knowledge Point 1: Recognize cyberbullying. (Easiest)",
    "description": "Knowledge Point 1: Recognize cyberbullying. (Easiest)\nWhat to understand: Online bullying can hurt people's feelings, make them feel scared or lonely, and make them not want to go online.\nBehavior task: Recognize that these actions are not okay. Don't dismiss them as just a joke if someone is being hurt."
  },
  {
    "key": "show_empathy_support",
    "title": "Knowledge Point 2: Show kindness and support the person being bullied.",
    "description": "Knowledge Point 2: Show kindness and support the person being bullied.\nWhat to understand: The person being bullied may feel sad, embarrassed, scared, or alone.\nBehavior task: Send them a kind private message, such as \"I'm sorry this happened. Are you okay?\" Let them know they are not alone. Offer to help them find a trusted adult."
  },
  {
    "key": "avoid_reinforcing_bullying",
    "title": "Knowledge Point 3: Don't join in or help spread bullying.",
    "description": "Knowledge Point 3: Don't join in or help spread bullying.\nWhat to understand: Even if you don't write the mean message, sharing it or laughing at it can make the bullying worse.\nBehavior task: Don't like, share, forward, or comment on hurtful posts. Don't laugh along or encourage the bully. If it is safe, show that you don't support the behavior."
  },
  {
    "key": "stand_up_constructively",
    "title": "Knowledge Point 4: Speak up calmly without making things worse. (Harder)",
    "description": "Knowledge Point 4: Speak up calmly without making things worse. (Harder)\nWhat to understand: Fighting back with mean words or starting an online argument can make the situation worse.\nBehavior task: If it is safe, respond calmly with a short message, such as \"That's not okay. Please stop.\" Don't insult, threaten, or argue with the bully. If you think speaking up could put you or someone else in danger, don't confront them. Get help from a trusted adult instead."
  },
  {
    "key": "choose_safe_next_step",
    "title": "Knowledge Point 5: Choose a safe next step and get help. (Most advanced)",
    "description": "Knowledge Point 5: Choose a safe next step and get help. (Most advanced)\nWhat to understand: You don't have to solve cyberbullying by yourself. There are safe ways to protect the person being bullied.\nBehavior task:\nSave evidence: Take screenshots of hurtful messages or posts before they disappear. Don't forward or repost them.\nReport: Use the platform's report button to tell the social media company about the bullying.\nBlock: Block the person who is bullying so they cannot keep contacting you.\nGet trusted help: Tell a parent, teacher, school counselor, or another trusted adult. Ask them to help decide what to do next.\nSupport the victim: Continue checking on the person being bullied and remind them that they are not alone."
  }
];
