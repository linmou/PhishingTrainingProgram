#!/usr/bin/env node
// Purpose: verify tutoring and queued target-specific transfer assessments across multiple knowledge points.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { openRoom, captureResponses, managementQuery, query, waitForMatch, screenshot, writeJson, TIMEOUT } = require('../browser-e2e-support');
const { startStatusJourney } = require('./transfer-status-events');
const { assertAssessmentGate, assertBlockedOrdinaryReply, assertBoundAnswers } = require('./assessment-browser-checks');

async function assessmentCycle(ctx, journey, target, label) {
  const priorMessageIds = (await query(ctx.client, 'messages', 'id', 'room_id', journey.room.id)).map(row => row.id);
  const focus = journey.observations.at(-1).message;
  writeJson(path.join(ctx.evidenceDir, `assessment-delivery-${label}-fixture.json`), {
    room_id: journey.room.id, checklist_id: journey.checklist_id,
    template_target_count: journey.template_target_count,
    focus_message_id: focus.id, expected_item_id: target.id, status_observations: journey.observations
  });
  const beforeAssessment = await query(ctx.client, 'checklist_items', '*', 'checklist_id', journey.checklist_id);
  const checklistClose = ctx.tutorPage.locator('.checklist-close');
  if (await checklistClose.isVisible()) await checklistClose.click();
  const stop = await captureResponses(ctx.tutorPage, (response) => response.url().includes('/functions/v1/assessment-api'));
  let calls;
  let prepareError;
  try {
    const preparation = ctx.tutorPage.waitForResponse(response => response.url().includes('/functions/v1/assessment-api') &&
      response.request().postDataJSON()?.operation === 'prepare_turn', { timeout: TIMEOUT });
    await ctx.tutorPage.locator('button.ai-generate-btn').click();
    const response = await preparation;
    if (response.status() !== 200) throw new Error(`Transfer preparation returned HTTP ${response.status()}`);
    await ctx.tutorPage.getByRole('heading', { name: 'Review transfer assessment' }).waitFor({ timeout: TIMEOUT });
  } catch (error) {
    prepareError = error;
  } finally {
    calls = await stop();
    writeJson(path.join(ctx.evidenceDir, `assessment-delivery-${label}-function.json`), calls);
  }
  const prepared = calls.find((call) => call.request?.operation === 'prepare_turn');
  assert.match(prepared?.request?.request_id || '', /^[0-9a-f-]{36}$/i, 'Transfer preparation did not complete');
  const providerAttempts = await managementQuery(ctx.config,
    `select * from private.transfer_provider_attempts where request_id = '${prepared.request.request_id}'::uuid order by attempt_ordinal`);
  writeJson(path.join(ctx.evidenceDir, `assessment-delivery-${label}-provider.json`), providerAttempts);
  if (prepareError) throw new Error(`Transfer preparation failed: HTTP ${prepared.status}, ${JSON.stringify(prepared.response?.error)}, provider outcomes ${providerAttempts.map(attempt => attempt.validation_outcome).join(', ')}`, { cause: prepareError });
  assert.equal(prepared.status, 200, 'Transfer preparation did not complete');
  assert.equal(prepared.response?.data?.item_id, target.id, 'Assessment scheduled the wrong knowledge point');
  assert(providerAttempts.some((attempt) => attempt.validation_outcome === 'valid'), 'No valid transfer provider attempt');
  const correctOptions = await ctx.tutorPage.locator('input[name="assessment-correct-option"]:checked')
    .evaluateAll(inputs => inputs.map(input => input.getAttribute('aria-label').replace('Correct answer ', '')));
  assert(correctOptions.length > 0, 'Review editor has no answer key');
  if (process.env.E2E_RECORD_VIDEO === '1') await ctx.tutorPage.waitForTimeout(2200);
  await ctx.tutorPage.getByRole('button', { name: 'Send assessment' }).click();
  const publicMessages = await waitForMatch(
    () => query(ctx.client, 'messages', '*', 'room_id', journey.room.id),
    (rows) => rows.some(row => row.assessment_id && row.assessment_lifecycle === 'delivered'),
    'delivered assessment in public messages'
  );
  const deliveredAssessments = await managementQuery(ctx.config,
    `select * from private.transfer_assessments where room_id='${journey.room.id}'::uuid and item_id='${target.id}'::uuid order by created_at`);
  assert.equal(deliveredAssessments.length, 1, 'Missing or duplicate assessment for this knowledge point');
  const questionMessage = publicMessages.find(row => row.id === deliveredAssessments[0].question_message_id);
  assert(questionMessage?.assessment_id, 'Delivered assessment has no matching public question');
  await ctx.studentPage.reload({ waitUntil: 'domcontentloaded' });
  const question = ctx.studentPage.locator(`[data-testid="public-assessment-${questionMessage.assessment_id}"]`);
  await question.waitFor({ timeout: TIMEOUT });
  const inputGate = await assertBlockedOrdinaryReply(ctx, journey.room.id);
  assert.equal(await question.getByRole('button', { name: 'Submit answer' }).isDisabled(), true);
  const deliveredScreenshot = await screenshot(ctx.studentPage, ctx.evidenceDir, `assessment-delivery-${label}-learner`);
  if (process.env.E2E_RECORD_VIDEO === '1') await ctx.studentPage.waitForTimeout(2200);
  const answerStop = await captureResponses(ctx.studentPage, response => response.url().includes('/functions/v1/assessment-api'));
  let answerCalls;
  let savedResult;
  try {
    for (const option of correctOptions) await question.locator(`input[value="${option}"]`).check();
    await question.getByRole('button', { name: 'Submit answer' }).click();
    const saved = await waitForMatch(() => query(ctx.client, 'messages', '*', 'room_id', journey.room.id),
      rows => rows.some(row => row.assessment_event?.assessment_id === questionMessage.assessment_id && row.assessment_event.kind === 'result'),
      'saved assessment pass message');
    savedResult = saved.find(row => row.assessment_event?.assessment_id === questionMessage.assessment_id && row.assessment_event.kind === 'result');
    await ctx.studentPage.getByTestId(`assessment-result-${savedResult.id}`).waitFor({ timeout: TIMEOUT });
  } finally {
    answerCalls = await answerStop();
    writeJson(path.join(ctx.evidenceDir, `assessment-delivery-${label}-answer-function.json`), answerCalls);
  }
  assert(answerCalls.some(call => call.request?.operation === 'process_message' && call.status === 200),
    'Assessment answer did not reach the trusted API');
  const completed = await waitForMatch(
    () => query(ctx.client, 'messages', '*', 'room_id', journey.room.id),
    rows => rows.some(row => row.assessment_id === questionMessage.assessment_id && row.assessment_result === 'pass'),
    'persisted assessment pass'
  );
  const privateAssessment = await managementQuery(ctx.config,
    `select * from private.transfer_assessments where id='${questionMessage.assessment_id}'::uuid`);
  writeJson(path.join(ctx.evidenceDir, `assessment-delivery-${label}-persisted.json`), { public_messages: completed, private_assessment: privateAssessment });
  assert.equal(privateAssessment[0]?.terminal_result, 'passed');
  assert.equal(privateAssessment[0]?.attempt_count, 1);
  assert.equal(privateAssessment[0]?.student_id, ctx.student.id);
  assert.equal(privateAssessment[0]?.question_message_id, questionMessage.id);
  const assessedItem = beforeAssessment.find(item => item.id === privateAssessment[0]?.item_id);
  assert.equal(privateAssessment[0]?.item_id, prepared.response?.data?.item_id,
    'Delivered assessment differs from the prepared target');
  assert.equal(assessedItem?.status, 'covered', 'Final assessment did not target a fully understood template item');
  const assessmentEvents = await managementQuery(ctx.config,
    `select * from private.learning_event_inbox where room_id='${journey.room.id}'::uuid and event_kind='assessment_pass' and event_payload->>'assessment_id'='${questionMessage.assessment_id}'`);
  assert(assessmentEvents.some(row => row.processing_state === 'applied'), 'Assessment pass event was not applied');
  assert(assessmentEvents.every(row => row.item_id === target.id && row.student_id === ctx.student.id),
    'Assessment outcome was applied to a different target or learner');
  const progress = (await query(ctx.client, 'checklist_items', 'status,understanding_level', 'id', assessedItem.id))[0];
  assert.equal(progress?.status, 'covered');
  assert.equal(progress?.understanding_level, 'good');
  const answers = assertBoundAnswers(completed, ctx.student.id, questionMessage.assessment_id, questionMessage.id, [correctOptions], priorMessageIds);
  const attempts = await managementQuery(ctx.config,
    `select * from private.transfer_assessment_attempts where assessment_id='${questionMessage.assessment_id}'::uuid order by attempt_number`);
  writeJson(path.join(ctx.evidenceDir, `assessment-delivery-${label}-attempts.json`), attempts);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].answer_message_id, answers[0].id);
  assert.equal(attempts[0].answer_outcome, 'passed');
  assert.deepEqual([...attempts[0].selected_option_ids].sort(), [...correctOptions].sort());
  const roomAssessments = await managementQuery(ctx.config,
    `select * from private.transfer_assessments where room_id='${journey.room.id}'::uuid and student_id='${ctx.student.id}'::uuid order by created_at`);
  assert(roomAssessments.every(row => row.closed_at && row.terminal_result), 'Assessment completion left an open lifecycle');
  const terminalGate = await assertAssessmentGate(ctx.studentPage, false);
  await ctx.studentPage.reload({ waitUntil: 'domcontentloaded' });
  const restored = ctx.studentPage.locator(`[data-testid="public-assessment-${questionMessage.assessment_id}"]`);
  await ctx.studentPage.getByTestId(`assessment-result-${savedResult.id}`).waitFor({ timeout: TIMEOUT });
  assert.equal(await restored.getByRole('button', { name: 'Submit answer' }).isDisabled(), true);
  const restoredGate = await assertAssessmentGate(ctx.studentPage, false);
  await openRoom(ctx.tutorPage, ctx.appUrl, journey.room.id);
  await ctx.tutorPage.locator('button[title="Learning Progress Checklist"]').click();
  await ctx.tutorPage.locator('.checklist-item').filter({ hasText: assessedItem.area_text })
    .locator('.status-icon.covered').waitFor();
  if (process.env.E2E_RECORD_VIDEO === '1') await ctx.tutorPage.waitForTimeout(2200);
  return {
    room_id: journey.room.id, checklist_id: journey.checklist_id,
    template_target_count: journey.template_target_count, assessed_item: assessedItem,
    focus_message_id: focus.id,
    status_observations: journey.observations.slice(), progress_before: beforeAssessment,
    function_calls: calls, provider_attempts: providerAttempts,
    public_messages: completed, assessment_id: questionMessage.assessment_id, correct_options: correctOptions,
    answer_calls: answerCalls, private_assessment: privateAssessment, private_attempts: attempts,
    room_assessments: roomAssessments, assessment_events: assessmentEvents, progress,
    input_gates: [inputGate, terminalGate, restoredGate],
    screenshots: [await screenshot(ctx.tutorPage, ctx.evidenceDir, `assessment-delivery-${label}-tutor`),
      deliveredScreenshot, await screenshot(ctx.studentPage, ctx.evidenceDir, `assessment-answer-${label}-learner`)]
  };
}

