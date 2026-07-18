#!/usr/bin/env node
/**
 * Purpose: Ecological product-path behavior gate.
 * Calls the same message shape as the website AI button (ecologicalTutorCall)
 * with the production casual_peer system prompt, then scores replies with
 * deterministic heuristics (not flaky LLM judges).
 *
 * Usage (from tutor-system/):
 *   node scripts/run-ecological-product-gate.js
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const tutorRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(tutorRoot, '..');
const envPath = path.join(tutorRoot, '.env');

function loadEnv() {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
  }
}

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

loadEnv();

const { generateSystemPrompt, PRESET_CONFIGS } = require(path.join(
  tutorRoot,
  'src/services/systemPrompts.ts'
));
const { SCENARIO_TEMPLATES } = require(path.join(
  tutorRoot,
  'src/services/detectionTemplates.ts'
));
const { buildEcologicalChatCompletionMessages } = require(path.join(
  tutorRoot,
  'src/services/ecologicalTutorCall.ts'
));
const { getEcologicalCasesFromTemplates } = require(path.join(
  tutorRoot,
  'src/services/demoRoomTemplates.ts'
));
const {
  scoreTutorResponse,
  allHeuristicsPassed
} = require(path.join(tutorRoot, 'src/services/tutorBehaviorHeuristics.ts'));

const OAI_API_KEY = process.env.REACT_APP_OAI_API_KEY || process.env.OPENAI_API_KEY;
const OAI_BASE_URL =
  process.env.REACT_APP_OAI_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  'https://api.openai.com/v1';
const MODEL = process.env.REACT_APP_E2E_TUTOR_MODEL || 'gpt-4o-mini';
const THRESHOLD = Number(process.env.ECO_GATE_THRESHOLD || 0.8);

const METRIC_OPTS = {
  direct_correction: { studentIsWrong: true },
  third_person_examples: { studentAskedPersonalStory: true },
  reading_level: { studentNeedsSimpleLanguage: true }
};

function loadEcologicalCases() {
  // Single source of truth: website room templates (realistic multi-turn dialogue).
  return getEcologicalCasesFromTemplates().map((c) => ({
    id: c.case_id,
    template_name: c.template_name,
    scenario_context: c.scenario_context,
    conversation_history: c.conversation_history,
    student_message: c.student_message,
    metrics: String(c.applicable_requirements || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    studentIsWrong: c.studentIsWrong,
    studentAskedPersonalStory: c.studentAskedPersonalStory,
    studentNeedsSimpleLanguage: c.studentNeedsSimpleLanguage
  }));
}

function buildProductionPrompt() {
  const scenario = SCENARIO_TEMPLATES['Account Security Alert'];
  return generateSystemPrompt({
    ...PRESET_CONFIGS.casual_peer,
    detection_areas: scenario.detection_areas,
    verification_steps: scenario.verification_steps
  });
}

async function callModel(systemPrompt, vars) {
  const messages = buildEcologicalChatCompletionMessages(systemPrompt, vars);
  const res = await fetch(`${OAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OAI_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 250
    })
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

async function main() {
  if (!OAI_API_KEY) {
    throw new Error('REACT_APP_OAI_API_KEY or OPENAI_API_KEY required');
  }

  const systemPrompt = buildProductionPrompt();
  const cases = loadEcologicalCases();
  const metricTotals = {};
  const results = [];

  console.log(`Ecological product gate: ${cases.length} webpage cases, model=${MODEL}`);
  console.log(`BASE=${OAI_BASE_URL}`);

  for (const c of cases) {
    const response = await callModel(systemPrompt, {
      scenario_context: c.scenario_context,
      conversation_history: c.conversation_history,
      student_message: c.student_message
    });

    const options = {
      metrics: c.metrics,
      studentIsWrong: c.studentIsWrong,
      studentAskedPersonalStory: c.studentAskedPersonalStory,
      studentNeedsSimpleLanguage: c.studentNeedsSimpleLanguage
    };
    const scores = scoreTutorResponse(response, options);
    const passed = allHeuristicsPassed(scores);

    for (const s of scores) {
      if (!metricTotals[s.metric]) metricTotals[s.metric] = { passed: 0, total: 0 };
      metricTotals[s.metric].total += 1;
      if (s.pass) metricTotals[s.metric].passed += 1;
    }

    results.push({ id: c.id, response, scores, passed });
    console.log(passed ? 'PASS' : 'FAIL', c.id);
    if (!passed) {
      console.log('  response:', response.slice(0, 200));
      console.log(
        '  failed:',
        scores.filter((s) => !s.pass).map((s) => s.metric + ':' + s.reasons.join(';'))
      );
    }
  }

  const failures = [];
  const summary = {};
  for (const [metric, t] of Object.entries(metricTotals)) {
    const rate = t.total ? t.passed / t.total : 0;
    summary[metric] = { ...t, passRate: rate };
    if (rate < THRESHOLD) {
      failures.push(
        `${metric} pass rate ${(rate * 100).toFixed(1)}% is below ${(THRESHOLD * 100).toFixed(0)}%`
      );
    }
  }

  const casePass = results.filter((r) => r.passed).length;
  const caseRate = casePass / results.length;
  if (caseRate < THRESHOLD) {
    failures.push(
      `case pass rate ${(caseRate * 100).toFixed(1)}% is below ${(THRESHOLD * 100).toFixed(0)}%`
    );
  }

  const outDir = path.join(repoRoot, 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'ecological_product_gate.json');
  const report = {
    passed: failures.length === 0,
    threshold: THRESHOLD,
    model: MODEL,
    casePassRate: caseRate,
    summary,
    failures,
    results
  };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('\n======== ECOLOGICAL PRODUCT GATE ========');
  console.log(JSON.stringify({ passed: report.passed, casePassRate: caseRate, summary, failures }, null, 2));
  console.log('Wrote', outPath);

  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
