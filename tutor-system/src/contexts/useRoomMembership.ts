import { useCallback, useEffect, useRef, useState } from 'react';
import type { AIAssistantConfig, AIInteraction, Message, Room, User, UserRole } from '../types';
import { supabase, validateRoomPassword } from '../services/supabase';
import { transferAssessmentService } from '../services/transferAssessmentService';
import { readRoomMessagePages } from './roomMessageSync';
import {
    answerLifecycleFromProcessed, mergeRoomMessages, projectRoomMessage,
    readAssessmentId, withAnswerLifecycle, preferredQuestionLifecycle,
} from './transferAssessmentUiAdapter';
import type { RoomMessageView } from './transferAssessmentUiAdapter';

export function normalizeRoom(room: Room): Room {
    if (!room.guard_mode) return room;
    return {
        ...room,
        guard_mode_changed_at: room.guard_mode_changed_at || null,
        guard_mode_change_source: room.guard_mode_change_source || null,
    };
}

// Owns room membership, history hydration and cancellation; command owners retain their state.
export function useRoomMembership(
    user: User | null,
    setAIInteractions: React.Dispatch<React.SetStateAction<AIInteraction[]>>,
    setAiConfig: React.Dispatch<React.SetStateAction<AIAssistantConfig | null>>,
) {
    const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [participants, setParticipants] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const activeRoomId = useRef<string | null>(null);
    activeRoomId.current = currentRoom?.id ?? null;
    const joinEpoch = useRef(0);
    const joinController = useRef<AbortController | null>(null);
    const joinRealtimeIds = useRef(new Set<string>());
    useEffect(() => () => { joinEpoch.current += 1; joinController.current?.abort(); }, []);
    // Stable function to add display names and avatars to messages
    const addDisplayNameToMessage = useCallback((message: any, participantsList?: User[]): Message => {
        // Find the user from participants list
        const messageUser = participantsList?.find(p => p.id === message.user_id);

        // For prepopulated messages, preserve the existing display_name
        if (message.user_id === 'system' && message.display_name) {
            return {
                ...message,
                // Keep the original display_name from prepopulated data
                display_name: message.display_name,
                avatar_url: message.avatar_url || null
            };
        }

        const isGuardMessage = message.response_mode === 'guard';
        return {
            ...message,
            display_name: message.persona_name || (isGuardMessage ? 'Security Supervisor' : message.user_id === user?.id ? (user?.display_name || 'User') :
                         messageUser?.display_name ||
                         (message.user_role === 'tutor' ? 'Tutor' :
                          message.user_role === 'student' ? 'Student' : 'Observer')),
            avatar_url: message.persona_avatar || (isGuardMessage ? null : message.user_id === user?.id ? user?.avatar_url : messageUser?.avatar_url)
        };
    }, [user?.id, user?.display_name, user?.avatar_url]);

    // Update participants list when current user changes (e.g., avatar update)
    useEffect(() => {
        if (!currentRoom || !user) return;

        // Update the current user in participants list
        setParticipants(prev => {
            const updatedParticipants = prev.map(p =>
                p.id === user.id ? { ...p, ...user } : p
            );

            // If user is not in participants, add them
            if (!updatedParticipants.some(p => p.id === user.id)) {
                updatedParticipants.push(user);
            }

            return updatedParticipants;
        });
    }, [user, currentRoom]);

    // Re-enrich existing messages when participants change (e.g., when user updates avatar)
    useEffect(() => {
        if (!currentRoom || !participants.length) return;

        // Re-enrich all existing messages with updated participant info
        setMessages(prevMessages =>
            prevMessages.map(msg => addDisplayNameToMessage(msg, participants))
        );
    }, [participants, currentRoom, addDisplayNameToMessage]);

    const createRoom = async (title: string, description?: string, imageFile?: File): Promise<void> => {
        if (!user || user.current_role !== 'tutor') {
            throw new Error('Only tutors can create rooms');
        }

        setLoading(true);
        try {
            let imageUrl = null;

            // Upload image if provided
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                const { data, error: uploadError } = await supabase.storage
                    .from('room-images')
                    .upload(fileName, imageFile);

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('room-images')
                    .getPublicUrl(data.path);

                imageUrl = urlData.publicUrl;
            }

            // Create room
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .insert({
                    tutor_id: user.id,
                    title,
                    description,
                    image_url: imageUrl
                })
                .select()
                .single();

            if (roomError) throw roomError;

            setCurrentRoom(normalizeRoom(roomData));
        } finally {
            setLoading(false);
        }
    };

    const joinRoom = useCallback(async (roomId: string, password?: string): Promise<void> => {
        const epoch = ++joinEpoch.current;
        joinRealtimeIds.current = new Set();
        joinController.current?.abort();
        const controller = new AbortController();
        joinController.current = controller;
        setLoading(true);
        try {
            // Get room details
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .select('*')
                .eq('id', roomId)
                .eq('is_active', true)
                .single();

            if (roomError) throw roomError;

            // Validate password if room is password protected
            if (roomData.password) {
                // Skip password validation if current user is the room owner (tutor)
                if (user?.id === roomData.tutor_id) {
                    console.log('🔓 RoomContext: Room owner bypassing password validation');
                } else {
                    if (!password) {
                        throw new Error('This room is password protected. Please enter the password.');
                    }

                    const validation = await validateRoomPassword(roomId, password);
                    if (!validation.success) {
                        throw new Error(validation.message);
                    }
                }
            }

            // Get existing messages
            const messagesData: Record<string, any>[] = [];
            await readRoomMessagePages(roomId, controller.signal, rows => messagesData.push(...rows));
            if (controller.signal.aborted) return;

            // Process pre-populated dialogue if it exists
            let prePopulatedMessages: Message[] = [];
            if (roomData.pre_populated_dialogue && Array.isArray(roomData.pre_populated_dialogue)) {
                console.log('🔄 Processing pre-populated dialogue:', roomData.pre_populated_dialogue);

                prePopulatedMessages = roomData.pre_populated_dialogue.map((item: any, index: number) => {
                    // Create a timestamp that's earlier than any real messages
                    const baseTimestamp = new Date(roomData.created_at);
                    baseTimestamp.setSeconds(baseTimestamp.getSeconds() + index);

                    return {
                        id: `prepop-${roomId}-${index}`,
                        room_id: roomId,
                        user_id: 'system', // Use system as user_id for pre-populated messages
                        content: item.message,
                        user_role: item.role as UserRole,
                        ai_model_used: null,
                        ai_response_time_ms: null,
                        parent_message_id: null,
                        created_at: baseTimestamp.toISOString(),
                        display_name: item.user_name,
                        persona_id: item.persona_id || null,
                        persona_name: item.user_name,
                        persona_avatar: item.avatar_url || null,
                        avatar_url: item.avatar_url || null
                    } as Message;
                });

                console.log('✅ Created pre-populated messages:', prePopulatedMessages);
            }

            // Get unique user IDs from messages and room
            const userIds = new Set<string>();
            if (roomData.tutor_id) userIds.add(roomData.tutor_id);
            if (messagesData) {
                messagesData.forEach(msg => userIds.add(msg.user_id));
            }

            // Always include current user if they're not already in the list
            if (user?.id) {
                userIds.add(user.id);
            }

            // Fetch user details for all participants
            const { data: participantsData, error: participantsError } = await supabase
                .from('users')
                .select('*')
                .in('id', Array.from(userIds));

            if (participantsError) throw participantsError;

            // Add display_name and avatar_url to existing messages, projecting each stored row
            // onto the allowlisted message view first.
            const messagesWithDisplayName = (messagesData || []).map(msg =>
                addDisplayNameToMessage(projectRoomMessage(msg), participantsData || []));

            // Combine pre-populated messages with existing messages.
            const allMessages = mergeRoomMessages([], [...prePopulatedMessages, ...messagesWithDisplayName]);

            // Re-read the server's idempotent result for this learner's persisted assessment
            // answers so lifecycle feedback is available after reload or reconnect.
            if (user?.current_role === 'student' && user.id) {
                for (const answer of allMessages) {
                    if (answer.user_id !== user.id || answer.user_role !== 'student' || !answer.parent_message_id) {
                        continue;
                    }

                    const questionIndex = allMessages.findIndex(message => {
                        const publicQuestion = (message as Partial<RoomMessageView>).publicQuestion;
                        return (
                            message.id === answer.parent_message_id &&
                            publicQuestion?.studentId === user.id &&
                            Boolean(publicQuestion.id)
                        );
                    });
                    if (questionIndex < 0) continue;

                    const question = allMessages[questionIndex] as RoomMessageView;
                    const assessmentId = question.publicQuestion?.id;
                    if (!assessmentId || readAssessmentId(answer) !== assessmentId) continue;

                    try {
                        const processed = await transferAssessmentService.processMessage(answer.id, assessmentId);
                        if (processed.message_id !== answer.id || processed.assessment_id !== assessmentId) {
                            continue;
                        }

                        const lifecycle = answerLifecycleFromProcessed(processed);
                        const answerIndex = allMessages.findIndex(message => message.id === answer.id);
                        if (answerIndex >= 0) {
                            allMessages[answerIndex] = withAnswerLifecycle(
                                allMessages[answerIndex] as RoomMessageView,
                                lifecycle
                            );
                        }
                        allMessages[questionIndex] = withAnswerLifecycle(
                            question,
                            preferredQuestionLifecycle(question, lifecycle)
                        );
                        if (processed.result_message && !allMessages.some(message => message.id===processed.result_message?.id)) {
                            allMessages.push(addDisplayNameToMessage(projectRoomMessage(processed.result_message as unknown as Record<string,unknown>),participantsData || []));
                        }
                    } catch (restoreError) {
                        console.warn('Could not restore transfer assessment feedback:', restoreError);
                    }
                }
            }

            let restoredAIInteractions: AIInteraction[] = [];
            if (user?.current_role === 'tutor') {
                try {
                    const feedbackQuery = supabase
                        .from('ai_suggestion_feedback')
                        .select('*')
                        .eq('room_id', roomId);
                    const feedbackResult = typeof (feedbackQuery as any).order === 'function'
                        ? await (feedbackQuery as any).order('created_at', { ascending: true })
                        : { data: [], error: null };
                    if (feedbackResult.error) {
                        console.warn('Could not restore AI suggestion feedback:', feedbackResult.error);
                    } else {
                        restoredAIInteractions = (feedbackResult.data || []).map((feedback: any) => ({
                            timestamp: feedback.created_at,
                            parent_message_id: feedback.parent_message_id,
                            parent_message_content: allMessages.find((message) => message.id === feedback.parent_message_id)?.content || '',
                            ai_suggestion: feedback.ai_suggestion,
                            tutor_action: feedback.tutor_action,
                            tutor_final_response: feedback.tutor_final_response ?? undefined,
                            response_time_ms: feedback.response_time_ms ?? undefined,
                            raw_guard_mode: feedback.raw_guard_mode,
                            raw_instruction: feedback.raw_instruction,
                            guard_reason: feedback.guard_reason,
                            final_guard_mode: feedback.final_guard_mode,
                            guard_rectified: feedback.guard_rectified,
                            raw_character: feedback.raw_character,
                            final_character: feedback.final_character,
                            tutor_id: feedback.tutor_id,
                            tutor_message_id: feedback.tutor_message_id,
                            generation_provenance: feedback.generation_provenance,
                        }));
                    }
                } catch (feedbackLoadError) {
                    console.warn('Could not restore AI suggestion feedback:', feedbackLoadError);
                }
            }

            if (epoch !== joinEpoch.current) return;
            setCurrentRoom(normalizeRoom(roomData));
            // Merge rather than replace: a realtime insert that arrived before this fetch
            // completed must survive it.
            const realtimeIds = joinRealtimeIds.current;
            setMessages(prev => mergeRoomMessages(
                mergeRoomMessages(prev.filter(message => message.room_id === roomId), allMessages),
                prev.filter(message => message.room_id === roomId && realtimeIds.has(message.id))
            ));
            setParticipants(participantsData || []);
            setAIInteractions(restoredAIInteractions);
        } finally {
            if (epoch === joinEpoch.current) setLoading(false);
        }
    }, [addDisplayNameToMessage, setAIInteractions, user?.id, user?.current_role]);

    const leaveRoom = useCallback(async (): Promise<void> => {
        joinEpoch.current += 1;
        joinController.current?.abort();
        activeRoomId.current = null;
        setCurrentRoom(null);
        setMessages([]);
        setParticipants([]);
        setAiConfig(null);
    }, [setAiConfig]);

    return {
        currentRoom, setCurrentRoom, messages, setMessages, participants, loading,
        activeRoomId, joinRealtimeIds, addDisplayNameToMessage, createRoom, joinRoom, leaveRoom,
    };
}
