#!/usr/bin/env node
// Purpose: verify public flag permissions and a reversible staging disable/history-preservation drill.
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const { assertStaging } = require('./assessment-security');
const { assessmentRoom, deliverFixedAssessment } = require('./assessment-fixture');
const { openExitAssessment, reloadWithExitPrompt } = require('./assessment-browser-checks');
const { assertSavedResult } = require('./assessment-result-checks');
const { query, openRoom, waitForMatch, managementQuery, requestId, writeJson, captureResponses, TIMEOUT } = require('../browser-e2e-support');
const FLAG = 'TRANSFER_ASSESSMENT_ENABLED';

async function readFlag(client) {
  const { data, error } = await client.from('feature_flags').select('enabled').eq('name', FLAG).single();
  assert(!error && typeof data?.enabled === 'boolean', 'Public flag configuration is unavailable');
  return data.enabled;
}

async function setFlag(client, enabled) {
  const { data, error } = await client.from('feature_flags').update({ enabled }).eq('name', FLAG).select('enabled').single();
  assert(!error && data?.enabled === enabled, 'Administrative flag update failed');
}

async function withFlagDisabled(client, run) {
  const original = await readFlag(client);
  try {
    await setFlag(client, false);
    return await run(original);
  } finally {
    try {
      await setFlag(client, original);
      assert.equal(await readFlag(client), original, 'Original flag value was not restored');
    } catch (error) {
      error.cleanupFailed = true;
      throw error;
    }
  }
}

