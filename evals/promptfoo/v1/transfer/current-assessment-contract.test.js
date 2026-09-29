#!/usr/bin/env node
// Test responsibility: verify current assessment-only evaluation inputs match production target and evidence boundaries.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { root } = require('./shared-request-contract');

const { buildTransferTutorRequestContextV3, buildTransferAssessmentRequest } =
  require(path.join(root, 'tutor-system/src/services/ecologicalTutorCall.ts'));
const { validateAssessmentDraft } =
  require(path.join(root, 'tutor-system/src/services/assessmentValidation.ts'));
const { base_input: baseInput } = require('./fixtures/contract-fixtures.json');

function roomInput(roomId, checklistId, targetId, messageId) {
  return {
    ...baseInput,
    room_id: roomId,
    checklist_id: checklistId,
    focus_student_id: 'learner-1',
    focus_student_message: {
      id: messageId, room_id: roomId, user_id: 'learner-1',
      user_role: 'student', content: 'I would verify through the official app.'
    },
    checklist_items: [{
      id: targetId, area_text: 'Verify independently through the official app',
      priority: 'critical', status: 'partially_covered', understanding_level: 'basic',
      relevant_evidence_message_ids: [messageId], repair_message_id: null
    }],
    eligible_assessment_item_ids: [targetId],
    unresolved_assessment: null,
    feedback_required: false,
    progress_snapshot_hash: `state-${roomId}`
  };
}

test('two rooms build assessment requests only from their approved targets and learner evidence', () => {
  const first = buildTransferTutorRequestContextV3(roomInput('room-a', 'checklist-a', 'target-a', 'message-a'));
  const second = buildTransferTutorRequestContextV3(roomInput('room-b', 'checklist-b', 'target-b', 'message-b'));
  const requestA = JSON.parse(buildTransferAssessmentRequest(first, 'target-a'));
  const requestB = JSON.parse(buildTransferAssessmentRequest(second, 'target-b'));

  assert.equal(requestA.contract_version, 'transfer_assessment_request_v1');
  assert.equal(requestA.target_item.id, 'target-a');
  assert.equal(requestB.target_item.id, 'target-b');
  assert.deepEqual(requestA.target_item.relevant_evidence_message_ids, ['message-a']);
  assert.deepEqual(requestB.target_item.relevant_evidence_message_ids, ['message-b']);
  assert(!JSON.stringify(requestA).includes('target-b'));
  assert(!JSON.stringify(requestB).includes('target-a'));
  assert.throws(() => buildTransferAssessmentRequest(first, 'target-b'), /not eligible/);
});

test('assessment-only validation rejects invented target and foreign learner evidence', () => {
  const draft = {
    reason: 'The learner showed an initial verification signal.',
    target_item_id: 'target-a',
    assessment: {
      stem: 'A friend sends a prize link. What is the safest first step?',
      selection_type: 'single',
      options: [
        { id: 'A', text: 'Open the link' },
        { id: 'B', text: 'Verify through the official app' },
        { id: 'C', text: 'Forward the link' },
        { id: 'D', text: 'Reply with account details' }
      ],
      correct_option_ids: ['B'],
      learner_safe_explanation: 'Use the official app to verify the request independently.',
      transfer_basis: {
        concept_rule: 'Verify unexpected requests independently.',
        source_context: 'A gift card request',
        changed_context: 'A prize link from a friend',
        source_evidence_message_ids: ['message-a']
      }
    }
  };
  const context = { knownItemIds: ['target-a'], knownMessageIds: ['message-a'] };
  assert.equal(validateAssessmentDraft(draft, context).target_item_id, 'target-a');
  assert.throws(() => validateAssessmentDraft({ ...draft, target_item_id: 'target-b' }, context), /target/);
  assert.throws(() => validateAssessmentDraft({ ...draft, assessment: {
    ...draft.assessment,
    transfer_basis: { ...draft.assessment.transfer_basis, source_evidence_message_ids: ['message-b'] }
  } }, context), /evidence/);
});
