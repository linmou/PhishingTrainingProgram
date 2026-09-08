#!/usr/bin/env node
// Purpose: test tutorDecisionContract.ts at v2 schema boundaries, preserving independent mode/action and supervisor reason.
import { parseTutorDecision } from '../tutorDecisionContract';

const valid = () => ({ reason: 'The learner intends to click; protection comes first.', decision: { mode: 'tutoring', instruction: 'protective_instruction' }, response: 'Do not open that link. Use the real app.' });

test('preserves all structured fields and trims text', () => {
  expect(parseTutorDecision(JSON.stringify({ ...valid(), reason: ' Evidence. ' })).reason).toBe('Evidence.');
  expect(parseTutorDecision(JSON.stringify(valid())).decision.instruction).toBe('protective_instruction');
});

test('permits null for participation-only Guard and rejects it in tutoring', () => {
  expect(parseTutorDecision(JSON.stringify({ ...valid(), decision: { mode: 'guard', instruction: null } })).decision.instruction).toBeNull();
  expect(() => parseTutorDecision(JSON.stringify({ ...valid(), decision: { instruction: null } }))).toThrow();
});

test.each([undefined, null, '', '{}', '[]', 'null', '42', '```json\n{}\n```'])('rejects malformed or incomplete response %p', input => {
  expect(() => parseTutorDecision(input)).toThrow();
});

test.each(['reason', 'response'])('rejects a missing/empty %s without prose inference', field => {
  for (const value of [undefined, null, '', ' ', 1, []]) expect(() => parseTutorDecision(JSON.stringify({ ...valid(), [field]: value }))).toThrow();
});

test('checks serialized order including escaped keys and numeric extra fields', () => {
  const { reason, ...rest } = valid();
  expect(() => parseTutorDecision(JSON.stringify({ ...rest, reason }))).toThrow();
  expect(parseTutorDecision(JSON.stringify(valid()).replace('"reason"', '"\\u0072eason"')).reason).toBe(reason);
  expect(parseTutorDecision(JSON.stringify(valid()).replace(/}$/, ',"0":"extra"}')).reason).toBe(reason);
});

test('rejects invalid independent decision shapes', () => {
  for (const decision of [undefined, null, [], {}, { instruction: 'guard' }]) expect(() => parseTutorDecision(JSON.stringify({ ...valid(), decision }))).toThrow();
  expect(() => parseTutorDecision(JSON.stringify({ ...valid(), decision: { mode: 'warning', instruction: 'scaffolding' } }))).toThrow();
  expect(() => parseTutorDecision(JSON.stringify({ ...valid(), mode: 'tutoring' }))).toThrow();
});

test.each(['reasoning', 'mode_reason', 'suggested_response'])('rejects legacy field %s', field => {
  expect(() => parseTutorDecision(JSON.stringify({ ...valid(), [field]: 'legacy' }))).toThrow();
});
