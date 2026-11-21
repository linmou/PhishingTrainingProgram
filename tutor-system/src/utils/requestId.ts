// Purpose: mint the random ids the browser sends as request ids, item ids and visit keys.

/**
 * A fresh random id: a UUID where the browser supports it, otherwise `<prefix>-<time>-<random>`.
 * Request ids belong to a user action; a retry of that action reuses the id it was given (AD-7).
 */
export function newRequestId(fallbackPrefix = 'request'): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  return randomUuid
    ? randomUuid.call(globalThis.crypto)
    : `${fallbackPrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
