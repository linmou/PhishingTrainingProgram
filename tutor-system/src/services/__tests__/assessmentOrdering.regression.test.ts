// Responsible for assessmentRendering ordering equivalence across duplicate, missing and conflicting dependencies.
import { orderAssessmentMessages } from '../assessmentRendering';
import { assessmentResultMessage } from '../../test-support/transferRoomFixtures';
import type { AssessmentEvent } from '../../types/assessment';

interface Row {
  id: string;
  created_at: string;
  parent_message_id?: string | null;
  assessment_event?: AssessmentEvent | null;
}

// Frozen pre-optimization ordering serves as the oracle for unusual persisted histories.
function previousOrdering(messages: Row[]): Row[] {
  const sorted = [...messages].sort((left, right) =>
    Number(right.id.startsWith('prepop-')) - Number(left.id.startsWith('prepop-')) ||
    (Date.parse(left.created_at) || 0) - (Date.parse(right.created_at) || 0) || left.id.localeCompare(right.id));
  const byId = new Map(sorted.map(message => [message.id, message]));
  const priorResults = new Map<string, string[]>();
  for (const message of sorted) {
    const event = message.assessment_event;
    if (!event) continue;
    const earlier = sorted.filter(candidate => candidate.assessment_event?.kind === 'result' &&
      candidate.assessment_event.assessment_id === event.assessment_id &&
      (event.kind === 'closure' || candidate.assessment_event.attempts_used < event.attempts_used)).map(candidate => candidate.id);
    priorResults.set(message.id, earlier);
    if (event.answer_message_id && event.kind === 'result') priorResults.set(event.answer_message_id, earlier);
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const output: Row[] = [];
  const visit = (message: Row) => {
    if (visited.has(message.id) || visiting.has(message.id)) return;
    visiting.add(message.id);
    for (const id of [...(priorResults.get(message.id) ?? []), message.assessment_event?.question_message_id,
      message.assessment_event?.answer_message_id, message.parent_message_id]) {
      const dependency = id ? byId.get(id) : undefined;
      if (dependency) visit(dependency);
    }
    visiting.delete(message.id);
    visited.add(message.id);
    output.push(message);
  };
  sorted.forEach(visit);
  return output;
}

function history(): Row[] {
  const rows: Row[] = [{ id: 'prepop-2', created_at: '2030-01-02' }, { id: 'prepop-1', created_at: '2030-01-01' }];
  for (const assessmentId of ['question-a', 'question-b']) {
    rows.push({ id: assessmentId, created_at: '2026-01-03' });
    for (const attempt of [1, 2] as const) {
      const answerId = `${assessmentId}-answer-${attempt}`;
      const result = assessmentResultMessage(attempt === 1 ? 'retry' : 'failed', attempt, answerId);
      rows.push({ id: answerId, created_at: '2026-01-02', parent_message_id: assessmentId },
        { id: result.id, created_at: '2026-01-01', assessment_event: {
          ...result.assessment_event!, assessment_id: assessmentId, question_message_id: assessmentId } });
    }
    rows.push({ id: `${assessmentId}-closure`, created_at: '2025-01-01', assessment_event: {
      ...assessmentResultMessage('retry', 1, 'missing-answer').assessment_event!,
      event_key: `assessment-closure:${assessmentId}`, assessment_id: assessmentId, question_message_id: assessmentId,
      answer_message_id: null, kind: 'closure', attempt_number: null, outcome: null, terminal: true,
      attempts_used: 2, attempts_remaining: 0, lifecycle: 'cancelled', closure_reason: 'cancelled' } });
  }
  return rows;
}

describe('assessment dependency ordering', () => {
  it('keeps prepopulated dialogue before inverted question, attempts, results and closure', () => {
    expect(orderAssessmentMessages(history()).map(row => row.id)).toEqual([
      'prepop-1', 'prepop-2',
      ...['question-a', 'question-b'].flatMap(id => [id, `${id}-answer-1`, `result-${id}-answer-1`,
        `${id}-answer-2`, `result-${id}-answer-2`, `${id}-closure`]),
    ]);
  });

  it('matches the prior traversal for ties, duplicates, missing links, cycles and shared answers', () => {
    for (let variant = 0; variant < 80; variant++) {
      let rows = history().map((row, index) => ({ ...row,
        created_at: ['invalid', '2020-01-01', '2026-01-03'][(index + variant) % 3] }));
      rows.push({ id: 'cycle-a', created_at: 'invalid', parent_message_id: 'cycle-b' },
        { id: 'cycle-b', created_at: 'invalid', parent_message_id: 'cycle-a' });
      if (variant % 2 === 0) rows = rows.filter(row => !row.id.endsWith('answer-1'));
      if (variant % 3 === 0) rows.push({ ...rows[3], created_at: '2021-01-01' });
      if (variant % 4 === 0) rows = rows.map(row => row.assessment_event ? {
        ...row, assessment_event: { ...row.assessment_event, answer_message_id: 'shared-answer' },
      } : row);
      rows.push({ id: 'shared-answer', created_at: '2020-01-01' });
      const offset = variant % rows.length;
      rows = [...rows.slice(offset), ...rows.slice(0, offset)];
      if (variant % 2) rows.reverse();
      expect(orderAssessmentMessages(rows)).toEqual(previousOrdering(rows));
    }
  });
});
