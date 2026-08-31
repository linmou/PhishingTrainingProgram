#!/usr/bin/env node
/** Purpose: provide Promptfoo's deterministic three-sentence/50-word response-length assertion. */

function scoreResponseLength(output) {
  const normalized = String(output || '').replace(/\r\n?/g, '\n').replace(/[ \t\n]+/g, ' ').trim();
  const Segmenter = Intl.Segmenter;
  const words = normalized && Segmenter
    ? Array.from(new Segmenter('en', { granularity: 'word' }).segment(normalized)).filter((segment) => segment.isWordLike)
    : normalized.split(/\s+/).filter(Boolean);
  const sentences = normalized && Segmenter
    ? Array.from(new Segmenter('en', { granularity: 'sentence' }).segment(normalized)).filter((segment) => segment.segment.trim())
    : normalized.split(/[.!?]+/).filter((segment) => segment.trim());
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const pass = normalized.length > 0 && wordCount <= 50 && sentenceCount <= 3;
  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass
      ? `within limit (${sentenceCount} sentences, ${wordCount} words)`
      : `must be non-empty and no more than 3 sentences/50 words (${sentenceCount} sentences, ${wordCount} words)`,
    wordCount,
    sentenceCount
  };
}

module.exports = scoreResponseLength;
module.exports.scoreResponseLength = scoreResponseLength;
