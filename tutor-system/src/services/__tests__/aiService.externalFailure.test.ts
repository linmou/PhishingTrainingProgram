#!/usr/bin/env node
/**
 * Test responsible for aiService.ts refusing to silently fall back to dummy suggestions when a configured AI backend rejects the request.
 */

jest.mock('../simplifiedAIContext', () => ({
  buildAIContextFromExistingData: jest.fn().mockResolvedValue([
    {
      role: 'user',
      content: 'Student: Is it safe to post my live location publicly?',
      timestamp: 1712016000
    }
  ])
}));

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn()
  }
}));

describe('aiService external backend failures', () => {
  const originalEnvironment = process.env.REACT_APP_ENVIRONMENT;
  const originalApiKey = process.env.REACT_APP_OAI_API_KEY;
  const originalBaseUrl = process.env.REACT_APP_OAI_BASE_URL;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.REACT_APP_ENVIRONMENT = 'production';
    process.env.REACT_APP_OAI_API_KEY = 'test-oai-key';
    process.env.REACT_APP_OAI_BASE_URL = 'https://example.invalid/v1';
  });

  afterAll(() => {
    process.env.REACT_APP_ENVIRONMENT = originalEnvironment;
    process.env.REACT_APP_OAI_API_KEY = originalApiKey;
    process.env.REACT_APP_OAI_BASE_URL = originalBaseUrl;
    global.fetch = originalFetch;
  });

  it('returns an error instead of a generic dummy suggestion when the configured AI backend returns 401', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue('invalid token')
    } as any);

    const { supabase } = await import('../supabase');
    const mockSupabaseFrom = supabase.from as jest.Mock;

    mockSupabaseFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                ai_assistant_enabled: true,
                ai_assistant_model: 'gpt-4o-mini'
              },
              error: null
            })
          })
        })
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'room-1',
                ai_assistant_enabled: true,
                ai_assistant_model: 'gpt-4o-mini',
                ai_assistant_prompt: 'Scenario prompt',
                created_at: '2026-04-02T00:00:00Z',
                updated_at: '2026-04-02T00:00:00Z'
              },
              error: null
            })
          })
        })
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  prompt_config: {
                    role: { role: 'high' },
                    communication_style: {
                      teen_slang: 'low',
                      conversational_markers: 'low',
                      uncertainty_expression: 'low'
                    },
                    cognitive_parameters: {
                      concept_density: 'high',
                      perspective_taking: 'high',
                      personal_examples: 'high',
                      consequence_highlighting: 'high'
                    },
                    emotional_parameters: {
                      enthusiasm_level: 'low',
                      validation_frequency: 'high',
                      mistake_normalization: 'high',
                      confidence_building: 'high'
                    },
                    detection_areas: ['Real-time location sharing'],
                    verification_steps: ['Use private messages']
                  },
                  temperature: 0.7,
                  max_tokens: 150
                },
                error: null
              })
            })
          })
        })
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { title: 'Test room', description: 'Test scenario' },
              error: null
            })
          })
        })
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{ id: 'message-1' }],
                error: null
              })
            })
          })
        })
      });

    const { generateTutorSuggestion } = await import('../aiService');

    await expect(generateTutorSuggestion('room-1', 'tutor-1')).resolves.toMatchObject({
      suggestion: '',
      success: false,
      error: expect.stringContaining('401')
    });
  });
});
