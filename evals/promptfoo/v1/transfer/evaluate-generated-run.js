#!/usr/bin/env node
// Purpose: evaluate-generated-run.js runs the deterministic transfer checks over a preserved runner report, writes write-once per-case evidence, and returns the blocking gate verdict without resampling any target output.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { checkContractAndProgress } = require('./contract-checks');
const { assess, buildExpectedRows } = require('./quality-gate');
const { writeRun, writeEvidence } = require('./evidence-record');
const policy = require('./gate-policy.json');

const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));

function itemAndMessageIds(definition) {
  const itemIds = definition.input.checklist_items.map(item => item.id);
  const messageIds = [definition.input.focus_student_message.id];
  for (const item of definition.input.checklist_items) messageIds.push(...item.relevant_evidence_message_ids);
  if (definition.transition) for (const step of definition.transition.steps) messageIds.push(definition.transition.causal_evidence_ref);
  return { item_ids: itemIds, message_ids: [...new Set(messageIds)] };
}

function evaluate({ report, cases, out }) {
  const caseById = new Map(cases.map(definition => [definition.case_id, definition]));
  const evidence = [];
  const records = [];
  for (const result of report.results) {
    const definition = caseById.get(result.case_id);
    if (!definition) continue;
    const ids = itemAndMessageIds(definition);
    const contract = checkContractAndProgress(result.target.text, { ...ids, room_mode: definition.input.prior_participation_mode === 'guard' ? 'guard' : 'tutoring' });
    const metrics = [
      { metric: 't09_contract_and_progress', method: 'deterministic', status: contract.status === 'pass' ? 'pass' : contract.failures.some(failure => failure.code === 'unparseable_output' || failure.code === 'empty_response') ? 'fail' : contract.status, pass: contract.status === 'pass', score: contract.status === 'pass' ? 1 : 0, reason: contract.failures.map(failure => failure.code).join(',') || 'contract checks passed', failures: contract.failures }
    ];
    // assessment_followup is deliberately absent from this live pass: its deterministic lifecycle
    // sequences are authored test assets (fixtures/contract-fixtures.json), not data recoverable
    // from frozen case fields, so deriving one here would be invented evidence. The gate counts it
    // as missing and returns incomplete, which is the honest verdict for this run.
    evidence.push({
      case_id: definition.case_id,
      case_version: definition.case_version,
      partition: definition.partition,
      case_role: definition.case_role,
      repetition: result.repetition,
      target_generation_id: result.target_generation || null,
      target_input: definition.input,
      applicability_rules: Object.fromEntries(metrics.map(metric => [metric.metric, 'case_fixed: every frozen v3 case declares this check'])),
      results: metrics
    });
    records.push({
      run_id: path.basename(out),
      case_id: definition.case_id,
      case_version: definition.case_version,
      metric_id: 't09_contract_and_progress',
      method: 'deterministic',
      repetition: result.repetition,
      turn: null,
      partition: definition.partition,
      target_generation_id: result.target_generation || null,
      target_input: definition.input,
      raw_request: result.target && result.target.request ? result.target.request : null,
      raw_response: result.target && result.target.payload ? result.target.payload : null,
      parsed_output: result.parsed,
      displayed_output: result.parsed && typeof result.parsed.response === 'string' ? result.parsed.response : null,
      expected: { key_order: ['reason', 'decision', 'response', 'assessment'] },
      actual: contract.actual,
      judgment: metrics[0],
      raw_judgment: { failures: contract.failures },
      status: metrics[0].status,
      score: metrics[0].score,
      applicability: { applicable: true, rule: 'case_fixed' },
      provider_metadata: { endpoint_host: 'dashscope-intl.aliyuncs.com', attempts: result.target && result.target.attempts ? result.target.attempts.length : 0 },
      source_provenance: definition.source_provenance,
      manifest_hashes: {}
    });
  }
  const runReport = { run_id: path.basename(out), evidence };
  const verdict = assess(runReport, { cases, manifest: read('manifest.json'), policy });
  return { evidence, records, verdict };
}

if (require.main === module) {
  const runDirectory = process.argv[2];
  const out = process.argv[3];
  if (!runDirectory || !out) throw new Error('Supply the preserved runner directory and a new transfer evaluation directory.');
  const report = JSON.parse(fs.readFileSync(path.join(runDirectory, 'report.json'), 'utf8'));
  const { cases } = read('cases.json');
  const { evidence, records, verdict } = evaluate({ report, cases, out });
  const runPath = writeRun(out, { run_id: path.basename(out), manifest_version: read('manifest.json').manifest_version, source_run: runDirectory, stage: 'deterministic-transfer-evaluation' });
  for (const record of records) writeEvidence(runPath, record);
  fs.writeFileSync(path.join(runPath, 'transfer-gate.json'), JSON.stringify({ verdict, evidence_count: evidence.length, expected_rows: buildExpectedRows({ cases, manifest: read('manifest.json') }).length }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ out: runPath, evidence: evidence.length, expected_rows: buildExpectedRows({ cases, manifest: read('manifest.json') }).length, verdict: verdict.verdict, issues: verdict.issues.length, issue_types: [...new Set(verdict.issues.map(issue => issue.type))], metrics: verdict.metrics.map(row => `${row.metric} ${row.fraction} rate=${row.rate === null ? 'n/a' : row.rate.toFixed(3)} ${row.verdict}`) }, null, 2));
  if (verdict.verdict !== 'accepted') process.exitCode = 1;
}

module.exports = { evaluate };