module.exports = async function assessmentConfiguration(ctx) {
  assertStaging(ctx.config);
  const evidence = { status: 'running', permission_checks: [], disabled_operations: [], restoration: 'not_started', authenticated_cleanup: 'not_created' };
  const persist = () => writeJson(path.join(ctx.evidenceDir, 'assessment-configuration.json'), evidence);
  let authId;
  async function http(endpoint, method, body, token = ctx.config.anonKey, actor) {
    const response = await fetch(ctx.config.projectUrl + endpoint, {
      method, headers: { apikey: ctx.config.anonKey, Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json', Prefer: 'return=representation',
        'x-practice-contract': 'cyberbullying-v2', ...(actor ? { 'x-application-user-id': actor } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
    });
    return { status: response.status, body: await response.json() };
  }
  const api = (operation, fields = {}) => http('/functions/v1/assessment-api', 'POST', {
    operation, request_id: requestId(), ...fields,
  }, ctx.config.anonKey, ctx.tutor.id);
  persist();
  try {
    assert.equal(await readFlag(ctx.client), true, 'Enabled staging configuration is required for this drill');
    authId = crypto.randomUUID();
    evidence.authenticated_cleanup = 'pending'; persist();
    const email = `assessment-configuration-${authId}@example.invalid`;
    const password = crypto.randomBytes(32).toString('base64url');
    const created = await ctx.client.auth.admin.createUser({ id: authId, email, password, email_confirm: true });
    assert(!created.error && created.data?.user?.id === authId, 'Real Auth fixture creation failed');
    const authClient = createClient(ctx.config.projectUrl, ctx.config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await authClient.auth.signInWithPassword({ email, password });
    const authToken = login.data?.session?.access_token;
    assert(!login.error && authToken, 'Real authenticated-role sign-in failed');
    for (const [role, token] of [['anon', ctx.config.anonKey], ['authenticated', authToken]]) {
      const read = await http(`/rest/v1/feature_flags?name=eq.${FLAG}&select=name,enabled`, 'GET', undefined, token);
      assert.equal(read.status, 200);
      assert.deepEqual(read.body, [{ name: FLAG, enabled: true }]);
      const write = await http(`/rest/v1/feature_flags?name=eq.${FLAG}`, 'PATCH', { enabled: false }, token);
      assert([401, 403].includes(write.status), 'Public flag write was not denied');
      assert.equal(write.body?.code, '42501');
      assert.equal(await readFlag(ctx.client), true);
      evidence.permission_checks.push({ role, read_status: read.status, write_status: write.status, write_code: write.body.code }); persist();
    }
    const fixture = await assessmentRoom({ ...ctx, kind: 'assessment-answer-pass' });
    const delivered = await deliverFixedAssessment(ctx, fixture);
    evidence.room_id = fixture.room.id; evidence.assessment_id = delivered.assessment_id;
    evidence.question_message_id = delivered.question_message_id; persist();
    await openRoom(ctx.studentPage, ctx.appUrl, fixture.room.id);
    // Open questions stay hidden during ordinary chat and appear at the exit prompt.
    await ctx.studentPage.locator('textarea.comment-input-field').click();
    await reloadWithExitPrompt(ctx.studentPage);
    const question = await openExitAssessment(ctx.studentPage, delivered.assessment_id);
    await question.locator('input[value="B"]').check();
    await question.getByRole('button', { name: 'Submit answer' }).click();
    const messages = await waitForMatch(() => query(ctx.client, 'messages', '*', 'room_id', fixture.room.id),
      rows => rows.some(row => row.assessment_event?.assessment_id === delivered.assessment_id && row.assessment_event.outcome === 'passed'),
      'saved passing assessment result before disabling');
    const result = messages.find(row => row.assessment_event?.assessment_id === delivered.assessment_id && row.assessment_event.outcome === 'passed');
    assertSavedResult(result, 'passed', 1, delivered.assessment);
    evidence.result_message_id = result.id;
    await ctx.detachRooms();
    async function snapshot() {
      const messages = (await query(ctx.client, 'messages', '*', 'room_id', fixture.room.id)).sort((a,b) => a.id.localeCompare(b.id));
      const progress = (await query(ctx.client, 'checklist_items', '*', 'checklist_id', fixture.checklist.id)).sort((a,b) => a.id.localeCompare(b.id));
      const authority = await managementQuery(ctx.config, `select to_jsonb(a) as assessment,
        (select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)
         from private.transfer_assessment_attempts t where t.assessment_id=a.id) as attempts
        from private.transfer_assessments a where a.id='${delivered.assessment_id}'::uuid`);
      return { sha256: crypto.createHash('sha256').update(JSON.stringify({ messages, progress, authority })).digest('hex'),
        message_ids: messages.map(row => row.id), result_message_id: result.id, assessment_id: delivered.assessment_id,
        attempt_count: authority[0]?.attempts?.length };
    }
    evidence.before = await snapshot();
    assert.equal(evidence.before.attempt_count, 1);
    evidence.restoration = 'pending'; persist();
    try {
      await withFlagDisabled(ctx.client, async original => {
        evidence.original_enabled = original;
        const flag = await http(`/rest/v1/feature_flags?name=eq.${FLAG}&select=enabled`, 'GET');
        assert.equal(flag.status, 200); assert.deepEqual(flag.body, [{ enabled: false }]);
        for (const operation of ['prepare_turn', 'send_reviewed', 'read_review']) {
          const response = await api(operation, { room_id: fixture.room.id, assessment_id: delivered.assessment_id });
          assert.equal(response.status, 503);
          assert.equal(response.body?.error?.code, 'ASSESSMENT_FEATURE_DISABLED');
          evidence.disabled_operations.push({ operation, status: response.status, code: response.body.error.code }); persist();
        }
        const history = await http(`/rest/v1/messages?room_id=eq.${fixture.room.id}&select=id,content,assessment_event`, 'GET');
        assert.equal(history.status, 200);
        assert(history.body.some(row => row.id === delivered.question_message_id));
        assert(history.body.some(row => row.id === result.id && row.content === result.content));
        evidence.history_readable_while_disabled = true;
        const readiness = await api('read_history_readiness', { room_id: fixture.room.id, assessment_id: delivered.assessment_id });
        assert.equal(readiness.status, 200);
        assert.equal(readiness.body?.data?.history_readiness?.ready, true);
        assert.deepEqual(Object.keys(readiness.body.data), ['history_readiness']);
        assert(!JSON.stringify(readiness.body.data).includes('correct_option_ids'), 'Keyless readiness exposed private keys');
        evidence.keyless_readiness_while_disabled = true;

        const trackingRoom = await ctx.existingRoom('checklist-management');
        const learnerApi = (operation, fields) => http('/functions/v1/assessment-api', 'POST', {
          operation, request_id: requestId(), room_id: trackingRoom.id, ...fields,
        }, ctx.config.anonKey, ctx.student.id);
        const joined = await learnerApi('join_room', {});
        assert.equal(joined.status, 200);
        const initialized = await api('initialize_checklist', { room_id: trackingRoom.id, student_id: ctx.student.id,
          items: [{ area_text: 'Verify an account warning through the official app', item_type: 'detection_area', priority: 'important' }] });
        assert.equal(initialized.status, 200);
        const checklistId = initialized.body?.data?.checklist_id;
        assert(checklistId, 'Disabled-mode setup returned no learner checklist');
        const items = await query(ctx.client, 'checklist_items', 'id,status', 'checklist_id', checklistId);
        assert.equal(items.length, 1);
        const edited = await api('edit_learning_progress', { room_id: trackingRoom.id,
          action: 'set_status', item_id: items[0].id, updates: { status: 'partially_covered' } });
        assert.equal(edited.status, 200);
        assert.equal((await query(ctx.client, 'checklist_items', 'status', 'id', items[0].id))[0]?.status, 'partially_covered');
        const posted = await learnerApi('post_message', { content: 'I will ignore the warning link and open the official app myself to verify the account alert.' });
        assert.equal(posted.status, 200);
        const messageId = posted.body?.data?.message?.id;
        assert(messageId, 'Disabled-mode learner message was not saved');
        const analyzed = await learnerApi('analyze_message', { message_id: messageId });
        assert.equal(analyzed.status, 200);
        assert.equal(analyzed.body?.ok, true);
        const learningEvidence = await api('read_learning_evidence', { room_id: trackingRoom.id, checklist_id: checklistId });
        assert.equal(learningEvidence.status, 200);
        evidence.disabled_learning = { room_id: trackingRoom.id, checklist_id: checklistId, message_id: messageId,
          setup_status: initialized.status, edit_status: edited.status, analysis_status: analyzed.status,
          evidence_status: learningEvidence.status };
        await openRoom(ctx.tutorPage, ctx.appUrl, trackingRoom.id);
        const stopTutoring = await captureResponses(ctx.tutorPage, response => response.url().includes('/functions/v1/ai-api'));
        let tutoringCalls;
        try {
          await ctx.tutorPage.locator('button.ai-generate-btn').click();
          await ctx.tutorPage.waitForFunction(() => {
            const value = document.querySelector('.ai-suggestion-box .ai-suggestion-content p')?.textContent?.trim();
            return value && value !== 'Generating new response...';
          }, null, { timeout: TIMEOUT });
        } finally { tutoringCalls = await stopTutoring(); }
        assert(tutoringCalls.some(call => call.url.includes('/ai-api') && call.status === 200),
          'Ordinary tutoring did not reach the provider while assessments were disabled');
        evidence.disabled_tutoring = { provider_calls: tutoringCalls.filter(call => call.url.includes('/ai-api')).length };
        await ctx.detachRooms();
        evidence.disabled = await snapshot();
        assert.deepEqual(evidence.disabled, evidence.before);
      });
      evidence.restoration = 'pass';
    } finally {
      try {
        evidence.restored_enabled = await readFlag(ctx.client);
        evidence.restoration = evidence.restored_enabled === true ? 'pass' : 'fail';
      } catch { evidence.restoration = 'fail'; }
      persist();
    }
    const restored = await api('read_review', { room_id: fixture.room.id, assessment_id: delivered.assessment_id });
    assert.equal(restored.status, 200);
    assert.equal(restored.body?.ok, true);
    evidence.restored_api_status = restored.status;
    evidence.after = await snapshot();
    assert.deepEqual(evidence.after, evidence.before);
    evidence.status = 'pass';
  } catch (error) {
    evidence.status = 'fail'; evidence.error = String(error); throw error;
  } finally {
    if (authId) {
      try {
        const profile = await ctx.client.from('users').delete().eq('id', authId);
        const deleted = await ctx.client.auth.admin.deleteUser(authId);
        const remaining = await ctx.client.auth.admin.getUserById(authId);
        const profileRemaining = await ctx.client.from('users').select('id').eq('id', authId);
        evidence.authenticated_cleanup = !profile.error && (!deleted.error || deleted.error.status === 404) &&
          !remaining.data?.user && remaining.error?.status === 404 && !profileRemaining.error && profileRemaining.data?.length === 0 ? 'pass' : 'fail';
      } catch { evidence.authenticated_cleanup = 'fail'; }
    }
    persist();
    if (evidence.authenticated_cleanup === 'fail' || evidence.restoration === 'fail') {
      const error = new Error('Configuration fixture cleanup or flag restoration failed'); error.cleanupFailed = true; throw error;
    }
  }
  return evidence;
};
module.exports.withFlagDisabled = withFlagDisabled;
