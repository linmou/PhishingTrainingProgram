#!/usr/bin/env node
/**
 * Test responsible for src/services/aiService.ts legacy-mode deprecation: saved Multi-agent configs
 * use the single-agent request path and model-produced Multi-agent decisions are rejected.
 */

export {};

jest.mock('../simplifiedAIContext', () => ({
  buildAIContextFromExistingData: jest.fn().mockResolvedValue([
    { role: 'user', content: 'Student: hi', timestamp: 1712016000 }
  ])
}));

jest.mock('../supabase', () => ({
  supabase: { from: jest.fn(), functions: { invoke: jest.fn() } }
}));

jest.mock('../checklistService', () => ({
  ChecklistService: { getChecklistByRoom: jest.fn().mockResolvedValue(null) }
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

describe('aiService deprecated Multi-agent mode', () => {
  const originalEnvironment = process.env.REACT_APP_ENVIRONMENT;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.REACT_APP_ENVIRONMENT = 'production';
  });

  afterAll(() => {
    process.env.REACT_APP_ENVIRONMENT = originalEnvironment;
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

  const mockModel = async (contents: string[]) => {
    const { supabase } = await import('../supabase');
    const invokeMock = supabase.functions.invoke as jest.Mock;
    contents.forEach((content, index) => {
      invokeMock.mockResolvedValueOnce({
        data: { content, finish_reason: 'stop', model: 'qwen3.5-flash' },
        error: null
      });
      expect(index).toBeGreaterThanOrEqual(0);
    });
    return invokeMock;
  };

  const requestBody = (invokeMock: jest.Mock, index: number) => invokeMock.mock.calls[index][1].body;

  it('uses the single-agent request contract for a room with a saved multi-agent config', async () => {
    await mockSupabaseFor('multi_agent');
    const fetchMock = await mockModel([decision('tutoring', 'scaffolding', 'Hello. What stands out to you about the alert?')]);

    const { generateTutorSuggestion } = await import('../aiService');
    const result = await generateTutorSuggestion('room-1', 'tutor-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.decision).toMatchObject({ mode: 'tutoring', instruction: 'scaffolding' });
    expect(result.suggestion).not.toContain('[agent:riley]');

    const firstRequest = requestBody(fetchMock, 0);
    expect(firstRequest.max_tokens).toBe(100);
    expect(firstRequest.messages[1].content).toContain('"interaction_mode":"single_agent"');
    expect(firstRequest.messages[0].content).not.toContain('MULTI-AGENT MODE');
  });

  it.each([
    ['protective_instruction', { mode: 'tutoring', instruction: 'protective_instruction' }, decision('tutoring', 'protective_instruction', 'Do not open that link. Open the real app instead.')],
    ['explanation', { mode: 'tutoring', instruction: 'explanation' }, decision('tutoring', 'explanation', 'A lock protects the connection, not the owner. Use the real app to check the alert.')],
    ['guard', { mode: 'guard', instruction: null }, decision('guard', null, 'Deliberately repeating that interrupts practice. Stop and make a task attempt.')]
  ])('accepts the exact %s exception without asking for a multiagent response', async (_label, expectedDecision, content) => {
    await mockSupabaseFor('multi_agent');
    const fetchMock = await mockModel([content]);

    const { generateTutorSuggestion } = await import('../aiService');
    const result = await generateTutorSuggestion('room-1', 'tutor-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.decision).toMatchObject(expectedDecision);
  });

  it('rejects a model-produced Multi-agent decision and repairs with the single-agent contract', async () => {
    await mockSupabaseFor('multi_agent');
    const fetchMock = await mockModel([
      PAIR,
      decision('tutoring', 'correction', 'A copied logo does not prove the sender.')
    ]);

    const { generateTutorSuggestion } = await import('../aiService');
    const result = await generateTutorSuggestion('room-1', 'tutor-1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ success: true, decision: { mode: 'tutoring', instruction: 'correction' } });
    const firstRequest = requestBody(fetchMock, 0);
    const repairRequest = requestBody(fetchMock, 1);
    expect(firstRequest.messages[0].content).not.toContain('MULTI-AGENT MODE');
    expect(firstRequest.messages[1].content).toContain('"interaction_mode":"single_agent"');
    expect(repairRequest.messages[0].content).not.toContain('MULTI-AGENT MODE');
    expect(repairRequest.messages[1].content).toContain('Return exactly one valid JSON object');
    expect(repairRequest.messages[1].content).not.toContain('The learner enabled Multi-agent');
  });

  it('accepts ordinary corrections for a room with a saved multi-agent config', async () => {
    await mockSupabaseFor('multi_agent');
    const fetchMock = await mockModel([decision('tutoring', 'correction', 'The sender name is not enough to prove this is real.')]);

    const { generateTutorSuggestion } = await import('../aiService');
    const result = await generateTutorSuggestion('room-1', 'tutor-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: true, decision: { mode: 'tutoring', instruction: 'correction' } });
  });

  it('keeps the single-agent path untouched: no patch prompt, no multiagent decision allowed', async () => {
    await mockSupabaseFor('single_agent');
    const fetchMock = await mockModel([decision('tutoring', 'scaffolding', 'What stands out in this alert?')]);

    const { generateTutorSuggestion } = await import('../aiService');
    const result = await generateTutorSuggestion('room-1', 'tutor-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    const request = requestBody(fetchMock, 0);
    expect(request.max_tokens).toBe(100);
    expect(request.messages[0].content).not.toContain('MULTI-AGENT MODE');
    expect(request.messages[1].content).toContain('"interaction_mode":"single_agent"');
  });
});
