// Offline archive integrity and retired entry points; never evidence of live product acceptance.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { verifyBundle } = require('./transfer-assessment-release');
const root = path.resolve(__dirname, '../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
test('preserves every historical bundle byte and the manifest/config bytes at their original paths', () => {
  const frozen = require('./transfer-assessment-history.sha256.json');
  for (const [file, expected] of Object.entries(frozen)) assert.equal(sha(fs.readFileSync(path.join(root, file))), expected, file);
  const history = path.join(root, 'evals/transfer-assessment/release');
  for (const dir of fs.readdirSync(history, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    const verdict = JSON.parse(fs.readFileSync(path.join(history, dir.name, 'verdict.json')));
    assert.equal(verdict.decision, 'release_not_approved');
  }
});
test('retired commands cannot generate releases or load a browser workflow module', () => {
  for (const script of ['transfer-assessment-release.js', 'transfer-assessment-browser-e2e.js']) {
    const result = spawnSync(process.execPath, [path.join(__dirname, script), '--config', 'missing.json'], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /retired/);
  }
  const scripts = require('../package.json').scripts;
  assert(!Object.keys(scripts).some(key => key.startsWith('eval:transfer:release')));
});
test('read-only verifier detects missing sources and tampering without repairing history', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'transfer-history-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const file of ['report.json', 'run-record.json', 'verdict.json']) fs.writeFileSync(path.join(dir, file), '{}');
  const snapshot = { artifact_hashes: [{ path: path.join(dir, 'unavailable-source'), sha256: 'missing' }],
    bundle_hashes: { 'report.json': sha(Buffer.from('{}')) } };
  fs.writeFileSync(path.join(dir, 'snapshot.json'), JSON.stringify(snapshot));
  assert.equal(verifyBundle(dir).ok, false);
  assert(verifyBundle(dir).problems.some(p => p.reason === 'artifact_missing'));
  fs.writeFileSync(path.join(dir, 'report.json'), '{"tampered":true}');
  const before = fs.readFileSync(path.join(dir, 'snapshot.json'));
  assert(verifyBundle(dir).problems.some(p => p.reason === 'artifact_hash_mismatch'));
  assert.deepEqual(fs.readFileSync(path.join(dir, 'snapshot.json')), before);
});
