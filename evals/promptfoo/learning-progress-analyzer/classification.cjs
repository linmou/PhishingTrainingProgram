#!/usr/bin/env node
// Purpose: score frozen single-item class predictions and fixed-membership ensembles without reading model prose.
'use strict';

const labels = ['none', 'initial_signal', 'demonstrated_understanding', 'post_repair_signal', 'spontaneous_transfer', 'contradiction'];
const abstain = '__abstain__';
const invalid = '__invalid__';

function prediction(generation) {
  const result = generation?.result;
  if (!result || result.http_status !== 200 || !result.applied || !Array.isArray(result.parsed?.events)) return invalid;
  const events = result.parsed.events;
  if (events.length === 0) return 'none';
  if (events.length !== 1 || !labels.slice(1).includes(events[0].kind)) return invalid;
  return events[0].kind;
}

function vote(values) {
  const counts = new Map();
  for (const value of values) if (labels.includes(value)) counts.set(value, (counts.get(value) || 0) + 1);
  const winner = [...counts].find(([, count]) => count > values.length / 2);
  return winner ? winner[0] : abstain;
}

function statistics(pairs) {
  const matrix = Object.fromEntries(labels.map(label => [label, Object.fromEntries([...labels, abstain, invalid].map(predicted => [predicted, 0]))]));
  for (const pair of pairs) matrix[pair.expected][pair.predicted]++;
  const classes = labels.map(label => {
    const support = pairs.filter(p => p.expected === label).length;
    const predicted = pairs.filter(p => p.predicted === label).length;
    const tp = matrix[label][label];
    const precision = predicted ? tp / predicted : 0;
    const recall = support ? tp / support : 0;
    const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
    return { label, support, predicted, tp, fp: predicted - tp, fn: support - tp, precision, recall, f1 };
  });
  const supported = classes.filter(c => c.support > 0);
  const answered = pairs.filter(p => labels.includes(p.predicted)).length;
  const correct = pairs.filter(p => p.expected === p.predicted).length;
  return {
    count: pairs.length, correct, answered,
    errors: pairs.filter(p => p.predicted === invalid).length,
    abstentions: pairs.filter(p => p.predicted === abstain).length,
    coverage: pairs.length ? answered / pairs.length : 0,
    accuracy: pairs.length ? correct / pairs.length : 0,
    conditional_accuracy: answered ? correct / answered : null,
    macro_f1: supported.length ? supported.reduce((sum, c) => sum + c.f1, 0) / supported.length : null,
    balanced_accuracy: supported.length ? supported.reduce((sum, c) => sum + c.recall, 0) / supported.length : null,
    classes, confusion_matrix: matrix,
  };
}

function classificationReport(frozen, generations) {
  const cases = frozen.cases.filter(c => c.classification_applicable !== false);
  const protocol = frozen.classification_protocol;
  if (!cases.length || new Set(cases.map(c => c.id)).size !== cases.length) throw new Error('Classification requires nonempty unique cases');
  for (const key of ['individual_minimum', 'ensemble_minimum', 'no_event_recall_minimum']) {
    if (!Number.isFinite(protocol?.[key]) || protocol[key] < 0 || protocol[key] > 1) throw new Error('Invalid frozen classification threshold: ' + key);
  }
  if (protocol.ensemble_minimum < 0.9) throw new Error('Ensemble threshold must be at least 0.9, strictly exceeded');
  const groups = [
    { name: 'overall', cases },
    ...[...new Set(cases.map(c => c.suite))].map(s => ({ name: 'suite:' + s, cases: cases.filter(c => c.suite === s) })),
    ...[...new Set(cases.map(c => c.partition))].map(s => ({ name: 'partition:' + s, cases: cases.filter(c => c.partition === s) })),
  ];
  const originals = cases.filter(c => frozen.original_case_ids.includes(c.id));
  if (originals.length) groups.push({ name: 'original_regression', cases: originals });
  const predictions = cases.map(c => ({
    case_id: c.id, expected: c.expected.kind || 'none',
    members: [1, 2, 3].map(repetition => {
      const matches = generations.filter(g => g.case_id === c.id && g.repetition === repetition);
      return { repetition, generation_id: matches.length === 1 ? matches[0].generation_id : null, predicted: matches.length === 1 ? prediction(matches[0]) : invalid };
    }),
  }));
  const rows = [];
  for (const group of groups) {
    const members = predictions.filter(p => group.cases.some(c => c.id === p.case_id));
    for (const view of ['individual_1', 'individual_2', 'individual_3', 'pooled', 'ensemble_2', 'ensemble_3']) {
      const pairs = members.flatMap(p => {
        const expected = p.expected;
        if (view === 'pooled') return p.members.map(m => ({ case_id:p.case_id, expected, predicted:m.predicted, generation_id:m.generation_id }));
        if (view.startsWith('individual_')) return [{ case_id:p.case_id, expected, predicted:p.members[Number(view.slice(-1)) - 1].predicted }];
        return [{ case_id:p.case_id, expected, predicted:vote(p.members.slice(0, Number(view.slice(-1))).map(m => m.predicted)) }];
      });
      const metrics = statistics(pairs);
      const errors = members.reduce((sum, p) => sum + p.members.filter(m => m.predicted === invalid).length, 0);
      const threshold = view === 'ensemble_3' ? protocol.ensemble_minimum : protocol.individual_minimum;
      const metricPass = metrics.macro_f1 !== null && (view === 'ensemble_3' ? metrics.macro_f1 > threshold : metrics.macro_f1 >= threshold);
      const none = metrics.classes.find(c => c.label === 'none');
      const negativeGate = !none.support || none.recall >= protocol.no_event_recall_minimum;
      const diagnostic = view === 'ensemble_2';
      rows.push({ group:group.name, view, primary:'macro_f1', threshold, strict:view==='ensemble_3', diagnostic,
        ...metrics, component_errors:errors, no_event_recall_minimum:protocol.no_event_recall_minimum,
        verdict:errors ? 'incomplete' : diagnostic ? 'diagnostic' : metricPass && negativeGate ? 'pass' : 'fail', predictions:pairs });
    }
  }
  const sharedErrors = predictions.filter(p => p.members.every(m => m.predicted !== p.expected));
  return { protocol:frozen.classification_protocol, labels, predictions, rows,
    shared_errors:sharedErrors, all_three_wrong:sharedErrors.length,
    benchmark_pass:rows.filter(r => !r.diagnostic).every(r => r.verdict === 'pass') };
}

module.exports = { labels, abstain, invalid, prediction, vote, statistics, classificationReport };
