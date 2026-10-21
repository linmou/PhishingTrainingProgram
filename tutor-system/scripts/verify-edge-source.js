#!/usr/bin/env node
// Purpose: compare original sources embedded in a deployed Edge bundle with a local or committed release, preserving the bundle and hash evidence.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const hash = value => createHash('sha256').update(value).digest('hex');
async function main() {
  const [project, slug, revision, envFile] = process.argv.slice(2);
  if (!/^[a-z]{20}$/.test(project || '') || !['ai-api', 'assessment-api'].includes(slug) || !revision || !envFile) {
    throw new Error('Usage: verify-edge-source.js PROJECT ai-api|assessment-api local|COMMIT ENV_FILE');
  }
  const env = dotenv.parse(fs.readFileSync(envFile));
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/functions/${slug}/body`, {
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
  });
  if (!response.ok) throw new Error(`Bundle read failed: ${response.status}`);
  const bundle = Buffer.from(await response.arrayBuffer());
  const text = bundle.toString('utf8');
  const files = [];
  let offset = 0;
  while ((offset = text.indexOf('{"version":3,"sources":', offset)) !== -1) {
    const start = offset;
    let depth = 0, quoted = false, escaped = false;
    for (; offset < text.length; offset++) {
      const char = text[offset];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) { offset++; break; }
    }
    const map = JSON.parse(text.slice(start, offset));
    for (let i = 0; i < map.sources.length; i++) {
      if (!map.sources[i].startsWith('source/')) continue;
      const filename = map.sources[i].slice('source/'.length);
      if (filename.includes('..') || path.isAbsolute(filename)) throw new Error('Invalid bundle source path');
      const expected = revision === 'local' ? fs.readFileSync(path.join(root, filename), 'utf8')
        : execFileSync('git', ['show', `${revision}:tutor-system/${filename}`], { cwd: root, encoding: 'utf8' });
      files.push({ path: filename, sha256: hash(map.sourcesContent[i]), expected_sha256: hash(expected), matches: map.sourcesContent[i] === expected });
    }
  }
  if (!files.some(file => file.path === `supabase/functions/${slug}/index.ts`)) throw new Error('Entrypoint source missing from bundle');
  const report = { project, slug, revision, bundle_sha256: hash(bundle), files, matches: files.every(file => file.matches) };
  const destination = path.join(root, 'output/browser-draft');
  fs.mkdirSync(destination, { recursive: true });
  const prefix = `${project}-${slug}-${revision}`;
  fs.writeFileSync(path.join(destination, `${prefix}.eszip`), bundle);
  fs.writeFileSync(path.join(destination, `${prefix}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (!report.matches) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
