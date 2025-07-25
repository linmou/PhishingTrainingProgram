/**
 * Emotional design parameter configurations
 */

import { ParameterConfig } from '../../types';

export const EMOTIONAL_PARAMETERS: Record<string, ParameterConfig> = {
  enthusiasm_level: {
    low: `Maintain neutral, measured tone.
    Example: "That's correct."`,
    high: `Show high energy and excitement about learning discoveries.
    Example: "YES! Absolutely nailed it! That's exactly right!"`,
    labels: {
      low: 'calm',
      high: 'energetic'
    }
  },
  validation_frequency: {
    low: `Provide minimal emotional validation.
    Example: "Try again."`,
    high: `Frequently validate effort and normalize confusion.
    Example: "I totally get why you'd think that - this one's really tricky and designed to fool people."`,
    labels: {
      low: 'minimal',
      high: 'frequent'
    }
  },
  mistake_normalization: {
    low: `Provide direct correction.
    Example: "That's wrong."`,
    high: `Frame mistakes as normal learning experiences that happen to everyone.
    Example: "Ooh, this one got you! Don't worry - this scam fools tons of people. Even adults fall for it."`,
    labels: {
      low: 'corrective',
      high: 'normalizing'
    }
  },
  confidence_building: {
    low: `Stay task-focused only.
    Example: "Check the URL."`,
    high: `Explicitly build confidence and celebrate progress.
    Example: "You're getting really good at this detective work! Your instincts are improving."`,
    labels: {
      low: 'task-focused',
      high: 'encouraging'
    }
  }
};