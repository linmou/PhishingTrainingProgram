#!/usr/bin/env node
// Purpose: quality-gate.js renders the blocking transfer verdict: pre-scoring contract identity and parity blockers, exact denominators, missing and errored rows, zero coverage, frozen thresholds, same-case non-regression, joint pair gating, forbidden metadata, and the non-substitution boundary.
'use strict';
const { validateManifest } = require('./manifest-schema');
const { loadSharedRequestContract } = require('./shared-request-contract');
const { checkForbiddenKeys } = require('./case-schema');
const { evaluatePairs } = require('./pair-transition');
const { compareManifests } = require('./comparison');
const { scanForSecrets } = require('./evidence-record');
const caseSchema = require('./case-schema.json');

const HARD_SUPPORTING_CHECK = 't09_contract_and_progress';
const HARD_METRIC_IDS = ['assessment_followup'];
const METHOD_BY_METRIC = metricId => (metricId === HARD_SUPPORTING_CHECK || HARD_METRIC_IDS.includes(metricId) ? 'deterministic' : 'llm_rubric');

const issue = (type, detail = {}) => ({ type, ...detail });
const closure = () => ({ verdict: 'incomplete', issues: [], metrics: [], pairs: [], new_failures: [], applicability_changes: [], expected_rows: 0 });

function buildExpectedRows({ cases, manifest }) {
  const rows = [];
  for (const definition of cases) {
    const metrics = [...new Set([HARD_SUPPORTING_CHECK, ...definition.evaluator.metric_ids])];
    for (const metric of metrics) {
      for (let repetition = 0; repetition < manifest.settings.repetitions; repetition++) {
        rows.push({ case_id: definition.case_id, case_version: definition.case_version, metric, repetition, partition: definition.partition, turn: null, case_role: definition.case_role, pair: definition.pair || null });
      }
    }
  }
  return rows;
}

function preScoringBlockers(manifest) {
  const issues = [];
  const declared = manifest && manifest.shared_request_contract;
  if (!declared) return [issue('pre_scoring_blocker', { blocker: 'missing shared_request_contract', path: 'shared_request_contract' })];
  for (const error of validateManifest(manifest)) {
    issues.push(issue('pre_scoring_blocker', { blocker: error.error, path: error.path, actual: error.actual }));
  }
  try {
    const shared = loadSharedRequestContract();
    if (declared.builder_source_sha256 !== shared.source.sha256) {
      issues.push(issue('pre_scoring_blocker', { blocker: 'builder hash mismatch', path: 'shared_request_contract.builder_source_sha256', expected: shared.source.sha256, actual: declared.builder_source_sha256 }));
    }
    if (declared.production_prompt_source_sha256 !== shared.production_prompt.sha256) {
      issues.push(issue('pre_scoring_blocker', { blocker: 'production prompt hash mismatch', path: 'shared_request_contract.production_prompt_source_sha256', expected: shared.production_prompt.sha256, actual: declared.production_prompt_source_sha256 }));
    }
    if (declared.evaluation_effective_completion_token_budget !== shared.production_call.max_tokens) {
      issues.push(issue('pre_scoring_blocker', { blocker: 'budget mismatch with the production transfer call site', path: 'shared_request_contract.evaluation_effective_completion_token_budget', expected: shared.production_call.max_tokens, actual: declared.evaluation_effective_completion_token_budget }));
    }
    if (declared.evaluation_enable_thinking !== shared.production_call.enable_thinking) {
      issues.push(issue('pre_scoring_blocker', { blocker: 'thinking flag mismatch with the production transfer call site', path: 'shared_request_contract.evaluation_enable_thinking', expected: shared.production_call.enable_thinking, actual: declared.evaluation_enable_thinking }));
    }
  } catch (error) {
    issues.push(issue('pre_scoring_blocker', { blocker: `shared contract unavailable: ${error.message}`, path: 'shared_request_contract' }));
  }
  return issues;
}

