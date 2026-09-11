#!/usr/bin/env node
/**
 * Purpose: exercise seven canonical behavior rooms through the real product UI,
 * preserve target/audit evidence, and delegate raw v2 outputs to the shared evaluator.
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

const tutorRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(tutorRoot, '..');
const evalRoot = path.join(repoRoot, 'evals/promptfoo');
const BASE_URL = process.env.DEMO_BASE_URL || 'http://localhost:3001';
const TIMEOUT = 60000;

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

const { getTestOnlyDemoTemplateSeeds, buildEcologicalCaseFromSeed } = require(path.join(
  tutorRoot,
  'src/services/demoRoomTemplates.ts'
));
const { buildEcologicalChatCompletionMessages } = require(path.join(
  tutorRoot,
  'src/services/ecologicalTutorCall.ts'
));
const { parseTutorDecision } = require(path.join(
  tutorRoot,
  'src/services/tutorDecisionContract.ts'
));
const {
  evaluateBrowserCapture,
  appendPersistenceEvidence,
  appendProductFailure,
  roomContentVisible,
  behaviorChecksComplete,
  productChecksComplete,
  redactSecrets
} = require(path.join(
  evalRoot,
  'v1/browser-adapter.js'
));
const { call: judgeCall } = require(path.join(evalRoot, 'v1/runner.js'));

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const writeNew = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const productCheck = (id, pass, reason, evidence) => ({
  id,
  method: 'product_verification',
  status: pass ? 'pass' : 'fail',
  pass,
  reason,
  ...(evidence === undefined ? {} : { evidence })
});

async function closeBrowserPreservingFatal(browser, fatalError) {
  if (!browser) return fatalError;
  try {
    await browser.close();
    return fatalError;
  } catch (error) {
    return fatalError ?? error;
  }
}

async function captureFailureScreenshot(page, screenshotDir, caseId) {
  const screenshotPath = path.join(screenshotDir, `${caseId}-failure.png`);
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return path.relative(path.dirname(screenshotDir), screenshotPath);
  } catch {
    return null;
  }
}

function loadLocalEnvironment(envFilePath) {
  const envFile = envFilePath || path.join(tutorRoot, '.env');
  const env = { ...(fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {}), ...process.env };
  const url = env.REACT_APP_SUPABASE_URL;
  const key = env.REACT_APP_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing local Supabase configuration.');
  return { env, supabase: createClient(url, key), secrets: [key, env.REACT_APP_OAI_API_KEY].filter(Boolean) };
}

async function loginAsTutor(page, displayName) {
  await page.goto(`${BASE_URL}/#/`, { waitUntil: 'domcontentloaded' });
  await page.fill('#displayName', displayName);
  await page.check('input[name="role"][value="tutor"]');
  await page.click('button[type="submit"], button:has-text("Join"), button:has-text("Start")');
  await page.waitForURL(/#\/tutor/, { timeout: TIMEOUT });
}

async function createRoomFromTemplate(page, templateName) {
  await page.goto(`${BASE_URL}/#/tutor/test-rooms`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Create a new Room').click();
  const select = page.locator('#template-select');
  const option = select.locator('option').filter({ hasText: templateName }).first();
  await option.waitFor({ state: 'attached', timeout: TIMEOUT });
  const templateId = await option.getAttribute('value');
  if (!templateId) throw new Error(`Missing template id for ${templateName}`);
  await select.selectOption(templateId);
  await page.getByRole('button', { name: /create room/i }).click();
  await page.waitForURL(/#\/room\//, { timeout: 90000 });
  const roomId = (page.url().match(/room\/([^/?#]+)/) || [])[1];
  if (!roomId) throw new Error(`Missing room id for ${templateName}`);
  return { templateId, roomId };
}

function beginTargetCapture(page) {
  const attempts = [];
  const pending = [];
  let sequence = 0;
  const listener = (response) => {
    if (!response.url().includes('/chat/completions')) return;
    sequence += 1;
    const attempt = {
      sequence,
      request_body: null,
      response_body: null,
      raw_output: '',
      parser_status: 'rejected',
      parsed_decision: null
    };
    attempts.push(attempt);
    pending.push((async () => {
      let requestBody = null;
      let responseBody = null;
      let rawOutput = '';
      try {
        requestBody = response.request().postDataJSON();
        const responseText = await response.text();
        try {
          responseBody = JSON.parse(responseText);
          rawOutput = responseBody.choices?.[0]?.message?.content || '';
        } catch {
          responseBody = responseText;
        }
        try {
          const parsedDecision = parseTutorDecision(rawOutput);
          Object.assign(attempt, { parser_status: 'accepted', parsed_decision: parsedDecision });
        } catch {
          Object.assign(attempt, { parser_status: 'rejected' });
        }
      } catch (error) {
        responseBody = { capture_error: error.message };
      }
      Object.assign(attempt, {
        request_body: requestBody,
        response_body: responseBody,
        raw_output: rawOutput
      });
    })());
  };
  page.on('response', listener);
  return async () => {
    page.off('response', listener);
    await Promise.all(pending);
    return attempts.sort((left, right) => left.sequence - right.sequence);
  };
}

async function generateSuggestion(page) {
  const button = page.locator('button.ai-generate-btn').first();
  await button.waitFor({ state: 'visible', timeout: TIMEOUT });
  await page.waitForFunction(() => {
    const value = document.querySelector('button.ai-generate-btn');
    return value && !value.disabled;
  }, null, { timeout: 20000 });
  await button.click();
  const box = page.locator('.ai-suggestion-box').first();
  await box.waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForFunction(() => {
    const paragraph = document.querySelector('.ai-suggestion-box .ai-suggestion-content p');
    const text = paragraph?.textContent?.trim() || '';
    return text.length > 0 && text !== 'Generating new response...';
  }, null, { timeout: 90000 });
  const suggestion = (await box.locator('.ai-suggestion-content p').first().innerText()).trim();
  const guardButton = box.locator('.ai-guard-toggle-button');
  const displayedMode = (await guardButton.getAttribute('class') || '').includes('active')
    ? 'guard'
    : 'tutoring';
  return { suggestion, displayedMode };
}

async function sendReviewedSuggestion(page, suggestion) {
  await page.getByRole('button', { name: /copy to input/i }).click();
  const textarea = page.locator('textarea.comment-input-field');
  if (await textarea.inputValue() !== suggestion) throw new Error('Copy to Input changed the suggestion.');
  let dialogMessage = null;
  const dialogHandler = async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.dismiss();
  };
  page.on('dialog', dialogHandler);
  let dialogCheck = null;
  try {
    await page.locator('form.comment-input-form button[type="submit"]').click();
    const dialogFailure = new Promise((_, reject) => {
      dialogCheck = setInterval(() => {
        if (dialogMessage) {
          clearInterval(dialogCheck);
          reject(new Error(dialogMessage));
        }
      }, 50);
    });
    await Promise.race([
      page.locator('.ai-suggestion-box').waitFor({ state: 'hidden', timeout: TIMEOUT }),
      dialogFailure
    ]);
  } finally {
    if (dialogCheck) clearInterval(dialogCheck);
    page.off('dialog', dialogHandler);
  }
}

async function readAuditRecord(supabase, roomId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase
      .from('ai_suggestion_feedback')
      .select('room_id, tutor_action, raw_mode, raw_instruction, mode_reason, final_mode, mode_rectified, ai_suggestion, tutor_final_response')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Audit lookup failed: ${error.message}`);
    if (data) return data;
    await sleep(250);
  }
  return null;
}

function exactRequestMatches(attempts, seed, productInput) {
  const first = attempts[0]?.request_body;
  if (!first) return false;
  const expectedMessages = buildEcologicalChatCompletionMessages(
    seed.ai_config_template.system_prompt,
    productInput
  );
  return JSON.stringify(first.messages) === JSON.stringify(expectedMessages)
    && first.model === seed.ai_config_template.model_name
    && first.temperature === seed.ai_config_template.temperature
    && first.max_tokens === Math.min(seed.ai_config_template.max_tokens, 120)
    && first.enable_thinking === false;
}

function containsEvaluatorLabels(attempts) {
  const serialized = JSON.stringify(attempts.map((attempt) => attempt.request_body)).replaceAll('\\', '');
  return /expected_behavior_focus|expected_mode|expected_instruction|case[_ ]rationale|rubric|"expected"\s*:\s*\{[^{}]*"(?:mode|instruction)"\s*:/i.test(serialized);
}

function persistenceMatches(audit, parsed) {
  return Boolean(audit && parsed
    && audit.raw_mode === parsed.decision.mode
    && audit.raw_instruction === parsed.decision.instruction
    && audit.mode_reason === parsed.reason
    && audit.final_mode === parsed.decision.mode
    && audit.ai_suggestion === parsed.response
    && audit.tutor_final_response === parsed.response);
}

async function readSeededRoom(page, seed) {
  const requiredStrings = [
    seed.title_template,
    seed.description_template,
    ...seed.pre_populated_dialogue.map((message) => message.message)
  ];
  await page.locator('.room-post').waitFor({ state: 'visible', timeout: TIMEOUT });
  await page.locator('.comments-list').waitFor({ state: 'visible', timeout: TIMEOUT });
  const body = await page.locator('body').innerText();
  return {
    body,
    visible: roomContentVisible(body, requiredStrings)
  };
}

async function runCase({ page, seed, caseDefinition, settings, supabase, screenshotDir, secrets }) {
  const { templateId, roomId } = await createRoomFromTemplate(page, seed.template_name);
  const derivedInput = buildEcologicalCaseFromSeed(seed);
  const { visible: roomVisible } = await readSeededRoom(page, seed);
  const roomScreenshot = path.join(screenshotDir, `${caseDefinition.id}-room.png`);
  await page.screenshot({ path: roomScreenshot, fullPage: true });

  const stopCapture = beginTargetCapture(page);
  let ui = null;
  let generationError = null;
  let attempts = [];
  try {
    ui = await generateSuggestion(page);
  } catch (error) {
    generationError = error;
  } finally {
    attempts = await stopCapture();
  }
  const suggestionScreenshot = path.join(screenshotDir, `${caseDefinition.id}-suggestion.png`);
  if (ui) await page.screenshot({ path: suggestionScreenshot, fullPage: true });

  const capture = {
    case_id: seed.case_id,
    template_id: templateId,
    room_id: roomId,
    request_equivalent: exactRequestMatches(attempts, seed, derivedInput),
    product_input: {
      scenario_context: derivedInput.scenario_context,
      conversation_history: derivedInput.conversation_history,
      student_message: derivedInput.student_message,
      configured_role: seed.ai_config_template.preset === 'casual_peer' ? 'peer' : 'adult',
      detection_areas: seed.ai_config_template.prompt_config.detection_areas,
      verification_steps: seed.ai_config_template.prompt_config.verification_steps,
      prior_mode: derivedInput.prior_mode
    },
    target_attempts: attempts,
    displayed_suggestion: ui?.suggestion || null,
    displayed_mode: ui?.displayedMode || null,
    screenshots: {
      room: path.relative(path.dirname(screenshotDir), roomScreenshot),
      ...(ui ? { suggestion: path.relative(path.dirname(screenshotDir), suggestionScreenshot) } : {})
    }
  };

  if (generationError) {
    const failureScreenshot = await captureFailureScreenshot(page, screenshotDir, caseDefinition.id);
    return appendProductFailure({
      capture,
      target_attempts: attempts,
      final_raw_output: null,
      parsed_decision: null,
      product_checks: [productCheck('generation_completed', false, generationError.message)],
      behavior_checks: null
    }, generationError, failureScreenshot ? { failure: failureScreenshot } : {}, secrets);
  }

  const evaluated = await evaluateBrowserCapture({
    caseDefinition,
    capture,
    contractVersion: 'v2',
    settings,
    judgeCall,
    replayEvidence: null,
    configuredSecrets: secrets
  });
  const parsed = evaluated.parsed_decision;
  let audit = null;
  try {
    await sendReviewedSuggestion(page, ui.suggestion);
    audit = await readAuditRecord(supabase, roomId);
  } catch (error) {
    const failureScreenshot = await captureFailureScreenshot(page, screenshotDir, caseDefinition.id);
    return appendProductFailure(evaluated,
      error,
      failureScreenshot ? { failure: failureScreenshot } : {},
      secrets
    );
  }
  const extraChecks = [
    productCheck('correct_template', Boolean(templateId && seed.case_id === caseDefinition.id), 'Selected template uses the stable case_id.'),
    productCheck('seeded_room_visible', roomVisible, 'Scenario and latest learner message are visible.'),
    productCheck('production_request_fields', exactRequestMatches(attempts, seed, derivedInput), 'Captured request fields match the production builder and seed config.'),
    productCheck('evaluator_labels_absent', !containsEvaluatorLabels(attempts), 'Target requests contain no evaluator labels or rubrics.'),
    productCheck('review_reached_persistence', Boolean(audit), 'Reviewed suggestion produced a local audit row.'),
    productCheck('persisted_decision_matches', persistenceMatches(audit, parsed), 'Persisted raw and final decision fields match the captured v2 output.')
  ];
  evaluated.product_checks.push(...extraChecks);
  return appendPersistenceEvidence(evaluated, audit, secrets);
}

async function main() {
  const { env, supabase, secrets } = loadLocalEnvironment();
  const casesFile = path.join(evalRoot, 'v1/development-with-guard-scenario-rich.json');
  const settingsFile = path.join(evalRoot, 'v1/settings.json');
  const evaluatorFile = path.join(evalRoot, 'v1/evaluator.js');
  const rubricManifestFile = path.join(evalRoot, 'rubrics/v1/manifest.json');
  const candidatePromptFile = path.join(evalRoot, 'v1/candidate-policy-11-contract-v2.md');
  const cases = readJson(casesFile);
  const settings = readJson(settingsFile);
  const byId = new Map(cases.map((entry) => [entry.id, entry]));
  const seeds = getTestOnlyDemoTemplateSeeds();
  const ids = seeds.map((seed) => seed.case_id);
  if (ids.length !== 7 || new Set(ids).size !== 7 || ids.some((id) => !byId.has(id))) {
    throw new Error('Behavior-room manifest must contain seven unique canonical case IDs.');
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(evalRoot, `results/qwen3.5-flash/web-test-rooms-${stamp}`);
  const screenshotDir = path.join(runDir, 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const gitStatus = execFileSync('git', ['status', '--porcelain=v1'], { cwd: repoRoot, encoding: 'utf8' });
  const gitDiff = execFileSync('git', ['diff', '--binary', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    encoding: 'utf8'
  }).trim().split('\n').filter(Boolean);
  const untrackedContents = untracked.map((file) => `${file}:${sha(fs.readFileSync(path.join(repoRoot, file)))}`).join('\n');
  const snapshot = {
    command: process.argv,
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
    dirty_tree_hash: sha(`${gitStatus}\n${gitDiff}\n${untrackedContents}`),
    model_settings: settings,
    prompt_hash: sha(fs.readFileSync(candidatePromptFile)),
    case_hash: sha(fs.readFileSync(casesFile)),
    rubric_manifest_hash: sha(fs.readFileSync(rubricManifestFile)),
    evaluator_hash: sha(fs.readFileSync(evaluatorFile)),
    started_at: startedAt,
    app_base_url: BASE_URL,
    supabase_origin: new URL(env.REACT_APP_SUPABASE_URL).origin
  };
  writeNew(path.join(runDir, 'snapshot.json'), snapshot);

  const records = [];
  let browser = null;
  let page = null;
  let fatalError = null;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL || 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    await loginAsTutor(page, `BehaviorTutor_${Date.now().toString().slice(-6)}`);
    for (const seed of seeds) {
      try {
        const record = await runCase({
          page,
          seed,
          caseDefinition: byId.get(seed.case_id),
          settings,
          supabase,
          screenshotDir,
          secrets
        });
        records.push(record);
        writeNew(path.join(runDir, `${seed.case_id}.json`), record);
      } catch (error) {
        const failureScreenshot = await captureFailureScreenshot(page, screenshotDir, seed.case_id);
        const record = appendProductFailure({
          capture: { case_id: seed.case_id },
          target_attempts: [],
          product_checks: [],
          behavior_checks: null
        }, error, failureScreenshot ? { failure: failureScreenshot } : {}, secrets);
        records.push(record);
        writeNew(path.join(runDir, `${seed.case_id}.json`), record);
      }
    }
  } catch (error) {
    fatalError = error;
  } finally {
    fatalError = await closeBrowserPreservingFatal(browser, fatalError);
  }

  if (fatalError) {
    for (const seed of seeds.slice(records.length)) {
      const record = appendProductFailure({
        capture: { case_id: seed.case_id, screenshots: {} },
        target_attempts: [],
        product_checks: [],
        behavior_checks: null
      }, fatalError, {}, secrets);
      records.push(record);
      writeNew(path.join(runDir, `${seed.case_id}.json`), record);
    }
  }

  const productComplete = !fatalError && records.length === 7
    && records.every((record) => productChecksComplete(record.product_checks));
  const behaviorComplete = records.every((record, index) => behaviorChecksComplete(record.behavior_checks, byId.get(ids[index])));
  const behaviorPass = behaviorComplete && records.every((record) =>
    record.behavior_checks.results.every((result) => ['pass', 'not_applicable'].includes(result.status))
  );
  const safeFatalError = fatalError ? redactSecrets(fatalError.message, secrets) : null;
  const report = { snapshot, completed_at: new Date().toISOString(), results: records, fatal_error: safeFatalError };
  const verdict = {
    product: { complete: productComplete, pass: productComplete },
    behavior_subset: {
      diagnostic_only: true,
      complete: behaviorComplete,
      pass: behaviorPass
    },
    fatal_error: safeFatalError
  };
  writeNew(path.join(runDir, 'report.json'), report);
  writeNew(path.join(runDir, 'verdict.json'), verdict);
  console.log(JSON.stringify({ run: runDir, verdict }));
  if (!productComplete || !behaviorComplete) process.exitCode = 1;
}

module.exports = {
  loadLocalEnvironment,
  beginTargetCapture,
  exactRequestMatches,
  containsEvaluatorLabels,
  persistenceMatches,
  closeBrowserPreservingFatal,
  captureFailureScreenshot,
  readSeededRoom
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
