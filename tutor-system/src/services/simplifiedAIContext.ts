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
import { decodeAgentMessage } from './tutorDecisionContract';
import { DEFAULT_AI_MODEL } from './aiModels';

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
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('title, description, pre_populated_dialogue, created_at')
            .eq('id', roomId)
            .single();
        if (roomError) throw roomError;

        // Read the full discussion in pages, including rooms beyond the server row cap.
        const pageSize = 1000;
        const messages: Array<{
            id: string;
            content: string;
            user_role: string;
            response_mode: string | null;
            created_at: string;
        }> = [];
        let cursor: { id: string; created_at: string } | null = null;
        while (true) {
            const query = supabase
                .from('messages')
                .select('id, content, user_role, response_mode, created_at')
                .eq('room_id', roomId)
                .order('created_at', { ascending: true })
                .order('id', { ascending: true });
            // A cursor prevents earlier inserts/deletions from shifting later pages.
            if (cursor) {
                query.or(`created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`);
            }
            const { data: page, error } = await query.range(0, pageSize - 1);
            if (error) throw error;
            if (!page || page.length === 0) break;
            messages.push(...page);
            cursor = page[page.length - 1];
        }

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

        // Add the complete saved discussion.
        if (messages && messages.length > 0) {
            messages.forEach(msg => {
                // Character-tagged AI rows keep their identity; Riley is never learner evidence.
                const agent = decodeAgentMessage(msg);
                if (agent) {
                    context.push({
                        role: 'assistant',
                        content: `${agent.character === 'riley' ? 'Simulated AI participant Riley' : 'AI Tutor'}: ${agent.content}`,
                        timestamp: new Date(msg.created_at).getTime() / 1000
                    });
                    return;
                }

                const role = msg.user_role === 'tutor' ? 'assistant' : 'user';
                const prefix = msg.user_role === 'student' ? 'Student: ' :
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
        throw error;
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
            model_name: DEFAULT_AI_MODEL,
            system_prompt: 'You are a helpful AI assistant in a phishing training session.',
            temperature: 0.7,
            max_tokens: 150
        };
    }

    return {
        model_name: DEFAULT_AI_MODEL,
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
