#!/usr/bin/env node
// Purpose: verify the combined committed harness/database/browser candidate while holding the shared staging lease.
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { STAGING, LEASE_ENV, acquireProjectLock, verifyLease, withProjectLock } = require('./staging-coordination');

const root = path.resolve(__dirname, '..');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

function artifactManifest() {
  assert.equal(git(['status', '--porcelain', '--untracked-files=normal']), '', 'Commit the complete candidate before integration verification');
  const files = git(['ls-files', 'scripts', '.github/workflows', 'tutor-system/src', 'tutor-system/scripts',
    'tutor-system/supabase/functions', 'tutor-system/supabase/migrations', 'tutor-system/package.json', 'tutor-system/package-lock.json']).split('\n').filter(Boolean);
  const migrations = files.filter(file => file.startsWith('tutor-system/supabase/migrations/') && file.endsWith('.sql'));
  assert.ok(migrations.length <= 1, 'Reconcile pending migrations before combined verification');
  return { commit: git(['rev-parse', 'HEAD']), migrations,
    files: Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')])) };
}

async function functionVersions(env = process.env) {
  assert.equal(env.E2E_PROJECT_REF, STAGING, 'Combined verification is staging-only');
  assert.ok(env.SUPABASE_ACCESS_TOKEN, 'A management token is required');
  const response = await fetch(`https://api.supabase.com/v1/projects/${STAGING}/functions`, {
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` }
  });
  if (!response.ok) throw new Error(`Function inventory HTTP ${response.status}`);
  return (await response.json()).map(({ slug, id, version, updated_at, verify_jwt }) =>
    ({ slug, id, version, updated_at, verify_jwt })).sort((a, b) => a.slug.localeCompare(b.slug));
}

function check(report, evidenceDir, name, args, cwd = root, extraEnv = {}) {
  const started = new Date().toISOString();
  try {
    const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8',
      env: { ...process.env, ...extraEnv }, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = result.stdout || '';
    fs.writeFileSync(path.join(evidenceDir, name + '.stdout.log'), stdout, { mode: 0o600 });
    fs.writeFileSync(path.join(evidenceDir, name + '.stderr.log'), result.stderr || '', { mode: 0o600 });
    if (result.error || result.status !== 0) {
      const error = result.error || new Error(`Exit ${result.status}`);
      Object.assign(error, { stdout, stderr: result.stderr, status: result.status });
      throw error;
    }
    report.checks[name] = { status: 'pass', args, started_at: started, completed_at: new Date().toISOString() };
    return stdout;
  } catch (error) {
    fs.writeFileSync(path.join(evidenceDir, name + '.stdout.log'), error.stdout || '', { mode: 0o600 });
    fs.writeFileSync(path.join(evidenceDir, name + '.stderr.log'), error.stderr || String(error), { mode: 0o600 });
    report.checks[name] = { status: 'fail', args, exit_code: error.status, started_at: started, completed_at: new Date().toISOString() };
    throw new Error(`${name} failed; evidence: ${evidenceDir}`);
  }
}

async function main(args = process.argv.slice(2)) {
  assert.ok(args.length === 1 && args[0].startsWith('--workflow='), 'Select one affected staging workflow with --workflow=<name>');
  const manifest = artifactManifest();
  await withProjectLock(STAGING, 'combined-agent-integration', async lock => {
    const evidenceDir = path.join(path.dirname(lock.leaseFile), 'integration-' + crypto.randomUUID());
    fs.mkdirSync(evidenceDir, { mode: 0o700 });
    const reportFile = path.join(evidenceDir, 'integration-report.json');
    const report = { started_at: new Date().toISOString(), project: STAGING, runtime: process.version, manifest,
      coordination: { ref: lock.ref, tag_sha: lock.tag_sha, borrowed: lock.borrowed }, checks: {}, status: 'running' };
    const save = () => fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
    save();
    try {
      report.functions_before = await functionVersions();
      save();
      check(report, evidenceDir, 'offline-harness', ['--test', 'scripts/staging-coordination.test.js',
        'scripts/database/disposable-database.test.js', 'scripts/database/export_validation_baseline.test.js',
        'tutor-system/scripts/browser-e2e/fixture-lock.test.js'], root, { LC_ALL: 'C', LC_CTYPE: 'C', LANG: 'C' });
      save();
      check(report, evidenceDir, 'database-integration', ['--test', 'scripts/database/disposable-database.integration.test.js'], root,
        { PG_DISPOSABLE_INTEGRATION: '1' });
      save();
      check(report, evidenceDir, 'browser-runner', ['--test', 'scripts/browser-e2e.test.js'], path.join(root, 'tutor-system'));
      save();
      const independentEnv = { ...process.env };
      delete independentEnv[LEASE_ENV];
      assert.throws(() => acquireProjectLock(STAGING, { operation: 'contention-probe', commit: manifest.commit,
        evidenceDir: path.join(evidenceDir, 'contender'), env: independentEnv }), /lease unavailable/);
      verifyLease(lock, STAGING);
      report.checks.remote_contention = { status: 'pass' };
      save();
      const result = JSON.parse(check(report, evidenceDir, 'staging-browser', ['scripts/browser-e2e.js', args[0]], path.join(root, 'tutor-system')));
      report.browser_evidence = result.evidence;
      save();
      assert.equal(result.status, 'pass');
      report.functions_after = await functionVersions();
      assert.deepEqual(report.functions_after, report.functions_before, 'Hosted function versions changed during combined verification');
      assert.deepEqual(artifactManifest(), manifest, 'Candidate artifacts changed during combined verification');
      report.status = 'pass';
    } catch (error) {
      report.status = 'fail';
      report.error = error.stack || String(error);
      throw error;
    } finally {
      report.completed_at = new Date().toISOString();
      save();
      console.log(JSON.stringify({ status: report.status, evidence: evidenceDir, browser_evidence: report.browser_evidence }));
    }
  });
}

module.exports = { artifactManifest, functionVersions, main };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
