#!/usr/bin/env node
// Test responsibility: verify saved backend result messages, two-attempt identity/reload and the real tutor request consuming assessment dialogue.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openRoom, insert, query, requestId, waitForMatch, captureResponses, managementQuery, screenshot, writeJson, TIMEOUT, ROOMS } = require('../browser-e2e-support');
const { assessmentRoom, deliverFixedAssessment } = require('./assessment-fixture');
const { assertAssessmentGate, assertBlockedOrdinaryReply, assertBoundAnswers } = require('./assessment-browser-checks');
const { tutoringStep } = require('./assessment-delivery');

async function draftRetryFeedback(ctx, roomId, label) {
  await openRoom(ctx.tutorPage, ctx.appUrl, roomId);
  const close = ctx.tutorPage.locator('.checklist-close');
  if (await close.isVisible()) await close.click();
  const stop = await captureResponses(ctx.tutorPage, response =>
    response.url().includes('/functions/v1/ai-api') || response.url().includes('/functions/v1/assessment-api'));
  let calls;
  try {
    await ctx.tutorPage.locator('button.ai-generate-btn').click();
    await Promise.race([
      ctx.tutorPage.locator('.ai-suggestion-box .ai-suggestion-regenerate').waitFor({ timeout: TIMEOUT }),
      ctx.tutorPage.locator('.transfer-turn-status[data-transfer-status="validation"], .transfer-turn-status[data-transfer-status="retryable"]')
        .waitFor({ timeout: TIMEOUT }).then(async () => {
          throw new Error(await ctx.tutorPage.locator('.transfer-turn-status').last().innerText());
        })
    ]);
    await ctx.tutorPage.locator('.ai-suggestion-box .ai-suggestion-regenerate').click();
    await ctx.tutorPage.locator('.ai-suggestion-box .ai-suggestion-regenerate:not([disabled])').waitFor({ timeout: TIMEOUT });
  } finally {
    calls = await stop();
    writeJson(path.join(ctx.evidenceDir, `assessment-answer-${label}-retry-drafts.json`), calls);
  }
  const providerCalls = calls.filter(call => call.url.includes('/ai-api') && call.status === 200);
  assert(providerCalls.length >= 2, 'Initial/regenerated requests did not reach the real provider');
  const decisions = providerCalls.flatMap(call => {
    try { return [JSON.parse(call.response.data.content)]; } catch { return []; }
  });
  const valid = decision => typeof decision.response === 'string' && decision.response.trim() &&
    ((decision.decision?.guard_mode === true && decision.decision.instruction === null) ||
      (decision.decision?.guard_mode === false && ['protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation'].includes(decision.decision.instruction)));
  assert(decisions.filter(valid).length >= 2 && valid(decisions.at(-1)), 'Initial/regenerated provider decisions violated the response contract');
  assert(calls.every(call => !JSON.stringify(call.request).includes('VERIFIED ASSESSMENT STATE')),
    'Retry request retained the removed state section');
  return calls;
}

