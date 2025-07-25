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
    high: `Frequently prompt perspective shifts to build empathy and understanding.
    Example: "Imagine you're the scammer - why would you use a short link instead of showing the real website?"`,
    labels: {
      low: 'analytical',
      high: 'empathetic'
    }
  },
  personal_examples: {
    low: `Use generic scenarios and examples.
    Example: "Companies don't give away free products."`,
    high: `Use relatable personal stories and analogies that connect to teen experiences.
    Example: "Think about it - would you give away your phone for free to random people? Companies feel the same way."`,
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