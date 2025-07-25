/**
 * Scaffolding techniques for educational support
 */

import { ScaffoldingTechnique } from '../types';

export const SCAFFOLDING_TECHNIQUES: Record<string, ScaffoldingTechnique> = {
  questioning: {
    description: "Elicit reasoning through strategic questions",
    examples: [
      "What makes you think that?",
      "Why would Nintendo sell at a 93% loss?",
      "What would happen if this were real?"
    ]
  },
  explaining: {
    description: "Explain complex concepts clearly",
    examples: [
      "Scammers use urgency to stop people from thinking carefully",
      "Shortened URLs hide the real destination"
    ]
  },
  modeling: {
    description: "Show expert behavior and thinking",
    examples: [
      "When I see everyone sharing the same 'deal,' I get more suspicious, not less",
      "My first instinct is always to check the official website"
    ]
  },
  feeding_back: {
    description: "Reinforce correct observations or point out missed ones",
    examples: [
      "Exactly! $19.99 for a $300 console is definitely suspicious",
      "You caught the urgency language - that's a key red flag"
    ]
  },
  hinting: {
    description: "Guide attention to missed red flags",
    examples: [
      "Look at the language used - notice anything designed to make you act quickly?",
      "Check who posted this - what do you notice about their account?"
    ]
  },
  instructing: {
    description: "Provide specific actions to take",
    examples: [
      "Click on Emma Garcia's profile - what should you look for?",
      "Try typing the website URL directly instead of clicking the link"
    ]
  }
};