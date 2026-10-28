#!/usr/bin/env node
// Test responsibility: assessment-api concurrent/retried grading and learner recovery after a real realtime disconnect.
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { assertStaging } = require('./assessment-security');
const { assessmentRoom, deliverFixedAssessment } = require('./assessment-fixture');
const { openRoom, query, managementQuery, requestId, writeJson, TIMEOUT } = require('../browser-e2e-support');

module.exports = async function assessmentReplay(ctx) {
  assertStaging(ctx.config);
  const evidence = { status: 'running', calls: [], realtime: { opened: 0, closed: 0 } };
  const persist = () => writeJson(path.join(ctx.evidenceDir, 'assessment-replay.json'), evidence);
  const page = ctx.studentPage;
  const context = page.context();
  const onSocket = socket => {
    if (!socket.url().includes('/realtime/')) return;
    evidence.realtime.opened++;
    socket.on('close', () => { evidence.realtime.closed++; });
  };
  page.on('websocket', onSocket);
  // Keep handles only to interrupt real network connections; application data is never injected.
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.__assessmentTestSockets = [];
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args) {
        super(...args);
        if (String(args[0]).includes('/realtime/')) window.__assessmentTestSockets.push(this);
      }
    };
  });
  async function api(body) {
    const response = await fetch(`${ctx.config.projectUrl}/functions/v1/assessment-api`, {
      method: 'POST', headers: { apikey: ctx.config.anonKey, Authorization: `Bearer ${ctx.config.anonKey}`,
        'Content-Type': 'application/json', 'x-application-user-id': ctx.student.id,
        'x-practice-contract': 'cyberbullying-v2' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
    });
    const payload = await response.json();
    evidence.calls.push({ operation: body.operation, request_id: body.request_id, status: response.status,
      message_id: payload.data?.message?.id, answer_outcome: payload.data?.answer_outcome,
      error_code: payload.error?.code }); persist();
    assert.equal(response.status, 200, 'Replay control operation failed');
    return payload.data;
  }
  async function state(roomId, assessmentId) {
    const rows = await managementQuery(ctx.config, `select id,attempt_count,lifecycle from private.transfer_assessments
      where id='${assessmentId}'::uuid`);
    const attempts = await managementQuery(ctx.config, `select id,answer_message_id,attempt_number from private.transfer_assessment_attempts
      where assessment_id='${assessmentId}'::uuid order by attempt_number`);
    const messages = await query(ctx.client, 'messages', '*', 'room_id', roomId);
    return { assessment: rows[0], attempts, result_ids: messages.filter(row =>
      row.assessment_event?.assessment_id === assessmentId && row.assessment_event.kind === 'result').map(row => row.id).sort() };
  }
  persist();
  try {
    const fixture = await assessmentRoom({ ...ctx, kind: 'assessment-answer-pass' });
    const delivered = await deliverFixedAssessment(ctx, fixture);
    await ctx.detachRooms();
    await openRoom(page, ctx.appUrl, fixture.room.id);
    await page.getByTestId(`public-assessment-${delivered.assessment_id}`).waitFor({ timeout: TIMEOUT });
    await page.waitForFunction(() => window.__assessmentTestSockets.some(socket => socket.readyState === WebSocket.OPEN), undefined, { timeout: TIMEOUT });
    await context.setOffline(true);
    await page.evaluate(() => window.__assessmentTestSockets.forEach(socket => socket.close()));
    await page.waitForFunction(() => window.__assessmentTestSockets.every(socket => socket.readyState === WebSocket.CLOSED), undefined, { timeout: TIMEOUT });
    assert(evidence.realtime.closed > 0, 'No real realtime socket was disconnected');
    evidence.disconnected_at = new Date().toISOString(); persist();
    const postedRequest = { operation: 'post_message', request_id: requestId(), room_id: fixture.room.id,
      assessment_id: delivered.assessment_id, parent_message_id: delivered.question_message_id,
      content: 'B', selected_option_ids: ['B'] };
    const posted = await api(postedRequest);
    const repeated = await api(postedRequest);
    assert.equal(repeated.message.id, posted.message.id, 'A repeated request created another answer');
    const grade = { operation: 'process_message', room_id: fixture.room.id,
      assessment_id: delivered.assessment_id, message_id: posted.message.id };
    const responses = await Promise.all([api({ ...grade, request_id: requestId() }), api({ ...grade, request_id: requestId() })]);
    assert(responses.every(row => row.answer_outcome === 'passed'), 'Concurrent grading lost the passing outcome');
    evidence.before_reconnect = await state(fixture.room.id, delivered.assessment_id);
    assert.equal(evidence.before_reconnect.assessment.attempt_count, 1);
    assert.equal(evidence.before_reconnect.attempts.length, 1);
    assert.equal(evidence.before_reconnect.attempts[0].answer_message_id, posted.message.id);
    assert.equal(evidence.before_reconnect.result_ids.length, 1);
    const resultId = evidence.before_reconnect.result_ids[0];
    assert.equal(await page.getByTestId(`assessment-result-${resultId}`).count(), 0, 'Offline browser unexpectedly received the saved result');
    await context.setOffline(false);
    evidence.reconnected_at = new Date().toISOString(); persist();
    // Realtime reconnect must restore missed persisted history without a page reload.
    await page.getByTestId(`assessment-result-${resultId}`).waitFor({ timeout: TIMEOUT });
    evidence.reconnect_without_reload = 'pass';
    await api({ ...grade, request_id: requestId() });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId(`assessment-result-${resultId}`).waitFor({ timeout: TIMEOUT });
    assert.equal(await page.getByTestId(`assessment-result-${resultId}`).count(), 1);
    evidence.after_reload = await state(fixture.room.id, delivered.assessment_id);
    assert.deepEqual(evidence.after_reload, evidence.before_reconnect, 'Reconnect/replay changed accepted attempts or saved results');
    evidence.status = 'pass';
  } catch (error) {
    evidence.status = 'fail'; evidence.error = error.message; throw error;
  } finally {
    try { await context.setOffline(false); }
    catch {
      evidence.network_restoration = 'fail'; persist();
      const error = new Error('Learner browser network restoration failed'); error.cleanupFailed = true; throw error;
    } finally { page.off('websocket', onSocket); persist(); }
  }
  return evidence;
};
