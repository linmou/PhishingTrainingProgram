#!/usr/bin/env node
// Purpose: keep reviewable counts and failure IDs in Git while retaining full judge explanations in the local analysis and raw evidence.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const source = path.join(__dirname, 'analysis.json');
const bytes = fs.readFileSync(source);
const data = JSON.parse(bytes);
for (const arms of Object.values(data.metrics)) for (const slices of Object.values(arms)) for (const result of Object.values(slices)) {
  result.failure_ids = result.failures.map(f => f.id);
  delete result.failures;
}
delete data.target_replay_integrity.records;
data.detailed_analysis = {path: source,sha256: crypto.createHash('sha256').update(bytes).digest('hex'),bytes: bytes.length};
data.explanation_source = 'Full reasons remain in analysis.json and preserved raw/<run>/<primary|secondary>/<generation-id>.json; summaries never replace raw judgments.';
const output = path.join(__dirname, 'analysis-summary.json');
fs.writeFileSync(output, JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output,bytes: fs.statSync(output).size,detailed_sha256: data.detailed_analysis.sha256}));
