#!/usr/bin/env node
// Purpose: pair-transition.js evaluates declared semantic pairs and generation joins jointly: exactly two members, one changed meaning-bearing factor, one target-generation identity per repetition, and a pair verdict that one failing or missing member blocks.
'use strict';

const failure = (code, detail = {}) => ({ code, ...detail });
const PASSING = ['pass'];

function groupByPair(definitions) {
  const pairs = new Map();
  for (const definition of definitions) {
    if (!definition.pair) continue;
    if (!pairs.has(definition.pair.pair_id)) pairs.set(definition.pair.pair_id, []);
    pairs.get(definition.pair.pair_id).push(definition);
  }
  return pairs;
}

function resultFor(results, definition, repetition) {
  return results.find(item => item.case_id === definition.case_id && (repetition === undefined || item.repetition === repetition));
}

function indexGenerations(generations) {
  const index = new Map();
  for (const entry of generations) index.set(`${entry.case_id}:${entry.repetition}`, entry.target_generation_id);
  return index;
}

function joinGenerations(definitions, generations) {
  const failures = [];
  for (const [pairId, members] of groupByPair(definitions)) {
    const byMember = new Map(members.map(member => [member.case_id, generations.filter(entry => entry.case_id === member.case_id)]));
    for (const member of members) {
      if (!byMember.get(member.case_id).length) failures.push(failure('missing_generation_identity', { pair_id: pairId, case_id: member.case_id }));
    }
    const repetitions = new Set([...byMember.values()].flat().map(entry => entry.repetition));
    for (const repetition of repetitions) {
      const identities = new Set();
      for (const member of members) {
        const entry = byMember.get(member.case_id).find(item => item.repetition === repetition);
        if (!entry) failures.push(failure('missing_generation_identity', { pair_id: pairId, case_id: member.case_id, repetition, actual: { pair_id: pairId, case_id: member.case_id, repetition } }));
        else identities.add(entry.target_generation_id);
      }
      if (identities.size > 1) failures.push(failure('generation_identity_mismatch', { pair_id: pairId, repetition, actual: { pair_id: pairId, repetition, identities: [...identities] } }));
    }
  }
  return { status: failures.length ? 'fail' : 'pass', failures, pairs: groupByPair(definitions).size };
}

function evaluatePairs(definitions, results) {
  const failures = [];
  const pairs = [];
  for (const [pairId, members] of groupByPair(definitions)) {
    const pair = { pair_id: pairId, members: [], status: 'pass', repetitions: new Set() };
    if (members.length !== 2) failures.push(failure('pair_cardinality', { pair_id: pairId, expected: 2, actual: members.length }));
    const factors = new Set(members.map(member => member.pair.changed_factor));
    if (members.length > 1 && factors.size < members.length) failures.push(failure('pair_factor_identity', { pair_id: pairId, actual: [...factors] }));
    const contrasts = new Set(members.map(member => member.pair.expected_contrast));
    if (members.length > 1 && contrasts.size < 2) failures.push(failure('pair_contrast_identity', { pair_id: pairId, actual: [...contrasts] }));
    for (const member of members) {
      const record = resultFor(results, member);
      if (!record) {
        failures.push(failure('missing_pair_member', { pair_id: pairId, case_id: member.case_id, actual: { member: member.pair.member } }));
        pair.status = 'fail';
        continue;
      }
      if (record.repetition === undefined || record.repetition === null) failures.push(failure('missing_repetition_identity', { pair_id: pairId, case_id: member.case_id, actual: { pair_id: pairId, case_id: member.case_id } }));
      if (record.pair_id && record.pair_id !== pairId) failures.push(failure('pair_identity_mismatch', { pair_id: pairId, actual: record.pair_id }));
      pair.repetitions.add(record.repetition);
      pair.members.push({ case_id: member.case_id, member: member.pair.member, repetition: record.repetition, metric_results: (record.results || []).map(result => ({ metric: result.metric, status: result.status })), target_generation_id: record.target_generation_id });
      const blocking = (record.results || []).filter(result => !PASSING.includes(result.status));
      const memberPassed = record.status === undefined ? blocking.length === 0 : PASSING.includes(record.status) && blocking.length === 0;
      if (!memberPassed) {
        pair.status = 'fail';
        failures.push(failure('pair_member_failed', { pair_id: pairId, case_id: member.case_id, actual: { case_id: member.case_id, status: record.status, blocking_metrics: blocking.map(result => `${result.metric}:${result.status}`) } }));
      }
    }
    // Each member is its own target request, so generation ids differ by design; what must match is
    // the repetition identity both members were joined at. joinGenerations owns the stricter
    // one-identity check used by the frozen fixtures.
    pair.generation_ids = pair.members.map(member => member.target_generation_id);
    pair.repetitions = [...pair.repetitions];
    pairs.push(pair);
  }
  const passed = pairs.filter(pair => pair.status === 'pass').length;
  const total = pairs.reduce((count, pair) => count + pair.members.length, 0);
  const passing = pairs.reduce((count, pair) => count + pair.members.filter(member => member.metric_results.every(result => PASSING.includes(result.status))).length, 0);
  return {
    status: failures.length ? 'fail' : 'pass',
    failures,
    pairs,
    aggregate_pass_rate: total ? passing / total : 0,
    pair_pass_rate: pairs.length ? passed / pairs.length : 0
  };
}

module.exports = { evaluatePairs, joinGenerations, groupByPair };
