#!/usr/bin/env node
// Retired Wave 105 gate: read-only historical hash verification only. See docs/transfer-assessment-wave105-audit.md.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha256File = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function verifyBundle(bundleDir) {
  const dir = path.resolve(bundleDir);
  const problems = [];
  const required = ['snapshot.json', 'run-record.json', 'report.json', 'verdict.json'];
  const documents = {};
  for (const name of required) {
    const filePath = path.join(dir, name);
    if (!fs.existsSync(filePath)) {
      problems.push({ path: filePath, reason: 'missing_bundle_artifact' });
      continue;
    }
    try {
      documents[name] = readJson(filePath);
    } catch (error) {
      problems.push({ path: filePath, reason: `invalid_json: ${error.message}` });
    }
  }
  const snapshot = documents['snapshot.json'];
  if (snapshot) {
    for (const entry of snapshot.artifact_hashes || []) {
      if (!entry.path || !fs.existsSync(entry.path)) {
        problems.push({ path: entry.path || '<missing>', reason: 'artifact_missing' });
      } else if (sha256File(entry.path) !== entry.sha256) {
        problems.push({ path: entry.path, reason: 'artifact_hash_mismatch' });
      }
    }
    for (const [name, expected] of Object.entries(snapshot.bundle_hashes || {})) {
      const filePath = path.join(dir, name);
      if (!fs.existsSync(filePath)) problems.push({ path: filePath, reason: 'bundle_hash_target_missing' });
      else if (sha256File(filePath) !== expected) problems.push({ path: filePath, reason: 'artifact_hash_mismatch' });
    }
  }
  return { ok: problems.length === 0, problems };
}


function main(argv) {
  if (argv.length !== 2 || argv[0] !== '--verify') {
    throw new Error('Wave 105 release generation is retired. Use --verify <bundle-directory> for read-only historical verification; see docs/transfer-assessment-wave105-audit.md.');
  }
  const result = verifyBundle(path.resolve(argv[1]));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
}
module.exports = { verifyBundle };