function assertTutorFeedback(message, assessment) {
  assert.equal(message.parent_message_id, assessment.terminal_answer_message_id,
    'Assessment feedback does not reply to the terminal learner answer');
  assert.equal(message.response_mode, 'tutoring', 'Assessment feedback has the wrong response mode');
  assert(Date.parse(message.created_at) > Date.parse(assessment.closed_at),
    'Assessment feedback must be persisted after the assessment closes');
}

async function tutoringStep(ctx, journey, options) {
  const { label, focusMessageId, expectedAssessmentCount, target, terminalAssessment } = options;
  await openRoom(ctx.tutorPage, ctx.appUrl, journey.room.id);
  const beforeMessages = await query(ctx.client, 'messages', '*', 'room_id', journey.room.id);
  const latestLearner = beforeMessages.filter(row => row.user_id === ctx.student.id)
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at)).at(-1);
  assert.equal(latestLearner?.id, focusMessageId, 'Tutoring step would focus a different learner message');
  const beforeIds = new Set(beforeMessages.map(row => row.id));
  const close = ctx.tutorPage.locator('.checklist-close');
  if (await close.isVisible()) await close.click();
  const stop = await captureResponses(ctx.tutorPage, response =>
    response.url().includes('/functions/v1/ai-api') || response.url().includes('/functions/v1/assessment-api'));
  let calls;
  let suggestion;
  try {
    await ctx.tutorPage.locator('button.ai-generate-btn').click();
    await ctx.tutorPage.locator('.ai-suggestion-box .ai-suggestion-content p').first().waitFor({ timeout: TIMEOUT });
    await ctx.tutorPage.waitForFunction(() => {
      const content = document.querySelector('.ai-suggestion-box .ai-suggestion-content p')?.textContent?.trim();
      return content && content !== 'Generating new response...';
    }, null, { timeout: TIMEOUT });
    suggestion = await ctx.tutorPage.locator('.ai-suggestion-box .ai-suggestion-content p').first().innerText();
    await ctx.tutorPage.getByRole('button', { name: /copy to input/i }).click();
    await ctx.tutorPage.locator('form.comment-input-form button[type="submit"]').click();
  } finally {
    calls = await stop();
    writeJson(path.join(ctx.evidenceDir, `assessment-delivery-${label}-function.json`), calls);
  }
  assert(calls.some(call => call.status === 200 && call.response?.data?.content), 'No real tutoring response');
  const messages = await waitForMatch(() => query(ctx.client, 'messages', '*', 'room_id', journey.room.id),
    rows => rows.some(row => !beforeIds.has(row.id) && row.user_role === 'tutor' && row.content === suggestion && !row.assessment_id),
    `${label} persisted tutor response`);
  const message = messages.find(row => !beforeIds.has(row.id) && row.user_role === 'tutor' && row.content === suggestion && !row.assessment_id);
  const assessments = await managementQuery(ctx.config,
    `select * from private.transfer_assessments where room_id='${journey.room.id}'::uuid and student_id='${ctx.student.id}'::uuid order by created_at`);
  const targetProgress = target ? (await query(ctx.client, 'checklist_items', '*', 'id', target.id))[0] : null;
  const evidence = { focus_message_id: focusMessageId, function_calls: calls, suggestion, message,
    private_assessments: assessments, target_progress: targetProgress, terminal_assessment: terminalAssessment,
    screenshot: await screenshot(ctx.tutorPage, ctx.evidenceDir, `assessment-delivery-${label}`) };
  writeJson(path.join(ctx.evidenceDir, `assessment-delivery-${label}-result.json`), evidence);
  assert.equal(message.parent_message_id, focusMessageId, 'Tutor response has the wrong learner focus');
  assert.equal(assessments.length, expectedAssessmentCount, 'Tutoring step scheduled an unexpected assessment');
  if (target) {
    assert.equal(targetProgress?.status, 'partially_covered', 'Tutor-only response advanced learner progress');
    assert.equal(targetProgress?.understanding_level, 'basic');
  }
  if (terminalAssessment) assertTutorFeedback(message, terminalAssessment);
  return evidence;
}

