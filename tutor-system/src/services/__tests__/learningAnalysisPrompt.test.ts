import { selectMajorityLearningEvents } from '../learningAnalysisPrompt';

test('majority votes on both item identity and event kind, preserving a real supporting event', () => {
  const a = { item_id: 'a', kind: 'initial_signal', evidence_quote: 'actual evidence' };
  const b = { item_id: 'b', kind: 'initial_signal' };
  expect(selectMajorityLearningEvents([{ events: [a,b] }, { events: [a] }, { events: [] }])).toEqual([a]);
  expect(selectMajorityLearningEvents([{ events: [a] }, { events: [{ ...a, kind: 'demonstrated_understanding' }] }, { events: [] }])).toEqual([]);
  expect(() => selectMajorityLearningEvents([{ events: [a] }])).toThrow('ANALYSIS_INCOMPLETE');
  expect(() => selectMajorityLearningEvents([{ events: [a,a] }, { events: [] }, { events: [] }])).toThrow('AI_OUTPUT_INVALID');
});
