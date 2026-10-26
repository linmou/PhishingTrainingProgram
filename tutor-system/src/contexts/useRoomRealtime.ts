import { useEffect, useRef, useState } from 'react';
import type { Message, Room, TypingIndicator, User } from '../types';
import { supabase } from '../services/supabase';
import { mergeRoomMessages, participationModeFromRoom, projectRoomMessage } from './transferAssessmentUiAdapter';
import { startRoomMessageSync } from './roomMessageSync';
import { normalizeRoom } from './useRoomMembership';

interface RoomRealtimeOptions {
    currentRoom: Room | null;
    user: User | null;
    participants: User[];
    activeRoomId: React.MutableRefObject<string | null>;
    joinRealtimeIds: React.MutableRefObject<Set<string>>;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    setCurrentRoom: React.Dispatch<React.SetStateAction<Room | null>>;
    addDisplayNameToMessage: (message: any, participantsList?: User[]) => Message;
    handleFeedbackRealtime: (payload: any) => Promise<void>;
    refreshMessageFeedbackStats: (messageId: string) => Promise<unknown>;
}

// Owns the channel, reconciliation scheduler and typing timers for one active room.
export function useRoomRealtime({
    currentRoom, user, participants, activeRoomId, joinRealtimeIds, setMessages,
    setCurrentRoom, addDisplayNameToMessage, handleFeedbackRealtime, refreshMessageFeedbackStats,
}: RoomRealtimeOptions) {
    const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
    const [subscriptionGeneration, setSubscriptionGeneration] = useState(0);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const channelRef = useRef<any>(null);
    // Mutable presentation/feedback callbacks must not recreate the room subscription.
    const syncCallbacks = useRef({ addDisplayNameToMessage, participants, handleFeedbackRealtime, refreshMessageFeedbackStats });
    syncCallbacks.current = { addDisplayNameToMessage, participants, handleFeedbackRealtime, refreshMessageFeedbackStats };
    const currentRoomId = currentRoom?.id;

    // Real-time subscription for messages and typing indicators
    useEffect(() => {
        if (!currentRoomId) return;
        const roomId = currentRoomId;
        let cancelled = false;
        let postgresChangesFailed = false;
        let subscriptionStatus: string | undefined;
        let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
        let replacingChannel = false;
        const scheduleRecovery = () => {
            if (cancelled || recoveryTimer || replacingChannel) return;
            recoveryTimer = setTimeout(async () => {
                recoveryTimer = undefined;
                if (cancelled || activeRoomId.current !== roomId) return;
                if (!supabase.realtime.isConnected()) {
                    scheduleRecovery();
                    return;
                }
                // The installed SDK reconnects its socket but tears down the channel's rejoin timer.
                // Remove the old topic completely before creating its replacement.
                replacingChannel = true;
                try {
                    await supabase.removeChannel(channel);
                    if (!cancelled && activeRoomId.current === roomId) {
                        setSubscriptionGeneration(generation => generation + 1);
                    }
                } catch (error) {
                    replacingChannel = false;
                    console.warn('Could not replace disconnected room channel:', error);
                    if (cancelled) channel.unsubscribe();
                    else scheduleRecovery();
                }
            }, 1000);
        };
        const sync = startRoomMessageSync(roomId, rows => {
            if (cancelled || activeRoomId.current !== roomId) return;
            const callbacks = syncCallbacks.current;
            const incoming = rows.map(row => callbacks.addDisplayNameToMessage(projectRoomMessage(row), callbacks.participants));
            setMessages(prev => mergeRoomMessages(prev.filter(message => message.room_id === roomId), incoming));
        });

        console.log('🔴 Setting up real-time subscription for room:', roomId);

        const channel = supabase.channel(`room_${roomId}`);
        
        channel
            .on('system', {}, payload => {
                if (cancelled || activeRoomId.current !== roomId) return;
                if (payload.extension === 'postgres_changes' && payload.status === 'error') {
                    // A channel can join successfully while its database stream is unavailable.
                    postgresChangesFailed = true;
                    sync.status('CHANNEL_ERROR');
                }
            })
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${roomId}`
                },
                (payload) => {
                    console.log('🟢 Real-time message received:', payload);
                    const newMessage = payload.new as any;
                    if (!cancelled) joinRealtimeIds.current.add(String(newMessage.id));
                    // Project before the row enters React state: a stored row can carry the
                    // private assessment key, and only allowlisted fields may be retained.
                    sync.realtime(newMessage);
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
                payload => {
                    if (!cancelled) joinRealtimeIds.current.add(String((payload.new as any).id));
                    sync.realtime(payload.new as any);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rooms',
                    filter: `id=eq.${roomId}`
                },
                (payload) => {
                    if (cancelled || activeRoomId.current !== roomId) return;
                    const incoming = payload.new as Room;
                    const mode = participationModeFromRoom(incoming);
                    // Room participation stays binary: an unrecognized value is never adopted as
                    // a mode, while the rest of the room row is still applied.
                    setCurrentRoom(prev => normalizeRoom({
                        ...incoming,
                        guard_mode: mode ?? prev?.guard_mode ?? false,
                    }));
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'message_feedback',
                    filter: `room_id=eq.${roomId}`
                },
                payload => { if (!cancelled) void syncCallbacks.current.handleFeedbackRealtime(payload); }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'message_feedback',
                    filter: `room_id=eq.${roomId}`
                },
                payload => { if (!cancelled) void syncCallbacks.current.handleFeedbackRealtime(payload); }
            )
            .on('broadcast', { event: 'message_feedback_changed' }, (payload) => {
                const feedbackMessageId = payload?.payload?.messageId;
                if (!feedbackMessageId) return;

                if (!cancelled) void syncCallbacks.current.refreshMessageFeedbackStats(feedbackMessageId);
            })
            .on('broadcast', { event: 'typing_start' }, (payload) => {
                if (cancelled) return;
                const { userId, displayName } = payload.payload;
                if (userId !== user?.id) {
                    setTypingUsers(prev => {
                        const filtered = prev.filter(t => t.userId !== userId);
                        return [...filtered, { userId, displayName, timestamp: Date.now() }];
                    });
                }
            })
            .on('broadcast', { event: 'typing_stop' }, (payload) => {
                if (cancelled) return;
                const { userId } = payload.payload;
                setTypingUsers(prev => prev.filter(t => t.userId !== userId));
            })
            .subscribe((status) => {
                if (cancelled || activeRoomId.current !== roomId) return;
                console.log('📡 Subscription status:', status);
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') scheduleRecovery();
                if (status === 'SUBSCRIBED' && recoveryTimer) {
                    clearTimeout(recoveryTimer);
                    recoveryTimer = undefined;
                }
                if (status === 'SUBSCRIBED' && subscriptionStatus && subscriptionStatus !== 'SUBSCRIBED') {
                    postgresChangesFailed = false;
                }
                subscriptionStatus = status;
                sync.status(status === 'SUBSCRIBED' && postgresChangesFailed ? 'CHANNEL_ERROR' : status);
            });

        // Store channel reference
        channelRef.current = channel;

        return () => {
            cancelled = true;
            if (recoveryTimer) clearTimeout(recoveryTimer);
            sync.stop();
            console.log('🔴 Unsubscribing from real-time channel');
            if (!replacingChannel) channel.unsubscribe();
            channelRef.current = null;
        };
    }, [currentRoomId, user?.id, activeRoomId, joinRealtimeIds, setCurrentRoom, setMessages, subscriptionGeneration]);

    // Clean up stale typing indicators
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setTypingUsers(prev => prev.filter(t => now - t.timestamp < 5000)); // 5 second timeout
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const startTyping = () => {
        if (!user || !currentRoom || user.current_role === 'observer' || !channelRef.current) return;

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Broadcast typing start using the existing channel
        try {
            channelRef.current.send({
                type: 'broadcast',
                event: 'typing_start',
                payload: {
                    userId: user.id,
                    displayName: user.display_name
                }
            });
        } catch (error) {
            console.warn('Failed to send typing start broadcast:', error);
        }

        // Auto-stop typing after 3 seconds
        typingTimeoutRef.current = setTimeout(() => {
            stopTyping();
        }, 3000);
    };

    const stopTyping = () => {
        if (!user || !currentRoom || user.current_role === 'observer' || !channelRef.current) return;

        // Clear timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        // Broadcast typing stop using the existing channel
        try {
            channelRef.current.send({
                type: 'broadcast',
                event: 'typing_stop',
                payload: {
                    userId: user.id
                }
            });
        } catch (error) {
            console.warn('Failed to send typing stop broadcast:', error);
        }
    };


    return { typingUsers, startTyping, stopTyping, channelRef };
}
