#!/usr/bin/env node
// Purpose: create a transfer-assessment demo room and verify it end to end in a real browser. The
// transfer checklist can no longer be created from the UI (its creation used to be a server
// operation), so this script joins the app as a tutor and a learner to create their identity rows,
// seeds a transfer_v1 checklist with eligible items and a dialogue history, then drives the tutor's
// "Generate AI Response" action and asserts that the next tutor turn is a transfer assessment.
//
// Usage: node scripts/seed-transfer-demo-room.js [--seed-only]

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

const tutorRoot = path.resolve(__dirname, '..');
const BASE_URL = process.env.DEMO_BASE_URL || 'http://localhost:3003';
const TIMEOUT = 90000;
const TUTOR_NAME = 'Transfer Demo Tutor';
const LEARNER_NAME = 'Transfer Demo Learner';

const env = {
  ...dotenv.parse(fs.readFileSync(path.join(tutorRoot, '.env'))),
  ...process.env,
};
const supabase = createClient(env.REACT_APP_SUPABASE_URL, env.REACT_APP_SUPABASE_ANON_KEY);

/** Reproduce AuthContext.generateUserId so seeded rows match the browser's identity. */
function generateUserId(displayName, role) {
  const normalized = displayName.toLowerCase().trim().replace(/\s+/g, ' ');
  const input = `${normalized}-${role}`;
  const hashes = [];
  for (let i = 0; i < 5; i += 1) {
    let hash = i * 31;
    for (let j = 0; j < input.length; j += 1) {
      hash = ((hash << 5) - hash + input.charCodeAt(j) + i * 17) & 0xffffffff;
    }
    hashes.push(Math.abs(hash).toString(16).padStart(8, '0'));
  }
  return `${hashes[0].slice(0, 8)}-${hashes[1].slice(0, 4)}-4${hashes[2].slice(0, 3)}-a${hashes[3].slice(0, 3)}-${hashes[4].slice(0, 8)}${hashes[0].slice(0, 4)}`;
}

async function joinAs(page, displayName, role) {
  await page.goto(`${BASE_URL}/#/`, { waitUntil: 'domcontentloaded' });
  await page.fill('#displayName', displayName);
  await page.check(`input[name="role"][value="${role}"]`);
  await page.click('button[type="submit"], button:has-text("Join"), button:has-text("Start")');
  await page.waitForTimeout(2500);
}

async function seed() {
  const tutorId = generateUserId(TUTOR_NAME, 'tutor');
  const learnerId = generateUserId(LEARNER_NAME, 'student');

  const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL || 'chrome' });
  try {
    const tutorContext = await browser.newContext();
    await joinAs(await tutorContext.newPage(), TUTOR_NAME, 'tutor');
    const learnerContext = await browser.newContext();
    await joinAs(await learnerContext.newPage(), LEARNER_NAME, 'student');
    await tutorContext.close();
    await learnerContext.close();
  } finally {
    await browser.close();
  }

  const roomId = crypto.randomUUID();
  const checklistId = crypto.randomUUID();
  const history = [
    { role: 'tutor', content: 'This alert says your account is at risk. What do you notice before anyone clicks?' },
    { role: 'student', content: 'The sender name looks like a company I use, so it seemed fine to me at first.' },
    { role: 'tutor', content: 'What does that tell you about trusting a familiar sender?' },
    { role: 'student', content: 'A name that looks familiar is not proof the message is real. I should check the real app instead of the link.' },
  ];

  const { error: roomError } = await supabase.from('rooms').insert({
    id: roomId,
    title: 'Transfer assessment demo',
    description: 'Seeded demo room for the transfer assessment.',
    tutor_id: tutorId,
    is_active: true,
    ai_assistant_enabled: true,
  });
  if (roomError) throw new Error(`room insert failed: ${roomError.message}`);

  const { error: checklistError } = await supabase.from('session_checklists').insert({
    id: checklistId,
    room_id: roomId,
    student_id: learnerId,
    template_name: 'Transfer demo',
    progress_policy_version: 'transfer_v1',
    is_active: true,
    total_items: 3,
    completed_items: 0,
    completion_percentage: 0,
  });
  if (checklistError) throw new Error(`checklist insert failed: ${checklistError.message}`);

  const items = [
    'A familiar sender or trusted-looking post is not proof that a message is safe',
    'Pressure language that demands immediate action is a warning sign',
    'Verify through the real app or the known address instead of the message link',
  ].map((areaText) => ({
    id: crypto.randomUUID(),
    checklist_id: checklistId,
    area_text: areaText,
    priority: 'critical',
    status: 'partially_covered',
    understanding_level: 'basic',
  }));
  const { error: itemError } = await supabase.from('checklist_items').insert(items);
  if (itemError) throw new Error(`checklist item insert failed: ${itemError.message}`);

  for (const message of history) {
    const { error: messageError } = await supabase.from('messages').insert({
      room_id: roomId,
      user_id: message.role === 'tutor' ? tutorId : learnerId,
      content: message.content,
      user_role: message.role,
      is_ai_generated: message.role === 'tutor',
      response_mode: 'tutoring',
    });
    if (messageError) throw new Error(`message insert failed: ${messageError.message}`);
  }

  const focusId = 'focus-message-not-used';
  void focusId;
  return { roomId, checklistId, tutorId, learnerId, url: `${BASE_URL}/#/room/${roomId}` };
}

async function verify(room) {
  const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL || 'chrome' });
  const captured = [];
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('response', async (response) => {
      if (!response.url().includes('/chat/completions')) return;
      try {
        captured.push(await response.json());
      } catch {
        /* ignore non-JSON */
      }
    });

    await joinAs(page, TUTOR_NAME, 'tutor');
    await page.goto(room.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const generated = page.locator('button[title^="Generate AI Response"]').first();
    await generated.waitFor({ state: 'visible', timeout: TIMEOUT });
    await generated.click();

    // Wait for either a provider response or a visible draft in the editor.
    const deadline = Date.now() + TIMEOUT;
    let decision = null;
    while (Date.now() < deadline) {
      if (captured.length > 0) {
        const content = captured[captured.length - 1]?.choices?.[0]?.message?.content;
        if (content) {
          try {
            decision = JSON.parse(content);
            break;
          } catch {
            /* keep waiting */
          }
        }
      }
      await page.waitForTimeout(1000);
    }

    const body = await page.locator('body').innerText();
    const optionInputs = await page.locator('input[placeholder^="Option"], textarea[placeholder^="Option"], input[name^="option"]').count();
    const mode = decision?.decision?.mode || null;
    const optionCount = Array.isArray(decision?.assessment?.options) ? decision.assessment.options.length : 0;

    return {
      room_id: room.roomId,
      provider_calls: captured.length,
      decision_mode: mode,
      decision_instruction: decision?.decision?.instruction || null,
      assessment_options: optionCount,
      assessment_stem: decision?.assessment?.stem || null,
      transfer_basis_present: Boolean(decision?.assessment?.transfer_basis),
      draft_editor_option_inputs: optionInputs,
      page_shows_assessment_editor: /assessment|correct|option/i.test(body),
      is_transfer_assessment: mode === 'assessment' && optionCount === 4,
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const seedOnly = process.argv.includes('--seed-only');
  const room = await seed();
  const result = { seeded: room };
  if (!seedOnly) result.verification = await verify(room);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.verification && !result.verification.is_transfer_assessment) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
