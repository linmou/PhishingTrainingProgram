#!/usr/bin/env node
// Purpose: report frozen individual and majority-vote tutor classification metrics without selecting favorable repetitions.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ABSTAIN = '<abstain>';
const label = value => value === null ? '<null>' : value;

function majority(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  const winner = [...counts].find(([, count]) => count > values.length / 2);
  return winner ? winner[0] : ABSTAIN;
}

function statistics(examples) {
  const matrix = {};
  for (const example of examples) {
    const reference = [...example.allowed].sort().join('|');
    matrix[reference] ||= {};
    matrix[reference][example.predicted] = (matrix[reference][example.predicted] || 0) + 1;
  }
  // F1 uses the unambiguous reference subset. Allowed-set accuracy covers every case.
  const single = examples.filter(example => example.allowed.length === 1);
  const classes = [...new Set(single.flatMap(example => example.allowed))].sort();
  const perClass = classes.map(value => {
    const support = single.filter(example => example.allowed[0] === value).length;
    const predicted = single.filter(example => example.predicted === value).length;
    const tp = single.filter(example => example.allowed[0] === value && example.predicted === value).length;
    const precision = predicted ? tp / predicted : 0;
    const recall = support ? tp / support : 0;
    return { label: value, support, predicted, true_positive: tp, precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0 };
  });
  const passed = examples.filter(example => example.allowed.includes(example.predicted)).length;
  const abstained = examples.filter(example => example.predicted === ABSTAIN).length;
  return {
    expected: examples.length, passed, accuracy: examples.length ? passed / examples.length : null,
    abstained, answered_coverage: examples.length ? (examples.length - abstained) / examples.length : 0,
    conditional_accuracy: examples.length > abstained ? passed / (examples.length - abstained) : null,
    confusion_matrix: matrix, singleton_reference_count: single.length, per_class: perClass,
    macro_f1: perClass.length ? perClass.reduce((sum, item) => sum + item.f1, 0) / perClass.length : null
  };
}

