/**
 * Predefined detection areas and verification steps for phishing training
 * Based on the structured examples from raw instructions
 */

// Scam Detection Areas Templates
export const SCAM_DETECTION_AREAS = {
  nintendo_switch_deal: [
    '"Too Good to Be True" Pricing: $19.99 for a $300+ gaming console',
    'Urgency Language: "Hurry up, this offer WILL NOT LAST"',
    'Suspicious URL: http://goo.gl/FreeSwitch (shortened link, not official Nintendo domain)',
    'ALL CAPS Warning: "WILL NOT LAST" creates false urgency',
    'No Official Branding: Missing Nintendo verification or official company messaging',
    'Generic Username: "Lucy Simms" doesn\'t suggest official Nintendo account',
    'Social Proof Manipulation: Limited engagement (only 3 likes) despite "amazing deal"',
    'Business Logic Flaw: No explanation of how/why Nintendo would offer this loss-making deal'
  ],
  
  itunes_gift_card: [
    'Excessive Value Promise: $500 for a "5 minute survey"',
    'Urgency/Excitement Language: "crazy deal!!" with multiple exclamation points',
    'Suspicious URL: http://bit.ly/FREEGIFTS (shortened link, not official Apple/iTunes)',
    '"Instant" Reward Claims: "got instantly" suggests unrealistic immediate gratification',
    'Generic Account: "Emma Garcia" not affiliated with Apple or iTunes',
    'Professional Photo Quality: Uses actual iTunes gift card photo to appear legitimate',
    'Believable Personal Story: "I filled in a 5 minute survey" sounds like peer testimony',
    'Lack of Official Apple Branding: No Apple logo, iTunes official messaging, or verification',
    'No Terms/Conditions: Legitimate promotions always include fine print and restrictions'
  ],
  
  account_security_alert: [
    'Fear-Based Urgency: "YOUR ACCOUNT IS AT RISK" in large, alarming text',
    'Suspicious URL: http://testdrive.info/youraccount (not official platform domain)',
    'Generic Source: "Socail Media Testdrive" (note spelling error) not a recognizable platform',
    'Panic-Inducing Language: "!!&$!ALERT!&$!!" with symbols and urgency',
    'Immediate Action Pressure: "Click here to resolve" without explanation',
    'Professional Design: Well-designed graphic could appear legitimate',
    'Vague Platform Reference: Doesn\'t specify which account/platform is at risk',
    'No Specific Account Information: Real security alerts include account-specific details',
    'Spelling Error: "Socail" instead of "Social" in account name',
    'No Alternative Contact Method: Legitimate alerts provide multiple ways to verify'
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
    'URL Analysis: Don\'t click the shortened link - check if it redirects to nintendo.com or authorized retailer',
    'Account Verification: Click on "Lucy Simms" profile - check account creation date, follower count, posting history',
    'Cross-Reference Checking: Visit nintendo.com directly to check for this promotion',
    'Official Social Media: Check Nintendo\'s official social media accounts for this deal',
    'Price Reality Check: Search current Nintendo Switch prices on legitimate retailers',
    'Business Logic: Ask "Why would Nintendo sell at 93% loss?"',
    'News Verification: Search major gaming news sites for coverage of this deal'
  ],
  
  itunes_gift_card: [
    'Official Source Verification: Visit apple.com or itunes.com directly',
    'Apple Social Media: Check Apple\'s official social media for any current promotions',
    'Press Release Check: Look for press releases about legitimate gift card promotions',
    'URL Analysis: Don\'t click bit.ly link - legitimate Apple promotions use apple.com domains',
    'Account Investigation: Check Emma Garcia\'s profile and posting history for other suspicious offers',
    'Logic Check: Ask "Why would Apple give away $500 for 5 minutes of work?"',
    'Cost Analysis: Calculate how much Apple would lose daily if this were real'
  ],
  
  account_security_alert: [
    'Do NOT Click: Never click security alert links directly',
    'Manual Login: Type the actual platform\'s URL manually into browser',
    'Official Account Check: Log into your real account separately to check for security notifications',
    'Platform Verification: Check which social media platforms you actually use',
    'URL Domain Check: Notice "testdrive.info" is not a legitimate social media domain',
    'Official Support: Contact platform support through official channels if concerned',
    'Security Review: Enable two-factor authentication through official platform settings',
    'Login Activity: Review recent login activity in official account security settings'
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
    'Real-time location sharing: Announcing specific places and times',
    'Predictable schedule: Giving exact times and locations',
    'Social engineering vulnerability: Revealing when away from home',
    'Safety risks: Making yourself trackable to strangers',
    'Property exposure: Showing identifying features of your home',
    'Address visibility: Posting exact addresses publicly'
  ],
  
  contact_information: [
    'Phone number exposure: Sharing personal contact information publicly',
    'Identity theft potential: Phone numbers used for account verification',
    'Harassment risk: Number accessible to anyone who sees the post',
    'Social engineering target: Phone numbers used for scams or impersonation',
    'Spam vulnerability: Public numbers lead to unwanted calls and messages'
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
    'Use private messages: Coordinate meetups via DM instead of public posts',
    'Be vague about locations: Say "downtown" or "my neighborhood" instead of exact addresses',
    'Avoid real-time posting: Share experiences after you\'ve left the location',
    'Check privacy settings: Ensure only friends can see location-based posts',
    'Remove identifying features: Avoid showing house numbers, street signs, or landmarks'
  ],
  
  contact_information: [
    'Keep numbers private: Share contact info only with close friends directly',
    'Use platform messaging: Communicate through the app\'s built-in messaging',
    'Create group chats: Use private group messages for planning events',
    'Be selective: Only give your number to people you trust',
    'Monitor usage: Watch for unusual activity if your number gets shared'
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