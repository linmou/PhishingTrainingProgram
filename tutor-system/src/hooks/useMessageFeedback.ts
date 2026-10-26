import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getMessagesFeedbackStats } from '../services/supabase';
import type { MessageFeedbackStats } from '../types';

type Pending = {
  promise: Promise<MessageFeedbackStats | null>;
  resolve: (stats: MessageFeedbackStats | null) => void;
  started: boolean;
  dirty: boolean;
};

export function useMessageFeedback(
  roomId: string | undefined,
  userId: string | undefined,
  messages: readonly { id: string; room_id?: string }[]
) {
  const scope = useMemo(() => ({
    cache: {} as Record<string, MessageFeedbackStats>,
    pending: new Map<string, Pending>(),
    running: false,
    generation: 0,
    roomId,
    userId
  }), [roomId, userId]);
  const active = useRef<typeof scope | null>(scope);
  active.current = scope;
  const [, render] = useState(0);
  useEffect(() => {
    active.current = scope;
    return () => { if (active.current === scope) active.current = null; };
  }, [scope]);

  const request = useCallback((messageId: string, invalidate: boolean): Promise<MessageFeedbackStats | null> => {
    if (!roomId || !userId || messageId.startsWith('prepop-') || messageId.startsWith('temp-') || active.current !== scope) {
      return Promise.resolve(null);
    }
    const pending = scope.pending.get(messageId);
    if (pending) {
      // A change arriving after a read started needs one follow-up read.
      if (invalidate && pending.started) pending.dirty = true;
      return pending.promise;
    }
    if (!invalidate && scope.cache[messageId]) return Promise.resolve(scope.cache[messageId]);
    let resolve!: Pending['resolve'];
    const promise = new Promise<MessageFeedbackStats | null>(done => { resolve = done; });
    scope.pending.set(messageId, { promise, resolve, started: false, dirty: false });
    if (!scope.running) {
      scope.running = true;
      void Promise.resolve().then(async () => {
        while (scope.pending.size && active.current === scope) {
          const ids = Array.from(scope.pending.keys());
          const generation = scope.generation;
          ids.forEach(id => { scope.pending.get(id)!.started = true; });
          let stats: Record<string, MessageFeedbackStats> = {};
          try {
            stats = await getMessagesFeedbackStats(roomId, userId, ids);
          } catch (error) {
            console.error('Failed to get message feedback stats:', error);
          }
          if (active.current === scope) {
            let changed = false;
            ids.forEach(id => {
              const entry = scope.pending.get(id)!;
              if (entry.dirty && scope.generation === generation) {
                entry.dirty = false;
                entry.started = false;
              } else {
                if (stats[id] && scope.generation === generation) {
                  scope.cache[id] = stats[id];
                  changed = true;
                }
                scope.pending.delete(id);
                entry.resolve(scope.generation === generation ? stats[id] || null : null);
              }
            });
            if (changed) render(version => version + 1);
          }
        }
        if (active.current !== scope) {
          scope.pending.forEach(entry => entry.resolve(null));
          scope.pending.clear();
        }
        scope.running = false;
      });
    }
    return promise;
  }, [roomId, userId, scope]);

  const getMessageFeedbackStats = useCallback((id: string) => request(id, false), [request]);
  const refreshMessageFeedbackStats = useCallback((id: string) => request(id, true), [request]);
  const resetFeedback = useCallback(() => {
    scope.generation++;
    scope.cache = {};
    render(version => version + 1);
  }, [scope]);

  useEffect(() => {
    messages.forEach(message => {
      if (!message.room_id || message.room_id === roomId) void getMessageFeedbackStats(message.id);
    });
  }, [messages, roomId, getMessageFeedbackStats]);

  return { messageFeedbackStats: { ...scope.cache }, getMessageFeedbackStats, refreshMessageFeedbackStats, resetFeedback };
}
