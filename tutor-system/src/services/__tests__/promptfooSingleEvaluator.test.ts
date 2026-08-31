#!/usr/bin/env node
/** Purpose: verify the Promptfoo runner uses one Qwen evaluator while retaining ecological cases in Promptfoo. */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, spawnSync, ChildProcess } from 'child_process';

const repoRoot = path.resolve(__dirname, '../../../..');
const tutorRoot = path.join(repoRoot, 'tutor-system');
const runnerPath = path.join(tutorRoot, 'scripts/run-promptfoo-eval.js');

function writePromptfooShim(directory: string): string {
  const shimPath = path.join(directory, 'npx');
  fs.writeFileSync(shimPath, `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.PROMPTFOO_SHIM_LOG, JSON.stringify(args) + '\\n');
const outputPaths = args.reduce((paths, arg, index) => {
  if (arg === '--output' && args[index + 1]) paths.push(args[index + 1]);
  return paths;
}, []);
const metrics = ['turn_rhythm', 'direct_correction', 'persona_stability', 'low_boilerplate_praise', 'practical_knowledge', 'third_person_examples', 'reading_level', 'response_length'];
const components = metrics.map((metric) => ({ pass: true, score: 1, assertion: { metric } }));
const result = (source_type, scaffolding_status) => ({
  promptIdx: 0,
  testCase: { vars: { case_id: source_type, source_type, scaffolding_status } },
  gradingResult: { componentResults: components }
});
const report = { results: { results: [result('product_template', 'failed'), result('synthetic_holdout', 'not_started')] } };
outputPaths.forEach((outputPath, index) => {
  fs.writeFileSync(outputPath, index === 0 ? JSON.stringify(report) : '<html>promptfoo shim</html>');
});
process.exit(Number(process.env.PROMPTFOO_SHIM_EXIT || '0'));
`, { mode: 0o755 });
  return shimPath;
}

function writeLocalApiServer(directory: string): string {
  const serverPath = path.join(directory, 'local-api-server.js');
  fs.writeFileSync(serverPath, `#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const countPath = process.env.QWEN_REQUEST_COUNT;
const server = http.createServer((_request, response) => {
  const count = Number(fs.readFileSync(countPath, 'utf8') || '0') + 1;
  fs.writeFileSync(countPath, String(count));
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ choices: [{ message: { content: 'Not quite. Open the real app instead.' } }] }));
});
server.listen(0, '127.0.0.1', () => {
  fs.writeFileSync(process.env.QWEN_SERVER_PORT, String(server.address().port));
});
`, { mode: 0o755 });
  return serverPath;
}