function assess(report, context = {}) {
  const { cases = [], manifest = {}, policy = {} } = context;
  const verdict = closure();
  verdict.evidence_label = policy.evidence_label || null;
  verdict.separate_gates = (policy.non_substitution_boundaries || []).slice();
  verdict.claims_release_acceptance = false;
  verdict.run_id = report && report.run_id ? report.run_id : null;

  const blockers = preScoringBlockers(manifest);
  if (report && report.contract_version !== undefined && report.contract_version !== manifest.shared_request_contract.contract_version) {
    blockers.push(issue('pre_scoring_blocker', { blocker: 'contract version mismatch', path: 'contract_version', expected: manifest.shared_request_contract.contract_version, actual: report.contract_version }));
  }
  if (blockers.length) {
    verdict.issues = blockers;
    return verdict;
  }

  const expected = buildExpectedRows({ cases, manifest });
  verdict.expected_rows = expected.length;
  const evidence = new Map();
  for (const record of report.evidence) {
    const key = `${record.case_id}:${record.repetition}`;
    if (evidence.has(key)) verdict.issues.push(issue('duplicate_generation', { key }));
    evidence.set(key, record);
  }

  const forbidden = validateEvidenceProjection(report.evidence);
  verdict.issues.push(...forbidden);
  const secrets = report.evidence.flatMap(record => scanForSecrets(record.target_input || {}).map(found => issue('forbidden_metadata', { path: `target_input.${found.path}`, key: found.key })));
  verdict.issues.push(...secrets);

  const rows = new Map();
  const rowKey = item => `${item.metric}|overall`;
  for (const item of expected) {
    const record = evidence.get(`${item.case_id}:${item.repetition}`);
    if (!record) {
      verdict.issues.push(issue('missing_generation', { case_id: item.case_id, repetition: item.repetition }));
      tally(rows, item, 'missing', policy);
      continue;
    }
    if (record.case_version !== item.case_version) verdict.issues.push(issue('case_version_drift', { case_id: item.case_id, expected: item.case_version, actual: record.case_version }));
    const result = (record.results || []).find(candidate => candidate.metric === item.metric);
    if (!result) {
      verdict.issues.push(issue('missing_result', { case_id: item.case_id, metric: item.metric, repetition: item.repetition }));
      tally(rows, item, 'missing', policy);
      continue;
    }
    if (result.method !== METHOD_BY_METRIC(item.metric)) verdict.issues.push(issue('method_mismatch', { case_id: item.case_id, metric: item.metric, expected: METHOD_BY_METRIC(item.metric), actual: result.method }));
    if (result.status === 'not_applicable') {
      const declaredRule = record.applicability_rules && record.applicability_rules[item.metric];
      if (result.applicable !== false || result.pass !== null || result.score !== null || !declaredRule) {
        verdict.issues.push(issue('invalid_inapplicability', { case_id: item.case_id, metric: item.metric, repetition: item.repetition }));
        tally(rows, item, 'error', policy);
        continue;
      }
    } else if (result.applicable === false) {
      verdict.issues.push(issue('invalid_inapplicability', { case_id: item.case_id, metric: item.metric }));
    }
    if (result.status === 'error' || result.status === 'missing') {
      verdict.issues.push(issue('errored_result', { case_id: item.case_id, metric: item.metric, repetition: item.repetition, status: result.status, reason: result.reason }));
    }
    tally(rows, item, result.status, policy, result);
  }

  for (const row of rows.values()) {
    row.verdict = row.applicable === 0 ? 'unmeasured' : row.passed / row.applicable >= row.threshold ? 'pass' : 'fail';
    row.fraction = `${row.passed}/${row.applicable}`;
    if (row.applicable === 0) verdict.issues.push(issue('zero_coverage', { metric: row.metric, partition: row.partition }));
    else if (row.verdict !== 'pass') verdict.issues.push(issue('below_threshold', { metric: row.metric, partition: row.partition, passed: row.passed, applicable: row.applicable, threshold: row.threshold, fraction: row.fraction }));
  }
  verdict.metrics = [...rows.values()];

  const pairOutcome = evaluatePairs(cases, report.evidence);
  verdict.pairs = pairOutcome.pairs;
  for (const failure of pairOutcome.failures) {
    verdict.issues.push(issue(failure.code === 'pair_member_failed' ? 'pair_member_failed' : 'pair', { ...failure }));
  }

  if (context.baseline) {
    const comparability = compareManifests(context.baseline.manifest, manifest);
    if (comparability.status !== 'comparable') {
      for (const failure of comparability.failures) verdict.issues.push(issue('incomparable_baseline', { ...failure }));
      verdict.comparison = comparability;
    } else {
      const baseIndex = new Map(context.baseline.report.evidence.map(record => [`${record.case_id}:${record.repetition}`, record]));
      for (const item of expected) {
        const record = evidence.get(`${item.case_id}:${item.repetition}`);
        const base = baseIndex.get(`${item.case_id}:${item.repetition}`);
        if (!record || !base) continue;
        {
          const candidateResult = (record.results || []).find(candidate => candidate.metric === item.metric);
          const baselineResult = (base.results || []).find(candidate => candidate.metric === item.metric);
          if (!candidateResult || !baselineResult) continue;
          if (baselineResult.status !== 'not_applicable' && candidateResult.status === 'not_applicable') {
            verdict.applicability_changes.push({ case_id: item.case_id, metric: item.metric, before: baselineResult.status, after: candidateResult.status });
          }
          if (baselineResult.status === 'pass' && candidateResult.status === 'fail') {
            verdict.new_failures.push({ case_id: item.case_id, metric: item.metric, repetition: item.repetition, baseline_status: 'pass', candidate_status: 'fail', baseline_reason: baselineResult.reason, candidate_reason: candidateResult.reason, source: 'baseline' });
          }
          if (baselineResult.status === 'fail' && candidateResult.status === 'not_applicable') {
            verdict.issues.push(issue('failed_baseline_became_inapplicable', { case_id: item.case_id, metric: item.metric }));
          }
        }
      }
      for (const row of verdict.metrics) {
        const comparable = expected.filter(item => item.metric === row.metric).flatMap(item => {
          const record = evidence.get(`${item.case_id}:${item.repetition}`);
          const base = baseIndex.get(`${item.case_id}:${item.repetition}`);
          const candidateResult = record && (record.results || []).find(candidate => candidate.metric === item.metric);
          const baselineResult = base && (base.results || []).find(candidate => candidate.metric === item.metric);
          if (!candidateResult || !baselineResult || candidateResult.status === 'not_applicable' || baselineResult.status === 'not_applicable') return [];
          return [{ candidate: candidateResult.status === 'pass', baseline: baselineResult.status === 'pass' }];
        });
        row.comparable_count = comparable.length;
        row.candidate_comparable_passed = comparable.filter(entry => entry.candidate).length;
        row.baseline_comparable_passed = comparable.filter(entry => entry.baseline).length;
        if (row.candidate_comparable_passed < row.baseline_comparable_passed) {
          verdict.issues.push(issue('regression', { metric: row.metric, partition: row.partition, baseline: row.baseline_comparable_passed, candidate: row.candidate_comparable_passed, expected: row.comparable_count }));
        }
      }
    }
  }

  verdict.verdict = verdict.issues.length ? (verdict.issues.some(item => ['below_threshold', 'regression', 'pair_member_failed', 'pair', 'failed_baseline_became_inapplicable'].includes(item.type)) ? 'failed' : 'incomplete') : 'accepted';
  return verdict;
}

