/**
 * Predefined recognition and safe-action learning targets for phishing training.
 * Named teaching scenarios have five total targets across both lists.
 */

// Scam Detection Areas Templates
export const SCAM_DETECTION_AREAS = {
  nintendo_switch_deal: [
    'Evaluate whether a $19.99 Nintendo Switch offer is plausible by comparing its price and business logic with legitimate retailers.',
    'Identify urgency and scarcity tactics such as "Hurry up" and "WILL NOT LAST" that pressure people to act quickly.',
    'Check the sender\'s claimed Nintendo affiliation and the exact link destination; shortened links and unofficial profiles do not establish authenticity.',
    'Evaluate likes, shares, testimonials, and branding against independent evidence rather than treating social proof as verification.'
  ],
  
  itunes_gift_card: [
    'Evaluate whether a $500 iTunes gift card is a plausible reward for a five-minute survey.',
    'Identify excitement, urgency, and instant-reward claims that encourage participation before checking the offer.',
    'Check the sender\'s claimed Apple affiliation and the exact link destination; a shortened URL or personal account does not establish authenticity.',
    'Explain why professional photos and personal testimonials are insufficient evidence, and check the promotion\'s terms and conditions.'
  ],
  
  account_security_alert: [
    'Identify fear, urgency, and pressure to click in alerts such as "YOUR ACCOUNT IS AT RISK".',
    'Check the sender and exact domain for impersonation, including "Socail Media Testdrive" and testdrive.info.',
    'Explain why professional design and an HTTPS lock do not prove a site or alert is legitimate.',
    'Identify vague or missing platform, account, and incident details that make an alert difficult to verify.'
  ],
  
  // Generic templates for custom scenarios
  general_scam_indicators: [
    'Too good to be true pricing or offers',
    'Urgent language designed to pressure quick action',
    'Suspicious or shortened URLs that hide real destinations',
    'Lack of official branding or verification',
    'Generic usernames not affiliated with legitimate companies',
    'Poor grammar, spelling errors, or unprofessional language',
    'Requests for personal information or passwords',
    'No way to verify the offer through official channels',
    'Business logic doesn\'t make sense (why would they give this away?)',
    'Social proof manipulation (fake testimonials or limited engagement)'
  ]
};

// Verification Steps Templates
export const VERIFICATION_STEPS = {
  nintendo_switch_deal: [
    'Verify the promotion and price through Nintendo\'s official website or an authorized retailer reached independently before clicking, paying, or sharing information.'
  ],
  
  itunes_gift_card: [
    'Verify the promotion through Apple\'s official channels reached independently before participating or sharing personal information.'
  ],
  
  account_security_alert: [
    'Verify independently by opening the official app or typing its known address, then review security alerts and login activity; use official support and enable two-factor authentication when needed.'
  ],
  
  // Generic verification steps
  general_verification: [
    'Check the source: Is this from an official, verified account?',
    'Verify the URL: Does it match the official website domain?',
    'Cross-reference: Check the company\'s official website and social media',
    'Research the offer: Search for news coverage or official announcements',
    'Check your account: Log in directly to see if there are real notifications',
    'Ask yourself: Does this make business sense?',
    'Get a second opinion: Ask a trusted adult or friend what they think',
    'Trust your instincts: If something feels wrong, it probably is'
  ]
};

// Privacy Risk Detection Areas
export const PRIVACY_DETECTION_AREAS = {
  location_sharing: [
    'Identify precise location information exposed in a public post, including a home address.',
    'Explain who can access public location information and how it could be misused to threaten personal safety.',
    'Recognize how addresses, house numbers, street signs, and identifying images can reveal a home location.'
  ],

  movie_meetup: [
    'Identify how a venue, date, and exact time reveal someone\'s future movements.',
    'Explain how public meetup plans can make a person trackable and their schedule predictable.',
    'Recognize how a stranger could use public plans to appear familiar or trustworthy.'
  ],
  
  contact_information: [
    'Identify a phone number as personal contact information exposed by a public post.',
    'Explain how public phone numbers can enable spam, harassment, and impersonation.',
    'Recognize suspicious calls or messages that use an exposed number to request personal information or account access.'
  ],
  
  personal_details: [
    'Full name and age: Complete identity information visible',
    'School or work location: Making yourself findable in real life',
    'Family information: Details about parents, siblings, or relatives',
    'Financial information: Bank details, income, or spending habits',
    'Daily routines: Patterns that make you predictable and targetable'
  ]
};

