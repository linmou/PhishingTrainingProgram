/**
 * Test suite for simplified AI context builder
 * Verifies that AI context includes room title, description, and previous comments
 */

import { buildAIContextFromExistingData } from '../simplifiedAIContext';
import { supabase } from '../supabase';

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

describe('buildAIContextFromExistingData', () => {
  const mockSupabase = supabase as jest.Mocked<typeof supabase>;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should include room title and description in AI context', async () => {
    const roomId = 'test-room-123';
    const mockRoomData = {
      title: 'Phishing Email Detection Training',
      description: 'Learn to identify suspicious emails and protect yourself from phishing attacks',
      pre_populated_dialogue: {
        posts: [
          { content: 'Suspicious email: "Click here to verify your account immediately!"' },
          { content: 'Another example: "You have won $1000! Claim now!"' }
        ]
      },
      created_at: '2024-01-15T10:00:00Z'
    };

    const mockMessages = [
      {
        content: 'What makes this email suspicious?',
        user_role: 'student',
        created_at: '2024-01-15T10:05:00Z'
      },
      {
        content: 'Great question! The urgency and suspicious link are red flags.',
        user_role: 'tutor', 
        created_at: '2024-01-15T10:06:00Z'
      },
      {
        content: 'I can help explain the key warning signs in this phishing attempt.',
        user_role: 'tutor',
        created_at: '2024-01-15T10:07:00Z'
      }
    ];

    // Mock the room query
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          single: jest.fn().mockResolvedValueOnce({
            data: mockRoomData,
            error: null
          })
        })
      })
    } as any);

    // Mock the messages query  
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          order: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce({
              data: mockMessages,
              error: null
            })
          })
        })
      })
    } as any);

    const context = await buildAIContextFromExistingData(roomId);

    // Verify the context structure
    expect(context).toHaveLength(6); // 1 system + 2 posts + 3 chat messages

    // Check system message includes room title and description
    const systemMessage = context[0];
    expect(systemMessage.role).toBe('system');
    expect(systemMessage.content).toContain('Phishing Email Detection Training');
    expect(systemMessage.content).toContain('Learn to identify suspicious emails');

    // Check that phishing example posts are included
    const firstPost = context[1];
    expect(firstPost.role).toBe('user');
    expect(firstPost.content).toContain('Student shared for analysis');
    expect(firstPost.content).toContain('Click here to verify your account');

    const secondPost = context[2];
    expect(secondPost.role).toBe('user');
    expect(secondPost.content).toContain('You have won $1000');

    // Check that chat messages are included with proper role mapping
    const studentMessage = context[3];
    expect(studentMessage.role).toBe('user');
    expect(studentMessage.content).toContain('Student: What makes this email suspicious?');

    const tutorMessage = context[4];
    expect(tutorMessage.role).toBe('assistant');
    expect(tutorMessage.content).toContain('Tutor: Great question!');

    const aiMessage = context[5];
    expect(aiMessage.role).toBe('assistant');
    expect(aiMessage.content).toContain('Tutor: I can help explain');
  });

  it('should handle room without pre_populated_dialogue', async () => {
    const roomId = 'simple-room-456';
    const mockRoomData = {
      title: 'Basic Phishing Training',
      description: 'Simple training session',
      pre_populated_dialogue: null,
      created_at: '2024-01-15T11:00:00Z'
    };

    const mockMessages = [
      {
        content: 'Hello, let\'s start the training',
        user_role: 'tutor',
        created_at: '2024-01-15T11:01:00Z'
      }
    ];

    // Mock room query
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          single: jest.fn().mockResolvedValueOnce({
            data: mockRoomData,
            error: null
          })
        })
      })
    } as any);

    // Mock messages query
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          order: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce({
              data: mockMessages,
              error: null
            })
          })
        })
      })
    } as any);

    const context = await buildAIContextFromExistingData(roomId);

    // Should have system message + 1 chat message
    expect(context).toHaveLength(2);
    
    const systemMessage = context[0];
    expect(systemMessage.content).toContain('Basic Phishing Training');
    expect(systemMessage.content).toContain('Simple training session');

    const chatMessage = context[1];
    expect(chatMessage.content).toContain('Tutor: Hello, let\'s start');
  });

  it('should handle empty messages gracefully', async () => {
    const roomId = 'empty-room-789';
    const mockRoomData = {
      title: 'Empty Training Room',
      description: 'No messages yet',
      pre_populated_dialogue: null,
      created_at: '2024-01-15T12:00:00Z'
    };

    // Mock room query
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          single: jest.fn().mockResolvedValueOnce({
            data: mockRoomData,
            error: null
          })
        })
      })
    } as any);

    // Mock empty messages query
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          order: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce({
              data: [],
              error: null
            })
          })
        })
      })
    } as any);

    const context = await buildAIContextFromExistingData(roomId);

    // Should only have system message
    expect(context).toHaveLength(1);
    
    const systemMessage = context[0];
    expect(systemMessage.content).toContain('Empty Training Room');
    expect(systemMessage.content).toContain('No messages yet');
  });

  it('should handle database errors gracefully', async () => {
    const roomId = 'error-room-000';

    // Mock room query with error
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          single: jest.fn().mockResolvedValueOnce({
            data: null,
            error: { message: 'Room not found', code: 'PGRST116' }
          })
        })
      })
    } as any);

    const context = await buildAIContextFromExistingData(roomId);

    // Should return empty context when room not found
    expect(context).toHaveLength(0);
  });

  it('should properly format pre_populated_dialogue posts', async () => {
    const roomId = 'dialogue-room-999';
    const mockRoomData = {
      title: 'Complex Phishing Scenario',
      description: 'Advanced training with multiple examples',
      pre_populated_dialogue: {
        posts: [
          { content: 'Email from bank: Your account will be closed unless you verify immediately' },
          { text: 'SMS message: Click link to claim your prize' }, // Different field name
          { content: null }, // Null content
          { other: 'Invalid post structure' } // No content/text field
        ]
      },
      created_at: '2024-01-15T13:00:00Z'
    };

    // Mock room query
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          single: jest.fn().mockResolvedValueOnce({
            data: mockRoomData,
            error: null
          })
        })
      })
    } as any);

    // Mock empty messages query
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          order: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce({
              data: [],
              error: null
            })
          })
        })
      })
    } as any);

    const context = await buildAIContextFromExistingData(roomId);

    // Should have system message + 2 valid posts (only first 2 with content)
    expect(context).toHaveLength(3);

    const firstPost = context[1];
    expect(firstPost.content).toContain('Your account will be closed');

    const secondPost = context[2];
    expect(secondPost.content).toContain('Click link to claim your prize');
  });
});
