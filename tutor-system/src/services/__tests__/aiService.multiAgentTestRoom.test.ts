#!/usr/bin/env node
/**
 * Test responsible for preserving the Multi-agent interaction mode when a test-room
 * template initializes and persists an AI assistant configuration.
 */

jest.mock('../simplifiedAIContext', () => ({
  buildAIContextFromExistingData: jest.fn().mockResolvedValue([])
}));

jest.mock('../supabase', () => ({
  supabase: { from: jest.fn() }
}));

describe('initializeAIAssistant Multi-agent test room', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('persists interaction_mode=multi_agent in the extended AI config', async () => {
    const { supabase } = await import('../supabase');
    const from = supabase.from as jest.Mock;
    from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { tutor_id: 'tutor-1' }, error: null })
          })
        })
      })
      .mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'room-1' }, error: null })
            })
          })
        })
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
          })
        })
      })
      .mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      });

    const { initializeAIAssistant } = await import('../aiService');
    await initializeAIAssistant(
      'room-1',
      'qwen3.5-flash',
      undefined,
      'tutor-1',
      {
        role: 'peer',
        scenario: 'Account Security Alert',
        interaction_mode: 'multi_agent'
      }
    );

    const insertCall = from.mock.results[3].value.insert.mock.calls[0][0];
    expect(insertCall.prompt_config.interaction_mode).toBe('multi_agent');
  });
});
