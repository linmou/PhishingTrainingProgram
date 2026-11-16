#!/usr/bin/env node
// Purpose: verify immutable experiment evidence while reporting later workspace drift separately from executed inputs.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../..');
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
function loadFrozen() {
  const file = path.join(__dirname, 'raw/frozen-v12.json'), snapshot = JSON.parse(fs.readFileSync(file, 'utf8')), copy = { ...snapshot }; delete copy.fingerprint;
  assert.equal(sha(copy), snapshot.fingerprint, 'Frozen evidence corruption');
  const workspaceDrift = snapshot.sources.flatMap(source => { const file = path.join(root, source.path), actual = fs.existsSync(file) ? sha(fs.readFileSync(file)) : null; return actual === source.sha256 ? [] : [{ path: source.path, executed_sha256: source.sha256, current_sha256: actual }]; });
  for (const relative of ['runner.cjs', '../../v1/runner.js', '../../v1/product-adapter.js']) {
    const file = path.resolve(__dirname, relative), source = snapshot.sources.find(s => s.path === path.relative(root, file)); assert(source, 'Unpinned helper: ' + relative);
    assert.equal(sha(fs.readFileSync(file)), source.sha256, 'Executed evaluator helper changed: ' + relative);
  }
  return { snapshot, workspace_drift: workspaceDrift, frozen_file: file, frozen_sha256: sha(fs.readFileSync(file)) };
}
module.exports = { loadFrozen, sha };
