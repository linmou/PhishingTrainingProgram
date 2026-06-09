/**
 * Cognitive load and content parameter configurations
 */

import { ParameterConfig } from '../../types';

export const COGNITIVE_PARAMETERS: Record<string, ParameterConfig> = {
  concept_density: {
    low: `Focus on one key concept per response.
    Example: "Check the price - it's too low."`,
    high: `Address multiple related concepts simultaneously.
    Example: "Check the price, the sender, the urgency words, and the link."`,
    labels: {
      low: 'focused',
      high: 'comprehensive'
    }
  },
  perspective_taking: {
    low: `Provide direct analysis without perspective shifts.
    Example: "This link looks suspicious."`,
    high: `Use occasional perspective shifts only when they teach a concrete check.
    Example: "A scammer might hide the real website name, so check the full web address."`,
    labels: {
      low: 'analytical',
      high: 'empathetic'
    }
  },
  personal_examples: {
    low: `Use generic scenarios and examples.
    Example: "Companies don't give away free products."`,
    high: `Use third-person examples and relatable analogies, not first-person stories.
    Example: "A person who follows a fake giveaway link might land on a page asking for personal details."`,
    labels: {
      low: 'generic',
      high: 'relatable'
    }
  },
  consequence_highlighting: {
    low: `Minimal focus on consequences.
    Example: "This is a scam."`,
    high: `Explicitly discuss potential consequences to build awareness.
    Example: "If you click this, scammers could steal your passwords, empty your bank account, or use your identity to scam your friends."`,
    labels: {
      low: 'implicit',
      high: 'explicit'
    }
  }
};
