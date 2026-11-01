#!/usr/bin/env node
// Purpose: verify browser Back, the multi-question exit queue, Guard recovery and visit-based reassessment on staging.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { assessmentRoom, deliverFixedAssessment } = require('./assessment-fixture');
const { assertStaging } = require('./assessment-security');
const { openExitAssessment, assertExitResult, assertAssessmentGate, assertReadOnlyAssessment } = require('./assessment-browser-checks');
const { openRoom, insert, query, sendStudentMessage, requestId, managementQuery, waitForMatch, writeJson, screenshot, TIMEOUT } = require('../browser-e2e-support');

function assertQueueState(rows, delivered, expected) {
  assert.equal(rows.length, delivered.length, 'Exit queue has missing or extra assessments');
  for (const [index, question] of delivered.entries()) {
    const row = rows.find(candidate => candidate.id === question.assessment_id);
    assert(row, 'Exit queue lost an assessment identity');
    assert.equal(row.question_message_id, question.question_message_id, 'Exit queue changed a question identity');
    assert.equal(row.lifecycle, expected[index].lifecycle, 'Exit queue has an unexpected lifecycle');
    assert.equal(row.attempt_count, expected[index].attempts, 'Exit queue consumed an unexpected number of attempts');
  }
}

module.exports = async function exitAssessment(ctx) {
  assertStaging(ctx.config);
  const evidence = { stage: 'fixture', operations: [], status: 'running' };
  const persist = () => writeJson(path.join(ctx.evidenceDir, 'exit-assessment.json'), evidence);
  const fixture = await assessmentRoom({ ...ctx, kind: 'assessment-answer-pass' });
  evidence.room_id = fixture.room.id;
  const privateRows = () => managementQuery(ctx.config,
    `select id,item_id,question_message_id,lifecycle,attempt_count,terminal_result,closed_at
     from private.transfer_assessments where room_id='${fixture.room.id}'::uuid order by created_at,id`);
  const visits = () => managementQuery(ctx.config,
    `select room_id,student_id,visit_key,started_at from private.learner_visits
     where room_id='${fixture.room.id}'::uuid and student_id='${ctx.student.id}'::uuid order by started_at,visit_key`);
  const api = async (actorId, body) => {
    const response = await fetch(`${ctx.config.projectUrl}/functions/v1/assessment-api`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.config.anonKey,
        Authorization: `Bearer ${ctx.config.anonKey}`, 'x-application-user-id': actorId, 'x-practice-contract': 'cyberbullying-v2' },
      body: JSON.stringify({ request_id: requestId(), ...body })
    });
    const result = await response.json();
    evidence.operations.push({ actor_id: actorId, request: body, status: response.status, response: result }); persist();
    assert.equal(response.status, 200, `Exit operation failed: ${JSON.stringify(result)}`);
    assert.equal(result.ok, true);
    return result.data;
  };
  const prepare = async focusId => {
    const { data, error } = await ctx.client.rpc('prepare_transfer_assessment_context_v1', {
      p_room_id: fixture.room.id, p_focus_student_message_id: focusId, p_checklist_id: fixture.checklist.id,
      p_actor_id: ctx.tutor.id, p_request_id: requestId()
    });
    if (error) throw new Error(`Exit eligibility read: ${error.message}`);
    return data;
  };
  try {
    evidence.visits_before = await visits();
    assert(evidence.visits_before.length > 0, 'Room page did not record a learner visit');
    const visit = evidence.visits_before.at(-1);
    await api(ctx.student.id, { operation: 'join_room', room_id: fixture.room.id, visit_key: visit.visit_key });
    await api(ctx.student.id, { operation: 'join_room', room_id: fixture.room.id, visit_key: visit.visit_key });
    await api(ctx.student.id, { operation: 'join_room', room_id: fixture.room.id });
    evidence.visits_after_retries = await visits();
    assert.deepEqual(evidence.visits_after_retries, evidence.visits_before, 'Retried or keyless joins created visits');

    evidence.stage = 'second_target_direct_coverage'; persist();
    const second = fixture.items.find(item => item.area_text === 'Verify a payment warning using a saved contact');
    assert(second, 'Exit fixture is missing its direct-coverage target');
    assert.equal(second.status, 'pending');
    const direct = await insert(ctx.client, 'messages', {
      room_id: fixture.room.id, user_id: ctx.student.id, user_role: 'student',
      content: 'For a payment warning, I would use the saved official contact myself instead of its supplied number.'
    });
    const { data: applied, error } = await ctx.client.rpc('apply_transfer_message_analysis_v1', {
      p_room_id: fixture.room.id, p_message_id: direct.id, p_actor_id: ctx.tutor.id, p_request_id: requestId(),
      p_analysis: { events: [{ item_id: second.id, kind: 'demonstrated_understanding', evidence_type: 'action',
        evidence_message_id: direct.id, evidence_quote: direct.content,
        explanation: 'Controlled fixture: direct learner-owned independent verification evidence.' }],
      explanation: 'Controlled fixture for Pending to Covered eligibility.' }
    });
    if (error) throw new Error(`Direct coverage fixture: ${error.message}`);
    evidence.direct_coverage = { message: direct, result: applied,
      target: (await query(ctx.client, 'checklist_items', '*', 'id', second.id))[0] };
    assert.equal(evidence.direct_coverage.target.status, 'covered');
    const historyBeforeDelivery = await ctx.studentPage.evaluate(() => window.history.length);
    const delivered = [await deliverFixedAssessment(ctx, fixture),
      await deliverFixedAssessment(ctx, { ...fixture, focus: direct, items: [second] })];
    evidence.delivered = delivered;
    assertQueueState(await privateRows(), delivered, [{ lifecycle: 'open', attempts: 0 }, { lifecycle: 'open', attempts: 0 }]);
    await ctx.studentPage.waitForFunction(previous => window.history.length > previous, historyBeforeDelivery, { timeout: TIMEOUT });
    await assertAssessmentGate(ctx.studentPage, false);
    for (const question of delivered) assert.equal(await ctx.studentPage.getByTestId(`public-assessment-${question.assessment_id}`).count(), 0);

    evidence.stage = 'ordinary_chat'; persist();
    const ordinaryText = 'I am ready to wrap up this discussion.';
    await sendStudentMessage(ctx.studentPage, ordinaryText);
    const ordinary = (await query(ctx.client, 'messages', '*', 'room_id', fixture.room.id))
      .find(row => row.user_id === ctx.student.id && row.content === ordinaryText);
    assert(ordinary && !ordinary.assessment_id, 'Hidden questions blocked ordinary chat');
    evidence.ordinary_message = ordinary;
    await managementQuery(ctx.config, `update public.rooms set guard_mode=true where id='${fixture.room.id}'::uuid`);
    evidence.stage = 'browser_back_and_guard'; persist();
    let question = await openExitAssessment(ctx.studentPage, delivered[0].assessment_id, { browserBack: true });
    const popup = ctx.studentPage.getByRole('dialog', { name: 'Before you leave' });
    assert((await popup.innerText()).includes('Question 1 of 2'), 'Browser Back did not open the ordered queue');
    await question.locator('input[value="B"]').check();
    await question.getByRole('button', { name: 'Submit answer' }).click();
    await popup.getByRole('status').filter({ hasText: 'Waiting for your tutor to turn Guard off.' }).waitFor({ timeout: TIMEOUT });
    evidence.guard_rows = await privateRows();
    assertQueueState(evidence.guard_rows, delivered, [{ lifecycle: 'open', attempts: 0 }, { lifecycle: 'open', attempts: 0 }]);
    assert.equal(await popup.getByRole('button', { name: 'Next', exact: true }).isDisabled(), true);
    evidence.guard_screenshot = await screenshot(ctx.studentPage, ctx.evidenceDir, 'exit-assessment-guard');
    await managementQuery(ctx.config, `update public.rooms set guard_mode=false where id='${fixture.room.id}'::uuid`);
    await api(ctx.tutor.id, { operation: 'read_review', room_id: fixture.room.id, assessment_id: delivered[0].assessment_id });
    const savedResult = async (assessmentId, attempt) => {
      const rows = await waitForMatch(() => query(ctx.client, 'messages', '*', 'room_id', fixture.room.id),
        rows => rows.some(row => row.assessment_event?.assessment_id === assessmentId && row.assessment_event.attempt_number === attempt),
        'persisted exit assessment result');
      return rows.find(row => row.assessment_event?.assessment_id === assessmentId && row.assessment_event.attempt_number === attempt);
    };
    const firstResult = await savedResult(delivered[0].assessment_id, 1);
    await assertExitResult(ctx.studentPage, firstResult);
    question = await openExitAssessment(ctx.studentPage, delivered[1].assessment_id);
    assert((await popup.innerText()).includes('Question 2 of 2'));
    for (const attempt of [1, 2]) {
      await question.locator('input[value="A"]').check();
      await question.getByRole('button', { name: 'Submit answer' }).click();
      await assertExitResult(ctx.studentPage, await savedResult(delivered[1].assessment_id, attempt));
    }
    evidence.ended_rows = await privateRows();
    assertQueueState(evidence.ended_rows, delivered, [{ lifecycle: 'passed', attempts: 1 }, { lifecycle: 'failed', attempts: 2 }]);
    evidence.same_visit_preparation = await prepare(ordinary.id);
    assert.equal(evidence.same_visit_preparation.no_assessment_due, true, 'Passed target became due within its resolution visit');
    evidence.messages = await query(ctx.client, 'messages', '*', 'room_id', fixture.room.id);
    evidence.stage = 'leave_and_reenter'; persist();
    await popup.getByRole('button', { name: 'Leave', exact: true }).click();
    await ctx.studentPage.waitForURL(url => !url.hash.startsWith('#/room/'), { timeout: TIMEOUT });
    evidence.stopped_navigation_resumed = ctx.studentPage.url();
    await openRoom(ctx.studentPage, ctx.appUrl, fixture.room.id);
    for (const assessment of delivered) {
      const restored = ctx.studentPage.getByTestId(`public-assessment-${assessment.assessment_id}`);
      await restored.waitFor({ timeout: TIMEOUT });
      await assertReadOnlyAssessment(restored);
    }
    for (const result of evidence.messages.filter(row => row.assessment_event?.kind === 'result')) {
      await ctx.studentPage.getByTestId(`assessment-result-${result.id}`).waitFor({ timeout: TIMEOUT });
    }
    evidence.visits_after_reentry = await visits();
    assert(evidence.visits_after_reentry.length > evidence.visits_before.length, 'Re-entry did not start a new visit');
    evidence.next_visit_preparation = await prepare(ordinary.id);
    const eligible = evidence.next_visit_preparation.context?.eligible_assessment_item_ids ?? [];
    assert(eligible.includes(fixture.items[0].id), 'Passed target was not due at the next visit');
    assert(!eligible.includes(second.id), 'Failed target was re-offered without new learning');
    evidence.stage = 'complete'; evidence.status = 'pass'; persist();
    return evidence;
  } catch (error) {
    evidence.status = 'fail'; evidence.error = error.message; persist();
    throw error;
  }
};

module.exports.assertQueueState = assertQueueState;
