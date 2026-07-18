/**
 * Simplified AI Context Builder
 * Uses existing tables (rooms, messages) instead of separate AI context storage
 */

import { supabase } from './supabase';
import { ConversationMessage } from '../types';
import {
    formatRoomScenarioContext,
    prePopulatedToContextMessages
} from './ecologicalTutorCall';

/**
 * Build AI conversation context directly from existing tables
 * No need for separate ai_conversation_contexts table!
 *
 * Ecological note: pre_populated_dialogue is shown in the room UI even when
 * rows are not yet in `messages`. Include it so the model sees the same
 * discussion the tutor sees when pressing ✨ AI.
 */
export async function buildAIContextFromExistingData(roomId: string): Promise<ConversationMessage[]> {
    try {
        console.log('🔄 Building AI context from existing room and message data');

        // Get room context (the phishing scenario being discussed)
        const { data: room } = await supabase
            .from('rooms')
            .select('title, description, pre_populated_dialogue, created_at')
            .eq('id', roomId)
            .single();

        // Get recent chat messages (the actual discussion)
        const { data: messages } = await supabase
            .from('messages')
            .select('content, user_role, is_ai_generated, created_at')
            .eq('room_id', roomId)
            .order('created_at', { ascending: true })
            .limit(15); // Last 15 messages for context

        const context: ConversationMessage[] = [];

        // Add room context as system message
        if (room) {
            context.push({
                role: 'system',
                content: `Training scenario: ${formatRoomScenarioContext(room.title, room.description)}`,
                timestamp: new Date(room.created_at).getTime() / 1000
            });

            // Pre-populated discussion (array or legacy {posts}) — same as UI
            const prePop = prePopulatedToContextMessages(
                room.pre_populated_dialogue as any,
                room.created_at
            );
            context.push(...prePop);
        }

        // Add recent chat messages
        if (messages && messages.length > 0) {
            messages.forEach(msg => {
                const role = msg.is_ai_generated ? 'assistant' : 'user';
                const prefix = msg.is_ai_generated ? 'AI suggested: ' : 
                              msg.user_role === 'student' ? 'Student: ' :
                              msg.user_role === 'tutor' ? 'Tutor: ' : 'Observer: ';
                
                context.push({
                    role,
                    content: prefix + msg.content,
                    timestamp: new Date(msg.created_at).getTime() / 1000
                });
            });
        }

        console.log(`✅ Built AI context with ${context.length} messages from existing data`);
        return context;

    } catch (error) {
        console.error('❌ Error building AI context from existing data:', error);
        return [];
    }
}

/**
 * Get AI configuration (keep this - tutors need to set AI parameters)
 */
export async function getAIConfigFromRoom(roomId: string) {
    const { data: room } = await supabase
        .from('rooms')
        .select('ai_assistant_enabled, ai_assistant_model, ai_assistant_prompt')
        .eq('id', roomId)
        .single();

    if (!room?.ai_assistant_enabled) {
        return {
            model_name: 'gpt-4o-mini',
            system_prompt: 'You are a helpful AI assistant in a phishing training session.',
            temperature: 0.7,
            max_tokens: 150
        };
    }

    return {
        model_name: room.ai_assistant_model || 'gpt-4o-mini',
        system_prompt: room.ai_assistant_prompt || 'You are a helpful AI assistant in a phishing training session.',
        temperature: 0.7,
        max_tokens: 150
    };
}

/**
 * Simple approach: No separate conversation storage needed!
 * Just query existing data when generating AI responses
 */
export async function generateAIResponseWithExistingData(
    roomId: string,
    userMessage: string,
    userId: string
) {
    // 1. Get AI config from room fields (or default)
    const aiConfig = await getAIConfigFromRoom(roomId);
    
    // 2. Build context from existing rooms + messages tables  
    const conversationHistory = await buildAIContextFromExistingData(roomId);
    
    // 3. Generate AI response using existing aiService
    // (No need to store conversation separately - it's already in messages table!)
    
    return {
        aiConfig,
        conversationHistory,
        context_source: 'existing_tables' // No separate AI tables needed!
    };
}
