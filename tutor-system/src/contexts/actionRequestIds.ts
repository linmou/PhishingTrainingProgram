// Purpose: give each user action one request id that its retries reuse (AD-7, NFR-5, issue #111).
//
// The server replays a mutating call whose request id it has already stored. That only helps if a
// retry sends the same id, so the id belongs to the user action, not to each HTTP call.

import type { Message } from '../types';
import type { AssessmentOptionId } from '../types/assessment';
import { newRequestId } from '../utils/requestId';

/** One user action that may be retried: its slot, what makes it "the same action", and its stored row. */
export interface RetryableAction {
  /** At most one pending action per slot, for example one per assessment or per room composer. */
  slot: string;
  /** Equal fingerprints mean a retry of the same action; a different one is a new action. */
  fingerprint: string;
  /** True for the row the server stored for this action, however that row reached the tab. */
  isStoredRow: (message: Message) => boolean;
}

interface PendingAction extends RetryableAction {
  requestId: string;
}

/**
 * Pending request ids, one per action slot.
 *
 * Only a confirmed server result settles a slot: the call's own response (`settle`), or the stored
 * row arriving another way, such as realtime or a catch-up read (`settleStored`). An error or a lost
 * response keeps the id, so the retry sends it again and the server returns the row it already has.
 */
export class ActionRequestIds {
  private readonly pending = new Map<string, PendingAction>();

  constructor(private readonly mint: () => string = newRequestId) {}

  /** The slot's id while the same action is retried; a new id when the action changed. */
  claim(action: RetryableAction): string {
    const current = this.pending.get(action.slot);
    if (current && current.fingerprint === action.fingerprint) return current.requestId;
    const requestId = this.mint();
    this.pending.set(action.slot, { ...action, requestId });
    return requestId;
  }

  /** The call returned its stored result, so the next action in this slot is new. */
  settle(slot: string, requestId: string): void {
    // A newer action may have replaced this one while the call was in flight; keep that one.
    if (this.pending.get(slot)?.requestId === requestId) this.pending.delete(slot);
  }

  /** Drops every pending action whose stored row is already among `messages`. */
  settleStored(messages: ReadonlyArray<Message>): void {
    this.pending.forEach((action, slot) => {
      if (messages.some(action.isStoredRow)) this.pending.delete(slot);
    });
  }
}

/**
 * A learner post (a plain message or an assessment answer) as a retryable action.
 *
 * Its stored row is a message by this learner in this room with the same content and reply target
 * that was not yet on screen when the action started. Projected rows do not carry the request id,
 * so the row is recognised by these fields; excluding `onScreen` keeps an earlier identical message
 * (an earlier "ok") from settling the new one.
 */
export function learnerPostAction(input: {
  roomId: string;
  userId: string;
  content: string;
  replyToMessageId?: string;
  assessmentId?: string;
  selectedOptionIds?: ReadonlyArray<AssessmentOptionId>;
  onScreen: ReadonlyArray<Message>;
}): RetryableAction {
  const parentId = input.replyToMessageId ?? null;
  const content = input.content.trim();
  const earlierIds = new Set(input.onScreen.map(message => message.id));
  return {
    slot: input.assessmentId ? `answer:${input.assessmentId}` : `post:${input.roomId}`,
    fingerprint: JSON.stringify([
      input.content,
      parentId,
      input.assessmentId ?? null,
      input.selectedOptionIds ?? null,
    ]),
    isStoredRow: message => !earlierIds.has(message.id) &&
      message.room_id === input.roomId &&
      message.user_id === input.userId &&
      (message.parent_message_id ?? null) === parentId &&
      message.content.trim() === content,
  };
}
