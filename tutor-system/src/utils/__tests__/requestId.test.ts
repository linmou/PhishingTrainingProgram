/** Test responsible for src/utils/requestId.ts: fresh ids, with a prefixed fallback where randomUUID is missing. */

import { newRequestId } from '../requestId';

describe('newRequestId', () => {
  const crypto = globalThis.crypto as Crypto & { randomUUID?: () => string };
  const original = crypto.randomUUID;

  afterEach(() => {
    Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true, writable: true });
  });

  it('returns a different id on every call', () => {
    Object.defineProperty(crypto, 'randomUUID', {
      value: jest.fn().mockReturnValueOnce('uuid-1').mockReturnValueOnce('uuid-2'), configurable: true, writable: true,
    });
    expect([newRequestId(), newRequestId()]).toEqual(['uuid-1', 'uuid-2']);
  });

  it('falls back to a prefixed random id when the browser has no randomUUID', () => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true, writable: true });
    const first = newRequestId('item');
    expect(first).toMatch(/^item-\d+-[a-z0-9]+$/);
    expect(newRequestId('item')).not.toBe(first);
    expect(newRequestId()).toMatch(/^request-/);
  });
});
