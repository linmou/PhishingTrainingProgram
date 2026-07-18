#!/usr/bin/env node
/**
 * Purpose: Browser UI walkthrough for behavior-demo room templates.
 * Follows claude_docs/ai-assistant-module.md Manual Testing:
 *   1) login as tutor
 *   2) create room from template (AI auto-enabled)
 *   3) open room
 *   4) generate AI suggestion against the seeded student message
 *   5) capture and score the AI suggestion text
 *
 * Usage (from tutor-system/, app on PORT 3001 by default):
 *   node scripts/browser-demo-tutor-behavior.js
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { chromium } = require('playwright');

const BASE_URL = process.env.DEMO_BASE_URL || 'http://localhost:3001';
const OUT_DIR = path.resolve(__dirname, '../../tmp/browser_demo_runs');
const TIMEOUT = 60000;

// Load TypeScript heuristics the same way product-gate does.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true
    },
    fileName: filename
  });
  module._compile(output.outputText, filename);
};

const {
  scoreTutorResponse,
  allHeuristicsPassed
} = require(path.join(__dirname, '../src/services/tutorBehaviorHeuristics.ts'));
const { getDemoRoomTemplateSeeds } = require(path.join(
  __dirname,
  '../src/services/demoRoomTemplates.ts'
));

/**
 * Browser demos: ONLY rooms created from global AI templates
 * (getDemoRoomTemplateSeeds). No freehand rooms.
 */
const DEMOS = getDemoRoomTemplateSeeds().map((seed) => ({
  id: seed.case_id,
  templateName: seed.template_name,
  expect: seed.expected_behavior_focus,
  metrics: seed.ai_config_template.behavior_focus,
  studentIsWrong: seed.studentIsWrong,
  studentAskedPersonalStory: seed.studentAskedPersonalStory,
  studentNeedsSimpleLanguage: seed.studentNeedsSimpleLanguage,
  // For assertions after template select
  expectedStudentLine: [...seed.pre_populated_dialogue]
    .reverse()
    .find((m) => m.role === 'student')?.message
}));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loginAsTutor(page, name) {
  await page.goto(`${BASE_URL}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#displayName', { timeout: TIMEOUT });
  await page.fill('#displayName', name);
  await page.check('input[name="role"][value="tutor"]');
  await page.click('button[type="submit"], button:has-text("Join"), button:has-text("Start")');
  // Tutor lands on tutor dashboard
  await page.waitForURL(/#\/tutor/, { timeout: TIMEOUT }).catch(async () => {
    // Some builds land on home then role routes; force tutor view
    await page.goto(`${BASE_URL}/#/tutor`, { waitUntil: 'domcontentloaded' });
  });
  await page.waitForSelector('text=Create a new Room', { timeout: TIMEOUT });
}

