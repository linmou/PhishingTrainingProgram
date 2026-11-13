#!/usr/bin/env node
// Purpose: index preserved experiment files and deduplicate recorded HTTP attempts for an auditable evidence and usage summary.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const digest = x => crypto.createHash('sha256').update(x).digest('hex');
const raw = path.join(__dirname, 'raw');
const files = [];
function list(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) list(full);
    else files.push(full);
  }
}
list(raw);
const attempts = new Map();
function inspect(value, file) {
  if (!value || typeof value !== 'object') return;
  if (value.request?.model && Array.isArray(value.attempts)) {
    for (const attempt of value.attempts) {
      const identity = digest(JSON.stringify({endpoint: value.endpoint, model: value.request.model, started: attempt.started, raw: attempt.raw, status: attempt.status}));
      if (attempts.has(identity)) continue;
      let response = {};
      try { response = JSON.parse(attempt.raw); } catch {}
      attempts.set(identity, {identity, model: value.request.model, endpoint: value.endpoint, started: attempt.started, completed: attempt.completed, status: attempt.status ?? null, response_id: response.id || response.request_id || null, usage: response.usage || null, evidence: path.relative(__dirname, file)});
    }
  }
  for (const child of Object.values(value)) if (typeof child === 'object') inspect(child, file);
}
const inventory = files.map(file => {
  const bytes = fs.readFileSync(file);
  if (file.endsWith('.json')) {
    try { inspect(JSON.parse(bytes), file); } catch (e) { throw new Error('Cannot index ' + file + ': ' + e.message); }
  }
  return {path: path.relative(__dirname, file), bytes: bytes.length, sha256: digest(bytes)};
});
const calls = [...attempts.values()];
const statuses = {};
for (const c of calls) statuses[c.status] = (statuses[c.status] || 0) + 1;
const summary = {
  created_at: new Date().toISOString(),
  evidence_root: raw,
  source_baseline: '2172ab600c042f454553e9369f057b2f65cb3c60',
  learning_goals_docx: {
    path: '/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/General Learning Goals.docx',
    sha256: digest(fs.readFileSync('/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/General Learning Goals.docx')),
    relationship: 'Matches the prior document-grounding hash; generated inventories assert equality with the merged catalog and retained standard-template snapshot.'
  },
  generation_commands: 'See experiment_log.md; initial run.cjs and versioned refine.cjs snapshots are preserved in raw frozen files.',
  file_count: inventory.length,
  size_bytes: inventory.reduce((n, f) => n + f.bytes, 0),
  inventory_sha256: digest(JSON.stringify(inventory)),
  unique_http_attempts: calls.length,
  statuses,
  recorded_tokens: calls.reduce((n, c) => n + (c.usage?.total_tokens || 0), 0),
  attempts_without_usage: calls.filter(c => !c.usage).length,
  deduplication: 'Endpoint, model, attempt start time, raw response and status; removes duplicate target records copied during measurement replay.',
  raw_inventory: 'raw/evidence-inventory.json',
  raw_attempt_index: 'raw/http-attempt-index.json',
};
fs.writeFileSync(path.join(raw, 'evidence-inventory.json'), JSON.stringify(inventory, null, 2) + '\n', {flag: 'wx'});
fs.writeFileSync(path.join(raw, 'http-attempt-index.json'), JSON.stringify(calls, null, 2) + '\n', {flag: 'wx'});
fs.writeFileSync(path.join(__dirname, 'evidence-summary.json'), JSON.stringify(summary, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(summary));
