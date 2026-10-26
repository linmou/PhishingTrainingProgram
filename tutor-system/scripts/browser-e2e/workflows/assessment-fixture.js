#!/usr/bin/env node
// Purpose: create assessment-ready staging state for independent delivery and answer workflows.
'use strict';

const assert = require('node:assert/strict');
const { insert, query, sendStudentMessage, openRoom, requestId, waitForMatch } = require('../browser-e2e-support');

const TRANSFER_LEARNER_DIALOGUE = Object.freeze({
  introduction: 'I want to know if this warning is real.',
  evidence: "I won't click the warning link. I'll open the real app and check my account.",
  followUp: 'I get it now. What else should I check in a warning like this?'
});

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
  const focus = (await query(client, 'messages', 'content,created_at', 'id', focusMessageId))[0];
  const partialMessage = await insert(client, 'messages', {
    room_id: roomId, user_id: studentId, user_role: 'student',
    content: 'I should verify the sender, but I do not know how.',
    created_at: new Date(Date.parse(focus.created_at) - 1000).toISOString(),
  });
  const { error: partialError } = await client.rpc('apply_transfer_message_analysis_v1', {
    p_room_id: roomId, p_message_id: partialMessage.id, p_actor_id: tutorId, p_request_id: requestId(),
    p_analysis: {
      events: [{ item_id: target.id, kind: 'initial_signal', evidence_type: 'action',
        evidence_message_id: partialMessage.id, evidence_quote: partialMessage.content,
        explanation: 'The learner names verification but has not supplied the method.' }],
      explanation: 'Verification method remains incomplete.',
    },
  });
  if (partialError) throw new Error(`Transfer fixture initial signal: ${partialError.message}`);
  const { error: analysisError } = await client.rpc('apply_transfer_message_analysis_v1', {
    p_room_id: roomId, p_message_id: focusMessageId, p_actor_id: tutorId, p_request_id: requestId(),
    p_analysis: {
      events: [{ item_id: target.id, kind: 'demonstrated_understanding', evidence_type: 'action',
        evidence_message_id: focusMessageId, evidence_quote: focus.content,
        explanation: 'The learner now supplies the independent verification method.' }],
      explanation: 'Independent verification is demonstrated.'
    }
  });
  if (analysisError) throw new Error(`Transfer fixture signal: ${analysisError.message}`);
  target.status = 'covered';
  target.understanding_level = 'good';
  return { checklist, items: [target, ...items.filter(item => item.id !== target.id)] };
}

async function assessmentRoom(ctx) {
  const room = await ctx.existingRoom(ctx.kind);
  await openRoom(ctx.studentPage, ctx.appUrl, room.id);
  const sessions = await waitForMatch(
    () => query(ctx.client, 'sessions', '*', 'room_id', room.id),
    rows => rows.some(row => row.status === 'active' && row.student_id === ctx.student.id),
    'browser-created current learner session'
  );
  const session = sessions.find(row => row.status === 'active' && row.student_id === ctx.student.id);
  const content = TRANSFER_LEARNER_DIALOGUE.evidence;
  const priorMessageIds = new Set((await query(ctx.client, 'messages', 'id', 'room_id', room.id)).map((row) => row.id));
  await sendStudentMessage(ctx.studentPage, content);
  const focus = (await query(ctx.client, 'messages', 'id,content,user_id,created_at', 'room_id', room.id))
    .filter((row) => row.user_id === ctx.student.id && !priorMessageIds.has(row.id))
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
    .at(-1);
  assert(focus?.id && focus.content, 'Learner focus message was not persisted');
  return { room, focus, session, ...await seedTransferChecklist(ctx.client, room.id, ctx.student.id, ctx.tutor.id, focus.id) };
}

async function deliverFixedAssessment(ctx, fixture, privateMarker) {
  const item = fixture.items[0];
  const assessment = {
    selection_type: 'single', stem: 'A warning says there is a problem with your account and tells you to click a link. What should you do?',
    options: [
      { id: 'A', text: 'Click the link right away' },
      { id: 'B', text: 'Open the official app yourself' },
      { id: 'C', text: 'Send them your password' },
      { id: 'D', text: 'Send the link to a friend' }
    ],
    correct_option_ids: ['B'],
    ...(privateMarker ? { raw_model_output: `private-provider-${privateMarker}`, rationale: `private-rationale-${privateMarker}` } : {}),
    learner_safe_explanation: 'Open the official app yourself instead of using the link.' + (privateMarker ? ` Independent verification ${privateMarker}.` : ''),
    transfer_basis: { source_evidence_message_ids: [fixture.focus.id], ...(privateMarker ? {
      concept_rule: `private-concept-${privateMarker}`, source_context: `private-source-${privateMarker}`,
      changed_context: `private-changed-${privateMarker}`
    } : {}) }
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

module.exports = { TRANSFER_LEARNER_DIALOGUE, assessmentRoom, deliverFixedAssessment, seedTransferChecklist };
