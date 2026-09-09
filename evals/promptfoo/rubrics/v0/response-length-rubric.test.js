#!/usr/bin/env node
// Test responsible for response-length-rubric.js enforcing canonical empty, word, sentence, URL, and line-break boundaries.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const scoreResponseLength = require('./response-length-rubric');

test('accepts exactly 50 words and rejects 51 words', () => {
  assert.equal(scoreResponseLength(Array(50).fill('word').join(' ')).pass, true);
  assert.equal(scoreResponseLength(Array(51).fill('word').join(' ')).pass, false);
});

test('accepts three sentences and rejects four sentences', () => {
  assert.equal(scoreResponseLength('One. Two! Three?').pass, true);
  assert.equal(scoreResponseLength('One. Two! Three? Four.').pass, false);
});

test('rejects empty content and handles URLs and line breaks deterministically', () => {
  assert.equal(scoreResponseLength('  \n\t ').pass, false);
  const result = scoreResponseLength('Open https://example.com/check.\nThen verify in the real app.');
  assert.equal(result.pass, true);
  assert.equal(result.sentenceCount, 2);
});
