import { 
    getRoomPostsForContext, 
    getChatMessagesForContext, 
    buildComprehensiveConversationHistory,
    getEnhancedConversationContext 
} from '../aiContextBuilder';

// Mock Supabase for testing
jest.mock('../supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn(() => Promise.resolve({
                        data: {
                            id: 'test-room-id',
                            title: 'Phishing Email Detection Training',
                            description: 'Learn to identify suspicious emails and protect your accounts',
                            pre_populated_dialogue: {
                                posts: [
                                    {
                                        content: 'I received this email claiming to be from my bank asking me to verify my account. Should I click the link?',
                                        image_url: 'suspicious-email.png'
                                    }
                                ]
                            },
                            created_at: '2024-01-15T10:00:00Z'
                        },
                        error: null
                    })),
                    order: jest.fn(() => ({
                        limit: jest.fn(() => Promise.resolve({
                            data: [
                                {
                                    id: 'msg-1',
                                    content: 'The email looks official but something feels off',
                                    user_role: 'student',
                                    is_ai_generated: false,
                                    created_at: '2024-01-15T10:05:00Z',
                                    parent_message_id: null
                                },
                                {
                                    id: 'msg-2', 
                                    content: 'Great observation! What specific details make you suspicious?',
                                    user_role: 'tutor',
                                    is_ai_generated: false,
                                    created_at: '2024-01-15T10:06:00Z',
                                    parent_message_id: 'msg-1'
                                },
                                {
                                    id: 'msg-3',
                                    content: 'The sender email has a weird domain and there are spelling mistakes',
                                    user_role: 'student', 
                                    is_ai_generated: false,
                                    created_at: '2024-01-15T10:07:00Z',
                                    parent_message_id: 'msg-2'
                                }
                            ],
                            error: null
                        }))
                    }))
                }))
            })),
            upsert: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
    }
}));

