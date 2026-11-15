#!/usr/bin/env node
// Verify #100: assessment-off tracing, progress visibility, and explicit server rejection.
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { waitForTemplateSettings } = require('./room-assessment-setup');
const { openRoom, insert, query, waitForMatch, sendStudentMessage, captureResponses,
  managementQuery, requestId, screenshot, writeJson, TIMEOUT } = require('../browser-e2e-support');

module.exports = async function assessmentSwitch(ctx) {
  const { client, tutorPage, studentPage, appUrl, evidenceDir } = ctx;
  const room = await ctx.existingRoom('assessment-delivery');
  await insert(client, 'sessions', { room_id: room.id, tutor_id: ctx.tutor.id, student_id: ctx.student.id, status: 'active' });
  const area = 'Open the official app independently instead of following the link in an urgent account warning.';
  let checklistId;
  let item;
  const before = (await query(client, 'rooms', 'transfer_learning_enabled,in_room_assessment_enabled,ai_assistant_enabled,ai_assistant_model,ai_assistant_prompt', 'id', room.id))[0];
  const config = (await query(client, 'ai_assistant_configs', 'id,model_name,system_prompt,prompt_config,temperature,max_tokens,is_active', 'room_id', room.id)).find(c => c.is_active);
  assert(config?.prompt_config, 'Fixture has no active AI configuration');
  try {
    const setup = await client.from('rooms').update({ transfer_learning_enabled: false, in_room_assessment_enabled: false }).eq('id', room.id);
    assert.equal(setup.error, null);
    await openRoom(tutorPage, appUrl, room.id);
    await tutorPage.locator('button[title="AI Assistant Settings"]').click();
    await waitForTemplateSettings(tutorPage, config.prompt_config);
    await tutorPage.getByLabel('Enable In-Room Assessment').check();
    await tutorPage.getByRole('button', { name: 'Save Settings' }).click();
    await waitForMatch(() => query(client, 'rooms', 'in_room_assessment_enabled', 'id', room.id),
      rows => rows[0]?.in_room_assessment_enabled === true, 'assessment enabled for backfilled room');
    await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
    await tutorPage.getByRole('button', { name: 'Enter Manually' }).click();
    await tutorPage.getByRole('textbox', { name: 'Verification Steps' }).fill(area);
    await tutorPage.locator('.manual-checklist-form button[type="submit"]').click();
    const checklists = await waitForMatch(() => query(client, 'session_checklists', 'id,progress_policy_version,is_active', 'room_id', room.id),
      rows => rows.some(c => c.progress_policy_version === 'transfer_v1' && c.is_active), 'transfer setup in a formerly disabled room');
    checklistId = checklists.find(c => c.progress_policy_version === 'transfer_v1' && c.is_active).id;
    item = (await query(client, 'checklist_items', 'id,area_text,status', 'checklist_id', checklistId))[0];
    assert(item, 'Transfer target was not created');
    await tutorPage.locator('.checklist-close').click();
    await tutorPage.locator('button[title="AI Assistant Settings"]').click();
    await waitForTemplateSettings(tutorPage, config.prompt_config);
    await tutorPage.getByLabel('Enable In-Room Assessment').uncheck();
    await tutorPage.getByRole('button', { name: 'Save Settings' }).click();
    await waitForMatch(() => query(client, 'rooms', 'in_room_assessment_enabled', 'id', room.id),
      rows => rows[0]?.in_room_assessment_enabled === false, 'assessment disabled');
    await tutorPage.locator('button[title="AI Assistant Settings"]').click();
    await waitForTemplateSettings(tutorPage, config.prompt_config);
    assert.equal(await tutorPage.getByLabel('Enable In-Room Assessment').isChecked(), false);
    await tutorPage.getByRole('button', { name: 'Save Settings' }).click();
    const saved = (await query(client, 'rooms', 'transfer_learning_enabled,in_room_assessment_enabled', 'id', room.id))[0];
    assert.equal(saved.transfer_learning_enabled, false);
    assert.equal(saved.in_room_assessment_enabled, false);
    await openRoom(studentPage, appUrl, room.id);
    const stop = await captureResponses(studentPage, r => r.url().includes('/functions/v1/assessment-api'));
    try {
      await sendStudentMessage(studentPage, 'I will ignore the warning link and open the official app myself to check my account.');
      await waitForMatch(() => query(client, 'checklist_items', 'id,status,understanding_level', 'id', item.id),
        rows => rows[0]?.status !== 'pending', 'target progress while assessment off');
    } finally { writeJson(path.join(evidenceDir, 'assessment-switch-analysis.json'), await stop()); }
    const messages = (await query(client, 'messages', 'id,content,user_id', 'room_id', room.id)).filter(m => m.user_id === ctx.student.id);
    assert(messages.length);
    const markers = await managementQuery(ctx.config, `select dedupe_key,processing_state from private.learning_event_inbox where room_id='${room.id}'::uuid and dedupe_key like 'analysis:%'`);
    for (const message of messages) assert(markers.some(m => m.dedupe_key === `analysis:${message.id}`), 'Missing per-message analysis marker');
    await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
    await tutorPage.locator('.checklist-item').filter({ hasText: area }).waitFor({ timeout: TIMEOUT });
    const shots = [await screenshot(tutorPage, evidenceDir, 'assessment-off-progress')];
    await tutorPage.locator('.checklist-close').click();
    const stopTutor = await captureResponses(tutorPage, r => r.url().includes('/functions/v1/'));
    let calls;
    try {
      await tutorPage.locator('button.ai-generate-btn').click();
      await tutorPage.locator('.ai-suggestion-box .ai-suggestion-content p').first().waitFor({ timeout: TIMEOUT });
    } finally { calls = await stopTutor(); writeJson(path.join(evidenceDir, 'assessment-switch-tutor.json'), calls); }
    assert(!calls.some(c => c.request?.operation === 'prepare_turn'), 'Disabled assessment was prepared');
    assert.equal(await tutorPage.getByRole('heading', { name: 'Review transfer assessment' }).count(), 0);
    const focus = messages.at(-1);
    const payload = { reason: 'Verify transfer', target_item_id: item.id, assessment: {
      selection_type: 'single', stem: 'What is the safe response to another account warning?',
      options: [{ id:'A',text:'Open the official app independently' },{ id:'B',text:'Follow the warning link' },{ id:'C',text:'Send the password' },{ id:'D',text:'Forward the login code' }],
      correct_option_ids:['A'], learner_safe_explanation:'Check independently through the official app.',
      transfer_basis:{concept_rule:area,source_context:'Account warning',changed_context:'A new payment alert',source_evidence_message_ids:[focus.id]}
    }};
    const rejected = [];
    for (const operation of ['prepare_turn','send_reviewed']) {
      const result = await client.functions.invoke('assessment-api', { headers:{'x-application-user-id':ctx.tutor.id}, body:{
        operation, request_id:requestId(), room_id:room.id, checklist_id:checklistId,
        student_id:ctx.student.id,item_id:item.id,focus_student_message_id:focus.id,reviewed_payload:payload
      }});
      const body = result.error?.context ? await result.error.context.json() : result.data;
      assert.equal(body?.error?.code, 'IN_ROOM_ASSESSMENT_DISABLED');
      rejected.push({operation,error:body.error});
    }
    return { room_id:room.id, checklist_id:checklistId, markers, rejected, screenshots:shots };
  } finally {
    const { id: configId, ...configValues } = config;
    const restoredConfig = await client.from('ai_assistant_configs').update(configValues).eq('id', configId);
    assert.equal(restoredConfig.error, null, 'Failed to restore fixture AI configuration');
    const restored = await client.from('rooms').update(before).eq('id',room.id);
    assert.equal(restored.error, null, 'Failed to restore fixture assessment switch');
  }
};