function tally(rows, item, status, policy, result = {}) {
  const key = `${item.metric}|overall`;
  if (!rows.has(key)) {
    const hard = item.metric === HARD_SUPPORTING_CHECK || HARD_METRIC_IDS.includes(item.metric) || (policy.hard_metrics || []).includes(item.metric);
    rows.set(key, { metric: item.metric, method: METHOD_BY_METRIC(item.metric), partition: 'overall', threshold: hard ? policy.hard_threshold : policy.semantic_default_threshold, expected: 0, applicable: 0, passed: 0, inapplicable: 0, missing: 0, error_rows: 0, verdict: 'unmeasured', fraction: '0/0' });
  }
  const row = rows.get(key);
  row.expected += 1;
  if (status === 'not_applicable') row.inapplicable += 1;
  else if (status === 'missing') row.missing += 1;
  else if (status === 'error') { row.error_rows += 1; row.applicable += 1; }
  else { row.applicable += 1; if (status === 'pass' && result.pass !== false) row.passed += 1; }
  return row;
}

function validateEvidenceProjection(evidence) {
  const issues = [];
  for (const record of evidence) {
    if (!record.target_input) continue;
    for (const found of checkForbiddenKeys(record.target_input)) {
      issues.push(issue('forbidden_metadata', { case_id: record.case_id, path: found.path, key: found.key }));
    }
  }
  return issues;
}

module.exports = { assess, buildExpectedRows, preScoringBlockers, HARD_SUPPORTING_CHECK, HARD_METRIC_IDS, METHOD_BY_METRIC };