async function answer(ctx, label, selections, expectedStatus) {
  const fixture = await assessmentRoom({ ...ctx, kind: `assessment-answer-${label}` });
  const delivered = await deliverFixedAssessment(ctx, fixture);
  const priorMessageIds = (await query(ctx.client, 'messages', 'id', 'room_id', fixture.room.id)).map(row => row.id);
  await openRoom(ctx.studentPage, ctx.appUrl, fixture.room.id);
  const question = ctx.studentPage.locator(`[data-testid="public-assessment-${delivered.assessment_id}"]`);
  await question.waitFor({ timeout: TIMEOUT });
  const inputGates = [await assertBlockedOrdinaryReply(ctx, fixture.room.id)];
  assert.equal(await question.getByRole('button', { name: 'Submit answer' }).isDisabled(), true,
    'Assessment accepted an empty selection');
  await ctx.studentPage.reload({ waitUntil: 'domcontentloaded' });
  await question.waitFor({ timeout: TIMEOUT });
  inputGates.push(await assertAssessmentGate(ctx.studentPage, true));
  const stop = await captureResponses(ctx.studentPage, (response) =>
    response.url().includes('/functions/v1/assessment-api') || response.url().includes('/functions/v1/ai-api'));
  const resultIds = [];
  const retryDrafts = [];
  let calls;
  try {
    for (const [index, selected] of selections.entries()) {
      await question.locator(`input[value="${selected}"]`).check();
      await question.getByRole('button', { name: 'Submit answer' }).click();
      const saved = await waitForMatch(
        () => query(ctx.client, 'messages', '*', 'room_id', fixture.room.id),
        rows => rows.some(row => row.assessment_event?.assessment_id === delivered.assessment_id &&
          row.assessment_event.kind === 'result' && row.assessment_event.attempt_number === index + 1),
        `${label} saved result ${index + 1}`);
      const result = saved.find(row => row.assessment_event?.assessment_id === delivered.assessment_id &&
        row.assessment_event.kind === 'result' && row.assessment_event.attempt_number === index + 1);
      resultIds.push(result.id);
      await ctx.studentPage.getByTestId(`assessment-result-${result.id}`).waitFor({ timeout: TIMEOUT });
      assert.equal(result.assessment_event.outcome, selected === 'B' ? 'passed' : index === 0 ? 'retry' : 'failed');
      assert.equal(result.parent_message_id, result.assessment_event.answer_message_id);
      if (result.assessment_event.outcome !== 'failed') {
        assert.equal(result.content, result.assessment_event.outcome === 'passed' ? 'Correct.' : 'Incorrect. One attempt remaining.',
          'Retry/pass published more than its deterministic result');
      }
      if (index < selections.length - 1) {
        retryDrafts.push(await draftRetryFeedback(ctx, fixture.room.id, label));
        inputGates.push(await assertBlockedOrdinaryReply(ctx, fixture.room.id));
        await ctx.studentPage.reload({ waitUntil: 'domcontentloaded' });
        await ctx.studentPage.getByTestId(`assessment-result-${result.id}`).waitFor({ timeout: TIMEOUT });
        inputGates.push(await assertAssessmentGate(ctx.studentPage, true));
      }
    }
  } finally { calls = await stop(); }
  writeJson(path.join(ctx.evidenceDir, `assessment-answer-${label}-function.json`), calls);
  assert(calls.some((call) => call.request?.operation === 'process_message' && call.status === 200), 'Assessment answer did not reach the trusted API');
  assert(!calls.some(call => call.url.includes('/ai-api') || ['prepare_turn', 'analyze_message'].includes(call.request?.operation)),
    'Grading unexpectedly invoked an LLM-backed operation');
  inputGates.push(await assertAssessmentGate(ctx.studentPage, false));
  await ctx.studentPage.reload({ waitUntil: 'domcontentloaded' });
  const restored = ctx.studentPage.locator(`[data-testid="public-assessment-${delivered.assessment_id}"]`);
  await restored.waitFor({ timeout: TIMEOUT });
  await ctx.studentPage.getByTestId(`assessment-result-${resultIds.at(-1)}`).waitFor({ timeout: TIMEOUT });
  assert.equal(await restored.getByRole('button', { name: 'Submit answer' }).isDisabled(), true);
  inputGates.push(await assertAssessmentGate(ctx.studentPage, false));
  const messages = await waitForMatch(
    () => query(ctx.client, 'messages', '*', 'room_id', fixture.room.id),
    (rows) => rows.some((row) => row.assessment_result === (expectedStatus === 'passed' ? 'pass' : 'fail')),
    `${label} persisted assessment result`
  );
  const privateRows = await managementQuery(ctx.config,
    `select id,lifecycle,terminal_result,attempt_count,closed_at from private.transfer_assessments where id = '${delivered.assessment_id}'::uuid`);
  writeJson(path.join(ctx.evidenceDir, `assessment-answer-${label}-persisted.json`), { messages, private_assessment: privateRows });
  assert(privateRows.some((row) => row.terminal_result === expectedStatus && row.attempt_count === selections.length),
    'Private assessment result or attempt count does not match the learner answers');
  const answers = assertBoundAnswers(messages, ctx.student.id, delivered.assessment_id,
    delivered.question_message_id, selections.map(selected => [selected]), priorMessageIds);
  const resultMessages = messages.filter(row => row.assessment_event?.assessment_id === delivered.assessment_id && row.assessment_event.kind === 'result');
  assert.equal(resultMessages.length, selections.length, 'Reload duplicated or lost a grading result');
  assert.deepEqual(new Set(resultMessages.map(row => row.id)), new Set(resultIds));
  const attempts = await managementQuery(ctx.config,
    `select * from private.transfer_assessment_attempts where assessment_id='${delivered.assessment_id}'::uuid order by attempt_number`);
  writeJson(path.join(ctx.evidenceDir, `assessment-answer-${label}-attempts.json`), attempts);
  assert.equal(attempts.length, selections.length, 'Authoritative attempts differ from selected option submissions');
  for (const [index, attempt] of attempts.entries()) {
    assert.equal(attempt.attempt_number, index + 1);
    assert.deepEqual(attempt.selected_option_ids, [selections[index]]);
    assert(answers.some(row => row.id === attempt.answer_message_id), 'Attempt references a different learner answer');
  }
  const terminalAnswer = answers.find(row => row.id === attempts.at(-1).answer_message_id);
  assert(terminalAnswer, 'Terminal accepted attempt has no bound learner answer');
  const terminalTutor = await tutoringStep(ctx, { room: fixture.room }, {
    label: `answer-${label}-terminal-tutor`, focusMessageId: terminalAnswer.id,
    expectedAssessmentCount: 1,
    terminalAssessment: { terminal_answer_message_id: terminalAnswer.id, closed_at: privateRows[0].closed_at }
  });
  const tutorCall = terminalTutor.function_calls.find(call => call.url.includes('/ai-api') && call.status === 200);
  assert(tutorCall?.response?.data?.content, 'Terminal assessment feedback did not reach the real tutor provider');
  assert(!terminalTutor.function_calls.some(call => ['analyze_message', 'prepare_turn'].includes(call.request?.operation)),
    'Assessment answer was incorrectly treated as ordinary learning evidence');
  assert(tutorCall.request.messages.every(message => !message.content.includes('VERIFIED ASSESSMENT STATE')),
    'Tutor request retained the removed assessment state section');
  const ecological = tutorCall.request.messages.flatMap(message => message.content.split('\n')).flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  }).find(value => typeof value?.conversation_history === 'string');
  assert(ecological, 'Tutor request omitted ordinary dialogue history');
  const history = ecological.conversation_history;
  const questionRow = messages.find(row => row.id === delivered.question_message_id);
  for (const option of questionRow.assessment_options) assert(history.includes(option.text), 'Tutor history omitted a public option');
  for (const result of resultMessages) {
    assert(history.includes(result.content), 'Tutor history omitted a saved grading result');
    assert(history.includes(result.id) || history.includes(result.assessment_event.event_key), 'Tutor history omitted result attribution');
  }
  const postTutorMessages = await query(ctx.client, 'messages', '*', 'room_id', fixture.room.id);
  assert.equal(postTutorMessages.filter(row => row.assessment_event?.assessment_id === delivered.assessment_id && row.assessment_event.kind === 'result').length,
    selections.length, 'Tutor response or duplicate processing created another result');
  return {
    room_id: fixture.room.id, question_message_id: delivered.question_message_id,
    assessment_id: delivered.assessment_id, selections, function_calls: calls,
    public_messages: messages, private_assessment: privateRows, private_attempts: attempts, input_gates: inputGates,
    terminal_tutor: terminalTutor, retry_drafts: retryDrafts, saved_result_messages: resultMessages, tutor_dialogue_history: history,
    screenshot: await screenshot(ctx.studentPage, ctx.evidenceDir, `assessment-answer-${label}`)
  };
}

