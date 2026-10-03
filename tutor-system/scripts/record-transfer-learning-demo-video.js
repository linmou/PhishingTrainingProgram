#!/usr/bin/env node
// Purpose: record one selected-target transfer-learning journey as a side-by-side tutor/learner WebM.
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const support = require('./browser-e2e/browser-e2e-support');
const { TRANSFER_LEARNER_DIALOGUE } = require('./browser-e2e/workflows/assessment-fixture');

const FOCUS_MESSAGE = TRANSFER_LEARNER_DIALOGUE.evidence;
const FOLLOW_UP = TRANSFER_LEARNER_DIALOGUE.followUp;
const TUTOR_NAME = 'DemoTutor_213782';
const TIMEOUT = support.TIMEOUT;
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_BIN || 'ffprobe';

function parseDecision(calls) {
  const content = [...calls].reverse().find((call) =>
    call.status === 200 && call.response?.choices?.[0]?.message?.content)?.response.choices[0].message.content;
  assert(content, 'Tutor provider returned no usable response');
  const decision = JSON.parse(content);
  assert(['tutoring', 'guard'].includes(decision.decision?.mode), 'Tutor provider returned no tutor decision');
  assert(decision.response?.trim(), 'Tutor provider returned no learner-facing response');
  return decision;
}

async function chapter(pages, label, chapters, startedAt) {
  chapters.push({ label, at_seconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)) });
  await Promise.all(pages.map((page) => page.evaluate((text) => {
    let marker = document.getElementById('__transfer_demo_chapter');
    if (!marker) {
      marker = document.createElement('div');
      marker.id = '__transfer_demo_chapter';
      marker.style.cssText = 'position:fixed;z-index:2147483647;left:24px;bottom:24px;padding:12px 18px;background:#111;color:#fff;font:600 18px/1.2 sans-serif;border-radius:6px;box-shadow:0 4px 18px #0008;';
      document.body.appendChild(marker);
    }
    marker.textContent = text;
    marker.style.display = 'block';
    window.setTimeout(() => { marker.style.display = 'none'; }, 2600);
  }, label)));
  await pages[0].waitForTimeout(1400);
}

async function sendStudentMessage(page, text) {
  await page.locator('textarea.comment-input-field').fill(text);
  await page.locator('form.comment-input-form button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('textarea.comment-input-field')?.value === '' ||
    document.querySelector('[data-testid="rating-reminder-backdrop"]') !== null);
  const reminder = page.getByRole('alertdialog', { name: 'Rate the previous response' });
  if (await reminder.count() && await reminder.isVisible()) {
    await reminder.getByRole('button', { name: 'Helpful', exact: true }).click();
    await reminder.getByRole('button', { name: '4 stars' }).click();
    await reminder.getByRole('button', { name: 'Submit rating' }).click();
    await reminder.waitFor({ state: 'hidden', timeout: TIMEOUT });
    await page.locator('form.comment-input-form button[type="submit"]').click();
  }
  await page.waitForFunction(() => document.querySelector('textarea.comment-input-field')?.value === '');
}

function extractLearningTargets(promptConfig) {
  const detectionAreas = Array.isArray(promptConfig?.detection_areas)
    ? promptConfig.detection_areas.filter((target) => typeof target === 'string' && target.trim())
    : [];
  const verificationSteps = Array.isArray(promptConfig?.verification_steps)
    ? promptConfig.verification_steps.filter((target) => typeof target === 'string' && target.trim())
    : [];
  assert(detectionAreas.length > 1, 'Template must provide multiple detection-area targets');
  assert(verificationSteps.length > 1, 'Template must provide multiple verification targets');
  return { detectionAreas, verificationSteps };
}

async function setUpTargets(tutorPage, targets) {
  await tutorPage.locator('button[title="Learning Progress Checklist"]').click();
  await tutorPage.getByRole('button', { name: 'Enter Manually' }).click();
  await tutorPage.getByRole('textbox', { name: 'Detection Areas' }).fill(targets.detectionAreas.join('\n'));
  await tutorPage.getByRole('textbox', { name: 'Verification Steps' }).fill(targets.verificationSteps.join('\n'));
  await tutorPage.locator('.manual-checklist-form button[type="submit"]').click();
  for (const target of [...targets.detectionAreas, ...targets.verificationSteps]) {
    await tutorPage.locator('.checklist-item').filter({ hasText: target }).waitFor({ timeout: TIMEOUT });
  }
}

