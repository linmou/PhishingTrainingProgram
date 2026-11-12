import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';

export interface RealtimeReadBinding { table: string; filter: string }
let nextSubscriptionId = 0;

/** Database events invalidate a projection; payloads never become application state. */
export function useRealtimeInvalidation(
  scope: string,
  bindings: RealtimeReadBinding[],
  reconcile: () => Promise<void>,
): string | null {
  const callback = useRef(reconcile);
  callback.current = reconcile;
  const [failure, setFailure] = useState<{ scope: string; message: string } | null>(null);
  const bindingKey = JSON.stringify(bindings);

  useEffect(() => {
    if (!scope || bindingKey === '[]') return;
    if (typeof supabase.channel !== 'function') {
      setFailure({ scope, message: 'Live learning progress updates are unavailable. Use Refresh to check for changes.' });
      return;
    }
    let stopped = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let maximumWait: ReturnType<typeof setTimeout> | undefined;
    let recovery: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let generation = 0;
    const reconcile = () => {
      clearTimeout(debounce);
      clearTimeout(maximumWait);
      debounce = undefined;
      maximumWait = undefined;
      if (!stopped) void callback.current();
    };
    const invalidate = () => {
      if (stopped) return;
      clearTimeout(debounce);
      debounce = setTimeout(reconcile, 300);
      // A long catch-up stream must not postpone the first visible update forever.
      if (!maximumWait) maximumWait = setTimeout(reconcile, 1000);
    };
    const failed = () => {
      if (stopped) return;
      setFailure({ scope, message: 'Live learning progress updates are unavailable. Use Refresh to check for changes.' });
      if (recovery) return;
      recovery = setTimeout(async () => {
        recovery = undefined;
        if (stopped) return;
        if (!supabase.realtime?.isConnected()) { failed(); return; }
        // This SDK can reconnect the socket without rejoining failed channels.
        ++generation;
        try {
          if (channel) await supabase.removeChannel(channel);
          if (!stopped) subscribe();
        } catch { failed(); }
      }, 1000);
    };
    const subscribe = () => {
      const currentGeneration = ++generation;
      let postgresChangesFailed = false;
      const current = () => !stopped && currentGeneration === generation;
      channel = supabase.channel(`learning_progress_${++nextSubscriptionId}`);
      // A missing channel is an unavailable feed, including restricted clients.
      if (!channel?.on) { failed(); return; }
      channel.on('system', {}, payload => {
        if (current() && payload.extension === 'postgres_changes' && payload.status === 'error') {
          postgresChangesFailed = true;
          failed();
        }
      });
      const registered = JSON.parse(bindingKey) as RealtimeReadBinding[];
      registered.forEach(binding => {
        const changed = () => { if (current()) invalidate(); };
        channel!.on('postgres_changes', { event: 'INSERT', schema: 'public', ...binding }, changed);
        channel!.on('postgres_changes', { event: 'UPDATE', schema: 'public', ...binding }, changed);
      });
      channel.subscribe(status => {
        if (!current()) return;
        if (status === 'SUBSCRIBED') {
          if (postgresChangesFailed) { failed(); return; }
          clearTimeout(recovery);
          recovery = undefined;
          setFailure(null);
          // Also close the first fetch/subscribe gap and catch up after reconnect.
          invalidate();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          failed();
        }
      });
    };
    subscribe();
    const resume = () => { if (!stopped) invalidate(); };
    window.addEventListener('online', resume);
    return () => {
      stopped = true;
      ++generation;
      clearTimeout(debounce);
      clearTimeout(maximumWait);
      clearTimeout(recovery);
      window.removeEventListener('online', resume);
      if (channel && typeof supabase.removeChannel === 'function') void supabase.removeChannel(channel);
    };
  }, [scope, bindingKey]);
  return bindingKey !== '[]' && failure?.scope === scope ? failure.message : null;
}