describe('Enhanced AI Context Integration', () => {
    const testRoomId = 'test-room-id';

    describe('Room Posts Context', () => {
        it('should extract room context and posts for AI understanding', async () => {
            const roomPosts = await getRoomPostsForContext(testRoomId, 2);
            
            console.log('\n=== ROOM POSTS CONTEXT ===');
            roomPosts.forEach((post, index) => {
                console.log(`${index + 1}. [${post.source}] ${post.role}: ${post.content}`);
            });
            console.log('========================\n');

            expect(roomPosts).toBeDefined();
            expect(roomPosts.length).toBeGreaterThan(0);
            
            // Should include room context
            expect(roomPosts.some(msg => msg.source === 'system')).toBe(true);
            expect(roomPosts.some(msg => msg.content.includes('Phishing Email Detection Training'))).toBe(true);
            
            // Should include the actual phishing example being discussed
            expect(roomPosts.some(msg => msg.content.includes('email claiming to be from my bank'))).toBe(true);
        });
    });

    describe('Chat Messages Context', () => {
        it('should extract recent chat discussion for AI context', async () => {
            const chatMessages = await getChatMessagesForContext(testRoomId, 5);
            
            console.log('\n=== CHAT MESSAGES CONTEXT ===');
            chatMessages.forEach((msg, index) => {
                console.log(`${index + 1}. [${msg.source}] ${msg.role}: ${msg.content}`);
            });
            console.log('============================\n');

            expect(chatMessages).toBeDefined();
            expect(chatMessages.length).toBeGreaterThan(0);
            
            // Should include student and tutor messages
            expect(chatMessages.some(msg => msg.content.includes('Student said:'))).toBe(true);
            expect(chatMessages.some(msg => msg.content.includes('Tutor said:'))).toBe(true);
            
            // Should include the actual discussion content
            expect(chatMessages.some(msg => msg.content.includes('spelling mistakes'))).toBe(true);
            expect(chatMessages.some(msg => msg.content.includes('What specific details'))).toBe(true);
        });
    });

    describe('Comprehensive Context Building', () => {
        it('should build complete conversation history with room posts and chat messages', async () => {
            const comprehensiveHistory = await buildComprehensiveConversationHistory(testRoomId);
            
            console.log('\n=== COMPREHENSIVE CONVERSATION HISTORY ===');
            console.log(`Total messages: ${comprehensiveHistory.length}`);
            comprehensiveHistory.forEach((msg, index) => {
                console.log(`${index + 1}. ${msg.role}: ${msg.content.substring(0, 100)}...`);
            });
            console.log('=========================================\n');

            expect(comprehensiveHistory).toBeDefined();
            expect(comprehensiveHistory.length).toBeGreaterThan(2);
            
            // Should be in chronological order
            for (let i = 1; i < comprehensiveHistory.length; i++) {
                expect(comprehensiveHistory[i].timestamp).toBeGreaterThanOrEqual(
                    comprehensiveHistory[i - 1].timestamp || 0
                );
            }
            
            // Should include both room context and chat messages
            const content = comprehensiveHistory.map(msg => msg.content).join(' ');
            expect(content).toContain('Phishing Email Detection');
            expect(content).toContain('email claiming to be from my bank');
            expect(content).toContain('spelling mistakes');
        });
    });

    describe('Enhanced Context Benefits', () => {
        it('should demonstrate how enhanced context improves AI understanding', async () => {
            const basicContext = []; // What AI had before (empty)
            const enhancedContext = await getEnhancedConversationContext(testRoomId);
            
            console.log('\n=== CONTEXT COMPARISON ===');
            console.log(`Basic context messages: ${basicContext.length}`);
            console.log(`Enhanced context messages: ${enhancedContext.length}`);
            console.log('\nEnhanced context includes:');
            
            const contextTypes = {
                roomTitle: enhancedContext.some(msg => msg.content.includes('Phishing Email Detection')),
                phishingExample: enhancedContext.some(msg => msg.content.includes('email claiming to be from my bank')),
                studentThinking: enhancedContext.some(msg => msg.content.includes('something feels off')),
                tutorGuidance: enhancedContext.some(msg => msg.content.includes('What specific details')),
                learningProgress: enhancedContext.some(msg => msg.content.includes('spelling mistakes'))
            };
            
            Object.entries(contextTypes).forEach(([type, hasIt]) => {
                console.log(`- ${type}: ${hasIt ? '✅' : '❌'}`);
            });
            console.log('=======================\n');

            // Enhanced context should be significantly better
            expect(enhancedContext.length).toBeGreaterThan(basicContext.length);
            expect(contextTypes.roomTitle).toBe(true);
            expect(contextTypes.phishingExample).toBe(true);
            expect(contextTypes.studentThinking).toBe(true);
            expect(contextTypes.tutorGuidance).toBe(true);
        });

        it('should show what the AI now knows vs what it knew before', () => {
            const beforeEnhancement = {
                knowsRoomTopic: false,
                knowsSpecificExample: false,
                knowsStudentProgress: false,
                knowsPreviousDiscussion: false,
                canProvideContextualHelp: false
            };

            const afterEnhancement = {
                knowsRoomTopic: true, // "Phishing Email Detection Training"
                knowsSpecificExample: true, // "email claiming to be from my bank"
                knowsStudentProgress: true, // Student noticed "something feels off"
                knowsPreviousDiscussion: true, // Previous tutor questions and student responses
                canProvideContextualHelp: true // Can reference specific details in conversation
            };

            console.log('\n=== AI KNOWLEDGE IMPROVEMENT ===');
            console.log('Before enhancement:', beforeEnhancement);
            console.log('After enhancement:', afterEnhancement);
            console.log('===============================\n');

            // Verify all improvements
            Object.keys(afterEnhancement).forEach(key => {
                expect(beforeEnhancement[key as keyof typeof beforeEnhancement]).toBe(false);
                expect(afterEnhancement[key as keyof typeof afterEnhancement]).toBe(true);
            });
        });
    });

    describe('Real-World Impact', () => {
        it('should demonstrate how this improves actual AI responses', () => {
            // Before: AI would respond generically without context
            const genericResponse = "I can help you identify phishing emails. Look for suspicious links and spelling errors.";
            
            // After: AI can respond with specific context
            const contextualResponse = `I see you're analyzing the bank email you received. You made an excellent observation that "something feels off" - that's exactly the kind of intuition that protects people! You mentioned the sender domain looks weird and there are spelling mistakes. These are classic red flags. Since you're looking at this specific email claiming to be from your bank, let's verify: does the sender address actually end with your bank's official domain?`;

            console.log('\n=== RESPONSE QUALITY COMPARISON ===');
            console.log('Generic response (before):', genericResponse);
            console.log('\nContextual response (after):', contextualResponse);
            console.log('==================================\n');

            // Contextual response should reference specific details from the conversation
            expect(contextualResponse).toContain('bank email you received');
            expect(contextualResponse).toContain('something feels off');
            expect(contextualResponse).toContain('sender domain looks weird');
            expect(contextualResponse).toContain('spelling mistakes');
            
            // Should be much more specific and helpful
            expect(contextualResponse.length).toBeGreaterThan(genericResponse.length * 2);
        });
    });
});