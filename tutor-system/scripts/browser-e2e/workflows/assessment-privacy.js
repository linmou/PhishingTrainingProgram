// Explicit staging-only learner privacy acceptance: real HTTP, realtime, DOM and downloads.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { assertStaging } = require('./assessment-security');
const { assessmentRoom, deliverFixedAssessment } = require('./assessment-fixture');
const { assertSavedResult } = require('./assessment-result-checks');
const { captureLearnerData } = require('./assessment-privacy-checks');
const { openRoom, query, waitForMatch, managementQuery, writeJson, requestId, TIMEOUT } = require('../browser-e2e-support');

async function privacyJourney(ctx, outcome) {
  const marker = crypto.randomUUID();
  const capture = captureLearnerData(ctx.studentPage, ctx.config.projectUrl);
  const evidence = { outcome, phases: [], status: 'running', stage: 'room_fixture' };
  const file = path.join(ctx.evidenceDir, `assessment-privacy-${outcome}.json`);
  const approvedResults = [];
  const requiredResults = [];
  let publicStem;
  const privateValues = [
    { label: 'concept', value: `private-concept-${marker}` },
    { label: 'source_context', value: `private-source-${marker}` },
    { label: 'changed_context', value: `private-changed-${marker}` },
    { label: 'raw_provider', value: `private-provider-${marker}` },
    { label: 'rationale', value: `private-rationale-${marker}` }
  ];
  async function checkpoint(label) {
    evidence.stage = `checkpoint_${label}`;
    capture.record('dom', await ctx.studentPage.locator('.room-post').innerText());
    for (const [format, button] of [['json', 'Complete Data (JSON)'], ['txt', 'Chat History (TXT)']]) {
      await ctx.studentPage.getByTitle('Download Chat History', { exact: true }).click();
      const download = ctx.studentPage.waitForEvent('download', { timeout: TIMEOUT });
      await ctx.studentPage.getByRole('button', { name: button, exact: true }).click();
      // Scan the actual downloaded bytes, then remove the raw file: a failed export may contain private material.
      const temporary = path.join(ctx.evidenceDir, `.privacy-${outcome}-${label}.${format}`);
      try {
        await (await download).saveAs(temporary);
        const content = fs.readFileSync(temporary, 'utf8');
        if (format === 'json') {
          const exported = JSON.parse(content);
          assert(Array.isArray(exported.messages) && exported.messages.some(row => row.id === evidence.question_message_id), 'Export omitted the real question');
          for (const result of requiredResults) assert(exported.messages.some(row => row.id === result.id && row.content === result.content), 'Export omitted a saved result');
          capture.record('export_json', exported);
        } else {
          assert(content.includes(publicStem), 'Text export omitted the real question');
          for (const result of requiredResults) assert(content.includes(result.content), 'Text export omitted a saved result');
          capture.record('export_txt', content);
        }
      } finally { fs.rmSync(temporary, { force: true }); }
    }
    const observations = await capture.checkpoint({ privateValues, approvedResults });
    const phase = { label, observations, status: observations.some(row => row.violations.length) ? 'fail' : 'pass' };
    evidence.phases.push(phase); writeJson(file, evidence);
    assert.equal(phase.status, 'pass', `Learner privacy leak at ${label}; see ${path.basename(file)}`);
  }
  try {
    const fixture = await assessmentRoom({ ...ctx, kind: outcome === 'passed' ? 'assessment-answer-pass' : 'assessment-answer-failure' });
    evidence.stage = 'assessment_delivery';
    const delivered = await deliverFixedAssessment(ctx, fixture, marker);
    evidence.room_id = fixture.room.id; evidence.assessment_id = delivered.assessment_id;
    evidence.question_message_id = delivered.question_message_id; publicStem = delivered.assessment.stem;
    privateValues.push({ label: 'safe_explanation', value: delivered.assessment.learner_safe_explanation });
    // Delivery persists private canaries before the reviewed payload becomes immutable.
    evidence.stage = 'private_canary';
    const seeded = await managementQuery(ctx.config, `select reviewed_private_payload->>'raw_model_output' as marker,
        reviewed_private_payload->>'rationale' as rationale
      from private.transfer_assessments
      where id='${delivered.assessment_id}'::uuid
      `);
    evidence.stage = 'private_canary_readback';
    assert.equal(seeded[0]?.marker, `private-provider-${marker}`, 'Private canary was not actually persisted');
    assert.equal(seeded[0]?.rationale, `private-rationale-${marker}`, 'Private rationale canary was not actually persisted');
    evidence.stage = 'provider_canary';
    const providerFixture = await ctx.client.rpc('record_transfer_provider_attempt_v1', {
      p_request_id: requestId(), p_room_id: fixture.room.id, p_student_id: ctx.student.id,
      p_checklist_id: fixture.checklist.id, p_focus_student_message_id: fixture.focus.id,
      p_attempt_ordinal: 1, p_provider_base_url: 'https://privacy-fixture.invalid/v1',
      p_provider_model: 'privacy-fixture-no-provider-call', p_max_tokens: 1,
      p_request_hash: crypto.createHash('sha256').update(marker).digest('hex'),
      p_request_payload: { fixture_only: true, private_marker: `private-provider-${marker}` },
      p_raw_response: { fixture_only: true, raw_model_output: `private-provider-${marker}` },
      p_finish_reason: 'fixture_only', p_validation_outcome: 'privacy_fixture_only', p_error_code: 'SYNTHETIC_PRIVACY_FIXTURE'
    });
    assert(!providerFixture.error && providerFixture.data, 'Private provider canary fixture was not stored');
    evidence.stage = 'provider_canary_readback';
    const storedProvider = await managementQuery(ctx.config,
      `select raw_response->>'raw_model_output' as marker from private.transfer_provider_attempts where id='${providerFixture.data}'::uuid`);
    assert.equal(storedProvider[0]?.marker, `private-provider-${marker}`, 'Provider audit canary is missing');
    evidence.provider_audit_fixture_only = true; // A leak-detection fixture, never a real-provider acceptance result.
    evidence.stage = 'question_realtime';
    await waitForMatch(async () => capture.hasRealtimeRow(delivered.question_message_id), Boolean, 'actual delivered-question realtime event');
    evidence.stage = 'question_dom';
    await openRoom(ctx.studentPage, ctx.appUrl, fixture.room.id);
    const question = ctx.studentPage.getByTestId(`public-assessment-${delivered.assessment_id}`);
    await question.waitFor({ timeout: TIMEOUT });
    // Exercise the real error boundary with the learner's own identity, not a fake error response.
    evidence.stage = 'learner_review_denial';
    const denied = await ctx.studentPage.evaluate(async ({ url, key, actor, room, assessment, request }) => {
      const response = await fetch(url + '/functions/v1/assessment-api', {
        method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
          'x-application-user-id': actor, 'x-practice-contract': 'cyberbullying-v2' },
        body: JSON.stringify({ operation: 'read_review', room_id: room, assessment_id: assessment, request_id: request })
      });
      return { status: response.status, body: await response.json() };
    }, { url: ctx.config.projectUrl, key: ctx.config.anonKey, actor: ctx.student.id,
      room: fixture.room.id, assessment: delivered.assessment_id, request: requestId() });
    assert.equal(denied.status, 403, 'Learner private-review request was not denied');
    assert.equal(denied.body?.error?.code, 'FORBIDDEN', 'An unrelated error cannot establish authorization');
    await checkpoint('open');
    assert(evidence.phases[0].observations.some(row => row.surface === 'network'), 'No real learner network data captured');
    assert(evidence.phases[0].observations.some(row => row.surface === 'realtime'), 'No real realtime data captured');
    assert(evidence.phases[0].observations.some(row => row.surface === 'error'), 'No actual learner error response captured');
    for (const [index, selected] of (outcome === 'passed' ? ['B'] : ['A', 'A']).entries()) {
      evidence.stage = `answer_${index + 1}`;
      await question.locator(`input[value="${selected}"]`).check();
      await question.getByRole('button', { name: 'Submit answer' }).click();
      const messages = await waitForMatch(() => query(ctx.client, 'messages', '*', 'room_id', fixture.room.id),
        rows => rows.some(row => row.assessment_event?.assessment_id === delivered.assessment_id && row.assessment_event.attempt_number === index + 1),
        'privacy journey saved result');
      const result = messages.find(row => row.assessment_event?.assessment_id === delivered.assessment_id && row.assessment_event.attempt_number === index + 1);
      const expected = selected === 'B' ? 'passed' : index === 0 ? 'retry' : 'failed';
      assertSavedResult(result, expected, index + 1, delivered.assessment);
      requiredResults.push(result);
      if (expected === 'failed') {
        const authority = await managementQuery(ctx.config, `select a.lifecycle,a.terminal_result,a.attempt_count,t.answer_message_id
          from private.transfer_assessments a join private.transfer_assessment_attempts t on t.assessment_id=a.id and t.attempt_number=2
          where a.id='${delivered.assessment_id}'::uuid`);
        assert.equal(authority.length, 1, 'Terminal disclosure has no unique private attempt');
        assert.equal(authority[0].lifecycle, 'failed'); assert.equal(authority[0].terminal_result, 'failed');
        assert.equal(authority[0].attempt_count, 2);
        assert.equal(authority[0].answer_message_id, result.assessment_event.answer_message_id);
        approvedResults.push(result); // Both private grading authority and the exact saved message establish disclosure.
      }
      evidence.stage = `result_${index + 1}_dom_realtime`;
      await ctx.studentPage.getByTestId(`assessment-result-${result.id}`).waitFor({ timeout: TIMEOUT });
      await waitForMatch(async () => capture.hasRealtimeRow(result.id), Boolean, 'actual saved-result realtime event');
      await checkpoint(expected);
      await ctx.studentPage.reload({ waitUntil: 'domcontentloaded' });
      await ctx.studentPage.getByTestId(`assessment-result-${result.id}`).waitFor({ timeout: TIMEOUT });
      await checkpoint(`${expected}-reload`);
    }
    evidence.stage = 'complete'; evidence.status = 'pass'; writeJson(file, evidence);
    return evidence;
  } catch (error) {
    evidence.failure_type = error.code === 'ERR_ASSERTION' ? 'assertion' : error.name === 'TimeoutError' ? 'timeout' : 'operation';
    const httpStatus = /^Staging SQL failed: HTTP (\d{3})\b/.exec(error.message);
    if (httpStatus) evidence.http_status = Number(httpStatus[1]);
    evidence.status = 'fail'; evidence.error = 'Privacy capture, assertion or fixture prerequisite failed'; writeJson(file, evidence);
    throw new Error(`Assessment privacy acceptance failed; see ${path.basename(file)}`);
  } finally { capture.stop(); }
}
module.exports = async function assessmentPrivacy(ctx) {
  assertStaging(ctx.config);
  return { passed: await privacyJourney(ctx, 'passed'), failed: await privacyJourney(ctx, 'failed') };
};
