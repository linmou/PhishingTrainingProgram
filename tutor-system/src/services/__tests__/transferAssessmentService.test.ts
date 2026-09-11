#!/usr/bin/env node
// Test responsible for transfer task 01: an answer cannot be graded before assessment delivery.

import { resolveTransferAssessmentAnswer } from '../transferAssessmentService';

const options = [
  { id: 'A' as const, text: 'The familiar account proves the link is safe' },
  { id: 'B' as const, text: 'The account could have been compromised' },
  { id: 'C' as const, text: 'Every prize message is necessarily a scam' },
  { id: 'D' as const, text: 'Opening the link proves the sender identity' },
];

describe('transfer assessment service lifecycle', () => {
  it('does not grade or mutate progress for an answer tied to an unsent question', () => {
    const currentProgress = { status: 'partially_covered' as const, understanding_level: 'basic' as const };
    const expectedProgress = { status: 'partially_covered' as const, understanding_level: 'basic' as const };

    const result = resolveTransferAssessmentAnswer({
      delivered: false,
      answer_message_id: 'answer-1',
      content: 'B',
      selection_type: 'single',
      options,
      correct_option_ids: ['B'],
      current_progress: currentProgress,
    });

    expect(result).toEqual({
      disposition: 'not_delivered',
      progress: expectedProgress,
      feedback_required: false,
    });
    expect(currentProgress).toEqual(expectedProgress);
  });
});
