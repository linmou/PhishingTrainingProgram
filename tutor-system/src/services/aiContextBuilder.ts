/**
 * Enhanced AI Context Builder
 * Builds comprehensive conversation history including room posts, comments, and chat messages
 */

import { supabase } from './supabase';
import { ConversationMessage } from '../types';

// Enhanced conversation message with source tracking
export interface EnhancedConversationMessage extends ConversationMessage {
    source: 'room_post' | 'room_comment' | 'chat_message' | 'system';
    user_role?: 'student' | 'tutor' | 'observer';
    parent_id?: string; // For linking comments to posts
    created_at?: string;
}

/**
 * Get room posts for AI context (the actual phishing examples being discussed)
 */
export async function getRoomPostsForContext(roomId: string, limit: number = 3): Promise<EnhancedConversationMessage[]> {
    try {
        const { data: posts, error } = await supabase
            .from('rooms')
            .select(`
                id,
                title,
                description,
                image_url,
                pre_populated_dialogue,
                tutor_id,
                created_at
            `)
            .eq('id', roomId)
            .single();

        if (error) {
            console.warn('Failed to get room posts for context:', error);
            return [];
        }

        const contextMessages: EnhancedConversationMessage[] = [];

        // Add room context as system message
        if (posts.title && posts.description) {
            contextMessages.push({
                role: 'system',
                content: `Room context: "${posts.title}" - ${posts.description}`,
                source: 'system',
                timestamp: new Date(posts.created_at).getTime() / 1000,
                created_at: posts.created_at
            });
        }

        // Add pre-populated dialogue if it exists (the main phishing example)
        if (posts.pre_populated_dialogue) {
            try {
                const dialogue = posts.pre_populated_dialogue as any;
                if (dialogue.posts && Array.isArray(dialogue.posts)) {
                    dialogue.posts.slice(0, limit).forEach((post: any, index: number) => {
                        contextMessages.push({
                            role: 'user',
                            content: `Student posted: ${post.content || post.text || 'Shared content for analysis'}`,
                            source: 'room_post',
                            user_role: 'student',
                            timestamp: new Date(posts.created_at).getTime() / 1000 + index,
                            created_at: posts.created_at,
                            parent_id: roomId
                        });
                    });
                }
            } catch (e) {
                console.warn('Failed to parse pre-populated dialogue:', e);
            }
        }

        return contextMessages;
    } catch (error) {
        console.warn('Error getting room posts for context:', error);
        return [];
    }
}

/**
 * Get recent chat messages for AI context (the discussion happening in the room)
 */
export async function getChatMessagesForContext(roomId: string, limit: number = 10): Promise<EnhancedConversationMessage[]> {
    try {
        const { data: messages, error } = await supabase
            .from('messages')
            .select(`
                id,
                content,
                user_role,
                is_ai_generated,
                created_at,
                parent_message_id
            `)
            .eq('room_id', roomId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.warn('Failed to get chat messages for context:', error);
            return [];
        }

        if (!messages || messages.length === 0) {
            return [];
        }

        // Convert to enhanced conversation messages, in chronological order
        return messages
            .reverse() // Put in chronological order (oldest first)
            .map(msg => ({
                role: msg.is_ai_generated ? 'assistant' : 'user',
                content: msg.is_ai_generated 
                    ? `AI suggested: ${msg.content}`
                    : `${msg.user_role === 'student' ? 'Student' : msg.user_role === 'tutor' ? 'Tutor' : 'Observer'} said: ${msg.content}`,
                source: 'chat_message' as const,
                user_role: msg.user_role as 'student' | 'tutor' | 'observer',
                timestamp: new Date(msg.created_at).getTime() / 1000,
                created_at: msg.created_at,
                parent_id: msg.parent_message_id
            }));
    } catch (error) {
        console.warn('Error getting chat messages for context:', error);
        return [];
    }
}

/**
 * Build comprehensive conversation history including room posts, comments, and chat messages
 */
