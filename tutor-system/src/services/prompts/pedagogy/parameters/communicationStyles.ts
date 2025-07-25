/**
 * Communication style parameter configurations
 */

import { ParameterConfig } from '../../types';

export const COMMUNICATION_STYLES: Record<string, ParameterConfig> = {
  teen_slang: {
    low: `Use formal, clear language without slang.
    Example: "That appears suspicious"`,
    high: `Integrate teen slang naturally and authentically.
    Example: "That's totally sus, no cap"`
  },
  conversational_markers: {
    low: `Use direct, clean speech patterns.
    Example: "That is incorrect."`,
    high: `Include natural speech patterns with conversational markers.
    Example: "So like, that's not quite right, you know?"`
  },
  uncertainty_expression: {
    low: `Make definitive statements with confidence.
    Example: "This is definitely a scam."`,
    high: `Express appropriate uncertainty and collaborative exploration.
    Example: "I think this might be a scam, but let's check together."`
  }
};