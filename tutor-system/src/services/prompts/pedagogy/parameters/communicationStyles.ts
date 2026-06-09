/**
 * Communication style parameter configurations
 */

import { ParameterConfig } from '../../types';

export const COMMUNICATION_STYLES: Record<string, ParameterConfig> = {
  teen_slang: {
    low: `Use formal, clear language without slang.
    Example: "That appears suspicious"`,
    high: `Use relaxed teen-friendly language without forced slang.
    Example: "That link looks fake, so I would not use it."`,
    labels: {
      low: 'formal',
      high: 'casual'
    }
  },
  conversational_markers: {
    low: `Use direct, clean speech patterns.
    Example: "That is incorrect."`,
    high: `Use direct, natural speech patterns.
    Example: "Not quite. The web address is the problem."`,
    labels: {
      low: 'direct',
      high: 'natural'
    }
  },
  uncertainty_expression: {
    low: `Make definitive statements with confidence.
    Example: "This is definitely a scam."`,
    high: `Be confident when the student's reasoning is unsafe, and reserve uncertainty for genuinely uncertain facts.
    Example: "This link is not safe. Open the real app instead."`,
    labels: {
      low: 'confident',
      high: 'collaborative'
    }
  }
};