async function completeAssessmentQueue(ctx, journey, label) {
  const cycles = [];
  const feedback = [];
  const readiness = [];
  for (let ordinal = 1; ordinal <= journey.template_target_count + 1; ordinal += 1) {
    const focus = journey.observations.at(-1).message;
    const { data, error } = await ctx.client.rpc('prepare_transfer_assessment_context_v1', {
      p_room_id: journey.room.id, p_focus_student_message_id: focus.id,
      p_checklist_id: journey.checklist_id, p_actor_id: ctx.tutor.id,
      p_request_id: require('node:crypto').randomUUID()
    });
    if (error) throw new Error(`Assessment queue inspection: ${error.message}`);
    readiness.push(data);
    writeJson(path.join(ctx.evidenceDir, `assessment-delivery-${label}-queue.json`), readiness);
    if (data.no_assessment_due) return { cycles, feedback, readiness };
    assert(ordinal <= journey.template_target_count, 'Assessment queue did not terminate within the target inventory');
    const target = data.context.checklist_items.find(item => item.id === data.selected_target_item_id);
    assert(target && data.context.eligible_assessment_item_ids.includes(target.id), 'Scheduler chose an ineligible target');
    assert(!cycles.some(cycle => cycle.assessed_item.id === target.id), 'Completed target became due again without new learning');
    if (cycles.length > 0) {
      // A learner acknowledgement supplies the next ordinary-message focus after terminal feedback.
      const previous = cycles.at(-1).assessed_item;
      await journey.observe('I am ready for the next practice question.', previous, null, 'covered', 'good');
    }
    const cycle = await assessmentCycle(ctx, journey, target, `${label}-${ordinal}`);
    cycles.push(cycle);
    writeJson(path.join(ctx.evidenceDir, `assessment-delivery-${label}-${ordinal}-result.json`), cycle);
    feedback.push(await tutoringStep(ctx, journey, {
      label: `${label}-${ordinal}-terminal-feedback`,
      focusMessageId: cycle.private_assessment[0].terminal_answer_message_id,
      expectedAssessmentCount: cycle.room_assessments.length,
      target: null, terminalAssessment: cycle.private_assessment[0]
    }));
  }
  throw new Error('Assessment queue exceeded the room target inventory');
}

