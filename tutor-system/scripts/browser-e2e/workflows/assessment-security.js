// Opt-in staging attack probes. Requests use only the public anon key; admin access is fixture/oracle only.
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { assessmentRoom, deliverFixedAssessment } = require('./assessment-fixture');
const { query, writeJson, requestId, managementQuery } = require('../browser-e2e-support');

function assertStaging(config) {
  assert.equal(config.projectRef, 'ciubrzggdqesgvfkpolj', 'Security probes are staging-only');
  assert.equal(config.projectUrl, 'https://ciubrzggdqesgvfkpolj.supabase.co', 'Security probes are staging-only');
}
function assertDenied(response, codes) {
  assert(response.status >= 400 && response.status < 500, `Expected denial, received HTTP ${response.status}`);
  assert(codes.includes(response.body?.error?.code ?? response.body?.code), 'Unexpected denial reason; infrastructure/validation errors are not authorization evidence');
}
// Harness logic only; injected snapshots in unit tests are not hosted security evidence.
async function runProbe(row, snapshot, execute, persist, httpStatus) {
  row.status = 'fail';
  delete row.reason;
  let oracleFailed = false;
  try {
    row.state_before = await snapshot();
    await execute();
    row.status = 'pass';
  } catch (error) { row.status = 'fail'; row.error = error.message; }
  finally {
    row.http_status = httpStatus();
    if (row.state_before) {
      try {
        row.state_after = await snapshot();
        if (row.state_before !== row.state_after) {
          row.status = 'fail'; row.error = 'Attack mutated persisted state';
        }
      } catch {
        row.status = 'fail'; row.state_verification_error = 'Persisted-state oracle failed after attack';
        oracleFailed = true;
      }
    } else {
      row.status = 'fail'; row.state_verification_error = 'Persisted-state oracle failed before attack';
      oracleFailed = true;
    }
    persist();
  }
  // Do not launch another attack after losing the state oracle. Unrun rows stay explicitly blocked.
  if (oracleFailed) throw new Error(row.state_verification_error);
}
const ATTACK_IDS = Object.freeze(['forged_identity', 'cross_learner', 'cross_room', 'direct_write', 'legacy_rpc', 'stale_question']);
module.exports = async function assessmentSecurity(ctx) {
  assertStaging(ctx.config); // Before fixture mutation, even when invoked directly.
  const fixture = await assessmentRoom({ ...ctx, kind: 'assessment-answer-pass' });
  const delivered = await deliverFixedAssessment(ctx, fixture);
  const otherRoom = await ctx.existingRoom('assessment-answer-failure');
  const outsiderId = crypto.randomUUID();
  const cases = ATTACK_IDS.map(id => ({ id, status: 'blocked', reason: 'not_run', boundary: 'live anon HTTP + persisted-state oracle' }));
  const file = path.join(ctx.evidenceDir, 'assessment-security.json');
  const evidence = { cases, untested_surfaces: ['realtime', 'exports', 'error value leakage'], outsider_cleanup: 'not_created' };
  const persist = () => writeJson(file, evidence);
  persist();
  let lastHttpStatus;
  async function request(endpoint, body, actorId, method = 'POST') {
    const response = await fetch(`${ctx.config.projectUrl}${endpoint}`, {
      method, headers: { apikey: ctx.config.anonKey, Authorization: `Bearer ${ctx.config.anonKey}`,
        'Content-Type': 'application/json', Prefer: 'return=representation',
        'x-practice-contract': 'cyberbullying-v2', ...(actorId ? { 'x-application-user-id': actorId } : {}) },
      body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(30000)
    });
    lastHttpStatus = response.status;
    return { status: response.status, body: await response.json() };
  }
  const api = (actorId, body) => request('/functions/v1/assessment-api', { request_id: requestId(), ...body }, actorId);
  async function snapshot() {
    // Compare persisted public rows as well as authority; RLS filtering may deny a write without an error.
    const { data, error } = await ctx.client.rpc('get_transfer_assessment_review_v1', {
      p_room_id: fixture.room.id, p_assessment_id: delivered.assessment_id, p_actor_id: ctx.tutor.id
    });
    if (error) throw new Error(`Security oracle unavailable: ${error.code}`);
    const messages = (await Promise.all([fixture.room.id, otherRoom.id].map(id =>
      query(ctx.client, 'messages', '*', 'room_id', id)))).flat().sort((a,b) => a.id.localeCompare(b.id));
    const progress = (await query(ctx.client, 'checklist_items', '*', 'checklist_id', fixture.checklist.id))
      .sort((a,b) => a.id.localeCompare(b.id));
    const authority = await managementQuery(ctx.config, `select to_jsonb(a) as assessment,
      (select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)
       from private.transfer_assessment_attempts t where t.assessment_id=a.id) as attempts
      from private.transfer_assessments a where a.id='${delivered.assessment_id}'::uuid`);
    return crypto.createHash('sha256').update(JSON.stringify({ data, messages, progress, authority })).digest('hex');
  }
  async function probe(id, execute) {
    lastHttpStatus = undefined;
    const row = cases.find(item => item.id === id);
    assert(row, 'Unknown attack ID');
    await runProbe(row, snapshot, execute, persist, () => lastHttpStatus);
  }
  const outsider = await ctx.client.from('users').insert({ id: outsiderId, email: `${outsiderId}@example.invalid`,
    display_name: `Security probe ${ctx.runId}`, current_role: 'student', status: 'active' });
  if (outsider.error) throw new Error(`Security outsider fixture failed: ${outsider.error.code}`);
  evidence.outsider_cleanup = 'pending';
  persist();
  try {
    await probe('forged_identity', async () => {
      // Anonymous attacker copies the known tutor ID. No signed tutor credential is supplied.
      const response = await api(ctx.tutor.id, { operation: 'read_review', room_id: fixture.room.id, assessment_id: delivered.assessment_id });
      assertDenied(response, ['UNAUTHORIZED', 'FORBIDDEN']);
      return response;
    });
    await probe('cross_learner', async () => {
      const response = await api(outsiderId, { operation: 'post_message', room_id: fixture.room.id,
        assessment_id: delivered.assessment_id, parent_message_id: delivered.question_message_id, content: 'B', selected_option_ids: ['B'] });
      assertDenied(response, ['FORBIDDEN', 'WRONG_LEARNER', 'OBSERVER_READ_ONLY']);
      return response;
    });
    await probe('cross_room', async () => {
      const response = await api(ctx.student.id, { operation: 'post_message', room_id: otherRoom.id,
        assessment_id: delivered.assessment_id, parent_message_id: delivered.question_message_id, content: 'B', selected_option_ids: ['B'] });
      assertDenied(response, ['FORBIDDEN', 'INVALID_SCOPE', 'WRONG_LEARNER', 'OBSERVER_READ_ONLY']);
      return response;
    });
    await probe('direct_write', async () => {
      const response = await request(`/rest/v1/messages?id=eq.${delivered.question_message_id}`,
        { assessment_result: 'pass' }, ctx.student.id, 'PATCH');
      if (response.status === 200 && Array.isArray(response.body) && response.body.length === 0) return response; // RLS filtered zero rows.
      assertDenied(response, ['42501']);
      return response;
    });
    await probe('legacy_rpc', async () => {
      const response = await request('/rest/v1/rpc/process_assessment_message_v1', {
        p_message_id: delivered.question_message_id, p_actor_id: ctx.student.id, p_request_id: requestId()
      }, ctx.student.id);
      // A schema-cache miss cannot establish the surviving function's grants; keep it failing pending catalog verification.
      assertDenied(response, ['42501']);
      return response;
    });
    // Close this real question through the normal assistance path, then try answering the stale ID.
    const posted = await api(ctx.student.id, { operation: 'post_message', room_id: fixture.room.id,
      content: 'Can you explain this question?', assessment_id: delivered.assessment_id, parent_message_id: delivered.question_message_id });
    assert.equal(posted.status, 200, 'Stale-question setup post failed');
    const processed = await api(ctx.student.id, { operation: 'process_message', room_id: fixture.room.id,
      assessment_id: delivered.assessment_id, message_id: posted.body?.data?.message?.id });
    assert.equal(processed.status, 200, 'Stale-question setup processing failed');
    const review = await ctx.client.rpc('get_transfer_assessment_review_v1', {
      p_room_id: fixture.room.id, p_assessment_id: delivered.assessment_id, p_actor_id: ctx.tutor.id
    });
    // Public question lifecycle is the independent setup precondition.
    const question = (await query(ctx.client, 'messages', '*', 'id', delivered.question_message_id))[0];
    assert.equal(question.assessment_lifecycle, 'cancelled', 'Stale question was not actually closed');
    assert(!review.error, 'Stale-question authority read failed');
    await probe('stale_question', async () => {
      const response = await api(ctx.student.id, { operation: 'post_message', room_id: fixture.room.id,
        assessment_id: delivered.assessment_id, parent_message_id: delivered.question_message_id, content: 'B', selected_option_ids: ['B'] });
      assertDenied(response, ['ASSESSMENT_TERMINAL', 'INVALID_SCOPE', 'ITEM_VALIDATION_FAILED']);
      return response;
    });
  } finally {
    const cleanup = await ctx.client.from('users').delete().eq('id', outsiderId);
    const remaining = await ctx.client.from('users').select('id').eq('id', outsiderId);
    evidence.outsider_cleanup = cleanup.error || remaining.error || remaining.data?.length !== 0 ? 'fail' : 'pass';
    persist();
    assert.equal(evidence.outsider_cleanup, 'pass', 'Security outsider cleanup failed');
  }
  assert.equal(cases.length, 6, 'Not every Wave 105 attack ran');
  assert(cases.every(row => row.status === 'pass'), `Security failures: ${cases.filter(row => row.status !== 'pass').map(row => row.id).join(', ')}; see assessment-security.json`);
  return { cases, untested_surfaces: ['realtime', 'exports', 'error value leakage'] };
};
module.exports.runProbe = runProbe;
module.exports.assertStaging = assertStaging;
module.exports.assertDenied = assertDenied;