function classify(report, snapshot) {
  if (snapshot.settings.repetitions !== 3) throw new Error('Formal classification requires exactly three independent repetitions.');
  const issues = [];
  if (!snapshot.cases.length || new Set(snapshot.cases.map(definition => definition.id)).size !== snapshot.cases.length) issues.push({ type: 'invalid_manifest' });
  const expectedKeys = new Set(snapshot.cases.flatMap(definition => [0, 1, 2].map(repetition => `${definition.id}:${repetition}`)));
  const records = new Map();
  for (const record of report.results) {
    const key = `${record.case_id}:${record.repetition}`;
    if (records.has(key)) issues.push({ type: 'duplicate_generation', key });
    if (!expectedKeys.has(key)) issues.push({ type: 'unexpected_generation', key });
    if (record.target?.error) issues.push({ type: 'target_error', key, reason: record.target.error });
    records.set(key, record);
  }
  for (const key of expectedKeys) if (!records.has(key)) issues.push({ type: 'missing_generation', key });
  const rows = [];
  const predictions = [];
  for (const metric of ['mode_selection', 'instruction_selection']) {
    const definitions = snapshot.cases.filter(definition => definition.expected.checks.includes(metric));
    const hardPartitions = snapshot.manifest?.checks?.find(check => check.id === metric)?.hard_partitions || [];
    const partitions = ['overall', ...new Set(definitions.map(definition => 'source:' + definition.source_type))];
    partitions.push(...hardPartitions);
    const examples = definitions.map(definition => {
      const reference = metric === 'mode_selection' ? definition.expected.mode : definition.expected.instruction;
      if (reference === undefined) throw new Error(`Missing classification reference for ${definition.id}/${metric}`);
      const allowed = (Array.isArray(reference) ? reference : [reference]).map(label);
      const individual = [0, 1, 2].map(repetition => {
        const record = records.get(`${definition.id}:${repetition}`);
        if (!record || record.target?.error) return ABSTAIN;
        const parsed = record.parsed_for_evaluation || record.parsed;
        const value = metric === 'mode_selection' ? parsed?.mode : parsed?.decision?.instruction;
        return value === undefined ? ABSTAIN : label(value);
      });
      const example = { case_id: definition.id, metric, allowed, individual, two_member: majority(individual.slice(0, 2)), three_member: majority(individual), source_type: definition.source_type, partitions: definition.partitions || [] };
      predictions.push(example);
      return example;
    });
    for (const partition of partitions) {
      const subset = examples.filter(example => partition === 'overall' || partition === 'source:' + example.source_type || example.partitions.includes(partition));
      if (!subset.length) continue;
      const views = {
        repetition_1: subset.map(example => ({ ...example, predicted: example.individual[0] })),
        repetition_2: subset.map(example => ({ ...example, predicted: example.individual[1] })),
        repetition_3: subset.map(example => ({ ...example, predicted: example.individual[2] })),
        pooled_individuals: subset.flatMap(example => example.individual.map(predicted => ({ ...example, predicted }))),
        two_member: subset.map(example => ({ ...example, predicted: example.two_member })),
        three_member: subset.map(example => ({ ...example, predicted: example.three_member }))
      };
      for (const [view, values] of Object.entries(views)) {
        const stats = statistics(values);
        const hard = hardPartitions.includes(partition);
        const threshold = hard ? 1 : view === 'three_member' ? 0.9 : 0.8;
        const pass = hard ? stats.accuracy === 1 : view === 'three_member' ? stats.accuracy > threshold : stats.accuracy >= threshold;
        rows.push({ metric, partition, view, primary_metric: 'allowed_set_accuracy', threshold, strict: view === 'three_member' && !hard, gating: view !== 'two_member', ...stats, verdict: pass ? 'pass' : 'fail' });
      }
    }
  }
  if (!rows.length) issues.push({ type: 'missing_classification_coverage' });
  return {
    verdict: issues.length ? 'incomplete' : rows.some(row => row.gating && row.verdict !== 'pass') ? 'failed' : 'accepted', rows, predictions, issues,
    comparison_identity: crypto.createHash('sha256').update(JSON.stringify({ cases: snapshot.cases, settings: snapshot.settings, manifest: snapshot.manifest })).digest('hex'),
    interpretation: 'Instruction references can permit alternatives. Accuracy and reference-set confusion matrices cover all cases; per-class precision, recall and F1 cover only singleton references. Abstention is incorrect. Ensembles are evaluation diagnostics, not deployed voting.'
  };
}

function compare(candidate, baseline) {
  const regressions = [];
  const issues = [...candidate.issues, ...baseline.issues];
  if (candidate.comparison_identity !== baseline.comparison_identity) issues.push({ type: 'incomparable_baseline' });
  for (const row of candidate.rows.filter(row => row.gating)) {
    const before = baseline.rows.find(item => item.metric === row.metric && item.partition === row.partition && item.view === row.view);
    if (!before || before.expected !== row.expected || row.accuracy < before.accuracy) regressions.push({ metric: row.metric, partition: row.partition, view: row.view, baseline: before?.accuracy ?? null, candidate: row.accuracy });
  }
  return { ...candidate, regressions, issues, verdict: issues.length ? 'incomplete' : candidate.verdict === 'accepted' && !regressions.length ? 'accepted' : 'failed' };
}

if (require.main === module) {
  const [directory, baselineDirectory] = process.argv.slice(2);
  if (!directory) throw new Error('Supply a run directory and optional comparable baseline directory.');
  const readRun = dir => classify(JSON.parse(fs.readFileSync(path.join(dir, 'report.json'))), JSON.parse(fs.readFileSync(path.join(dir, 'snapshot.json'))));
  const result = baselineDirectory ? compare(readRun(directory), readRun(baselineDirectory)) : readRun(directory);
  fs.writeFileSync(path.join(directory, baselineDirectory ? 'classification-comparison.json' : 'classification.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ verdict: result.verdict, rows: result.rows.length, regressions: result.regressions?.length || 0 }));
  if (result.verdict !== 'accepted') process.exitCode = 1;
}
module.exports = { majority, statistics, classify, compare, ABSTAIN };
