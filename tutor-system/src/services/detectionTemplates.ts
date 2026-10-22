/**
 * Learning targets for teaching scenarios. Every scenario has five targets.
 */

export const SCENARIO_TEMPLATES = {
  "Nintendo Switch Deal ($19.99)": {
    detection_areas: [
      "Evaluate whether a $19.99 Nintendo Switch offer is plausible by comparing its price and business logic with legitimate retailers.",
      "Identify urgency and scarcity tactics such as \"Hurry up\" and \"WILL NOT LAST\" that pressure people to act quickly.",
      "Check the sender's claimed Nintendo affiliation and the exact link destination; shortened links and unofficial profiles do not establish authenticity.",
      "Evaluate likes, shares, testimonials, and branding against independent evidence rather than treating social proof as verification.",
      "Verify the promotion and price through Nintendo's official website or an authorized retailer reached independently before clicking, paying, or sharing information."
    ],
    verification_steps: [] as string[],
    type: 'scam'
  },
  "iTunes Gift Card Survey ($500)": {
    detection_areas: [
      "Evaluate whether a $500 iTunes gift card is a plausible reward for a five-minute survey.",
      "Identify excitement, urgency, and instant-reward claims that encourage participation before checking the offer.",
      "Check the sender's claimed Apple affiliation and the exact link destination; a shortened URL or personal account does not establish authenticity.",
      "Explain why professional photos and personal testimonials are insufficient evidence, and check the promotion's terms and conditions.",
      "Verify the promotion through Apple's official channels reached independently before participating or sharing personal information."
    ],
    verification_steps: [] as string[],
    type: 'scam'
  },
  "Account Security Alert": {
    detection_areas: [
      "Identify fear, urgency, and pressure to click in alerts such as \"YOUR ACCOUNT IS AT RISK\".",
      "Check the sender and exact domain for impersonation, including \"Socail Media Testdrive\" and testdrive.info.",
      "Explain why professional design and an HTTPS lock do not prove a site or alert is legitimate.",
      "Identify vague or missing platform, account, and incident details that make an alert difficult to verify.",
      "Verify independently by opening the official app or typing its known address, then review security alerts and login activity; use official support and enable two-factor authentication when needed."
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
      "Identify precise location information exposed in a public post, including a home address.",
      "Explain who can access public location information and how it could be misused to threaten personal safety.",
      "Recognize how addresses, house numbers, street signs, and identifying images can reveal a home location.",
      "Choose an appropriate audience and a private communication channel for sharing necessary location details.",
      "Rewrite the post to coordinate safely without exposing a home address or identifying location details."
    ],
    verification_steps: [] as string[],
    type: 'privacy'
  },
  "Movie Meetup Social Engineering": {
    detection_areas: [
      "Identify how a venue, date, and exact time reveal someone's future movements.",
      "Explain how public meetup plans can make a person trackable and their schedule predictable.",
      "Recognize how a stranger could use public plans to appear familiar or trustworthy.",
      "Verify who is involved through a trusted channel before agreeing to meet.",
      "Coordinate meetup plans privately and limit public venue, date, and time details."
    ],
    verification_steps: [] as string[],
    type: 'privacy'
  },
  "Contact Information Exposure": {
    detection_areas: [
      "Identify a phone number as personal contact information exposed by a public post.",
      "Explain how public phone numbers can enable spam, harassment, and impersonation.",
      "Recognize suspicious calls or messages that use an exposed number to request personal information or account access.",
      "Share contact details selectively with trusted people through private messages or platform messaging.",
      "Respond safely to suspicious calls or messages without sharing passwords or verification codes."
    ],
    verification_steps: [] as string[],
    type: 'privacy'
  },
};

export type ScenarioTemplate = keyof typeof SCENARIO_TEMPLATES;

/** One shared target inventory for every Cyberbullying scenario. */
export const CYBERBULLYING_TARGET_VERSION = 'cyberbullying_v1';
export const CYBERBULLYING_LEARNING_TARGETS = [
  {
    key: 'recognize_cyberbullying_impact',
    title: 'Recognize cyberbullying and impact',
    description: 'Recognize harmful online behavior and explain its impact on the person targeted.'
  },
  {
    key: 'show_empathy_support',
    title: 'Show empathy and support',
    description: 'Acknowledge the targeted person’s feelings and offer a concrete supportive response.'
  },
  {
    key: 'stand_up_constructively',
    title: 'Stand up constructively',
    description: 'Challenge bullying with a calm, respectful response that avoids escalating the conflict.'
  },
  {
    key: 'avoid_reinforcing_bullying',
    title: 'Avoid reinforcing bullying',
    description: 'Choose responses that avoid joining in, amplifying, or rewarding harmful behavior.'
  },
  {
    key: 'choose_safe_next_step',
    title: 'Choose a safe next step',
    description: 'Choose an appropriate next step such as supporting the person privately, saving evidence, reporting, blocking, or seeking trusted help.'
  }
] as const;
