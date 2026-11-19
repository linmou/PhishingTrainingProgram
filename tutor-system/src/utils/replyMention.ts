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

/**
 * Put `mention` at the start of the draft, replacing the mention of an earlier
 * reply target and keeping whatever the user already typed. The result never
 * exceeds `maxLength`.
 */
export function applyReplyMention(
  text: string,
  mention: string,
  previousMention?: string | null,
  maxLength = 1000
): string {
  const body = removeReplyMention(text, previousMention);
  const withMention = body.startsWith(mention) ? body : `${mention}${body}`;
  return withMention.slice(0, maxLength);
}
