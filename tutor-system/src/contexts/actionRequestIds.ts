// Purpose: give each user action one request id that its retries reuse (AD-7, NFR-5, issue #111).
//
// The server replays a mutating call whose request id it has already stored. That only helps if a
// retry sends the same id, so the id belongs to the user action, not to each HTTP call.

import { newRequestId } from '../services/transferAssessmentService';

interface PendingAction {
  fingerprint: string;
  requestId: string;
}

/**
 * Pending request ids, one per action slot (for example one per assessment or per room composer).
 *
 * - `claim` returns the slot's id while the same action (same fingerprint) is retried, and mints a
 *   new id when the action changed, such as a different selection.
 * - `settle` drops the id once the server's result was received, so the next action is new.
 */
export class ActionRequestIds {
  private readonly pending = new Map<string, PendingAction>();

  constructor(private readonly mint: () => string = newRequestId) {}

  claim(slot: string, fingerprint: string): string {
    const current = this.pending.get(slot);
    if (current && current.fingerprint === fingerprint) return current.requestId;
    const requestId = this.mint();
    this.pending.set(slot, { fingerprint, requestId });
    return requestId;
  }

  settle(slot: string, requestId: string): void {
    // A newer action may have replaced this one while the call was in flight; keep that one.
    if (this.pending.get(slot)?.requestId === requestId) this.pending.delete(slot);
  }
}
