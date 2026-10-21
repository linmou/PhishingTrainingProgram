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
import { DEFAULT_AI_MODEL } from './aiModels';
import { orderAssessmentMessages, parseAssessmentEvent, renderAssessment } from './assessmentRendering';
import type { AssessmentEvent, AssessmentOption } from '../types/assessment';
import { transferAssessmentService } from './transferAssessmentService';

const HISTORY_COLUMNS='id, content, user_role, user_id, parent_message_id, response_mode, character, persona_id, persona_name, created_at, assessment_id, assessment_options, assessment_selection_type, assessment_student_id, assessment_event';

/**
 * Build AI conversation context directly from existing tables
 * No need for separate ai_conversation_contexts table!
 *
 * Ecological note: pre_populated_dialogue is shown in the room UI even when
 * rows are not yet in `messages`. Include it so the model sees the same
 * discussion the tutor sees when pressing ✨ AI.
 */
export async function buildAIContextFromExistingData(roomId: string, expectedAssessmentResultIds: ReadonlyArray<string> = [], focusStudentId?:string): Promise<ConversationMessage[]> {
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
            character?: string | null;
            persona_id?: string | null;
            persona_name?: string | null;
            created_at: string;
            user_id: string;
            parent_message_id: string | null;
            assessment_id: string | null;
            assessment_options: AssessmentOption[] | null;
            assessment_selection_type: 'single' | 'multiple' | null;
            assessment_student_id: string | null;
            assessment_event: AssessmentEvent | null;
        }> = [];
        let cursor: { id: string; created_at: string } | null = null;
        while (true) {
            const query = supabase
                .from('messages')
                .select(HISTORY_COLUMNS)
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
            messages.push(...page.map(message => ({...message,assessment_event:parseAssessmentEvent(message.assessment_event)})));
            cursor = page[page.length - 1];
        }

        const learnerId=focusStudentId ?? [...messages].reverse().find(message=>message.user_role==='student')?.user_id;
        const latestQuestion=[...messages].reverse().find(message=>message.assessment_id &&
            (message.assessment_student_id===learnerId || (message.user_role==='student' && message.user_id===learnerId)));
        let requiredResultIds=[...expectedAssessmentResultIds];
        let handledAnswerIds: string[]=[];
        if (latestQuestion?.assessment_id) {
            // This common boundary applies to initial, focused and regenerated calls, including disabled transfer rooms.
            const review=await transferAssessmentService.readReview(roomId,latestQuestion.assessment_id);
            const readiness=review?.history_readiness;
            if (!readiness || !readiness.ready || !Array.isArray(readiness.result_message_ids) ||
                !Array.isArray(readiness.pending_answer_message_ids) || readiness.pending_answer_message_ids.length ||
                !Array.isArray(readiness.unavailable_assessment_ids) || readiness.unavailable_assessment_ids.length) {
                throw new Error('ASSESSMENT_RESULT_UNAVAILABLE: Assessment processing is incomplete.');
            }
            requiredResultIds=Array.from(new Set([...requiredResultIds,...readiness.result_message_ids]));
            handledAnswerIds=readiness.handled_answer_message_ids ?? [];
            // Trusted recovery may have committed results after the paged history read.
            const missingIds=requiredResultIds.filter(id=>!messages.some(message=>message.id===id));
            if (missingIds.length) {
                const {data,error}=await supabase.from('messages').select(HISTORY_COLUMNS).eq('room_id',roomId).in('id',missingIds);
                if (error) throw error;
                messages.push(...(data ?? []).map(message=>({...message,assessment_event:parseAssessmentEvent(message.assessment_event)})));
            }
        }
        if (requiredResultIds.some(id => !messages.some(message => message.id === id && message.assessment_event))) {
            throw new Error('ASSESSMENT_RESULT_UNAVAILABLE: Saved assessment results are missing from dialogue. Refresh and retry.');
        }
        const hasRecordedResult=(message:typeof messages[number])=>messages.some(candidate=>{
            const event=candidate.assessment_event;
            return event?.assessment_id===message.assessment_id && event.student_id===message.user_id &&
                ((event.kind==='result' && event.answer_message_id===message.id) || event.kind==='closure');
        });
        // Recheck the fetched snapshot: an answer may arrive after the readiness read.
        for (const message of messages) {
            if (message.response_mode==='assessment' && message.assessment_student_id===learnerId &&
                (!message.assessment_options || message.assessment_options.length!==4 || !message.assessment_selection_type)) {
                throw new Error('ASSESSMENT_RESULT_UNAVAILABLE: Assessment question options are incomplete.');
            }
            if (message.user_role==='student' && message.user_id===learnerId && message.assessment_id &&
                !handledAnswerIds.includes(message.id) && !hasRecordedResult(message)) {
                throw new Error('ASSESSMENT_RESULT_UNAVAILABLE: An assessment answer is still processing.');
            }
            const event=message.assessment_event;
            if (event && (!messages.some(candidate => candidate.id===event.question_message_id && candidate.assessment_options) ||
                (event.kind==='result' && !messages.some(candidate => candidate.id===event.answer_message_id && candidate.user_id===event.student_id)))) {
                throw new Error('ASSESSMENT_RESULT_UNAVAILABLE: Assessment dialogue is incomplete.');
            }
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
            const dialogue = room.pre_populated_dialogue;
            const normalizedDialogue = dialogue && !Array.isArray(dialogue) && Array.isArray(dialogue.posts)
                ? { posts: dialogue.posts.filter((post: any) =>
                    typeof (post?.content || post?.text || post?.message) === 'string' &&
                    (post.content || post.text || post.message).trim().length > 0) }
                : dialogue;
            const prePop = prePopulatedToContextMessages(
                normalizedDialogue as any,
                room.created_at
            );
            context.push(...prePop);
        }

        // Add the complete saved discussion.
        if (messages && messages.length > 0) {
            orderAssessmentMessages(messages).forEach(msg => {
                if (msg.response_mode==='assessment' && msg.assessment_student_id!==learnerId && !msg.assessment_options) return;
                if (msg.assessment_event) {
                    const event = msg.assessment_event;
                    context.push({role:'assistant',timestamp:new Date(msg.created_at).getTime()/1000,
                        content:`Assessment ${event.kind === 'closure' ? 'closure' : 'result'} [message ${msg.id}; assessment ${event.assessment_id}; learner ${event.student_id}; answer ${event.answer_message_id ?? 'none'}; attempt ${event.attempt_number ?? 'none'}; attempts remaining ${event.attempts_remaining}; lifecycle ${event.lifecycle}; progress deferred ${event.progress_deferred}]: ${msg.content}`});
                    return;
                }
                if (msg.assessment_options) {
                    if (!msg.assessment_selection_type || !msg.assessment_student_id || msg.assessment_options.length !== 4) {
                        throw new Error('ASSESSMENT_RESULT_UNAVAILABLE: Assessment question options are incomplete.');
                    }
                    context.push({role:'assistant',timestamp:new Date(msg.created_at).getTime()/1000,
                        content:`Tutor assessment [question ${msg.id}; assessment ${msg.assessment_id}; learner ${msg.assessment_student_id}]: ${renderAssessment({stem:msg.content,selection_type:msg.assessment_selection_type,options:msg.assessment_options})}`});
                    return;
                }
                if (msg.user_role === 'student' && msg.assessment_id) {
                    if (msg.user_id!==learnerId && !hasRecordedResult(msg)) return;
                    context.push({role:'user',timestamp:new Date(msg.created_at).getTime()/1000,
                        content:`${handledAnswerIds.includes(msg.id) ? 'Unscored assessment response' : 'Student'} [learner ${msg.user_id}; answer ${msg.id}; assessment ${msg.assessment_id}; question ${msg.parent_message_id}]: ${msg.content}`});
                    return;
                }

                const role = msg.user_role === 'tutor' ? 'assistant' : 'user';
                const prefix = msg.user_role === 'tutor' && msg.persona_name
                    ? `AI character ${msg.persona_name} [${msg.persona_id}; ${msg.character}]: `
                    : msg.user_role === 'student' ? 'Student: ' :
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
