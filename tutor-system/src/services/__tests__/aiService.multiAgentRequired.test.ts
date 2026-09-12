#!/usr/bin/env node
/**
 * Test responsible for src/services/aiService.ts Multi-agent enforcement: with the learner's
 * Multi-agent choice active, a discretionary single-Tutor decision is repaired once into the
 * two-character pair, while protective_instruction, explanation and Guard pass through untouched.
 */

jest.mock('../simplifiedAIContext', () => ({
  buildAIContextFromExistingData: jest.fn().mockResolvedValue([
    { role: 'user', content: 'Student: hi', timestamp: 1712016000 }
  ])
}));

jest.mock('../supabase', () => ({
  supabase: { from: jest.fn() }
}));

const promptConfig = (interactionMode: 'single_agent' | 'multi_agent') => ({
  role: { role: 'low' as const },
  communication_style: { teen_slang: 'high' as const, conversational_markers: 'high' as const, uncertainty_expression: 'low' as const },
  cognitive_parameters: { concept_density: 'low' as const, perspective_taking: 'high' as const, personal_examples: 'low' as const, consequence_highlighting: 'high' as const },
  emotional_parameters: { enthusiasm_level: 'low' as const, validation_frequency: 'low' as const, mistake_normalization: 'high' as const, confidence_building: 'high' as const },
  detection_areas: ['Sender identity'],
  verification_steps: ['Verify independently'],
  interaction_mode: interactionMode
});

const decision = (mode: string, instruction: string | null, response: string) => JSON.stringify({
  reason: 'Observable evidence and the purpose of this decision.',
  decision: { mode, instruction },
  response
});

const PAIR = decision('multiagent', 'multiagent',
  '[agent:riley] Just click the link, the account closes today.\n[agent:tutor] That is pressure, not proof. What is trying to rush you?');

describe('aiService Multi-agent enforcement', () => {
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

  const mockSupabaseFor = async (interactionMode: 'single_agent' | 'multi_agent') => {
    const { supabase } = await import('../supabase');
    (supabase.from as jest.Mock)
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ai_assistant_enabled: true, ai_assistant_model: 'qwen3.5-flash', active_response_mode: 'tutoring' },
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
                ai_assistant_model: 'qwen3.5-flash',
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
                data: { prompt_config: promptConfig(interactionMode), temperature: 0.3, max_tokens: 100 },
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
              limit: jest.fn().mockResolvedValue({ data: [{ id: 'message-1' }], error: null })
            })
          })
        })
      });
  };

  const mockModel = (contents: string[]) => {
    const fetchMock = jest.fn();
    contents.forEach((content, index) => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content }, finish_reason: 'stop' }] })
      });
      expect(index).toBeGreaterThanOrEqual(0);
    });
    global.fetch = fetchMock as any;
    return fetchMock;
  };

  const systemAndUserTurns = (fetchMock: jest.Mock) =>
    (fetchMock.mock.calls[0][0] as any, JSON.parse(fetchMock.mock.calls[0][1].body));

  it('repairs a discretionary single-Tutor decision into the pair and uses the multiagent budget', async () => {
    await mockSupabaseFor('multi_agent');
    const fetchMock = mockModel([
      decision('tutoring', 'scaffolding', 'Hello. What stands out to you about the alert?'),
      PAIR
    ]);

    const { generateTutorSuggestion } = await import('../aiService');
    const result = await generateTutorSuggestion('room-1', 'tutor-1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.decision).toMatchObject({ mode: 'multiagent', instruction: 'multiagent' });
    expect(result.suggestion).toContain('[agent:riley]');

    const firstRequest = JSON.parse(fetchMock.mock.calls[0][1].body);
    const repairRequest = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(firstRequest.max_tokens).toBe(240);
    expect(firstRequest.messages[1].content).toContain('"interaction_mode":"multi_agent"');
    expect(firstRequest.messages[0].content).toContain('MULTI-AGENT MODE (interaction_mode = multi_agent)');
    expect(repairRequest.messages[1].content).toContain('The learner enabled Multi-agent');
  });

  it.each([
    ['protective_instruction', decision('tutoring', 'protective_instruction', 'Do not open that link. Open the real app instead.')],
    ['explanation', decision('tutoring', 'explanation', 'A lock protects the connection, not the owner. Use the real app to check the alert.')],
    ['guard', decision('guard', null, 'Deliberately repeating that interrupts practice. Stop and make a task attempt.')]
  ])('accepts a %s turn without asking for the pair', async (_label, content) => {
    await mockSupabaseFor('multi_agent');
    const fetchMock = mockModel([content]);

    const { generateTutorSuggestion } = await import('../aiService');
    const result = await generateTutorSuggestion('room-1', 'tutor-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.decision?.mode).not.toBe('multiagent');
  });

  it('keeps the single-agent path untouched: no patch prompt, no multiagent decision allowed', async () => {
    await mockSupabaseFor('single_agent');
    const fetchMock = mockModel([decision('tutoring', 'scaffolding', 'What stands out in this alert?')]);

    const { generateTutorSuggestion } = await import('../aiService');
    const result = await generateTutorSuggestion('room-1', 'tutor-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.max_tokens).toBe(100);
    expect(request.messages[0].content).not.toContain('MULTI-AGENT MODE');
    expect(request.messages[1].content).toContain('"interaction_mode":"single_agent"');
  });
});
