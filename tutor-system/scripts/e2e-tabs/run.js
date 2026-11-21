#!/usr/bin/env node
// Purpose: two-tab identity checks (#109) in real Chromium against a local fake Supabase backend.
// No staging, production or other network access. See ../../docs/browser-e2e-testing.md.
// Usage: npm run test:e2e:tabs [-- --dev] [-- --scenario=A,G]
//   default  production build (served from a temp folder)
//   --dev    CRA dev server (React.StrictMode double-runs effects)
//   E2E_TABS_APP_URL=<url> skips startup and uses an app already built against the fake backend URL.
//   E2E_TABS_EVIDENCE=<dir> keeps evidence there (default: a new temp folder, printed at the end).
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { MOCK_ORIGIN } = require('./mock-backend');
const { setup } = require('./harness');
const scenarios = require('./scenarios');

const ROOT = path.resolve(__dirname, '../..');

function parseArgs(argv) {
  const options = { dev: false, only: Object.keys(scenarios) };
  for (const arg of argv) {
    if (arg === '--dev') options.dev = true;
    else if (arg.startsWith('--scenario=')) options.only = arg.slice(11).toUpperCase().split(',').filter(Boolean);
    else throw new Error(`Unknown argument ${arg}. Use --dev and/or --scenario=A,B`);
  }
  const unknown = options.only.filter(key => !scenarios[key]);
  if (unknown.length) throw new Error(`Unknown scenario ${unknown.join(',')}; available: ${Object.keys(scenarios).join(',')}`);
  return options;
}

// The app talks only to the fake backend origin; server-only secrets never reach the child.
function appEnv(extra) {
  const env = { ...process.env, REACT_APP_SUPABASE_URL: MOCK_ORIGIN, REACT_APP_SUPABASE_ANON_KEY: 'e2e-tabs-anon-key', OAI_MODEL: 'e2e-tabs-model', BROWSER: 'none', ...extra };
  for (const name of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'OAI_API_KEY', 'OAI_BASE_URL']) delete env[name];
  return env;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    }).on('error', reject);
  });
}

function runToEnd(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, env, stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${args.join(' ')} exited with ${code}`))));
  });
}

function serveStatic(root, port) {
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
  const server = http.createServer((req, res) => {
    let file = path.join(root, path.normalize(decodeURIComponent(req.url.split('?')[0])));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function waitForHttp(url, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`dev server exited with ${child.exitCode}`);
    const ok = await new Promise(resolve => http.get(url, res => { res.resume(); resolve(res.statusCode === 200); }).on('error', () => resolve(false)));
    if (ok) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`dev server did not answer at ${url} within ${timeoutMs / 1000}s`);
}

// Starts the app and returns { url, stop }.
async function startApp(dev, tmp) {
  if (process.env.E2E_TABS_APP_URL) return { url: process.env.E2E_TABS_APP_URL.replace(/\/$/, ''), stop: async () => {} };
  const port = await freePort();
  const url = `http://localhost:${port}`;
  if (dev) {
    console.log(`Starting the dev server on ${url} ...`);
    const child = spawn(process.execPath, ['scripts/react-scripts.js', 'start'], {
      cwd: ROOT, env: appEnv({ PORT: String(port), CI: 'true' }), stdio: ['ignore', 'ignore', 'inherit'], detached: true,
    });
    const stop = async () => { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ } };
    try { await waitForHttp(url, child, 240000); } catch (error) { await stop(); throw error; }
    return { url, stop };
  }
  const build = path.join(tmp, 'build');
  console.log('Building the production app against the fake backend ...');
  await runToEnd(['scripts/react-scripts.js', 'build'], appEnv({ BUILD_PATH: build, CI: 'false', GENERATE_SOURCEMAP: 'false' }));
  const server = await serveStatic(build, port);
  return { url, stop: () => new Promise(resolve => server.close(() => resolve())) };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-tabs-'));
  const evidence = process.env.E2E_TABS_EVIDENCE ? path.resolve(process.env.E2E_TABS_EVIDENCE) : path.join(tmp, 'evidence');
  const mode = process.env.E2E_TABS_APP_URL ? 'existing app' : options.dev ? 'dev server' : 'production build';
  const app = await startApp(options.dev, tmp);
  const summary = {};
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const key of options.only) {
      console.log(`\n${key}  ${scenarios[key].title}`);
      const h = await setup(browser, app.url, path.join(evidence, key));
      let error = null;
      try { await scenarios[key].run(h); } catch (caught) { error = caught; }
      if (error) h.check(`Scenario ran to completion`, false, String(error.message).split('\n')[0]);
      const checks = await h.finish();
      summary[key] = checks.every(check => check.pass) ? 'PASS' : 'FAIL';
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    await app.stop();
    fs.rmSync(path.join(tmp, 'build'), { recursive: true, force: true });
  }
  console.log(`\n${mode}: ${options.only.map(key => `${key} ${summary[key]}`).join(', ')}`);
  console.log(`Evidence: ${evidence}`);
  fs.writeFileSync(path.join(evidence, 'summary.json'), JSON.stringify({ mode, summary }, null, 2));
  return Object.values(summary).every(result => result === 'PASS');
}

if (require.main === module) {
  main().then(ok => process.exit(ok ? 0 : 1), error => { console.error(error); process.exit(1); });
}