async function waitForFile(filePath: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (fs.existsSync(filePath)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

describe('single Promptfoo Qwen evaluator', () => {
  it('removes the redundant ecological process and keeps ecological cases in Promptfoo', async () => {
    const source = fs.readFileSync(runnerPath, 'utf8');
    const config = fs.readFileSync(path.join(repoRoot, 'evals/promptfoo/promptfooconfig.yaml'), 'utf8');

    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-single-evaluator-'));
    const shimLog = path.join(tempDirectory, 'npx.log');
    const requestCountPath = path.join(tempDirectory, 'qwen-request-count');
    const portPath = path.join(tempDirectory, 'qwen-port');
    fs.writeFileSync(requestCountPath, '0');
    const apiServer = spawn(process.execPath, [writeLocalApiServer(tempDirectory)], {
      env: { ...process.env, QWEN_REQUEST_COUNT: requestCountPath, QWEN_SERVER_PORT: portPath },
      stdio: 'ignore'
    });
    await waitForFile(portPath);
    const port = Number(fs.readFileSync(portPath, 'utf8'));
    writePromptfooShim(tempDirectory);
    const resultsDirectory = path.join(repoRoot, 'evals/promptfoo/results/qwen3.5-flash');
    const beforeRuns = new Set(fs.existsSync(resultsDirectory) ? fs.readdirSync(resultsDirectory) : []);
    const latestPaths = [
      path.join(repoRoot, 'evals/promptfoo/results/latest.json'),
      path.join(repoRoot, 'evals/promptfoo/results/latest.html')
    ];
    const latestBefore = latestPaths.map((filePath) => ({ filePath, exists: fs.existsSync(filePath), content: fs.existsSync(filePath) ? fs.readFileSync(filePath) : null }));
    const generatedPaths = [
      path.join(repoRoot, 'evals/promptfoo/prompts/current.chat.prompt.json'),
      path.join(repoRoot, 'evals/promptfoo/prompts/current.prompt.txt'),
      path.join(repoRoot, 'evals/promptfoo/fixtures/fixture-metadata.json'),
      path.join(repoRoot, 'evals/promptfoo/cases/webpage-ecological.yaml')
    ].map((filePath) => ({ filePath, exists: fs.existsSync(filePath), content: fs.existsSync(filePath) ? fs.readFileSync(filePath) : null }));
    let createdRuns: string[] = [];
    let testRunDirectory: string | null = null;

    try {
      const execution = spawnSync(process.execPath, [runnerPath], {
        cwd: tutorRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${tempDirectory}:${process.env.PATH || ''}`,
          PROMPTFOO_SHIM_LOG: shimLog,
          REACT_APP_OAI_API_KEY: 'single-evaluator-test-key',
          REACT_APP_OAI_BASE_URL: `http://127.0.0.1:${port}`
        }
      });

      createdRuns = (fs.existsSync(resultsDirectory) ? fs.readdirSync(resultsDirectory) : [])
        .filter((entry) => !beforeRuns.has(entry));
      const reportPathMatch = `${execution.stdout}\n${execution.stderr}`.match(/"report":\s*"([^\"]+\/evals\/promptfoo\/results\/qwen3\.5-flash\/[^\"]+)\/promptfoo\.json"/);
      testRunDirectory = reportPathMatch ? reportPathMatch[1] : null;
      const shimCalls = fs.readFileSync(shimLog, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
      expect(shimCalls).toHaveLength(1);
      expect(shimCalls[0]).toEqual(expect.arrayContaining(['promptfoo', 'eval', '--no-cache']));
      expect(Number(fs.readFileSync(requestCountPath, 'utf8'))).toBe(0);
      expect(execution.status).toBe(0);
      expect(execution.stdout + execution.stderr).toContain('SATISFIES_RUBRICS');
      expect(execution.stdout + execution.stderr).not.toContain('ecological product-path gate');

      expect(source).not.toContain('run-ecological-product-gate.js');
      expect(source).not.toContain('codes.ecological');
      expect(source).not.toContain('ecological-product-gate.json');
      expect(source).not.toContain('ecological_product_gate');
      expect(source).toContain('promptfoo.json');
      expect(config).toContain('file://cases/webpage-ecological.yaml');
      expect(fs.existsSync(path.join(tutorRoot, 'scripts/run-ecological-product-gate.js'))).toBe(false);
      const packageJson = JSON.parse(fs.readFileSync(path.join(tutorRoot, 'package.json'), 'utf8'));
      expect(JSON.stringify(packageJson.scripts)).not.toContain('run-ecological-product-gate');
      expect(createdRuns).toHaveLength(1);
      const metadata = JSON.parse(fs.readFileSync(path.join(resultsDirectory, createdRuns[0], 'run-metadata.json'), 'utf8'));
      expect(metadata.command_exit_codes).toEqual(expect.objectContaining({
        export_prompt: 0,
        export_ecological: 0,
        promptfoo: 0,
        quality_gate: 0
      }));
      expect(metadata.command_exit_codes).not.toHaveProperty('ecological');
    } finally {
      apiServer.kill();
      if (testRunDirectory) fs.rmSync(testRunDirectory, { recursive: true, force: true });
      latestBefore.forEach(({ filePath, exists, content }) => {
        if (exists && content) fs.writeFileSync(filePath, content);
        else if (!exists && fs.existsSync(filePath)) fs.rmSync(filePath);
      });
      generatedPaths.forEach(({ filePath, exists, content }) => {
        if (exists && content) fs.writeFileSync(filePath, content);
        else if (!exists && fs.existsSync(filePath)) fs.rmSync(filePath);
      });
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
