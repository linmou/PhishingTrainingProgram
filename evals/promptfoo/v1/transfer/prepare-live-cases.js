#!/usr/bin/env node
// Purpose: prepare-live-cases.js materializes the runner-shaped transfer case file from the frozen cases: the system turn is the production transfer prompt read from the Edge Function and the user turn is the projected v3 context, so the live target request is the production request.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { projectContextInput } = require('./adapter');
const { PRODUCTION_PROMPT_SOURCE, root } = require('./shared-request-contract');

const PROMPT_CONSTANT = 'TRANSFER_V3_SYSTEM_PROMPT';

function extractProductionPrompt() {
  const source = fs.readFileSync(path.join(root, PRODUCTION_PROMPT_SOURCE), 'utf8');
  const start = source.indexOf(`const ${PROMPT_CONSTANT} = [`);
  const end = source.indexOf("].join('\\n');", start);
  if (start < 0 || end < 0) throw new Error('The production transfer prompt constant was not found.');
  return source.slice(start, end).split('\n').slice(1)
    .map(line => line.trim().replace(/^'/, '').replace(/',?$/, ''))
    .join('\n');
}

function materialize(out) {
  const { cases } = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
  const systemPrompt = extractProductionPrompt();
  const runnerCases = cases.map(definition => ({
    id: definition.case_id,
    source_type: definition.source_type,
    role: 'transfer',
    case_version: definition.case_version,
    partition: definition.partition,
    case_role: definition.case_role,
    partitions: [definition.partition],
    baseline_messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(projectContextInput(definition)) }
    ],
    input: definition.input,
    expected: { checks: [] },
    legacy: []
  }));
  // The v1 runner reads a bare case array, so the materialized file is that array.
  fs.writeFileSync(out, JSON.stringify(runnerCases, null, 2) + '\n', { flag: 'wx' });
  return { out, count: runnerCases.length, system_prompt_sha256: require('node:crypto').createHash('sha256').update(systemPrompt).digest('hex') };
}

if (require.main === module) {
  const out = process.argv[2];
  if (!out) throw new Error('Supply the new runner-case file path.');
  console.log(JSON.stringify(materialize(out), null, 2));
}

module.exports = { materialize, extractProductionPrompt };