export async function buildComprehensiveConversationHistory(roomId: string): Promise<ConversationMessage[]> {
    try {
        console.log('🔄 Building comprehensive conversation history for room:', roomId);

        // Get all context sources
        const [roomPosts, chatMessages] = await Promise.all([
            getRoomPostsForContext(roomId, 2), // Get main room context (title, description, posts)
            getChatMessagesForContext(roomId, 8) // Get recent chat discussion
        ]);

        // Combine all messages and sort by timestamp
        const allMessages: EnhancedConversationMessage[] = [
            ...roomPosts,
            ...chatMessages
        ].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        console.log(`✅ Built conversation history with ${allMessages.length} messages:`, {
            roomPosts: roomPosts.length,
            chatMessages: chatMessages.length
        });

        // Convert to standard ConversationMessage format for AI
        const conversationHistory: ConversationMessage[] = allMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp || Date.now() / 1000
        }));

        // Store the enhanced conversation history for future use
        await storeConversationHistory(roomId, conversationHistory);

        return conversationHistory;
    } catch (error) {
        console.error('❌ Error building comprehensive conversation history:', error);
        return [];
    }
}

/**
 * Store conversation history in the database (now that RLS is fixed)
 */
export async function storeConversationHistory(roomId: string, conversationHistory: ConversationMessage[]): Promise<void> {
    try {
        const { error } = await supabase
            .from('ai_conversation_contexts')
            .upsert({
                room_id: roomId,
                conversation_history: conversationHistory,
                last_updated: new Date().toISOString()
            }, {
                onConflict: 'room_id'
            });

        if (error) {
            console.warn('Failed to store conversation history:', error);
        } else {
            console.log('✅ Stored conversation history for room:', roomId);
        }
    } catch (error) {
        console.warn('Error storing conversation history:', error);
    }
}

/**
 * Get enhanced conversation context (with fixed RLS)
 */
export async function getEnhancedConversationContext(roomId: string): Promise<ConversationMessage[]> {
    try {
        console.log('🔄 Getting enhanced conversation context for room:', roomId);

        // First try to get existing stored conversation history
        const { data, error } = await supabase
            .from('ai_conversation_contexts')
            .select('conversation_history, last_updated')
            .eq('room_id', roomId)
            .single();

        if (!error && data && data.conversation_history) {
            const storedHistory = data.conversation_history as ConversationMessage[];
            const lastUpdated = new Date(data.last_updated);
            const now = new Date();
            const minutesSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);

            // If the stored history is less than 5 minutes old, use it
            if (minutesSinceUpdate < 5 && storedHistory.length > 0) {
                console.log('✅ Using cached conversation history');
                return storedHistory;
            }
        }

        // Otherwise, build fresh comprehensive history
        console.log('🔄 Building fresh conversation history');
        return await buildComprehensiveConversationHistory(roomId);
    } catch (error) {
        console.error('❌ Error getting enhanced conversation context:', error);
        // Fallback to building fresh history
        return await buildComprehensiveConversationHistory(roomId);
    }
}

/**
 * Add message to enhanced conversation context
 */
export async function addToEnhancedConversationContext(
    roomId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    source: 'chat_message' | 'ai_response' = 'chat_message'
): Promise<void> {
    try {
        const newMessage: ConversationMessage = {
            role,
            content,
            timestamp: Date.now() / 1000
        };

        // Get current conversation history
        const currentHistory = await getEnhancedConversationContext(roomId);
        
        // Add new message
        const updatedHistory = [...currentHistory, newMessage];
        
        // Keep only the last 20 messages to prevent context from getting too long
        const trimmedHistory = updatedHistory.slice(-20);
        
        // Store updated history
        await storeConversationHistory(roomId, trimmedHistory);
        
        console.log('✅ Added message to enhanced conversation context');
    } catch (error) {
        console.error('❌ Error adding to enhanced conversation context:', error);
    }
}