// Purpose: build and swap the "@name " prefix the Reply button places at the start of the composer.

/** The prefix inserted for a reply target, e.g. "@Security Supervisor ". */
export function buildReplyMention(authorName: string): string {
  return `@${authorName.trim() || 'User'} `;
}

/** Remove a previously inserted mention when the draft still starts with it. */
export function removeReplyMention(text: string, mention: string | null | undefined): string {
  if (!mention || !text.startsWith(mention)) return text;
  return text.slice(mention.length);
}

/** True when the draft holds nothing but the reply mention, with or without its trailing space. */
export function isReplyMentionOnly(text: string, mention: string | null | undefined): boolean {
  return Boolean(mention) && text.trim() === (mention as string).trim();
}

export interface AppliedReplyMention {
  text: string;
  /** The prefix this call added, or null when nothing was added and so nothing should be removed later. */
  inserted: string | null;
}

/**
 * Put `mention` at the start of the draft, first removing the mention an earlier
 * Reply inserted, and keeping whatever the user typed. A mention the user typed
 * themselves is left in place and not claimed, and the mention is skipped rather
 * than cutting typed text when it would not fit within `maxLength`.
 */
export function applyReplyMention(
  text: string,
  mention: string,
  previousInserted?: string | null,
  maxLength = 1000
): AppliedReplyMention {
  const body = removeReplyMention(text, previousInserted);
  if (body.startsWith(mention) || mention.length + body.length > maxLength) {
    return { text: body, inserted: null };
  }
  return { text: `${mention}${body}`, inserted: mention };
}
