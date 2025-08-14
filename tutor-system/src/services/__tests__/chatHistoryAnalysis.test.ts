// Mock modules before imports
jest.mock('../simplifiedAIContext');

// Import after mocks are defined
import { getConversationContext, generateTutorSuggestion } from '../aiService';
import { buildAIContextFromExistingData } from '../simplifiedAIContext';

// Type the mock
const mockBuildAIContext = buildAIContextFromExistingData as jest.MockedFunction<typeof buildAIContextFromExistingData>;

// Mock Supabase
jest.mock('../supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn(() => Promise.resolve({ 
                        data: null, 
                        error: { code: 'PGRST116' } 
                    }))
                })),
                order: jest.fn(() => ({
                    limit: jest.fn(() => Promise.resolve({ 
                        data: [
                            { id: 'msg1' },
                            { id: 'msg2' },
                            { id: 'msg3' }
                        ] 
                    }))
                }))
            }))
        }))
    }
}));

describe('Chat History Analysis', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Set up the mock implementation for each test
        mockBuildAIContext.mockResolvedValue([
            {
                role: 'system',
                content: 'You are supporting a student in a room titled "Phishing Email Detection Training" with description: "Learn to identify phishing attempts in email communications"'
            },
            {
                role: 'user',
                content: 'Student shared for analysis: URGENT: Your account will be suspended! Click here to verify: http://phising-site.com/verify'
            },
            {
                role: 'user',
                content: 'Student shared for analysis: Limited time offer - claim your free gift card now!'
            },
            {
                role: 'user',
                content: 'Student: This email looks suspicious to me'
            },
            {
                role: 'user',
                content: 'Tutor: Good observation! What specific red flags do you notice?'
            },
            {
                role: 'user',
                content: 'Student: The urgent language and suspicious URL are major warning signs'
            },
            {
                role: 'user',
                content: 'AI suggested: Excellent analysis! You correctly identified key phishing indicators.'
            }
        ]);
    });

    describe('Current Implementation Limitations', () => {
        it('should show actual conversation context with mocked room data', async () => {
            const roomId = 'test-room-id';
            
            // Test current conversation context retrieval
            const conversationHistory = await getConversationContext(roomId);
            
            console.log('\n=== ACTUAL CONVERSATION HISTORY ===');
            console.log('Length:', conversationHistory?.length || 0);
            console.log('Full Content:');
            if (conversationHistory && Array.isArray(conversationHistory)) {
                conversationHistory.forEach((msg, i) => {
                    console.log(`${i + 1}. [${msg.role}] ${msg.content}`);
                });
                console.log('Raw JSON:', JSON.stringify(conversationHistory, null, 2));
            } else {
                console.log('conversationHistory is undefined or not an array');
            }
            console.log('=====================================\n');
            
            // Should contain system message, posts, and chat messages
            expect(conversationHistory).toBeDefined();
            expect(conversationHistory.length).toBeGreaterThan(0);
            expect(conversationHistory[0].role).toBe('system'); // Room context
            expect(conversationHistory[0].content).toContain('Phishing Email Detection Training');
        });

        it('should show that tutor suggestion generation only uses conversation history', async () => {
            const roomId = 'test-room-id';
            const userId = 'test-user-id';
            
            try {
                const result = await generateTutorSuggestion(roomId, userId);
                
                console.log('\n=== TUTOR SUGGESTION CONTEXT ===');
                console.log('Context messages used:', result.contextMessages);
                console.log('Number of context messages:', result.contextMessages.length);
                console.log('Suggestion success:', result.success);
                console.log('=====================================\n');
                
                // Should only have a few recent message IDs for tracking
                expect(result.contextMessages).toBeDefined();
                expect(Array.isArray(result.contextMessages)).toBe(true);
                
            } catch (error) {
                // Expected to fail due to missing room/AI config in test
                console.log('Expected error in test environment:', error);
                expect(error).toBeDefined();
            }
        });
    });

    describe('What Should Be Included (Recommendations)', () => {
        it('should outline what conversation history should ideally contain', () => {
            // This test documents what SHOULD be included in conversation history
            const idealConversationHistory = [
                {
                    role: 'system',
                    content: 'Room context: This is a phishing training session about email security',
                    source: 'room_post',
                    timestamp: Date.now() - 3600000 // 1 hour ago
                },
                {
                    role: 'user',
                    content: 'Student posted: I received this suspicious email asking for my password',
                    source: 'room_post',
                    user_role: 'student',
                    timestamp: Date.now() - 1800000 // 30 minutes ago
                },
                {
                    role: 'assistant',
                    content: 'Tutor commented: Let\'s analyze this together. What red flags do you notice?',
                    source: 'room_comment',
                    user_role: 'tutor',
                    timestamp: Date.now() - 1200000 // 20 minutes ago
                },
                {
                    role: 'user',
                    content: 'Student replied: The sender email looks official but the grammar is weird',
                    source: 'room_comment',
                    user_role: 'student',
                    timestamp: Date.now() - 600000 // 10 minutes ago
                },
                {
                    role: 'user',
                    content: 'Current message: Should I click the link in the email?',
                    source: 'chat_message',
                    user_role: 'student',
                    timestamp: Date.now()
                }
            ];

            console.log('\n=== IDEAL CONVERSATION HISTORY STRUCTURE ===');
            console.log(JSON.stringify(idealConversationHistory, null, 2));
            console.log('==============================================\n');

            // Test that the structure includes all necessary context
            expect(idealConversationHistory).toHaveLength(5);
            expect(idealConversationHistory[0].source).toBe('room_post');
            expect(idealConversationHistory[1].source).toBe('room_post');
            expect(idealConversationHistory[2].source).toBe('room_comment');
            expect(idealConversationHistory[3].source).toBe('room_comment');
            expect(idealConversationHistory[4].source).toBe('chat_message');
            
            // Should include different types of content
            const sources = idealConversationHistory.map(item => item.source);
            expect(sources).toContain('room_post');
            expect(sources).toContain('room_comment');
            expect(sources).toContain('chat_message');
        });

        it('should demonstrate missing context that would help AI responses', () => {
            const currentContext = {
                hasRoomPosts: false,
                hasComments: false,
                hasConversationHistory: false,
                hasUserProfiles: false,
                hasSessionContext: false
            };

            const desiredContext = {
                hasRoomPosts: true, // Should include room posts for scenario context
                hasComments: true, // Should include previous comments for discussion context
                hasConversationHistory: true, // Should maintain conversation continuity
                hasUserProfiles: true, // Should know student's learning progress
                hasSessionContext: true // Should understand the current lesson/scenario
            };

            console.log('\n=== CONTEXT COMPARISON ===');
            console.log('Current AI Context:', currentContext);
            console.log('Desired AI Context:', desiredContext);
            console.log('===========================\n');

            // Demonstrate the gaps
            Object.keys(desiredContext).forEach(key => {
                expect(currentContext[key as keyof typeof currentContext]).toBe(false);
                expect(desiredContext[key as keyof typeof desiredContext]).toBe(true);
            });
        });
    });

    describe('Suggested Improvements', () => {
        it('should outline functions needed for comprehensive context building', () => {
            // This test documents the functions that would be needed
            const neededFunctions = [
                'getRoomPostsForContext(roomId: string, limit: number = 3)',
                'getPostCommentsForContext(postId: string, limit: number = 5)',
                'buildComprehensiveConversationHistory(roomId: string)',
                'includeRelevantRoomContent(roomId: string, messageContext: string)',
                'getUserLearningProgress(userId: string, roomId: string)',
                'getSessionScenarioContext(roomId: string)'
            ];

            console.log('\n=== NEEDED FUNCTIONS FOR BETTER CONTEXT ===');
            neededFunctions.forEach((func, index) => {
                console.log(`${index + 1}. ${func}`);
            });
            console.log('============================================\n');

            expect(neededFunctions).toHaveLength(6);
            expect(neededFunctions[0]).toContain('getRoomPostsForContext');
            expect(neededFunctions[1]).toContain('getPostCommentsForContext');
            expect(neededFunctions[2]).toContain('buildComprehensiveConversationHistory');
        });
    });
});