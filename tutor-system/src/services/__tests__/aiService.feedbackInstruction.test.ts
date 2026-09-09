#!/usr/bin/env node
/**
 * Test responsible for aiService.ts persisting raw instructional decisions for rejected and ignored AI suggestions, including Guard with null instruction.
 */

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn()
  }
}));

import { recordAISuggestionFeedback } from '../aiService';
import { supabase } from '../supabase';

const mockInsert = jest.fn();

describe('AI feedback raw instruction persistence', () => {
  beforeEach(() => {
    mockInsert.mockReset().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReset().mockReturnValue({ insert: mockInsert });
  });

  it('persists a rejected tutoring instruction without deriving it from final mode', async () => {
    await recordAISuggestionFeedback(
      'room-1',
      'tutor-1',
      'message-1',
      'A lock does not prove the site is real.',
      'rejected',
      undefined,
      undefined,
      120,
      ['message-1'],
      'tutoring',
      'correction',
      'The learner made a false inference.',
      'guard'
    );

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      tutor_action: 'rejected',
      raw_mode: 'tutoring',
      raw_instruction: 'correction',
      mode_reason: 'The learner made a false inference.',
      final_mode: 'guard',
      mode_rectified: true
    }));
  });

  it('persists an ignored Guard decision with a null instruction', async () => {
    await recordAISuggestionFeedback(
      'room-1',
      'tutor-1',
      'message-2',
      'Stop disrupting the discussion and make a relevant attempt.',
      'ignored',
      undefined,
      undefined,
      90,
      ['message-2'],
      'guard',
      null,
      'The learner deliberately repeated unrelated content.',
      'guard'
    );

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      tutor_action: 'ignored',
      raw_mode: 'guard',
      raw_instruction: null,
      final_mode: 'guard',
      mode_rectified: false
    }));
  });

  it('persists feedback for pre-populated learner messages with a null database parent', async () => {
    await recordAISuggestionFeedback(
      'room-1',
      'tutor-1',
      'prepop-room-1-0',
      'Check the sender through the real app.',
      'rejected',
      undefined,
      undefined,
      75,
      ['prepop-room-1-0'],
      'tutoring',
      'protective_instruction',
      'The learner proposed an unsafe action.',
      'tutoring'
    );

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      parent_message_id: null,
      raw_instruction: 'protective_instruction'
    }));
  });
});
