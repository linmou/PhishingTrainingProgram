#!/usr/bin/env node
/**
 * Purpose: run the single-prompt Qwen Promptfoo benchmark and enforce its
 * eight-metric gate across product-template and synthetic-holdout cases.
 */

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const tutorRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(tutorRoot, '..');
const resultsRoot = path.join(repoRoot, 'evals', 'promptfoo', 'results');
const model = 'qwen3.5-flash';
const startedAt = new Date();
let endpoint;
const runId = new Date().toISOString().replace(/[-:.]/g, '');
const runDir = path.join(resultsRoot, model, runId);
const rawJsonPath = path.join(runDir, 'promptfoo.json');
const htmlPath = path.join(runDir, 'promptfoo.html');
const gatedReportPath = path.join(runDir, 'gated-report.json');
const qualityGatePath = path.join(runDir, 'quality-gate.json');
const perCaseFailuresPath = path.join(runDir, 'per-case-failures.json');

function loadEnvFile() {
  const envPath = path.join(tutorRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function mapApiEnv() {
  if (!process.env.OPENAI_API_KEY && process.env.REACT_APP_OAI_API_KEY) {
    process.env.OPENAI_API_KEY = process.env.REACT_APP_OAI_API_KEY;
  }
  process.env.OPENAI_BASE_URL = endpoint;
  process.env.OPENAI_API_BASE = endpoint;
}

function run(label, command, args) {
  console.log(`\n======== ${label} ========`);
  const result = spawnSync(command, args, {
    cwd: tutorRoot,
    env: process.env,
    stdio: 'inherit',
    shell: false
  });
  return result.status == null ? 1 : result.status;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function git(commandArgs) {
  const result = spawnSync('git', commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function countResults(report) {
  return Array.isArray(report?.results?.results) ? report.results.results.length : 0;
}

function tokenUsage(report) {
  const usage = { prompt: 0, completion: 0, total: 0 };
  const results = Array.isArray(report?.results?.results) ? report.results.results : [];
  results.forEach((result) => {
    const value = result?.tokenUsage || result?.token_usage || result?.response?.tokenUsage;
    if (!value) return;
    usage.prompt += Number(value.prompt || value.input || 0);
    usage.completion += Number(value.completion || value.output || 0);
    usage.total += Number(value.total || 0);
  });
  return usage;
}

function perCaseFailures(report) {
  const results = Array.isArray(report?.results?.results) ? report.results.results : [];
  return results.flatMap((result) => {
    const components = result?.gradingResult?.componentResults || [];
    const failures = components
      .filter((component) => component?.pass === false || component?.success === false || component?.score === 0)
      .map((component) => ({
        metric: component?.assertion?.metric || component?.metric || component?.name || component?.type,
        reason: component?.reason || component?.error || component?.gradingResult || null
      }));
    if (result?.error || result?.failureReason) {
      failures.push({ metric: 'evaluation', reason: result.error || result.failureReason });
    }
    if (!failures.length) return [];
    return [{
      case_id: result?.testCase?.vars?.case_id || result?.description || 'unknown_case',
      source_type: result?.testCase?.vars?.source_type || 'unknown_suite',
      scaffolding_status: result?.testCase?.vars?.scaffolding_status || 'unknown_status',
      failures
    }];
  });
}

function writeMetadata(codes, report, verdict) {
  const promptPath = path.join(repoRoot, 'evals', 'promptfoo', 'prompts', 'current.chat.prompt.json');
  const metadata = {
    model,
    endpoint,
    thinking: { enable_thinking: false },
    temperatures: { target: 0.3, judge: 0 },
    token_limits: { target: 100, judge: 100 },
    prompt: {
      active: 'current.chat.prompt.json',
      sha256: sha256(promptPath)
    },
    git: {
      revision: git(['rev-parse', 'HEAD']),
      worktree: git(['status', '--short'])
    },
    timestamps: {
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString()
    },
    case_count: countResults(report),
    token_usage: tokenUsage(report),
    evaluation_errors: (report?.results?.results || []).filter((result) => result?.error || result?.failureReason).map((result) => ({
      case_id: result?.testCase?.vars?.case_id,
      error: result.error || result.failureReason
    })),
    api_errors: (report?.results?.results || []).filter((result) => result?.error).map((result) => ({
      case_id: result?.testCase?.vars?.case_id,
      error: result.error
    })),
    judge_errors: (report?.results?.results || []).filter((result) => result?.failureReason && !result?.error).map((result) => ({
      case_id: result?.testCase?.vars?.case_id,
      error: result.failureReason
    })),
    artifacts: {
      promptfoo_json: rawJsonPath,
      promptfoo_html: htmlPath,
      gated_report: gatedReportPath,
      quality_gate: qualityGatePath,
      per_case_failures: perCaseFailuresPath
    },
    command_exit_codes: codes,
    verdict
  };
  fs.writeFileSync(path.join(runDir, 'run-metadata.json'), JSON.stringify(metadata, null, 2));
  fs.writeFileSync(path.join(runDir, 'verdict.json'), JSON.stringify(verdict, null, 2));
  fs.writeFileSync(path.join(runDir, 'README.md'), [
    `# Qwen3.5 Flash Promptfoo run ${runId}`,
    '',
    `Verdict: **${verdict.label}**`,
    '',
    `Model: \`${model}\``,
    `Endpoint: \`${endpoint}\``,
    'Thinking: `enable_thinking: false`',
    '',
    'The active benchmark contains one production prompt. Ecological product-template results and synthetic holdout results are gated independently at an 80% threshold.',
    `Quality summary: ${path.basename(qualityGatePath)}`,
    `Per-case failures: ${path.basename(perCaseFailuresPath)}`
  ].join('\n'));
}

loadEnvFile();
endpoint = (process.env.REACT_APP_OAI_BASE_URL || '').replace(/\/+$/, '') ||
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
mapApiEnv();
fs.mkdirSync(runDir, { recursive: true });

if (!process.env.OPENAI_API_KEY) {
  console.error('Missing REACT_APP_OAI_API_KEY in tutor-system/.env.');
  process.exitCode = 1;
  process.exit();
}

const codes = {};
codes.export_prompt = run('1/4 export current Qwen prompt', process.execPath, [
  path.join(__dirname, 'export-promptfoo-fixture.js')
]);
codes.export_ecological = run('2/4 export product-template ecological cases', process.execPath, [
  path.join(__dirname, 'export-ecological-cases.js')
]);

const promptfooArgs = [
  'promptfoo', 'eval',
  '-c', path.join(repoRoot, 'evals', 'promptfoo', 'promptfooconfig.yaml'),
  '--output', rawJsonPath,
  '--output', htmlPath,
  '--no-cache'
];
codes.promptfoo = run('3/4 Promptfoo Qwen evaluation (no cache)', 'npx', promptfooArgs);

let report = {};
if (fs.existsSync(rawJsonPath)) {
  report = JSON.parse(fs.readFileSync(rawJsonPath, 'utf8'));
  fs.copyFileSync(rawJsonPath, path.join(resultsRoot, 'latest.json'));
  if (fs.existsSync(htmlPath)) fs.copyFileSync(htmlPath, path.join(resultsRoot, 'latest.html'));
} else {
  console.error('Promptfoo did not write a JSON report.');
}

fs.writeFileSync(gatedReportPath, JSON.stringify(report, null, 2));
const gateResult = spawnSync(process.execPath, [
  path.join(__dirname, 'check-promptfoo-quality-gate.js'), gatedReportPath, '0.8'
], { cwd: tutorRoot, env: process.env, encoding: 'utf8' });
codes.quality_gate = gateResult.status == null ? 1 : gateResult.status;
if (gateResult.stdout) process.stdout.write(gateResult.stdout);
if (gateResult.stderr) process.stderr.write(gateResult.stderr);

const { evaluateGate } = require(path.join(__dirname, 'check-promptfoo-quality-gate.js'));
let qualityGate;
try {
  qualityGate = evaluateGate(report, 0.8);
} catch (error) {
  qualityGate = {
    passed: false,
    threshold: 0.8,
    metrics: [],
    summary: {},
    failures: [error instanceof Error ? error.message : String(error)]
  };
}
fs.writeFileSync(qualityGatePath, JSON.stringify(qualityGate, null, 2));
fs.writeFileSync(perCaseFailuresPath, JSON.stringify({
  count: perCaseFailures(report).length,
  cases: perCaseFailures(report)
}, null, 2));

// Promptfoo uses exit 100 for completed evaluations with assertion failures.
// Other nonzero exits indicate a process/configuration failure and must block.
const promptfooExecutionReady =
  codes.promptfoo === 0 ||
  (codes.promptfoo === 100 && countResults(report) > 0);

const exportsAndReportsReady =
  codes.export_prompt === 0 &&
  codes.export_ecological === 0 &&
  promptfooExecutionReady &&
  fs.existsSync(rawJsonPath) &&
  fs.existsSync(htmlPath) &&
  fs.existsSync(gatedReportPath) &&
  fs.existsSync(qualityGatePath) &&
  fs.existsSync(perCaseFailuresPath);

const verdict = {
  label: codes.quality_gate === 0 && exportsAndReportsReady
    ? 'SATISFIES_RUBRICS'
    : 'DOES_NOT_SATISFY_RUBRICS',
  promptfoo_passed: codes.promptfoo === 0,
  promptfoo_report_written: fs.existsSync(rawJsonPath),
  rubric_gate_passed: codes.quality_gate === 0,
  exports_and_reports_ready: exportsAndReportsReady,
  quality_gate_summary: qualityGate.summary,
  per_case_failure_count: perCaseFailures(report).length,
  report: rawJsonPath,
  html: htmlPath,
  gated_report: gatedReportPath,
  quality_gate: qualityGatePath,
  per_case_failures: perCaseFailuresPath
};
writeMetadata(codes, report, verdict);

console.log('\n======== QWEN PROMPTFOO VERDICT ========');
console.log(JSON.stringify(verdict, null, 2));
process.exitCode = verdict.label === 'SATISFIES_RUBRICS' ? 0 : 1;