async function recovery(ctx) {
  const fixture = await assessmentRoom({ ...ctx, kind: 'assessment-delivery' });
  const delivered = await deliverFixedAssessment(ctx, fixture);
  const calls = [];
  async function operation(actorId, body, expectedStatus = 200) {
    const response = await fetch(`${ctx.config.projectUrl}/functions/v1/assessment-api`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.config.anonKey,
        Authorization: `Bearer ${ctx.config.anonKey}`, 'x-application-user-id': actorId, 'x-practice-contract': 'cyberbullying-v1' },
      body: JSON.stringify({ request_id: requestId(), ...body })
    });
    const payload = await response.json();
    calls.push({ request: body, status: response.status, response: payload });
    assert.equal(response.status, expectedStatus, `Recovery API returned unexpected status: ${JSON.stringify(payload)}`);
    return payload.ok ? payload.data : payload;
  }
  const ambiguous = await insert(ctx.client, 'messages', {
    room_id: fixture.room.id, user_id: ctx.student.id, user_role: 'student',
    content: 'A or B', parent_message_id: delivered.question_message_id, assessment_id: delivered.assessment_id,
  });
  const reviewed = await operation(ctx.tutor.id, { operation: 'read_review', room_id: fixture.room.id,
    assessment_id: delivered.assessment_id });
  assert.equal(reviewed.history_readiness.ready, true, 'Completed unscored answer remained pending');
  assert(reviewed.history_readiness.handled_answer_message_ids.includes(ambiguous.id));
  const rejected = await operation(ctx.student.id, { operation: 'process_message',
    message_id: ambiguous.id, assessment_id: delivered.assessment_id });
  assert.equal(rejected.attempts_used, 0, 'Ambiguous answer consumed an attempt');
  assert.equal(rejected.result_message, null, 'Ambiguous answer acquired a grade');
  await managementQuery(ctx.config, `update public.rooms set guard_mode=true where id='${fixture.room.id}'::uuid`);
  const deferred = await insert(ctx.client, 'messages', {
    room_id: fixture.room.id, user_id: ctx.student.id, user_role: 'student', content: 'B',
    parent_message_id: delivered.question_message_id, assessment_id: delivered.assessment_id,
    assessment_selected_option_ids: ['B'],
  });
  const guarded = await operation(ctx.tutor.id, { operation: 'read_review', room_id: fixture.room.id,
    assessment_id: delivered.assessment_id });
  assert.equal(guarded.history_readiness.ready, true, 'Guard deferral stranded trusted readiness');
  assert(guarded.history_readiness.handled_answer_message_ids.includes(deferred.id));
  let attempts = await managementQuery(ctx.config,
    `select * from private.transfer_assessment_attempts where assessment_id='${delivered.assessment_id}'::uuid`);
  assert.equal(attempts.length, 0, 'Guard-only deferral consumed an attempt');
  const guardDrafts = await draftRetryFeedback(ctx, fixture.room.id, 'guard-deferred');
  await managementQuery(ctx.config, `update public.rooms set guard_mode=false where id='${fixture.room.id}'::uuid`);
  const recovered = await operation(ctx.tutor.id, { operation: 'read_review', room_id: fixture.room.id,
    assessment_id: delivered.assessment_id });
  assert.equal(recovered.history_readiness.ready, true);
  attempts = await managementQuery(ctx.config,
    `select * from private.transfer_assessment_attempts where assessment_id='${delivered.assessment_id}'::uuid`);
  assert.equal(attempts.length, 1, 'Leaving Guard did not recover exactly one accepted answer');
  assert.equal(attempts[0].answer_message_id, deferred.id);
  const saved = (await query(ctx.client, 'messages', '*', 'room_id', fixture.room.id))
    .find(row => row.assessment_event?.answer_message_id === deferred.id);
  assert(saved && saved.assessment_event.outcome === 'passed');
  await openRoom(ctx.studentPage, ctx.appUrl, fixture.room.id);
  await ctx.studentPage.getByTestId(`assessment-result-${saved.id}`).waitFor({ timeout: TIMEOUT });
  const denied = await ctx.client.from('messages').delete().eq('id', saved.id);
  assert(denied.error, 'An individual trusted result could be deleted');
  const deniedClear = await operation(ctx.student.id, { operation: 'clear_chat_history', room_id: fixture.room.id }, 403);
  assert.equal(deniedClear.ok, false, 'A learner could clear trusted assessment history');
  const evidence = { room_id: fixture.room.id, delivered, ambiguous, deferred, calls, guard_drafts: guardDrafts, attempts, saved,
    unauthorized_clear: deniedClear, individual_delete_error: { code: denied.error.code, message: denied.error.message } };
  writeJson(path.join(ctx.evidenceDir, 'assessment-answer-recovery.json'), evidence);
  await openRoom(ctx.tutorPage, ctx.appUrl, fixture.room.id);
  const clearStop = await captureResponses(ctx.tutorPage, response => response.url().includes('/functions/v1/assessment-api'));
  const errors = [];
  const onConsole = message => { if (message.type() === 'error') errors.push(message.text()); };
  const onDialog = async dialog => { errors.push(dialog.message()); await dialog.dismiss(); };
  ctx.tutorPage.on('console', onConsole);
  ctx.tutorPage.on('dialog', onDialog);
  try {
    await ctx.tutorPage.getByTitle('Clear Chat History', { exact: true }).click();
    const download = ctx.tutorPage.waitForEvent('download', { timeout: TIMEOUT });
    await ctx.tutorPage.getByRole('button', { name: 'Download Backup & Clear History', exact: true }).click();
    const backupPath = path.join(ctx.evidenceDir, 'assessment-answer-recovery-backup.json');
    await (await download).saveAs(backupPath);
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    assert(JSON.stringify(backup).includes(saved.assessment_event.event_key), 'Room backup lost result provenance');
    await waitForMatch(() => query(ctx.client, 'messages', 'id', 'room_id', fixture.room.id),
      rows => rows.length === 0, 'authorized clear history with immutable results');
    await ctx.tutorPage.getByTestId(`assessment-result-${saved.id}`).waitFor({ state: 'hidden', timeout: TIMEOUT });
  } finally {
    ctx.tutorPage.off('console', onConsole);
    ctx.tutorPage.off('dialog', onDialog);
    writeJson(path.join(ctx.evidenceDir, 'assessment-answer-owner-clear.json'), { errors, calls: await clearStop() });
  }
  evidence.owner_clear_history = 'passed';
  writeJson(path.join(ctx.evidenceDir, 'assessment-answer-recovery.json'), evidence);
  return evidence;
}

