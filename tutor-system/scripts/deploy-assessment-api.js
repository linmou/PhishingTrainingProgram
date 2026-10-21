#!/usr/bin/env node
// Purpose: prepare, bundle-check, or deploy assessment-api through the Supabase Management API.

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const ts = require('typescript');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '..');
const requiredSecrets = ['OAI_API_KEY', 'OAI_BASE_URL'];
const sha256 = value => createHash('sha256').update(value).digest('hex');

async function main() {
  const args = process.argv.slice(2);
  const functionFlag = args.find(arg => arg.startsWith('--function='));
  const slug = functionFlag ? functionFlag.slice('--function='.length) : 'assessment-api';
  if (!['assessment-api', 'ai-api'].includes(slug)) throw new Error('Select assessment-api or ai-api.');
  if (functionFlag) args.splice(args.indexOf(functionFlag), 1);
  const entrypoint = `supabase/functions/${slug}/index.ts`;
  const mode = args.shift();
  if (!['--dry-run', '--bundle-only', '--deploy'].includes(mode)) {
    throw new Error('Usage: node scripts/deploy-assessment-api.js MODE PROJECT_REF [ENV_FILE] [--function=ai-api]');
  }
  const [projectRef, envFile] = args;
  if (!/^[a-z]{20}$/.test(projectRef || '') || args.length > 2) throw new Error('Provide one project ref and optional env file.');

  const files = new Map();
  const externalImports = new Set();
  function visit(filename) {
    if (files.has(filename)) return;
    const relative = path.relative(root, filename).split(path.sep).join('/');
    if (relative.startsWith('../')) throw new Error('Dependency is outside tutor-system.');
    const source = fs.readFileSync(filename, 'utf8');
    files.set(filename, { path: relative, source, sha256: sha256(source) });
    for (const imported of ts.preProcessFile(source, true, true).importedFiles) {
      if (!imported.fileName.startsWith('.')) {
        externalImports.add(imported.fileName);
        continue;
      }
      const base = path.resolve(path.dirname(filename), imported.fileName);
      const dependency = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]
        .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!dependency) throw new Error(`Missing dependency of ${relative}: ${imported.fileName}`);
      visit(dependency);
    }
  }
  visit(path.join(root, entrypoint));
  const sources = [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
  const metadata = { name: slug, entrypoint_path: entrypoint, verify_jwt: false };
  const manifest = sources.map(({ path: sourcePath, sha256: hash }) => ({ path: sourcePath, sha256: hash }));
  const report = {
    mode, projectRef, metadata, files: manifest, source_sha256: sha256(JSON.stringify(manifest)),
    externalImports: [...externalImports].sort(), requiredSecretNames: requiredSecrets,
  };
  if (mode === '--dry-run') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN || dotenv.parse(fs.readFileSync(envFile || path.join(root, '.env'))).SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required.');
  const api = `https://api.supabase.com/v1/projects/${projectRef}`;
  const headers = { Authorization: `Bearer ${token}` };
  async function read(endpoint) {
    const response = await fetch(`${api}${endpoint}`, { headers });
    if (!response.ok) throw new Error(`Management API ${endpoint} returned HTTP ${response.status}`);
    return response.json();
  }
  const secrets = await read('/secrets');
  const names = new Set(secrets.map(secret => secret.name));
  const missing = requiredSecrets.filter(name => !names.has(name));
  if (missing.length) throw new Error(`Missing Edge secret names: ${missing.join(', ')}`);
  report.confirmedSecretNames = requiredSecrets;
  const before = await read(`/functions/${slug}`);
  const form = new FormData();
  form.set('metadata', JSON.stringify(metadata));
  for (const source of sources) form.append('file', new Blob([source.source], { type: 'application/typescript' }), source.path);
  const query = `?slug=${slug}${mode === '--bundle-only' ? '&bundleOnly=1' : ''}`;
  const response = await fetch(`${api}/functions/deploy${query}`, { method: 'POST', headers, body: form });
  if (!response.ok) throw new Error(`Function ${mode} returned HTTP ${response.status}`);
  const result = await response.json();
  const after = await read(`/functions/${slug}`);
  if (mode === '--bundle-only' && (before.id !== after.id || before.version !== after.version || before.updated_at !== after.updated_at)) {
    throw new Error('Function changed during bundle-only verification; inspect concurrent deployments.');
  }
  report.before = { id: before.id, version: before.version, updated_at: before.updated_at };
  report.after = { id: after.id, version: after.version, updated_at: after.updated_at, verify_jwt: after.verify_jwt };
  report.bundle = { version: result.version, ezbr_sha256: result.ezbr_sha256, entrypoint_path: result.entrypoint_path };
  console.log(JSON.stringify(report, null, 2));
}

const { STAGING, withProjectLock } = require('../../scripts/staging-coordination');
const operation = process.argv[2] === '--deploy' && process.argv[3] === STAGING
  ? () => withProjectLock(STAGING, 'deploy-assessment-api', main) : main;
operation().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