// Privacy Protection Steps
export const PRIVACY_PROTECTION_STEPS = {
  location_sharing: [
    'Choose an appropriate audience and a private communication channel for sharing necessary location details.',
    'Rewrite the post to coordinate safely without exposing a home address or identifying location details.'
  ],

  movie_meetup: [
    'Verify who is involved through a trusted channel before agreeing to meet.',
    'Coordinate meetup plans privately and limit public venue, date, and time details.'
  ],
  
  contact_information: [
    'Share contact details selectively with trusted people through private messages or platform messaging.',
    'Respond safely to suspicious calls or messages without sharing passwords or verification codes.'
  ],
  
  general_privacy: [
    'Review privacy settings: Regularly check who can see your posts',
    'Think before posting: Ask "Would I be comfortable if anyone saw this?"',
    'Limit personal details: Keep sensitive information off public profiles',
    'Use privacy-first platforms: Choose apps that prioritize user privacy',
    'Educate friends: Help friends understand privacy risks too',
    'Regular audits: Periodically review and delete old posts with personal info'
  ]
};

// Helper function to get detection areas by category
export function getDetectionAreas(category: keyof typeof SCAM_DETECTION_AREAS | keyof typeof PRIVACY_DETECTION_AREAS): string[] {
  if (category in SCAM_DETECTION_AREAS) {
    return SCAM_DETECTION_AREAS[category as keyof typeof SCAM_DETECTION_AREAS];
  }
  if (category in PRIVACY_DETECTION_AREAS) {
    return PRIVACY_DETECTION_AREAS[category as keyof typeof PRIVACY_DETECTION_AREAS];
  }
  return [];
}

// Helper function to get verification steps by category
export function getVerificationSteps(category: keyof typeof VERIFICATION_STEPS | keyof typeof PRIVACY_PROTECTION_STEPS): string[] {
  if (category in VERIFICATION_STEPS) {
    return VERIFICATION_STEPS[category as keyof typeof VERIFICATION_STEPS];
  }
  if (category in PRIVACY_PROTECTION_STEPS) {
    return PRIVACY_PROTECTION_STEPS[category as keyof typeof PRIVACY_PROTECTION_STEPS];
  }
  return [];
}

// Combined template selector
export const SCENARIO_TEMPLATES = {
  // Scam scenarios
  'Nintendo Switch Deal ($19.99)': {
    detection_areas: SCAM_DETECTION_AREAS.nintendo_switch_deal,
    verification_steps: VERIFICATION_STEPS.nintendo_switch_deal,
    type: 'scam'
  },
  'iTunes Gift Card Survey ($500)': {
    detection_areas: SCAM_DETECTION_AREAS.itunes_gift_card,
    verification_steps: VERIFICATION_STEPS.itunes_gift_card,
    type: 'scam'
  },
  'Account Security Alert': {
    detection_areas: SCAM_DETECTION_AREAS.account_security_alert,
    verification_steps: VERIFICATION_STEPS.account_security_alert,
    type: 'scam'
  },
  'General Scam Indicators': {
    detection_areas: SCAM_DETECTION_AREAS.general_scam_indicators,
    verification_steps: VERIFICATION_STEPS.general_verification,
    type: 'scam'
  },
  
  // Privacy scenarios
  'Location Sharing Risks': {
    detection_areas: PRIVACY_DETECTION_AREAS.location_sharing,
    verification_steps: PRIVACY_PROTECTION_STEPS.location_sharing,
    type: 'privacy'
  },
  'Movie Meetup Social Engineering': {
    detection_areas: PRIVACY_DETECTION_AREAS.movie_meetup,
    verification_steps: PRIVACY_PROTECTION_STEPS.movie_meetup,
    type: 'privacy'
  },
  'Contact Information Exposure': {
    detection_areas: PRIVACY_DETECTION_AREAS.contact_information,
    verification_steps: PRIVACY_PROTECTION_STEPS.contact_information,
    type: 'privacy'
  },
  'Personal Details Protection': {
    detection_areas: PRIVACY_DETECTION_AREAS.personal_details,
    verification_steps: PRIVACY_PROTECTION_STEPS.general_privacy,
    type: 'privacy'
  }
};

export type ScenarioTemplate = keyof typeof SCENARIO_TEMPLATES;
