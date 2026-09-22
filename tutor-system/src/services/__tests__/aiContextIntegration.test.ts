/**
 * Integration test for AI context generation
 * Tests the complete flow from room data to AI system prompts
 */

import { buildAIContextFromExistingData } from '../simplifiedAIContext';
import { generateSystemPrompt } from '../systemPrompts';
import { generateTutorSuggestion, getAIConfig } from '../aiService';

// Mock the supabase client
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(() => ({
            limit: jest.fn()
          }))
        }))
      }))
    }))
  }
}));

describe('AI Context Integration', () => {
  it('should build complete context with room posts and chat history', async () => {
    const roomId = 'integration-test-room';
    
    // Mock complete room and message data
    const { supabase } = require('../supabase');
    
    // Mock room data
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          single: jest.fn().mockResolvedValueOnce({
            data: {
              title: 'Nintendo Switch Scam Detection',
              description: 'Learn to identify fake Nintendo Switch giveaway scams',
              pre_populated_dialogue: {
                posts: [
                  { 
                    content: '🎮 CONGRATULATIONS! You\'ve been selected to receive a FREE Nintendo Switch! Click here to claim: http://nintendo-free.scam.com/claim' 
                  },
                  { 
                    content: 'Limited time offer! Only 24 hours left to claim your prize. Don\'t miss out!' 
                  }
                ]
              },
              created_at: '2024-01-15T14:00:00Z'
            },
            error: null
          })
        })
      })
    });

    // Mock messages data
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          order: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce({
              data: [
                {
                  content: 'Is this message legitimate?',
                  user_role: 'student',
                  created_at: '2024-01-15T14:05:00Z'
                },
                {
                  content: 'What warning signs do you notice in this message?',
                  user_role: 'tutor',
                  created_at: '2024-01-15T14:06:00Z'
                },
                {
                  content: 'The urgency and suspicious URL are major red flags',
                  user_role: 'student',
                  created_at: '2024-01-15T14:07:00Z'
                }
              ],
              error: null
            })
          })
        })
      })
    });

    const context = await buildAIContextFromExistingData(roomId);

    // Verify complete context structure
    expect(context).toHaveLength(6);

    // Check system message with room context
    const systemMessage = context[0];
    expect(systemMessage.role).toBe('system');
    expect(systemMessage.content).toContain('Nintendo Switch Scam Detection');
    expect(systemMessage.content).toContain('fake Nintendo Switch giveaway scams');

    // Check first phishing post
    const firstPost = context[1];
    expect(firstPost.role).toBe('user');
    expect(firstPost.content).toContain('Student shared for analysis');
    expect(firstPost.content).toContain('FREE Nintendo Switch');
    expect(firstPost.content).toContain('nintendo-free.scam.com');

    // Check second phishing post
    const secondPost = context[2];
    expect(secondPost.role).toBe('user');
    expect(secondPost.content).toContain('Limited time offer');
    expect(secondPost.content).toContain('24 hours left');

    // Check chat messages preserve conversation flow
    const studentQuestion = context[3];
    expect(studentQuestion.role).toBe('user');
    expect(studentQuestion.content).toContain('Student: Is this message legitimate?');

    const tutorQuestion = context[4];
    expect(tutorQuestion.role).toBe('assistant');
    expect(tutorQuestion.content).toContain('Tutor: What warning signs');

    const studentResponse = context[5];
    expect(studentResponse.role).toBe('user');
    expect(studentResponse.content).toContain('Student: The urgency and suspicious URL');

    console.log('✅ Complete AI Context Structure:');
    context.forEach((msg, i) => {
      console.log(`${i + 1}. [${msg.role}] ${msg.content.substring(0, 80)}...`);
    });
  });

  it('should generate system prompt with context-aware detection areas', () => {
    const config = {
      role: { role: 'high' as const },
      communication_style: {
        teen_slang: 'low' as const,
        conversational_markers: 'high' as const,
        uncertainty_expression: 'low' as const
      },
      cognitive_parameters: {
        concept_density: 'medium' as const,
        perspective_taking: 'high' as const,
        personal_examples: 'high' as const,
        consequence_highlighting: 'high' as const
      },
      emotional_parameters: {
        enthusiasm_level: 'medium' as const,
        validation_frequency: 'high' as const,
        mistake_normalization: 'high' as const,
        confidence_building: 'high' as const
      },
      detection_areas: [
        'Urgent language and pressure tactics',
        'Suspicious URLs and links',
        'Too-good-to-be-true offers',
        'Request for immediate action'
      ],
      verification_steps: [
        'Check the sender\'s email address carefully',
        'Hover over links to see actual destinations',
        'Look for spelling and grammar errors',
        'Verify with official sources independently'
      ]
    };

    const systemPrompt = generateSystemPrompt(config);

    // Verify system prompt includes context-specific detection areas
    expect(systemPrompt).toContain('Urgent language and pressure tactics');
    expect(systemPrompt).toContain('Suspicious URLs and links');
    expect(systemPrompt).toContain('Too-good-to-be-true offers');

    // Verify verification steps are included
    expect(systemPrompt).toContain('Check the sender\'s email address');
    expect(systemPrompt).toContain('Hover over links to see actual destinations');
    expect(systemPrompt).toContain('Look for spelling and grammar errors');

    console.log('✅ Generated System Prompt Length:', systemPrompt.length);
    console.log('✅ System Prompt Preview:', systemPrompt.substring(0, 200) + '...');
  });
});

