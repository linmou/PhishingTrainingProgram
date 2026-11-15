// Purpose: opt-in real-provider lifecycle from a freshly seeded canonical room.
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { query, waitForMatch, openRoom, sendStudentMessage, captureResponses,
  managementQuery, requestId, writeJson, screenshot, TIMEOUT } = require('../browser-e2e-support');
const { openExitAssessment, assertExitResult, assertBoundAnswers } = require('./assessment-browser-checks');

const TARGET = 'Knowledge Point 4: Check the website address before trusting it. (Harder)\nObservation task: The link goes to "testdrive.info," not the official website of a social media company.\nBehavior task: Never click a link in a scary security message. Open the real app or type its official website address yourself.';
const CASES = Object.freeze([
  Object.freeze({ label: 'partial', content: 'The link goes to testdrive.info, which is not the official website of a social media company.',
    kind: 'initial_signal', status: 'partially_covered', level: 'basic' }),
  Object.freeze({ label: 'full', content: 'The link goes to testdrive.info, not the social media company’s official website. I will never click a link in a scary security message. I will open the real app or type its official website address myself instead.',
    kind: 'demonstrated_understanding', status: 'covered', level: 'good' })
]);

function assertCanonicalInventory(templateConfig, roomConfig, items) {
  const expected = templateConfig.prompt_config;
  assert.equal(expected.detection_areas.length, 5);
  assert.deepEqual(expected.verification_steps, []);
  assert(expected.detection_areas.includes(TARGET), 'Approved canonical target text changed; review expectations');
  assert(expected.detection_areas.every(text => text.includes('\nObservation task:') &&
    text.includes('\nBehavior task:') && !/What to (notice|do):/.test(text)), 'Template is not canonical');
  assert.deepEqual(roomConfig.prompt_config.detection_areas, expected.detection_areas, 'Saved room inventory differs from live template');
  assert.deepEqual(roomConfig.prompt_config.verification_steps, expected.verification_steps, 'Saved room actions differ from live template');
  // TutorView regenerates current pedagogy around the saved inventory; only teaching strings must match.
  assert(expected.detection_areas.every(point => roomConfig.system_prompt?.includes(point)),
    'Saved system prompt omitted an exact canonical point');
  if (items) {
    assert.deepEqual(items.map(i => i.area_text).sort(), [...expected.detection_areas].sort(),
      'Approved checklist differs from canonical template');
    assert(items.every(i => i.item_type === 'detection_area'));
  }
}

function assertObservation(rows, progress, itemId, messageId, expected) {
  const markers = rows.filter(row => row.dedupe_key === `analysis:${messageId}`);
  assert.equal(markers.length, 1, 'Missing or duplicate analysis completion marker');
  assert.equal(markers[0].processing_state, 'applied');
  const events = markers[0].event_payload?.analysis?.events;
  assert(Array.isArray(events), 'Missing recorded model judgments');
  assert.deepEqual(events.filter(event => event.item_id === itemId).map(event => event.kind), [expected.kind]);
  const event = rows.find(row => row.item_id === itemId && row.event_kind === expected.kind);
  assert.equal(event?.processing_state, 'applied');
  assert(event.event_payload.source_evidence_message_ids.includes(messageId));
  assert.equal(progress.status, expected.status);
  assert.equal(progress.understanding_level, expected.level);
}

