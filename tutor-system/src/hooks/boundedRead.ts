/** Bound a UI read even if the transport never settles. Late results are discarded. */
export function boundedRead<T>(operation: PromiseLike<T> | T, signal: AbortSignal, timeoutMs = 15_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error: Error | null, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(value as T);
    };
    const abort = () => finish(new Error('Read cancelled.'));
    if (signal.aborted) abort();
    else {
      signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => finish(new Error('Reading learning progress timed out. Use Refresh to retry.')), timeoutMs);
    }
    Promise.resolve(operation).then(value => finish(null, value), error => finish(error instanceof Error ? error : new Error(String(error))));
  });
}
