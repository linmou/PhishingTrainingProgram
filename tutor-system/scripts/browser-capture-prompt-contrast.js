#!/usr/bin/env node
/**
 * Purpose: create the six controlled comparison rooms, capture one successful
 * AI suggestion per room, and write webpage screenshots plus a complete run manifest.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ts = require('typescript');

const BASE_URL = process.env.DEMO_BASE_URL || 'http://localhost:3001';
const TIMEOUT_MS = 60000;

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
      resolveJsonModule: true
    },
    fileName: filename
  });
  module._compile(output.outputText, filename);
};

class TransportGenerationError extends Error {}

async function generateWithTransportRetry(generate) {
  try {
    return await generate();
  } catch (error) {
    if (!(error instanceof TransportGenerationError)) throw error;
    return generate();
  }
}

function buildCaptureRecord(capture) {
  return {
    pairId: capture.comparison.pairId,
    version: capture.comparison.version,
    templateId: capture.template.id,
    roomId: capture.room.id,
    scenarioContext: capture.input.scenarioContext,
    conversationHistory: capture.input.conversationHistory,
    studentMessage: capture.input.studentMessage,
    modelName: capture.controls.modelName,
    temperature: capture.controls.temperature,
    maxTokens: capture.controls.maxTokens,
    systemPromptSourceCommit: capture.input.systemPromptSourceCommit,
    systemPromptSha256: capture.input.systemPromptSha256,
    userTurn: capture.input.userTurn,
    response: capture.generation.response,
    latencyMs: capture.generation.latencyMs,
    heuristicScores: capture.generation.heuristicScores,
    screenshotPath: capture.screenshotPath
  };
}

function buildRunManifest({ runId, startedAt, appCommit, records }) {
  return { runId, startedAt, appCommit, records };
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function loginAsTutor(page, displayName) {
  await page.goto(`${BASE_URL}/#/`, { waitUntil: 'domcontentloaded' });
  await page.fill('#displayName', displayName);
  await page.check('input[name="role"][value="tutor"]');
  await page.click('button[type="submit"], button:has-text("Join"), button:has-text("Start")');
  await page.waitForURL(/#\/tutor/, { timeout: TIMEOUT_MS });
}

async function createRoomFromTemplate(page, templateName) {
  await page.goto(`${BASE_URL}/#/tutor/test-rooms`, { waitUntil: 'domcontentloaded' });
  await page.click('[data-testid="create-test-room"]');
  const select = page.locator('#template-select');
  await select.waitFor({ timeout: TIMEOUT_MS });
  const option = select.locator('option').filter({ hasText: templateName }).first();
  await option.waitFor({ timeout: TIMEOUT_MS });
  const templateId = await option.getAttribute('value');
  if (!templateId) throw new Error(`Missing template id for ${templateName}`);
  await select.selectOption(templateId);
  await page.getByRole('button', { name: /create room/i }).click();
  await page.waitForURL(/#\/room\//, { timeout: 90000 });
  const roomId = (page.url().match(/room\/([^/?#]+)/) || [])[1];
  if (!roomId) throw new Error(`Missing room id after creating ${templateName}`);
  return { templateId, roomId };
}

async function generateOnce(page) {
  const button = page.locator('button.ai-generate-btn').first();
  await button.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  const readyAt = Date.now();
  while (await button.isDisabled()) {
    if (Date.now() - readyAt > 20000) {
      throw new TransportGenerationError('AI button did not become ready');
    }
    await sleep(250);
  }

  let dialogMessage = null;
  page.once('dialog', async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.dismiss();
  });
  const startedAt = Date.now();
  await button.click();
  const suggestionBox = page.locator('.ai-suggestion-box').first();
  try {
    await suggestionBox.waitFor({ state: 'visible', timeout: 90000 });
  } catch (error) {
    throw new TransportGenerationError(dialogMessage || error.message);
  }
  const response = (await suggestionBox.locator('p').first().innerText()).trim();
  if (!response) throw new Error('Successful suggestion UI contained no response text');
  return { response, latencyMs: Date.now() - startedAt };
}

async function main() {
  const { chromium } = require('playwright');
  const tutorRoot = path.resolve(__dirname, '..');
  const artifactRoot = path.resolve(tutorRoot, '../artifacts/feedback-contrast');
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const runDir = path.join(artifactRoot, runId);
  const screenshotDir = path.join(runDir, 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const {
    getPromptComparisonTemplateSeeds
  } = require(path.join(tutorRoot, 'src/services/demoRoomTemplates.ts'));
  const {
    buildEcologicalCaseVarsFromRoomDialogue,
    buildEcologicalTutorUserTurn,
    buildPhase0TutorUserTurn,
    prePopulatedToContextMessages
  } = require(path.join(tutorRoot, 'src/services/ecologicalTutorCall.ts'));
  const { scoreTutorResponse } = require(path.join(tutorRoot, 'src/services/tutorBehaviorHeuristics.ts'));

  const seeds = getPromptComparisonTemplateSeeds();
  const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL || 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const records = [];
  const startedAt = new Date().toISOString();

  try {
    await loginAsTutor(page, `ContrastTutor_${Date.now().toString().slice(-6)}`);
    for (const seed of seeds) {
      const comparison = seed.ai_config_template.prompt_config.prompt_comparison;
      const { templateId, roomId } = await createRoomFromTemplate(page, seed.template_name);
      const latestStudent = [...seed.pre_populated_dialogue]
        .reverse()
        .find((message) => message.role === 'student');
      if (!latestStudent) throw new Error(`Missing student message for ${seed.case_id}`);

      const vars = buildEcologicalCaseVarsFromRoomDialogue(
        seed.title_template,
        seed.description_template,
        seed.pre_populated_dialogue
      );
      vars.scenario_context = comparison.shared_scenario_context;
      const contextMessages = prePopulatedToContextMessages(
        seed.pre_populated_dialogue,
        new Date(0).toISOString()
      );
      const userTurn = comparison.version === 'phase0'
        ? buildPhase0TutorUserTurn([
            `Scenario context: ${comparison.shared_scenario_context}`,
            ...contextMessages.map((message) => `${message.role}: ${message.content}`)
          ].join('\n'))
        : buildEcologicalTutorUserTurn(vars);

      const generation = await generateWithTransportRetry(() => generateOnce(page));
      const screenshotName = `${comparison.pair_id}-${comparison.version}.png`;
      await page.screenshot({ path: path.join(screenshotDir, screenshotName), fullPage: true });
      const scores = scoreTutorResponse(generation.response, {
        metrics: seed.ai_config_template.behavior_focus,
        studentIsWrong: seed.studentIsWrong,
        studentAskedPersonalStory: seed.studentAskedPersonalStory,
        studentNeedsSimpleLanguage: seed.studentNeedsSimpleLanguage
      });

      records.push(buildCaptureRecord({
        comparison: { pairId: comparison.pair_id, version: comparison.version },
        template: { id: templateId },
        room: { id: roomId },
        input: {
          scenarioContext: comparison.shared_scenario_context,
          conversationHistory: vars.conversation_history,
          studentMessage: latestStudent.message,
          systemPromptSourceCommit: comparison.system_prompt_source_commit,
          systemPromptSha256: crypto
            .createHash('sha256')
            .update(seed.ai_config_template.system_prompt)
            .digest('hex'),
          userTurn
        },
        controls: {
          modelName: seed.ai_config_template.model_name,
          temperature: seed.ai_config_template.temperature,
          maxTokens: seed.ai_config_template.max_tokens
        },
        generation: {
          ...generation,
          heuristicScores: scores
        },
        screenshotPath: `screenshots/${screenshotName}`
      }));
    }
  } finally {
    await browser.close();
  }

  if (records.length !== 6) throw new Error(`Expected six captures, received ${records.length}`);
  const appCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tutorRoot, encoding: 'utf8' }).trim();
  const manifest = buildRunManifest({ runId, startedAt, appCommit, records });
  fs.writeFileSync(path.join(runDir, 'run.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(runDir);
}

module.exports = {
  TransportGenerationError,
  generateWithTransportRetry,
  buildCaptureRecord,
  buildRunManifest
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
