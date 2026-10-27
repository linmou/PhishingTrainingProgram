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
  const code = response.body?.error?.code ?? response.body?.code;
  const diagnostic = typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : 'UNRECOGNIZED';
  assert(codes.includes(code), `Unexpected denial code ${diagnostic}; infrastructure/validation errors are not authorization evidence`);
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
  } catch (error) {
    row.status = 'fail'; row.error = error.message;
    if (error.oracleFailed) { oracleFailed = true; row.state_verification_error = 'A subcheck lost the persisted-state oracle'; }
  }
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
  if (oracleFailed) { const error = new Error(row.state_verification_error); error.oracleFailed = true; throw error; }
}
const ATTACK_IDS = Object.freeze(['forged_identity', 'cross_learner', 'cross_room', 'direct_write', 'legacy_rpc', 'stale_question']);
module.exports = async function assessmentSecurity(ctx) {
  assertStaging(ctx.config); // Before fixture mutation, even when invoked directly.
  const fixture = await assessmentRoom({ ...ctx, kind: 'assessment-answer-pass' });
  const delivered = await deliverFixedAssessment(ctx, fixture);
  const otherRoom = await ctx.existingRoom('assessment-answer-failure');
  // Keep legitimate browser auto-processing from racing the HTTP attack/state comparisons.
  await ctx.detachRooms();
  const outsiderId = crypto.randomUUID();
  const cases = ATTACK_IDS.map(id => ({ id, status: 'blocked', reason: 'not_run', boundary: 'live anon HTTP + persisted-state oracle' }));
  const file = path.join(ctx.evidenceDir, 'assessment-security.json');
  const evidence = { cases, untested_surfaces: ['realtime', 'exports', 'error value leakage'], outsider_cleanup: 'not_created' };
  const persist = () => writeJson(file, evidence);
  persist();
  let lastHttpStatus;
  async function request(endpoint, body, actorId, method = 'POST', bearer = ctx.config.anonKey) {
    const response = await fetch(`${ctx.config.projectUrl}${endpoint}`, {
      method, headers: { apikey: ctx.config.anonKey, Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json', Prefer: 'return=representation',
        'x-practice-contract': 'cyberbullying-v2', ...(actorId ? { 'x-application-user-id': actorId } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(30000)
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
  async function checks(id, definitions) {
    const parent = cases.find(row => row.id === id);
    parent.checks = definitions.map(entry => ({ id: entry.id, status: 'blocked', reason: 'not_run' }));
    await probe(id, async () => {
      for (const [index, definition] of definitions.entries()) {
        const row = parent.checks[index];
        if (definition.blocked) { row.reason = definition.blocked; persist(); continue; }
        lastHttpStatus = undefined;
        await runProbe(row, snapshot, () => definition.execute(row), persist, () => lastHttpStatus);
      }
      assert(parent.checks.every(row => row.status === 'pass'), 'One or more authorization subchecks failed or remain blocked');
    });
  }
  let authId; let authToken;
  evidence.authenticated_setup = 'blocked'; evidence.authenticated_cleanup = 'not_created';
  evidence.outsider_cleanup = 'pending';
  persist();
  try {
    const outsider = await ctx.client.from('users').insert({ id: outsiderId, email: `${outsiderId}@example.invalid`,
      display_name: `Security probe ${ctx.runId}`, current_role: 'student', status: 'active' });
    if (outsider.error) throw new Error(`Security outsider fixture failed: ${outsider.error.code}`);
    // A real signed authenticated-role JWT, not a forged role claim or an injected verifier.
    try {
      const email = `assessment-security-${crypto.randomUUID()}@example.invalid`;
      const password = crypto.randomBytes(32).toString('base64url');
      authId = crypto.randomUUID(); // Known before the request, so an ambiguous creation response can still be cleaned up.
      evidence.authenticated_cleanup = 'pending'; persist();
      const created = await ctx.client.auth.admin.createUser({ id: authId, email, password, email_confirm: true });
      assert(!created.error && created.data?.user?.id === authId, 'Auth fixture creation unavailable');
      const { createClient } = require('@supabase/supabase-js');
      const publicClient = createClient(ctx.config.projectUrl, ctx.config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const login = await publicClient.auth.signInWithPassword({ email, password });
      authToken = login.data?.session?.access_token;
      assert(!login.error && authToken, 'Auth fixture sign-in unavailable');
      evidence.authenticated_setup = 'pass';
    } catch { evidence.authenticated_setup = 'blocked'; }
    persist();
    await probe('forged_identity', async () => {
      // Anonymous attacker copies the known tutor ID. No signed tutor credential is supplied.
      const response = await api(ctx.tutor.id, { operation: 'read_review', room_id: fixture.room.id, assessment_id: delivered.assessment_id });
      assertDenied(response, ['UNAUTHORIZED', 'FORBIDDEN']);
      return response;
    });
    const observer = await ctx.client.rpc('join_room_v1', { p_room_id: fixture.room.id, p_student_id: outsiderId });
    assert(!observer.error && observer.data?.room_role === 'observer', 'Same-room observer fixture was not established');
    const pending = await api(ctx.student.id, { operation: 'post_message', room_id: fixture.room.id,
      assessment_id: delivered.assessment_id, parent_message_id: delivered.question_message_id, content: 'A', selected_option_ids: ['A'] });
    assert.equal(pending.status, 200, 'Cross-learner setup did not create an actual answer');
    const answerId = pending.body?.data?.message?.id;
    assert(answerId, 'Cross-learner fixture lost the answer ID');
    await checks('cross_learner', [
      { id: 'same_room_observer_post', execute: async () => {
        const response = await api(outsiderId, { operation: 'post_message', room_id: fixture.room.id,
          assessment_id: delivered.assessment_id, parent_message_id: delivered.question_message_id, content: 'B', selected_option_ids: ['B'] });
        assertDenied(response, ['FORBIDDEN', 'WRONG_LEARNER', 'OBSERVER_READ_ONLY']);
      } },
      { id: 'other_learner_process_existing_answer', execute: async () => {
        const response = await api(outsiderId, { operation: 'process_message', message_id: answerId, assessment_id: delivered.assessment_id });
        assertDenied(response, ['FORBIDDEN', 'WRONG_LEARNER', 'OBSERVER_READ_ONLY']);
      } }
    ]);
    const ownResult = await api(ctx.student.id, { operation: 'process_message', room_id: fixture.room.id,
      message_id: answerId, assessment_id: delivered.assessment_id });
    assert.equal(ownResult.status, 200, 'Own-learner fixture processing failed');
    assert.equal(ownResult.body?.data?.answer_outcome, 'retry', 'Control answer must consume only the first incorrect attempt');
    await checks('cross_room', [
      { id: 'learner_wrong_room_answer', execute: async () => {
        const response = await api(ctx.student.id, { operation: 'post_message', room_id: otherRoom.id,
          assessment_id: delivered.assessment_id, parent_message_id: delivered.question_message_id, content: 'B', selected_option_ids: ['B'] });
        assertDenied(response, ['FORBIDDEN', 'INVALID_SCOPE', 'WRONG_LEARNER', 'OBSERVER_READ_ONLY']);
      } },
      { id: 'owner_mismatched_room_assessment', execute: async () => {
        const response = await api(ctx.tutor.id, { operation: 'read_review', room_id: otherRoom.id, assessment_id: delivered.assessment_id });
        assertDenied(response, ['INVALID_SCOPE', 'FORBIDDEN']);
      } }
    ]);
    const roles = [{ name: 'anon', token: ctx.config.anonKey }, { name: 'authenticated', token: authToken }];
    const writes = role => [
      ['result', { assessment_result: role.name === 'anon' ? 'pass' : 'fail' }],
      ['lifecycle', { assessment_lifecycle: role.name === 'anon' ? 'passed' : 'failed' }],
      ['selected_options', { assessment_selected_option_ids: [role.name === 'anon' ? 'A' : 'B'] }],
      ['trusted_event', { assessment_event: { event_key: `assessment-closure:${delivered.question_message_id}`,
        kind: 'closure', assessment_id: delivered.assessment_id, question_message_id: delivered.question_message_id,
        student_id: ctx.student.id, answer_message_id: null, attempts_used: 1, attempts_remaining: 0,
        terminal: true, lifecycle: 'cancelled', progress_deferred: false, closure_reason: 'assisted' } }],
      ['question_options', { assessment_options: delivered.assessment.options.map(option => ({ ...option, text: `Forged ${role.name} ${option.text}` })) }]
    ];
    const writeChecks = roles.flatMap(role => writes(role).map(([field, patch]) => ({
      id: `${role.name}_${field}`, blocked: role.token ? null : 'Real authenticated-role JWT could not be provisioned',
      execute: async () => {
        const response = await request(`/rest/v1/messages?id=eq.${delivered.question_message_id}`, patch, ctx.student.id, 'PATCH', role.token);
        if (response.status === 200 && Array.isArray(response.body) && response.body.length === 0) return; // Known existing row, checked against authority.
        assertDenied(response, ['42501']);
      }
    })));
    for (const role of roles) writeChecks.push({
      id: `${role.name}_private_review_rpc`, blocked: role.token ? null : 'Real authenticated-role JWT could not be provisioned',
      execute: async () => assertDenied(await request('/rest/v1/rpc/get_transfer_assessment_review_v1', {
        p_room_id: fixture.room.id, p_assessment_id: delivered.assessment_id, p_actor_id: ctx.tutor.id
      }, ctx.student.id, 'POST', role.token), ['42501'])
    });
    await checks('legacy_rpc', roles.map(role => ({
      id: `${role.name}_legacy_grading`, blocked: role.token ? null : 'Real authenticated-role JWT could not be provisioned',
      execute: async row => {
        const response = await request('/rest/v1/rpc/process_assessment_message_v1', {
          p_message_id: answerId, p_actor_id: ctx.student.id, p_request_id: requestId()
        }, ctx.student.id, 'POST', role.token);
        if (response.status === 404 && response.body?.code === 'PGRST202') {
          const catalog = await managementQuery(ctx.config, `select to_regprocedure('public.process_assessment_message_v1(uuid,uuid,uuid)') is null as absent,
            case when to_regprocedure('public.process_assessment_message_v1(uuid,uuid,uuid)') is null then false
            else has_function_privilege('${role.name}',to_regprocedure('public.process_assessment_message_v1(uuid,uuid,uuid)'),'EXECUTE') end as executable`);
          row.catalog = catalog[0];
          assert(row.catalog && row.catalog.executable === false, 'Schema-cache miss without actual catalog denial/absence cannot pass');
        } else assertDenied(response, ['42501']);
      }
    })));
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
    // Run corrupting public-field attacks last so stale-question checks use legitimate lifecycle state.
    await checks('direct_write', writeChecks);
  } finally {
    try {
      const cleanup = await ctx.client.from('users').delete().eq('id', outsiderId);
      const remaining = await ctx.client.from('users').select('id').eq('id', outsiderId);
      evidence.outsider_cleanup = cleanup.error || remaining.error || remaining.data?.length !== 0 ? 'fail' : 'pass';
    } catch { evidence.outsider_cleanup = 'fail'; }
    if (authId) {
      try {
        const profile = await ctx.client.from('users').delete().eq('id', authId);
        const cleanup = await ctx.client.auth.admin.deleteUser(authId);
        const remaining = await ctx.client.auth.admin.getUserById(authId);
        const absent = !remaining.data?.user && remaining.error?.status === 404;
        const profileRemaining = await ctx.client.from('users').select('id').eq('id', authId);
        evidence.authenticated_cleanup = !profile.error && (!cleanup.error || cleanup.error.status === 404) && absent &&
          !profileRemaining.error && profileRemaining.data?.length === 0 ? 'pass' : 'fail';
      } catch { evidence.authenticated_cleanup = 'fail'; }
    }
    persist();
    if ([evidence.outsider_cleanup, evidence.authenticated_cleanup].includes('fail')) {
      const error = new Error('Security identity fixture cleanup failed'); error.cleanupFailed = true; throw error;
    }
  }
  assert.equal(cases.length, 6, 'Not every Wave 105 attack ran');
  assert(cases.every(row => row.status === 'pass'), `Security failures: ${cases.filter(row => row.status !== 'pass').map(row => row.id).join(', ')}; see assessment-security.json`);
  return { cases, untested_surfaces: ['realtime', 'exports', 'error value leakage'] };
};
module.exports.runProbe = runProbe;
module.exports.assertStaging = assertStaging;
module.exports.assertDenied = assertDenied;
