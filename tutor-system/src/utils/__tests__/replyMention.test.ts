/**
 * Test file: src/utils/replyMention.ts
 * Purpose: verify the Reply button's "@name " prefix is added, swapped, removed and length-bounded.
 */
import { applyReplyMention, buildReplyMention, removeReplyMention } from '../replyMention';

describe('reply mention prefix', () => {
  it('builds a mention with a trailing space and a fallback name', () => {
    expect(buildReplyMention('Sam Student')).toBe('@Sam Student ');
    expect(buildReplyMention('  ')).toBe('@User ');
  });

  it('prefixes an empty or existing draft', () => {
    expect(applyReplyMention('', '@Sam ')).toBe('@Sam ');
    expect(applyReplyMention('I think so', '@Sam ')).toBe('@Sam I think so');
  });

  it('does not duplicate a mention already at the start', () => {
    expect(applyReplyMention('@Sam hi', '@Sam ', '@Sam ')).toBe('@Sam hi');
  });

  it('replaces the previous target mention and keeps the typed text', () => {
    expect(applyReplyMention('@Sam hi', '@Security Supervisor ', '@Sam ')).toBe('@Security Supervisor hi');
  });

  it('leaves a draft alone when the user already edited the old mention away', () => {
    expect(applyReplyMention('hello @Sam', '@Alex ', '@Sam ')).toBe('@Alex hello @Sam');
  });

  it('never exceeds the composer limit', () => {
    expect(applyReplyMention('x'.repeat(1000), '@Sam ')).toHaveLength(1000);
  });

  it('removes only a leading mention', () => {
    expect(removeReplyMention('@Sam hi', '@Sam ')).toBe('hi');
    expect(removeReplyMention('hi @Sam ', '@Sam ')).toBe('hi @Sam ');
    expect(removeReplyMention('hi', null)).toBe('hi');
  });
});
