#!/usr/bin/env node
// Tests recover.cjs: only failed transport can be retried; completed bad answers remain evidence.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { transportFailure } = require('./recover.cjs');
test('transport classification preserves completed responses regardless of content', () => {
  const row = call => ({ result: { calls: [call] } });
  assert.equal(transportFailure(row({ error: 'timeout' })), true);
  assert.equal(transportFailure(row({ status: 503 })), true);
  assert.equal(transportFailure(row({ status: 200, response: { malformed: true } })), false);
  assert.equal(transportFailure(row({ status: 400 })), false);
  assert.equal(transportFailure({ result: { calls: [] } }), false);
});
