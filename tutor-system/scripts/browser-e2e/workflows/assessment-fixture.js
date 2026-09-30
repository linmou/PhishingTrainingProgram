#!/usr/bin/env node
// Purpose: create assessment-ready staging state for independent delivery and answer workflows.
'use strict';

const assert = require('node:assert/strict');
const { insert, query, sendStudentMessage, openRoom, requestId } = require('../staging-support');

async function seedTransferChecklist(client, roomId, studentId, tutorId, focusMessageId) {
  const targets = [
    'Verify a familiar sender through the official app',
    'Verify a payment warning using a saved contact',
    'Reject urgency in an account reset link',
    'Check a delivery alert without its embedded link'
  ];
  const { data: initialized, error: initializeError } = await client.rpc('initialize_transfer_checklist_v1', {
    p_room_id: roomId, p_student_id: studentId, p_actor_id: tutorId,
    p_items: targets.map(area_text => ({ area_text, item_type: 'verification_step', priority: 'critical' }))
  });
  if (initializeError) throw new Error(`Transfer checklist initialization: ${initializeError.message}`);
  const checklist = (await query(client, 'session_checklists', '*', 'id', initialized.checklist_id))[0];
  const items = await query(client, 'checklist_items', '*', 'checklist_id', checklist.id);
  const target = items.find(item => item.area_text === targets[0]);
  assert(target, 'Transfer target was not initialized');
  const { error: analysisError } = await client.rpc('apply_transfer_message_analysis_v1', {
    p_room_id: roomId, p_message_id: focusMessageId, p_actor_id: tutorId, p_request_id: requestId(),
    p_analysis: {
      events: [{ item_id: target.id, kind: 'initial_signal', explanation: 'The learner chose independent verification.' }],
      requires_protection: false, requires_correction: false
    }
  });
  if (analysisError) throw new Error(`Transfer fixture signal: ${analysisError.message}`);
  target.status = 'partially_covered';
  target.understanding_level = 'basic';
  return { checklist, items };
}

async function assessmentRoom(ctx) {
  const room = await ctx.existingRoom(ctx.kind);
  await openRoom(ctx.studentPage, ctx.appUrl, room.id);
  const content = 'I would open the official app instead of this warning link. Can you test me on another warning?';
  await sendStudentMessage(ctx.studentPage, content);
  const focus = (await query(ctx.client, 'messages', 'id,content,user_id', 'room_id', room.id))
    .find((row) => row.user_id === ctx.student.id && row.content === content);
  assert(focus, 'Learner focus message was not persisted');
  const session = await insert(ctx.client, 'sessions', {
    room_id: room.id, tutor_id: room.tutor_id, student_id: ctx.student.id, status: 'active'
  });
  return { room, focus, session, ...await seedTransferChecklist(ctx.client, room.id, ctx.student.id, ctx.tutor.id, focus.id) };
}

async function deliverFixedAssessment(ctx, fixture) {
  const item = fixture.items[0];
  const assessment = {
    selection_type: 'single', stem: 'A familiar account warning asks you to open its link. What should you do?',
    options: [
      { id: 'A', text: 'Open the link immediately' },
      { id: 'B', text: 'Open the official app independently' },
      { id: 'C', text: 'Reply with a password' },
      { id: 'D', text: 'Forward the link' }
    ],
    correct_option_ids: ['B'],
    learner_safe_explanation: 'Use the official app rather than the message link.',
    transfer_basis: { source_evidence_message_ids: [fixture.focus.id] }
  };
  const { data, error } = await ctx.client.rpc('send_reviewed_tutor_response_v4', {
    p_reviewed_payload: {
      decision: { mode: 'assessment', instruction: 'transfer_assess', target_item_id: item.id },
      response: assessment.stem, assessment
    },
    p_room_id: fixture.room.id, p_student_id: ctx.student.id,
    p_checklist_id: fixture.checklist.id, p_item_id: item.id,
    p_focus_student_message_id: fixture.focus.id, p_actor_id: ctx.tutor.id,
    p_request_id: requestId()
  });
  if (error) throw new Error(`Assessment fixture delivery: ${error.message}`);
  assert(data?.message?.id && data.message.assessment?.id, 'Assessment fixture delivery returned no question');
  return { question_message_id: data.message.id, assessment_id: data.message.assessment.id, assessment };
}

module.exports = { assessmentRoom, deliverFixedAssessment, seedTransferChecklist };
