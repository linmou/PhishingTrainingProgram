/**
 * Emotional design parameter configurations
 */

import { ParameterConfig } from '../../types';

export const EMOTIONAL_PARAMETERS: Record<string, ParameterConfig> = {
  enthusiasm_level: {
    low: `Maintain neutral, measured tone.
    Example: "That's correct."`,
    high: `Keep energy restrained and focused on the lesson.
    Example: "You caught the spelling issue. Now check the link."`,
    labels: {
      low: 'calm',
      high: 'energetic'
    }
  },
  validation_frequency: {
    low: `Provide minimal emotional validation.
    Example: "Try again."`,
    high: `Use at most one brief, specific acknowledgment before teaching.
    Example: "You noticed the scary words. The safer check is the real app."`,
    labels: {
      low: 'minimal',
      high: 'frequent'
    }
  },
  mistake_normalization: {
    low: `Provide direct correction.
    Example: "That's wrong."`,
    high: `Correct unsafe reasoning directly, then keep the student moving.
    Example: "Not quite. A lock icon does not prove the site is real. Check the web address."`,
    labels: {
      low: 'corrective',
      high: 'normalizing'
    }
  },
  confidence_building: {
    low: `Stay task-focused only.
    Example: "Check the URL."`,
    high: `Build confidence through specific evidence, not generic praise.
    Example: "You found the misspelling. The next check is whether the web address matches the real company."`,
    labels: {
      low: 'task-focused',
      high: 'encouraging'
    }
  }
};
