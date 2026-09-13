#!/usr/bin/env node
// Purpose: test tutorDecisionContract.ts at v2 schema boundaries, preserving independent mode/action and supervisor reason,
// and at the multiagent grammar boundary (two tagged character messages, either order, only when allowed).
import { decodeAgentMessage, decodeMultiAgentResponse, parseTutorDecision } from '../tutorDecisionContract';

const valid = () => ({ reason: 'The learner intends to click; protection comes first.', decision: { mode: 'tutoring', instruction: 'protective_instruction' }, response: 'Do not open that link. Use the real app.' });
const multiAgent = (response: string) => JSON.stringify({ reason: 'Familiar branding is the live assumption.', decision: { mode: 'multiagent', instruction: 'multiagent' }, response });
const ALLOW = { allowMultiagent: true };

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

test('accepts a multiagent decision only when the turn allows it', () => {
  const response = '[agent:riley] The logo looks official, so I would trust it.\n[agent:tutor] A logo does not prove the sender. What could you verify yourself?';
  const decision = parseTutorDecision(multiAgent(response), ALLOW).decision;
  expect(decision).toEqual({ mode: 'multiagent', instruction: 'multiagent' });
  expect(() => parseTutorDecision(multiAgent(response))).toThrow('not allowed for this turn');
});

test.each([
  ['Riley', '[agent:riley] Trust the logo.', { character: 'riley', content: 'Trust the logo.' }],
  ['Tutor', '[agent:tutor] Check the sender.', { character: 'tutor', content: 'Check the sender.' }]
])('accepts a single %s response for a multiagent decision', (_character, response, decoded) => {
  expect(parseTutorDecision(multiAgent(response), ALLOW).decision).toEqual({
    mode: 'multiagent', instruction: 'multiagent'
  });
  expect(decodeMultiAgentResponse(response)).toEqual([decoded]);
});

test('accepts either character order and trims each decoded message', () => {
  const rileyFirst = decodeMultiAgentResponse('[agent:riley]  Trust the logo. \n[agent:tutor] Check the sender.');
  expect(rileyFirst).toEqual([
    { character: 'riley', content: 'Trust the logo.' },
    { character: 'tutor', content: 'Check the sender.' }
  ]);
  const tutorFirst = decodeMultiAgentResponse('[agent:tutor] Check the sender.\n[agent:riley] Trust the logo.');
  expect(tutorFirst.map(message => message.character)).toEqual(['tutor', 'riley']);
});

test.each([
  ['duplicate Riley tag', '[agent:riley] Trust the logo.\n[agent:riley] Still trust it.'],
  ['unknown third tag', '[agent:riley] Trust it.\n[agent:sam] Same here.\n[agent:tutor] Check the sender.'],
  ['untagged prefix', 'Here is a contrast:\n[agent:riley] Trust it.\n[agent:tutor] Check the sender.'],
  ['empty tagged body', '[agent:riley]   \n[agent:tutor] Check the sender.'],
  ['no tags at all', 'Trust the logo, but check the sender.']
])('rejects a malformed multiagent response: %s', (_label, response) => {
  expect(() => parseTutorDecision(multiAgent(response), ALLOW)).toThrow();
});

test('rejects multiagent mode with a wrong instruction and the instruction outside multiagent mode', () => {
  expect(() => parseTutorDecision(JSON.stringify({ ...valid(), decision: { mode: 'multiagent', instruction: 'scaffolding' } }), ALLOW)).toThrow();
  expect(() => parseTutorDecision(JSON.stringify({ ...valid(), decision: { mode: 'tutoring', instruction: 'multiagent' } }))).toThrow();
});

test('rejects agent tags in a non-multiagent response', () => {
  const tagged = { ...valid(), response: '[agent:tutor] Check the sender.' };
  expect(() => parseTutorDecision(JSON.stringify(tagged))).toThrow('must not contain agent tags');
});

test('reads character identity only from Multi-agent tutor rows', () => {
  const row = { content: '[agent:riley] Trust the logo.', user_role: 'tutor', response_mode: 'multiagent' };
  expect(decodeAgentMessage(row)).toEqual({ character: 'riley', content: 'Trust the logo.' });
  expect(decodeAgentMessage({ ...row, response_mode: 'tutoring' })).toBeNull();
  expect(decodeAgentMessage({ ...row, response_mode: 'guard' })).toBeNull();
  expect(decodeAgentMessage({ ...row, response_mode: 'assessment' })).toBeNull();
  expect(decodeAgentMessage({ ...row, user_role: 'student' })).toBeNull();
  expect(decodeAgentMessage({ content: 'Trust the logo.', user_role: 'tutor', response_mode: 'multiagent' })).toBeNull();
  expect(decodeAgentMessage({ content: '[agent:unknown] Trust the logo.', user_role: 'tutor', response_mode: 'multiagent' })).toBeNull();
  expect(decodeAgentMessage({ content: '[agent:riley Trust the logo.', user_role: 'tutor', response_mode: 'multiagent' })).toBeNull();
  expect(decodeAgentMessage({ content: '[agent:tutor Check the sender.', user_role: 'tutor', response_mode: 'multiagent' })).toBeNull();
});
