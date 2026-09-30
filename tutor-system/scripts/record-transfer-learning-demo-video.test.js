#!/usr/bin/env node
// Purpose: verify transfer-video checklist targets come from the room template configuration.
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { extractLearningTargets } = require('./record-transfer-learning-demo-video');

test('extracts multiple detection and verification targets from a template', () => {
  assert.deepEqual(
    extractLearningTargets({
      detection_areas: ['Urgent language', 'Suspicious URL'],
      verification_steps: ['Do not click', 'Open the official app']
    }),
    {
      detectionAreas: ['Urgent language', 'Suspicious URL'],
      verificationSteps: ['Do not click', 'Open the official app']
    }
  );
});

test('rejects a room configuration with only one target group item', () => {
  assert.throws(
    () => extractLearningTargets({ detection_areas: ['Only one'], verification_steps: ['Only one'] }),
    /multiple detection-area targets/
  );
});