module.exports = async function canonicalTemplateLifecycle(ctx) {
  const { client, tutorPage, studentPage, appUrl, evidenceDir } = ctx;
  const report = { status: 'running', stage: 'template', cases: CASES, observations: [] };
  const save = () => writeJson(path.join(evidenceDir, 'canonical-template-lifecycle.json'), report);
  const sql = text => managementQuery(ctx.config, text);
  try {
    const templates = await query(client, 'room_templates', '*', 'template_name', 'Account Security Alert Scam');
    const template = templates.find(t => t.tutor_id === '00000000-0000-0000-0000-000000000000');
    assert(template, 'Canonical system template missing');
    // Fail before room creation when SQL was not seeded, rather than accepting fallback content.
    assertCanonicalInventory(template.ai_config_template, template.ai_config_template);
    report.template_id = template.id;
    report.stage = 'create_room'; save();
    await tutorPage.goto(`${appUrl}/#/tutor`, { waitUntil: 'domcontentloaded' });
    await tutorPage.getByRole('button', { name: /Create a new Room/i }).click();
    await tutorPage.getByLabel('Use Template').selectOption({ label: template.template_name });
    await tutorPage.getByLabel('Room Title').fill(`Canonical lifecycle ${ctx.runId}`);
    await tutorPage.getByLabel('Description').fill('[browser-e2e-created] Canonical template lifecycle');
    const created = tutorPage.waitForResponse(r => r.url().includes('/rest/v1/rooms') && r.request().method() === 'POST', { timeout: TIMEOUT });
    await tutorPage.getByRole('button', { name: /Create Room/i }).click();
    const response = await created;
    assert.equal(response.status(), 201);
    const body = await response.json();
    const room = Array.isArray(body) ? body[0] : body;
    assert(room?.id);
    ctx.registerCreatedRoom(room.id);
    report.room_id = room.id;
    assert.equal(room.in_room_assessment_enabled, true, 'New room must enable assessment by default');
    assert.equal(room.tutor_id, ctx.tutor.id);
    const configs = await waitForMatch(() => query(client, 'ai_assistant_configs', '*', 'room_id', room.id),
      rows => rows.some(row => row.is_active), 'canonical saved room configuration');
    const config = configs.find(row => row.is_active);
    assertCanonicalInventory(template.ai_config_template, config);
    const joined = await client.functions.invoke('assessment-api', {
      body: { operation: 'join_room', request_id: requestId(), room_id: room.id },
      headers: { 'x-application-user-id': ctx.student.id }
    });
    assert.equal(joined.error, null);
    assert.equal(joined.data?.ok, true);
    await openRoom(studentPage, appUrl, room.id);
    await waitForMatch(() => query(client, 'sessions', '*', 'room_id', room.id),
      rows => rows.some(row => row.student_id === ctx.student.id && row.status === 'active'), 'canonical learner session');
    await openRoom(tutorPage, appUrl, room.id);
    await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
    await tutorPage.getByRole('button', { name: 'Generate Learning Targets', exact: true }).click();
    const checklists = await waitForMatch(() => query(client, 'session_checklists', '*', 'room_id', room.id),
      rows => rows.some(row => row.student_id === ctx.student.id && row.is_active && row.progress_policy_version === 'transfer_v1'),
      'approved learner transfer checklist');
    const checklist = checklists.find(row => row.student_id === ctx.student.id && row.is_active && row.progress_policy_version === 'transfer_v1');
    const items = await waitForMatch(() => query(client, 'checklist_items', '*', 'checklist_id', checklist.id),
      rows => rows.length === 5, 'five approved canonical targets');
    assertCanonicalInventory(template.ai_config_template, config, items);
    await waitForMatch(() => tutorPage.getByRole('button', { name: 'Refresh', exact: true }).isEnabled(),
      ready => ready, 'owner-scoped target synchronization');
    const target = items.find(item => item.area_text === TARGET);
    assert.equal(items.find(item => item.id === target.id).status, 'pending');
    report.item_id = target.id;
    report.inventory = items.map(item => ({ id: item.id, area_text: item.area_text }));
    save();
    for (const expected of CASES) {
      report.stage = expected.label; save();
      const stop = await captureResponses(studentPage, r => r.url().includes('/functions/v1/assessment-api'));
      const analysisWait = studentPage.waitForResponse(r => r.url().includes('/functions/v1/assessment-api') &&
        r.request().method() === 'POST' && r.request().postDataJSON()?.operation === 'analyze_message' &&
        r.request().postDataJSON()?.room_id === room.id, { timeout: TIMEOUT })
        .then(response => ({ response }), error => ({ error }));
      try {
        await sendStudentMessage(studentPage, expected.content);
        const analyzed = await analysisWait;
        if (analyzed.error) throw analyzed.error;
        assert.equal(analyzed.response.status(), 200, 'Canonical evidence analysis failed');
      }
      finally { report.function_calls = [...(report.function_calls || []), ...await stop()]; save(); }
      const messages = await waitForMatch(() => query(client, 'messages', '*', 'room_id', room.id),
        rows => rows.some(row => row.user_id === ctx.student.id && row.content === expected.content), 'persisted canonical evidence');
      const message = messages.find(row => row.user_id === ctx.student.id && row.content === expected.content);
      const rows = await waitForMatch(() => sql(`select * from private.learning_event_inbox where room_id='${room.id}'::uuid and source_message_id='${message.id}'::uuid`),
        rows => rows.some(row => row.dedupe_key === `analysis:${message.id}`), 'real analysis completion');
      const progress = (await query(client, 'checklist_items', '*', 'id', target.id))[0];
      report.observations.push({ expected, message_id: message.id, rows, progress }); save();
      assertObservation(rows, progress, target.id, message.id, expected);
      const assessments = await sql(`select id from private.transfer_assessments where room_id='${room.id}'::uuid`);
      assert.equal(assessments.length, 0, 'Assessment delivered before explicit tutor preparation');
    }
    report.stage = 'prepare'; save();
    // Exercise the real provider and tutor review path, without injecting grading/event fixtures.
    const close = tutorPage.locator('.checklist-close');
    if (await close.isVisible()) await close.click();
    const preparedWait = tutorPage.waitForResponse(r => r.url().includes('/functions/v1/assessment-api') &&
      r.request().postDataJSON()?.operation === 'prepare_turn', { timeout: TIMEOUT });
    await tutorPage.locator('button.ai-generate-btn').click();
    const prepared = await preparedWait;
    report.prepared = await prepared.json(); save();
    assert.equal(prepared.status(), 200);
    assert.equal(report.prepared.data?.item_id, target.id, 'Scheduler selected another target; inspect over-crediting');
    const provider = await sql(`select validation_outcome from private.transfer_provider_attempts where request_id='${prepared.request().postDataJSON().request_id}'::uuid`);
    report.provider_attempts = provider; save();
    assert(provider.some(row => row.validation_outcome === 'valid'));
    await tutorPage.getByRole('heading', { name: 'Review transfer assessment' }).waitFor({ timeout: TIMEOUT });
    const correct = await tutorPage.locator('input[name="assessment-correct-option"]:checked').evaluateAll(
      inputs => inputs.map(input => input.getAttribute('aria-label').replace('Correct answer ', '')));
    assert(correct.length > 0);
    report.stage = 'delivery'; save();
    await tutorPage.getByRole('button', { name: 'Send assessment' }).click();
    const assessments = await waitForMatch(() => sql(`select * from private.transfer_assessments where room_id='${room.id}'::uuid`),
      rows => rows.length > 0, 'canonical delivered assessment');
    assert.equal(assessments.length, 1);
    const assessment = assessments[0];
    assert.equal(assessment.item_id, target.id);
    assert.equal(assessment.student_id, ctx.student.id);
    report.stage = 'answer'; save();
    const question = await openExitAssessment(studentPage, assessment.id);
    assert.equal(await question.getByRole('button', { name: 'Submit answer' }).isDisabled(), true);
    for (const option of correct) await question.locator(`input[value="${option}"]`).check();
    await question.getByRole('button', { name: 'Submit answer' }).click();
    const messages = await waitForMatch(() => query(client, 'messages', '*', 'room_id', room.id),
      rows => rows.some(row => row.assessment_event?.assessment_id === assessment.id && row.assessment_event.kind === 'result'), 'canonical assessment result');
    assertBoundAnswers(messages, ctx.student.id, assessment.id, assessment.question_message_id, [correct]);
    const result = messages.find(row => row.assessment_event?.assessment_id === assessment.id && row.assessment_event.kind === 'result');
    await assertExitResult(studentPage, result);
    const terminal = (await sql(`select * from private.transfer_assessments where id='${assessment.id}'::uuid`))[0];
    report.terminal = terminal; save();
    assert.equal(terminal.terminal_result, 'passed');
    assert.equal(terminal.attempt_count, 1);
    const attempts = await sql(`select * from private.transfer_assessment_attempts where assessment_id='${assessment.id}'::uuid`);
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].answer_outcome, 'passed');
    assert.deepEqual([...attempts[0].selected_option_ids].sort(), [...correct].sort());
    report.screenshot = await screenshot(studentPage, evidenceDir, 'canonical-template-result');
    report.stage = 'complete';
    report.status = 'pass';
    return report;
  } catch (error) { report.status = 'fail'; report.error = { message: error.message, stack: error.stack }; throw error; }
  finally { save(); }
};
module.exports.TARGET = TARGET;
module.exports.CASES = CASES;
module.exports.assertCanonicalInventory = assertCanonicalInventory;
module.exports.assertObservation = assertObservation;