module.exports = async function assessmentDelivery(ctx) {
  const policy = await managementQuery(ctx.config, `select
    to_regprocedure('private.transfer_assessment_due_event(uuid)') is not null as final_policy_helper,
    exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='prepare_transfer_assessment_context_v1'
      and pg_get_functiondef(p.oid) like '%transfer_assessment_due_event%') as preparation_uses_final_policy`);
  writeJson(path.join(ctx.evidenceDir, 'assessment-delivery-policy-prerequisite.json'), {
    project_ref: ctx.config.projectRef, expected_policy: 'partial_basic_to_covered_good', live_policy: policy
  });
  assert(policy[0]?.final_policy_helper && policy[0]?.preparation_uses_final_policy,
    'Live prerequisite mismatch: deploy the final assessment policy before this two-target journey; hosted Partial/Basic scheduling cannot verify it');
  const journey = await startStatusJourney(ctx);
  const firstTutoring = await tutoringStep(ctx, journey, {
    label: 'domain-tutoring', focusMessageId: journey.observations.at(-1).message.id,
    expectedAssessmentCount: 0, target: journey.explanation, terminalAssessment: null
  });
  await journey.observe('testdrive.info is not the social media platform address. I would go to the real site myself instead of using that link.',
    journey.explanation, 'demonstrated_understanding', 'covered', 'good');
  const firstQueue = await completeAssessmentQueue(ctx, journey, 'domain');
  const first = firstQueue.cycles.find(cycle => cycle.assessed_item.id === journey.explanation.id);
  assert(first, 'URL-domain learning did not complete its assessment');
  const items = await query(ctx.client, 'checklist_items', 'id,area_text,status,understanding_level', 'checklist_id', journey.checklist_id);
  const secondTarget = items.find(item => item.area_text.startsWith('Official Support:'));
  assert(secondTarget?.id && secondTarget.id !== first.assessed_item.id, 'Missing distinct Official Support target');
  assert.equal(secondTarget.status, 'pending', 'Second target advanced before its tutoring evidence');
  await journey.observe('I think I should contact the platform support team about the warning, but I do not know where to find their real contact details.',
    secondTarget, 'initial_signal', 'partially_covered', 'basic');
  const between = await tutoringStep(ctx, journey, {
    label: 'support-tutoring', focusMessageId: journey.observations.at(-1).message.id,
    expectedAssessmentCount: firstQueue.cycles.length, target: secondTarget, terminalAssessment: null
  });
  await journey.observe('For official support, I would open the platform app myself and use its Help or Support page to contact them. I would not use the phone number or contact link supplied by this warning because it may reach the scammer.',
    secondTarget, 'demonstrated_understanding', 'covered', 'good');
  const secondQueue = await completeAssessmentQueue(ctx, journey, 'support');
  const second = secondQueue.cycles.find(cycle => cycle.assessed_item.id === secondTarget.id);
  assert(second, 'Official Support learning did not complete its assessment');
  const cycles = [...firstQueue.cycles, ...secondQueue.cycles];
  assert.equal(cycles.at(-1).room_assessments.length, cycles.length, 'Journey created unexpected assessment lifecycles');
  assert.equal(new Set(cycles.map(cycle => cycle.assessment_id)).size, cycles.length);
  assert.notEqual(first.assessment_id, second.assessment_id, 'Second target reused the first assessment');
  assert.notEqual(first.private_assessment[0].item_id, second.private_assessment[0].item_id);
  const finalProgress = await query(ctx.client, 'checklist_items', '*', 'checklist_id', journey.checklist_id);
  for (const cycle of cycles) {
    const progress = finalProgress.find(item => item.id === cycle.assessed_item.id);
    assert.equal(progress?.status, 'covered');
    assert.equal(progress?.understanding_level, 'good');
  }
  return { room_id: journey.room.id, checklist_id: journey.checklist_id,
    template_target_count: journey.template_target_count, cycles,
    first_target_tutoring: firstTutoring, assessment_queues: [firstQueue, secondQueue],
    between_cycles: between, status_observations: journey.observations, final_progress: finalProgress };
};

module.exports.assertTutorFeedback = assertTutorFeedback;
module.exports.tutoringStep = tutoringStep;