async function cancellation(ctx, reusableRoomId) {
  await ctx.detachRooms();
  await ctx.cleanupRoom(reusableRoomId);
  const fixture = await assessmentRoom({ ...ctx, kind: 'assessment-answer-pass' });
  const delivered = await deliverFixedAssessment(ctx, fixture);
  const answer = await insert(ctx.client, 'messages', {
    room_id: fixture.room.id, user_id: ctx.student.id, user_role: 'student',
    content: 'Can you explain this question?', parent_message_id: delivered.question_message_id,
    assessment_id: delivered.assessment_id,
  });
  const providerCalls = await draftRetryFeedback(ctx, fixture.room.id, 'cancellation');
  const messages = await query(ctx.client, 'messages', '*', 'room_id', fixture.room.id);
  const closure = messages.find(row => row.assessment_event?.assessment_id === delivered.assessment_id &&
    row.assessment_event.kind === 'closure');
  assert(closure, 'Assistance did not persist a closure message');
  assert.equal(closure.assessment_event.closure_reason, 'assisted');
  assert.equal(closure.assessment_event.attempts_used, 0);
  assert.equal(closure.assessment_event.answer_message_id, answer.id);
  assert(!messages.some(row => row.assessment_event?.assessment_id === delivered.assessment_id &&
    row.assessment_event.kind === 'result'), 'Cancellation invented a grade');
  await openRoom(ctx.studentPage, ctx.appUrl, fixture.room.id);
  await ctx.studentPage.getByTestId(`assessment-result-${closure.id}`).waitFor({ timeout: TIMEOUT });
  assert.equal(await ctx.studentPage.getByTestId(`public-assessment-${delivered.assessment_id}`)
    .getByRole('button', { name: 'Submit answer' }).isDisabled(), true);
  return { room_id: fixture.room.id, delivered, answer, closure, function_calls: providerCalls,
    screenshot: await screenshot(ctx.studentPage, ctx.evidenceDir, 'assessment-cancellation') };
}

module.exports = async function assessmentAnswer(ctx) {
  const selectedCase = process.env.E2E_ASSESSMENT_CASE;
  if (selectedCase === 'recovery') return { recovery: await recovery(ctx) };
  if (selectedCase === 'cancellation') return { cancelled: await cancellation(ctx, ROOMS['assessment-answer-pass'].id) };
  if (selectedCase) throw new Error(`Unknown E2E_ASSESSMENT_CASE: ${selectedCase}`);
  const passed = await answer(ctx, 'pass', ['B'], 'passed');
  const failed = await answer(ctx, 'failure', ['A', 'A'], 'failed');
  const recovered = await recovery(ctx);
  const cancelled = await cancellation(ctx, passed.room_id);
  return { passed, failed, recovery: recovered, cancelled };
};