async function combineVideos(rawDir, output) {
  const videos = fs.readdirSync(rawDir).filter((name) => name.endsWith('.webm')).sort();
  assert.equal(videos.length, 2, `Expected tutor and learner recordings, found ${videos.length}`);
  execFileSync(FFMPEG, [
    '-y', '-i', path.join(rawDir, videos[0]), '-i', path.join(rawDir, videos[1]),
    '-filter_complex', '[0:v]setpts=PTS-STARTPTS[left];[1:v]setpts=PTS-STARTPTS[right];[left][right]hstack=inputs=2:shortest=1[v]',
    '-map', '[v]', '-an', '-c:v', 'libvpx-vp9', '-crf', '28', '-b:v', '0', output, '-loglevel', 'error'
  ]);
  return videos.map((name) => path.join(rawDir, name));
}

function makeContactSheet(video, output) {
  execFileSync(FFMPEG, [
    '-y', '-i', video,
    '-vf', "fps=1/4,scale=960:300,drawtext=text='%{pts\\:hms}':x=18:y=18:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.85:boxborderw=8,tile=3x4",
    '-frames:v', '1', output, '-loglevel', 'error'
  ]);
}

async function main() {
  const config = support.configFromEnv();
  const runId = `${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
  const outputRoot = path.resolve(__dirname, '../output/playwright');
  const evidenceDir = path.join(outputRoot, `transfer-learning-demo-video-${runId}`);
  const rawDir = path.join(evidenceDir, 'raw');
  const video = path.join(outputRoot, `transfer-learning-demo-video-${runId}.webm`);
  const contactSheet = path.join(outputRoot, `transfer-learning-demo-video-${runId}-timestamped.png`);
  fs.mkdirSync(rawDir, { recursive: true });

  const client = createClient(config.projectUrl, config.serviceKey, { auth: { persistSession: false } });
  const learnerName = `Transfer Demo Learner ${runId}`;
  const startedAt = Date.now();
  const chapters = [];
  let browser;
  let tutorContext;
  let studentContext;
  let tutorPage;
  let studentPage;
  let room;
  let checklist;
  let tutorDialogMessage = null;
  const evidence = { run_id: runId, project_ref: support.PROJECT, room_id: null, tutor_name: TUTOR_NAME, learner_name: learnerName, chapters };

  try {
    await support.managementQuery(config, 'select 1 as ready');
    browser = await chromium.launch({ headless: true });
    tutorContext = await browser.newContext({ recordVideo: { dir: rawDir, size: { width: 1280, height: 800 } } });
    studentContext = await browser.newContext({ recordVideo: { dir: rawDir, size: { width: 1280, height: 800 } } });
    const tutorTraffic = await support.guardProject(tutorContext);
    const studentTraffic = await support.guardProject(studentContext);
    tutorPage = await tutorContext.newPage();
    studentPage = await studentContext.newPage();
    tutorPage.on('dialog', async (dialog) => {
      tutorDialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await chapter([tutorPage, studentPage], 'Transfer learning demo begins', chapters, startedAt);
    await support.joinAs(tutorPage, config.appUrl, TUTOR_NAME, 'tutor');
    support.assertProjectTraffic(tutorTraffic);
    const tutor = (await support.query(client, 'users', 'id,display_name', 'display_name', TUTOR_NAME))[0];
    assert(tutor?.id, `Tutor identity was not stored in ${support.TARGET}`);
    await support.joinAs(studentPage, config.appUrl, learnerName, 'student');
    support.assertProjectTraffic(studentTraffic);
    const student = (await support.query(client, 'users', 'id,display_name', 'display_name', learnerName))[0];
    assert(student?.id, `Learner identity was not stored in ${support.TARGET}`);

    room = await support.existingRoom(client, 'assessment-delivery', tutor.id);
    evidence.room_id = room.id;
    const roomConfig = (await support.query(
      client,
      'ai_assistant_configs',
      'prompt_config',
      'room_id',
      room.id
    ))[0];
    const targets = extractLearningTargets(roomConfig?.prompt_config);
    await support.insert(client, 'sessions', {
      room_id: room.id, tutor_id: tutor.id, student_id: student.id, status: 'active'
    });
    await support.openRoom(studentPage, config.appUrl, room.id);
    const priorIntroductionIds = new Set((await support.query(client, 'messages', 'id', 'room_id', room.id)).map((row) => row.id));
    await sendStudentMessage(studentPage, TRANSFER_LEARNER_DIALOGUE.introduction);
    const introduction = (await support.waitForMatch(
      () => support.query(client, 'messages', 'id,content,user_id,created_at', 'room_id', room.id),
      (rows) => rows.some((row) => row.user_id === student.id && !priorIntroductionIds.has(row.id)),
      'learner room introduction'
    )).filter((row) => row.user_id === student.id && !priorIntroductionIds.has(row.id))
      .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at)).at(-1);
    assert(introduction?.id && introduction.content, 'Learner room introduction was not saved');
    await support.openRoom(tutorPage, config.appUrl, room.id);

    await chapter([tutorPage, studentPage], 'Tutor approves the learner target', chapters, startedAt);
    await setUpTargets(tutorPage, targets);
    checklist = (await support.waitForMatch(
      () => support.query(client, 'session_checklists', 'id,room_id,student_id,progress_policy_version', 'room_id', room.id),
      (rows) => rows.length === 1 && rows[0].student_id === student.id && rows[0].progress_policy_version === 'transfer_v1',
      'approved transfer checklist'
    ))[0];

    await chapter([tutorPage, studentPage], 'Learner demonstrates the target', chapters, startedAt);
    const priorEvidenceIds = new Set((await support.query(client, 'messages', 'id', 'room_id', room.id)).map((row) => row.id));
    await sendStudentMessage(studentPage, FOCUS_MESSAGE);
    const focus = (await support.waitForMatch(
      () => support.query(client, 'messages', 'id,content,user_id,created_at', 'room_id', room.id),
      (rows) => rows.some((row) => row.user_id === student.id && !priorEvidenceIds.has(row.id)),
      'learner target evidence'
    )).filter((row) => row.user_id === student.id && !priorEvidenceIds.has(row.id))
      .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at)).at(-1);
    assert(focus?.id && focus.content, 'Learner evidence message was not saved');
    const checklistItems = await support.query(client, 'checklist_items', 'id,status,area_text', 'checklist_id', checklist.id);
    assert(checklistItems.length >= targets.detectionAreas.length + targets.verificationSteps.length,
      'Checklist did not preserve the complete template target inventory');
    await support.waitForMatch(
      () => support.query(client, 'checklist_items', 'id,status,area_text', 'checklist_id', checklist.id),
      (rows) => rows.some((row) => row.status !== 'pending'),
      'learner target analysis'
    );

    await tutorPage.reload({ waitUntil: 'domcontentloaded' });
    await tutorPage.locator('.post-comment').filter({ hasText: focus.content }).waitFor({ timeout: TIMEOUT });
    const checklistClose = tutorPage.locator('.checklist-close');
    if (await checklistClose.isVisible()) await checklistClose.click();
    await chapter([tutorPage, studentPage], 'Tutor reviews and sends the assessment', chapters, startedAt);
    const assessmentStop = await support.captureResponses(tutorPage, (response) => response.url().includes('/functions/v1/assessment-api'));
    let assessmentCalls;
    try {
      await tutorPage.locator('button.ai-generate-btn').click();
      await tutorPage.getByRole('heading', { name: 'Review transfer assessment' }).waitFor({ timeout: TIMEOUT });
    } finally {
      assessmentCalls = await assessmentStop();
      support.writeJson(path.join(evidenceDir, 'assessment-api.json'), assessmentCalls);
    }
    const prepared = assessmentCalls.find((call) => call.request?.operation === 'prepare_turn' && call.status === 200);
    assert(prepared, 'Transfer assessment preparation did not complete');
    const correctOptionLabel = await tutorPage.locator('input[name="assessment-correct-option"]:checked').getAttribute('aria-label');
    const correctOption = correctOptionLabel?.match(/Correct answer ([A-D])$/)?.[1];
    assert(correctOption, 'Assessment draft has no selected answer');
    await tutorPage.getByRole('button', { name: 'Send assessment' }).click();
    const delivered = (await support.waitForMatch(
      () => support.query(client, 'messages', 'id,assessment_id,assessment_lifecycle,response_mode', 'room_id', room.id),
      (rows) => rows.some((row) => row.assessment_id && row.assessment_lifecycle === 'delivered'),
      'delivered transfer assessment'
    )).find((row) => row.assessment_id && row.assessment_lifecycle === 'delivered');
    assert(delivered?.assessment_id, 'Delivered assessment has no public assessment ID');
    await studentPage.reload({ waitUntil: 'domcontentloaded' });
    const question = studentPage.locator(`[data-testid="public-assessment-${delivered.assessment_id}"]`);
    await question.waitFor({ timeout: TIMEOUT });

    await chapter([tutorPage, studentPage], 'Learner answers and progress is recorded', chapters, startedAt);
    await question.locator(`input[value="${correctOption}"]`).check();
    await question.getByRole('button', { name: 'Submit answer' }).click();
    await question.getByRole('status').filter({ hasText: 'Correct.' }).waitFor({ timeout: TIMEOUT });
    await support.waitForMatch(
      () => support.query(client, 'checklist_items', 'id,status', 'checklist_id', checklist.id),
      (rows) => rows.some((row) => row.status === 'covered'),
      'covered transfer target'
    );

    await chapter([tutorPage, studentPage], 'Learner asks a follow-up; tutor resumes tutoring', chapters, startedAt);
    const priorFollowUpIds = new Set((await support.query(client, 'messages', 'id', 'room_id', room.id)).map((row) => row.id));
    await sendStudentMessage(studentPage, FOLLOW_UP);
    const followUp = (await support.waitForMatch(
      () => support.query(client, 'messages', 'id,content,user_id,created_at', 'room_id', room.id),
      (rows) => rows.some((row) => row.user_id === student.id && !priorFollowUpIds.has(row.id)),
      'learner follow-up'
    )).filter((row) => row.user_id === student.id && !priorFollowUpIds.has(row.id))
      .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at)).at(-1);
    assert(followUp?.id && followUp.content, 'Learner follow-up was not saved');
    await tutorPage.reload({ waitUntil: 'domcontentloaded' });
    await tutorPage.locator('.post-comment').filter({ hasText: followUp.content }).waitFor({ timeout: TIMEOUT });
    const tutorChecklistClose = tutorPage.locator('.checklist-close');
    if (await tutorChecklistClose.isVisible()) await tutorChecklistClose.click();
    const tutorStop = await support.captureResponses(
      tutorPage,
      (response) => response.url().includes('/functions/v1/ai-api') || response.url().includes('/functions/v1/assessment-api')
    );
    let tutorCalls;
    try {
      await tutorPage.locator('button.ai-generate-btn').click();
      if (tutorDialogMessage) throw new Error(`Tutor generation dialog: ${tutorDialogMessage}`);
      await tutorPage.locator('.ai-suggestion-box .ai-suggestion-content p').first().waitFor({ timeout: TIMEOUT });
      await tutorPage.waitForFunction(() => {
        const value = document.querySelector('.ai-suggestion-box .ai-suggestion-content p')?.textContent?.trim();
        return value && value !== 'Generating new response...';
      }, null, { timeout: TIMEOUT });
    } finally {
      tutorCalls = await tutorStop();
      support.writeJson(path.join(evidenceDir, 'tutor-provider.json'), { dialog: tutorDialogMessage, calls: tutorCalls });
    }
    assert.equal(await tutorPage.getByRole('heading', { name: 'Review transfer assessment' }).count(), 0);
    const decision = parseDecision(tutorCalls);
    assert.equal(decision.decision.mode, 'tutoring');
    await tutorPage.getByRole('button', { name: /copy to input/i }).click();
    const reviewed = await tutorPage.locator('textarea.comment-input-field').inputValue();
    assert.equal(reviewed, decision.response);
    await tutorPage.locator('form.comment-input-form button[type="submit"]').click();
    const tutoringMessage = (await support.waitForMatch(
      () => support.query(client, 'messages', 'id,content,parent_message_id,response_mode,user_role', 'room_id', room.id),
      (rows) => rows.some((row) => row.parent_message_id === followUp.id && row.user_role === 'tutor' && row.response_mode === 'tutoring'),
      'post-assessment tutoring message'
    )).find((row) => row.parent_message_id === followUp.id && row.user_role === 'tutor' && row.response_mode === 'tutoring');
    assert(tutoringMessage, 'Post-assessment tutor message did not persist');
    await studentPage.reload({ waitUntil: 'domcontentloaded' });
    await studentPage.locator('.post-comment').filter({ hasText: reviewed }).waitFor({ timeout: TIMEOUT });

    const messages = await support.query(client, 'messages', 'id,user_role,response_mode,assessment_id,assessment_lifecycle', 'room_id', room.id);
    evidence.assessment_message = delivered;
    evidence.tutoring_message = tutoringMessage;
    evidence.messages = messages;
    evidence.assessment_calls = assessmentCalls.map((call) => ({ url: call.url, status: call.status, operation: call.request?.operation }));
    evidence.tutor_calls = tutorCalls.map((call) => ({ url: call.url, status: call.status }));
    support.writeJson(path.join(evidenceDir, 'evidence.json'), evidence);
    await chapter([tutorPage, studentPage], 'Final tutoring message visible', chapters, startedAt);
    support.writeJson(path.join(evidenceDir, 'chapters.json'), chapters);
    await Promise.all([
      support.screenshot(tutorPage, evidenceDir, 'final-tutor'),
      support.screenshot(studentPage, evidenceDir, 'final-learner')
    ]);
  } finally {
    if (browser) await browser.close();
    if (room) await support.cleanupRoom(config, room.id);
  }

  const rawVideos = await combineVideos(rawDir, video);
  makeContactSheet(video, contactSheet);
  const probe = JSON.parse(execFileSync(FFPROBE, [
    '-v', 'error', '-show_entries', 'format=duration,size', '-show_entries', 'stream=width,height,codec_name',
    '-of', 'json', video
  ], { encoding: 'utf8' }));
  evidence.video = { file: video, contact_sheet: contactSheet, raw_files: rawVideos, probe };
  evidence.completed_at = new Date().toISOString();
  support.writeJson(path.join(evidenceDir, 'evidence.json'), evidence);
  process.stdout.write(`${JSON.stringify({ video, evidence: evidenceDir, probe })}\n`);
}

module.exports = { extractLearningTargets, main };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
}
