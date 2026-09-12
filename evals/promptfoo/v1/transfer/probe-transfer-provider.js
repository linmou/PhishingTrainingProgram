#!/usr/bin/env node
// Purpose: probe-transfer-provider.js runs one authorized live transfer-path request against the configured provider and records raw evidence: endpoint host, exact frozen request settings, HTTP status, token usage, and the parsed v3 draft shape.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { call } = require('../runner');
const { transferRunnerConfig } = require('./runner-config');
const { productionCallSettings, PRODUCTION_PROMPT_SOURCE, root } = require('./shared-request-contract');

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

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error('Supply a new evidence directory.');
  const { cases } = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
  const definition = cases[0];
  const settings = transferRunnerConfig({});
  const sourceSettings = productionCallSettings();
  const messages = [
    { role: 'system', content: extractProductionPrompt() },
    { role: 'user', content: JSON.stringify(require('./adapter').projectContextInput(definition)) }
  ];
  const callSettings = {
    model: process.env.TRANSFER_PROBE_MODEL || 'qwen3.5-flash',
    target_temperature: sourceSettings.temperature,
    target_max_tokens: settings.target_max_tokens,
    target_enable_thinking: settings.target_enable_thinking,
    transport_attempts: 1,
    transport_retry_delay_ms: 2000,
    timeout_ms: 180000,
    request_concurrency: 1
  };
  fs.mkdirSync(out, { recursive: true });
  const response = await call(messages, 'target', callSettings);
  let parsed = null;
  let parseError = null;
  try { parsed = JSON.parse(response.text); } catch (error) { parseError = error.message; }
  const record = {
    stage: 'live-provider-probe',
    created_at: new Date().toISOString(),
    case_id: definition.case_id,
    case_version: definition.case_version,
    endpoint_host: (() => { try { return new URL(process.env.REACT_APP_OAI_BASE_URL || '').host; } catch { return null; } })(),
    request_settings: { model: callSettings.model, temperature: callSettings.target_temperature, max_tokens: callSettings.target_max_tokens, enable_thinking: callSettings.target_enable_thinking },
    frozen_values: { declared_max_tokens: settings.target_max_tokens, declared_enable_thinking: settings.target_enable_thinking, source_max_tokens: sourceSettings.max_tokens, source_enable_thinking: sourceSettings.enable_thinking },
    model_returned: response.payload ? response.payload.model || null : null,
    attempts: (response.attempts || []).map(attempt => ({ status: attempt.status || null, error: attempt.error || null })),
    http_status: (response.attempts || []).at(-1).status || null,
    error: response.error || null,
    token_usage: response.payload ? response.payload.usage || null : null,
    parse_error: parseError,
    parsed_keys: parsed ? Object.keys(parsed) : null,
    parsed_decision: parsed && parsed.decision ? { mode: parsed.decision.mode, instruction: parsed.decision.instruction, target_item_id: parsed.decision.target_item_id } : null
  };
  const file = path.join(out, 'probe.json');
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ file, http_status: record.http_status, error: record.error, parse_error: record.parse_error, parsed_keys: record.parsed_keys, token_usage: record.token_usage }, null, 2));
  if (record.error || record.parse_error) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