async function createRoomFromTemplate(page, templateName) {
  await page.click('text=Create a new Room');
  await page.waitForSelector('#template-select, label:has-text("Use Template")', { timeout: TIMEOUT });

  // Template-only path: must pick an existing global template.
  const select = page.locator('#template-select');
  await select.waitFor({ timeout: TIMEOUT });
  const options = await select.locator('option').allTextContents();
  const match = options.find(
    (o) => o.trim() === templateName || o.includes(templateName)
  );
  if (!match || !match.trim() || match.includes('Select') || match.includes('None')) {
    throw new Error(
      `Template-only policy: "${templateName}" not in dropdown. Options: ${options.join(' | ')}`
    );
  }
  await select.selectOption({ label: match.trim() });
  await sleep(500);

  // Refuse create if template select cleared somehow
  const selected = await select.inputValue();
  if (!selected) {
    throw new Error(`Template-only policy: no template selected for ${templateName}`);
  }

  await page.click('button:has-text("Create Room")');
  // Wait for navigation into room or success then auto-navigate
  await page.waitForURL(/#\/room\//, { timeout: 90000 });
  const url = page.url();
  const roomId = (url.match(/room\/([^/?#]+)/) || [])[1];
  if (!roomId) throw new Error(`No room id after create: ${url}`);
  return roomId;
}

async function ensureAIEnabled(page) {
  const body = await page.locator('body').innerText();
  if (body.includes('AI: On') || body.includes('AI Enabled') || body.includes('✨')) {
    // Already looks enabled; still open settings if Off is shown
  }
  if (body.includes('AI: Off')) {
    // Open settings and enable
    const settingsBtn = page.locator('button:has-text("AI"), button:has-text("Settings")').first();
    if (await settingsBtn.count()) {
      await settingsBtn.click();
      await sleep(800);
      const toggle = page.locator('text=Enable AI Assistant').first();
      if (await toggle.count()) {
        const checkbox = page.locator('input[type="checkbox"]').first();
        if (await checkbox.count()) {
          const checked = await checkbox.isChecked();
          if (!checked) await checkbox.check();
        }
      }
      const save = page.locator('button:has-text("Save")').first();
      if (await save.count()) await save.click();
      await sleep(1000);
    }
  }
}

async function dumpControls(page) {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map((b) => ({
      text: (b.innerText || '').trim().slice(0, 80),
      title: b.getAttribute('title') || '',
      className: b.className,
      disabled: b.disabled
    }));
    const bodySnippet = (document.body.innerText || '').slice(0, 1500);
    return { buttons: buttons.filter((b) => b.text || b.title).slice(0, 40), bodySnippet };
  });
}

async function generateAI(page) {
  page._lastDialog = null;
  page.once('dialog', async (d) => {
    const msg = d.message();
    await d.dismiss().catch(() => {});
    page._lastDialog = msg;
  });

  // RoomPagePost uses a purple floating "✨ AI" button (class ai-generate-btn).
  // See claude_docs/ai-assistant-module.md: "Generate AI Responses".
  const aiBtn = page.locator('button.ai-generate-btn').first();
  await aiBtn.waitFor({ state: 'visible', timeout: TIMEOUT });

  // Wait until enabled (not loading, messages present)
  const readyStart = Date.now();
  while (Date.now() - readyStart < 20000) {
    const disabled = await aiBtn.isDisabled().catch(() => true);
    if (!disabled) break;
    await sleep(300);
  }
  if (await aiBtn.isDisabled()) {
    const dump = await dumpControls(page);
    throw new Error(`AI button stayed disabled. Body=${dump.bodySnippet.slice(0, 500)}`);
  }

  await aiBtn.click();
  console.log('Clicked AI generate button');

  // Wait for suggestion box or failure dialog
  const start = Date.now();
  while (Date.now() - start < 90000) {
    if (page._lastDialog) {
      throw new Error(`AI dialog error: ${page._lastDialog}`);
    }
    const hasBox =
      (await page.locator('.ai-suggestion-box').count()) > 0 ||
      (await page.getByText('AI Suggested Response').count()) > 0;
    if (hasBox) {
      console.log('AI suggestion box appeared');
      break;
    }
    // still generating?
    const loading = await page.locator('button.ai-generate-btn:disabled, .ai-loading-spinner').count();
    if (loading === 0 && Date.now() - start > 8000) {
      // finished loading without box — dump state
      const dump = await dumpControls(page);
      // keep waiting a bit more in case of slow paint
      if (Date.now() - start > 20000) {
        throw new Error(
          `AI finished without suggestion UI. Body=${dump.bodySnippet.slice(0, 700)}`
        );
      }
    }
    await sleep(500);
  }
  if (
    (await page.locator('.ai-suggestion-box').count()) === 0 &&
    (await page.getByText('AI Suggested Response').count()) === 0
  ) {
    const dump = await dumpControls(page);
    throw new Error(
      `Timed out waiting for AI suggestion. Body=${dump.bodySnippet.slice(0, 700)}`
    );
  }
  await sleep(1000);
}

async function readSuggestion(page) {
  const box = page.locator('.ai-suggestion-content p, .ai-suggestion-box p, .ai-suggestion-content');
  if ((await box.count()) > 0) {
    return (await box.first().innerText()).trim();
  }
  // Fallback: text near AI Suggested Response
  const body = await page.locator('body').innerText();
  const m = body.match(/AI Suggested Response[\s\S]{0,40}([\s\S]{20,600})/);
  return m ? m[1].split('\n').slice(0, 8).join(' ').trim() : '';
}

function scoreDemo(text, demo) {
  const scores = scoreTutorResponse(text, {
    metrics: demo.metrics,
    studentIsWrong: demo.studentIsWrong,
    studentAskedPersonalStory: demo.studentAskedPersonalStory,
    studentNeedsSimpleLanguage: demo.studentNeedsSimpleLanguage
  });
  return {
    pass: allHeuristicsPassed(scores),
    scores,
    failed: scores.filter((s) => !s.pass).map((s) => s.metric)
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Prefer system Chrome so we do not depend on a matching Playwright browser cache.
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PW_CHANNEL || 'chrome'
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);

  const results = [];
  console.log(`BASE_URL=${BASE_URL}`);
  console.log('Following ai-assistant-module.md Manual Testing flow');

  try {
    await loginAsTutor(page, `DemoTutor_${Date.now().toString().slice(-6)}`);
    console.log('Logged in as tutor');

    for (const demo of DEMOS) {
      console.log(`\n======== ${demo.id}: ${demo.templateName} ========`);
      const entry = {
        id: demo.id,
        templateName: demo.templateName,
        expect: demo.expect,
        roomId: null,
        suggestion: '',
        score: null,
        error: null,
        screenshot: null
      };

      try {
        // Always start from tutor dashboard for a clean create flow
        await page.goto(`${BASE_URL}/#/tutor`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('text=Create a new Room', { timeout: TIMEOUT });

        entry.roomId = await createRoomFromTemplate(page, demo.templateName);
        console.log('Created room from template', demo.templateName, entry.roomId);
        await sleep(2000);
        await page.waitForSelector('body', { timeout: TIMEOUT });

        // Verify template dialogue (student line) is visible in the room
        if (demo.expectedStudentLine) {
          const bodyText = await page.locator('body').innerText();
          if (!bodyText.includes(demo.expectedStudentLine.slice(0, 40))) {
            throw new Error(
              `Template dialogue missing in room UI. Expected student line snippet: ${demo.expectedStudentLine.slice(0, 60)}`
            );
          }
        }

        // Capture room landing
        const shot1 = path.join(OUT_DIR, `${demo.id}_room.png`);
        await page.screenshot({ path: shot1, fullPage: true });

        await ensureAIEnabled(page);
        await generateAI(page);
        entry.suggestion = await readSuggestion(page);
        entry.score = scoreDemo(entry.suggestion, demo);

        const shot2 = path.join(OUT_DIR, `${demo.id}_ai.png`);
        await page.screenshot({ path: shot2, fullPage: true });
        entry.screenshot = shot2;

        console.log('SUGGESTION:', entry.suggestion.slice(0, 300));
        console.log(entry.score.pass ? 'PASS' : 'FAIL', entry.score.failed);
        if (!entry.score.pass) {
          console.log(
            '  scores:',
            entry.score.scores
              .filter((s) => !s.pass)
              .map((s) => `${s.metric}: ${s.reasons.join('; ')}`)
          );
        }
      } catch (e) {
        entry.error = e.message || String(e);
        console.error('ERROR', entry.error);
        try {
          const shotE = path.join(OUT_DIR, `${demo.id}_error.png`);
          await page.screenshot({ path: shotE, fullPage: true });
          entry.screenshot = shotE;
        } catch (_) {
          /* ignore */
        }
      }

      results.push(entry);
    }
  } finally {
    await browser.close();
  }

  const reportPath = path.join(OUT_DIR, 'report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ baseUrl: BASE_URL, ranAt: new Date().toISOString(), results }, null, 2)
  );

  const passed = results.filter((r) => !r.error && r.score?.pass).length;
  console.log('\n======== SUMMARY ========');
  console.log(`${passed}/${results.length} demos passed quick UI checks`);
  for (const r of results) {
    console.log(
      r.error ? 'ERROR' : r.score?.pass ? 'PASS' : 'FAIL',
      r.id,
      r.error || r.suggestion.slice(0, 80).replace(/\s+/g, ' ')
    );
  }
  console.log('Report:', reportPath);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
