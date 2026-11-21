/**
 * Test file: src/utils/replyMention.ts
 * Purpose: verify the Reply button's "@name " prefix is added, swapped, removed, never cuts typed text,
 * and that a mention-only draft is recognised.
 */
import { applyReplyMention, buildReplyMention, isReplyMentionOnly, removeReplyMention } from '../replyMention';

describe('reply mention prefix', () => {
  it('builds a mention with a trailing space and a fallback name', () => {
    expect(buildReplyMention('Sam Student')).toBe('@Sam Student ');
    expect(buildReplyMention('  ')).toBe('@User ');
  });

  it('prefixes an empty or existing draft and reports what it inserted', () => {
    expect(applyReplyMention('', '@Sam ')).toEqual({ text: '@Sam ', inserted: '@Sam ' });
    expect(applyReplyMention('I think so', '@Sam ')).toEqual({ text: '@Sam I think so', inserted: '@Sam ' });
  });

  it('keeps a mention the user typed and does not claim it', () => {
    expect(applyReplyMention('@Sam hi', '@Sam ')).toEqual({ text: '@Sam hi', inserted: null });
  });

  it('replaces the mention an earlier Reply inserted and keeps the typed text', () => {
    expect(applyReplyMention('@Sam hi', '@Security Supervisor ', '@Sam '))
      .toEqual({ text: '@Security Supervisor hi', inserted: '@Security Supervisor ' });
  });

  it('leaves the draft alone when the user already edited the old mention away', () => {
    expect(applyReplyMention('hello @Sam', '@Alex ', '@Sam ').text).toBe('@Alex hello @Sam');
  });

  it('skips the mention instead of cutting typed text at the length limit', () => {
    const draft = 'x'.repeat(998);
    expect(applyReplyMention(draft, '@Sam ')).toEqual({ text: draft, inserted: null });
  });

  it('removes only a leading mention', () => {
    expect(removeReplyMention('@Sam hi', '@Sam ')).toBe('hi');
    expect(removeReplyMention('hi @Sam ', '@Sam ')).toBe('hi @Sam ');
    expect(removeReplyMention('hi', null)).toBe('hi');
  });

  it('recognises a mention-only draft with or without its trailing space', () => {
    expect(isReplyMentionOnly('@Sam ', '@Sam ')).toBe(true);
    expect(isReplyMentionOnly('  @Sam', '@Sam ')).toBe(true);
    expect(isReplyMentionOnly('@Sam hi', '@Sam ')).toBe(false);
    expect(isReplyMentionOnly('', null)).toBe(false);
  });
});
