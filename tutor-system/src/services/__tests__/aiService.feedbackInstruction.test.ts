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
      false,
      'correction',
      'The learner made a false inference.',
      true
    );

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      tutor_action: 'rejected',
      raw_guard_mode: false,
      raw_instruction: 'correction',
      guard_reason: 'The learner made a false inference.',
      final_guard_mode: true,
      guard_rectified: true
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
      true,
      null,
      'The learner deliberately repeated unrelated content.',
      true
    );

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      tutor_action: 'ignored',
      raw_guard_mode: true,
      raw_instruction: null,
      final_guard_mode: true,
      guard_rectified: false
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
      false,
      'protective_instruction',
      'The learner proposed an unsafe action.',
      false
    );

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      parent_message_id: null,
      raw_instruction: 'protective_instruction'
    }));
  });

  it('records an unsent character review with separate originals and edits through the shared table', async () => {
    await recordAISuggestionFeedback('room-1', 'tutor-1', 'message-1', 'Original AI text', 'rejected',
      'Edited tutor text', undefined, 120, ['saved context'], false, null, 'Support', true,
      { rawCharacter: 'victim', finalCharacter: 'educator', generationProvenance: { model: 'fixture' } });
    expect(supabase.from).toHaveBeenCalledWith('ai_suggestion_feedback');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      tutor_id: 'tutor-1', parent_message_id: 'message-1', tutor_message_id: null,
      ai_suggestion: 'Original AI text', tutor_final_response: 'Edited tutor text', tutor_action: 'rejected',
      raw_character: 'victim', final_character: 'educator', raw_guard_mode: false, final_guard_mode: true,
      guard_rectified: true, generation_provenance: { model: 'fixture' }, contract_version: 'cyberbullying_v1',
    }));
  });
});
