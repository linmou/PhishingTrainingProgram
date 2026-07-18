#!/usr/bin/env node
/**
 * Purpose: Layer-1 Promptfoo evaluation with ecological validity.
 *
 * Steps:
 *   1) export product system prompt into Promptfoo fixtures
 *   2) run Promptfoo (ecological + holdout cases) → latest.json/html
 *   3) ecological product-path gate (deterministic heuristics — primary pass/fail)
 *   4) dual-prompt quality gate on latest.json (advisory if judge is flaky)
 *
 * Usage (from tutor-system/):
 *   npm run eval:prompts
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tutorRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(tutorRoot, '..');
const envPath = path.join(tutorRoot, '.env');
const reportPath = path.join(repoRoot, 'evals', 'promptfoo', 'results', 'latest.json');

function loadEnvFile() {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function mapApiEnv() {
  if (!process.env.OPENAI_API_KEY && process.env.REACT_APP_OAI_API_KEY) {
    process.env.OPENAI_API_KEY = process.env.REACT_APP_OAI_API_KEY;
  }
  const base = process.env.REACT_APP_OAI_BASE_URL || process.env.OPENAI_BASE_URL;
  if (base) {
    process.env.OPENAI_BASE_URL = base;
    process.env.OPENAI_API_BASE = base;
  }
}

function run(label, command, args, options = {}) {
  console.log(`\n======== ${label} ========`);
  const result = spawnSync(command, args, {
    cwd: tutorRoot,
    env: process.env,
    stdio: 'inherit',
    shell: false
  });
  const code = result.status == null ? 1 : result.status;
  if (code !== 0 && !options.allowFailure) {
    console.error(`\nFailed at step: ${label} (exit ${code})`);
    process.exit(code);
  }
  return code;
}

loadEnvFile();
mapApiEnv();

if (!process.env.OPENAI_API_KEY) {
  console.error(
    'Missing OPENAI_API_KEY (or REACT_APP_OAI_API_KEY in tutor-system/.env).'
  );
  process.exit(1);
}

// 1) Export live product prompt + ecological cases from room templates
run('1/4 export fixtures from product prompt', process.execPath, [
  path.join(__dirname, 'export-promptfoo-fixture.js')
]);
run('1b/4 export ecological cases from room templates', process.execPath, [
  path.join(__dirname, 'export-ecological-cases.js')
]);

// 2) Promptfoo live eval (writes report; non-zero if any case fails under LLM judge)
const promptfooArgs = [
  'promptfoo',
  'eval',
  '-c',
  path.join(repoRoot, 'evals', 'promptfoo', 'promptfooconfig.yaml'),
  '--output',
  path.join(repoRoot, 'evals', 'promptfoo', 'results', 'latest.json'),
  '--output',
  path.join(repoRoot, 'evals', 'promptfoo', 'results', 'latest.html')
];
// Bust cache when possible so grading is not stale
promptfooArgs.push('--no-cache');

const pfCode = run('2/4 Promptfoo eval + report', 'npx', promptfooArgs, {
  allowFailure: true
});

if (!fs.existsSync(reportPath)) {
  console.error('Promptfoo did not write latest.json — cannot continue.');
  process.exit(pfCode || 1);
}
if (pfCode !== 0) {
  console.warn(
    `\nPromptfoo process exit ${pfCode} (often LLM-judge case failures). Report was written; continuing to ecological gate.`
  );
}

// 3) Primary ecological validity gate (product-shaped call + heuristics)
const ecoCode = run(
  '3/4 ecological product-path gate (primary pass/fail)',
  process.execPath,
  [path.join(__dirname, 'run-ecological-product-gate.js')]
);

// 4) Dual-prompt quality gate (advisory if flaky)
const dualCode = run(
  '4/4 dual-prompt quality gate on latest.json (advisory)',
  process.execPath,
  [
    path.join(__dirname, 'check-promptfoo-quality-gate.js'),
    reportPath,
    '0.8'
  ],
  { allowFailure: true }
);

console.log('\n======== LAYER 1 SUMMARY ========');
console.log(`Promptfoo report: ${dualCode === 0 ? 'dual-gate PASS' : 'dual-gate FAIL/advisory'}`);
console.log(`Ecological product gate: ${ecoCode === 0 ? 'PASS' : 'FAIL'}`);
console.log('Reports: evals/promptfoo/results/latest.json|html');
console.log('Eco report: tmp/ecological_product_gate.json');
console.log('Next: npm run test:browser:behavior-demos');

// Primary authority for Layer 1 is the ecological product gate
process.exit(ecoCode === 0 ? 0 : ecoCode);