// Additional utility test to verify context message formatting
describe('Context Message Formatting', () => {
  it('should properly format different message types with role prefixes', async () => {
    const { supabase } = require('../supabase');
    
    // Mock room data
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          single: jest.fn().mockResolvedValueOnce({
            data: {
              title: 'Message Formatting Test',
              description: 'Testing different message types',
              pre_populated_dialogue: null,
              created_at: '2024-01-15T15:00:00Z'
            },
            error: null
          })
        })
      })
    });

    // Mock various message types
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          order: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce({
              data: [
                {
                  content: 'Student question about phishing',
                  user_role: 'student',
                  created_at: '2024-01-15T15:01:00Z'
                },
                {
                  content: 'Tutor explanation of the concept',
                  user_role: 'tutor',
                  created_at: '2024-01-15T15:02:00Z'
                },
                {
                  content: 'Observer noting interesting point',
                  user_role: 'observer',
                  created_at: '2024-01-15T15:03:00Z'
                },
                {
                  content: 'AI-generated educational response',
                  user_role: 'tutor',
                  created_at: '2024-01-15T15:04:00Z'
                }
              ],
              error: null
            })
          })
        })
      })
    });

    const context = await buildAIContextFromExistingData('format-test-room');

    // Check message formatting
    expect(context[1].content).toContain('Student: Student question about phishing');
    expect(context[1].role).toBe('user');
    expect(context[2].content).toContain('Tutor: Tutor explanation of the concept');
    expect(context[2].role).toBe('assistant');
    expect(context[3].content).toContain('Observer: Observer noting interesting point');
    expect(context[3].role).toBe('user');
    expect(context[4].content).toContain('Tutor: AI-generated educational response');
    expect(context[4].role).toBe('assistant');

    console.log('✅ Message Formatting Verified:');
    context.slice(1).forEach((msg, i) => {
      console.log(`  ${i + 1}. ${msg.content}`);
    });
  });
});

describe('AI config loading edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads AI settings from room fields when no extended persisted config exists', async () => {
    const roomId = 'room-with-inline-ai-config';
    const { supabase } = require('../supabase');

    supabase.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: roomId,
                ai_assistant_enabled: true,
                ai_assistant_model: 'gpt-4o-mini',
                ai_assistant_prompt: 'Use the room-level tutor guidance.',
                created_at: '2026-03-20T00:00:00Z',
                updated_at: '2026-03-26T00:00:00Z'
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
                data: null,
                error: { code: 'PGRST116', message: 'No rows found' }
              })
            })
          })
        })
      });

    await expect(getAIConfig(roomId)).resolves.toMatchObject({
      id: roomId,
      room_id: roomId,
            model_name: 'qwen3.5-flash',
      system_prompt: 'Use the room-level tutor guidance.',
      is_active: true
    });
  });
});
