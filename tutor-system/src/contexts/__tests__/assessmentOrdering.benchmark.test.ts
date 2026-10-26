// Responsible for measuring transferAssessmentUiAdapter merge latency on reproducible room histories.
import { performance } from 'perf_hooks';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { mergeRoomMessages, projectRoomMessage } from '../transferAssessmentUiAdapter';
import { assessmentResultMessage, deliveredAnswerRow, deliveredQuestionRow } from '../../test-support/transferRoomFixtures';
import type { Message } from '../../types';

jest.mock('../../services/supabase', () => ({ supabase: {} }));

const benchmark = process.env.RUN_ASSESSMENT_BENCHMARK === 'true' ? describe : describe.skip;

benchmark('assessment ordering benchmark', () => {
  it('reports warmed merge median and p95 for few and many assessment events', () => {
    for (const size of [100, 1000, 5000]) {
      for (const density of ['few', 'many']) {
        const groups = density === 'few' ? 2 : Math.floor(size / 6);
        const messages: Message[] = [];
        for (let group = 0; group < groups; group++) {
          const questionId = `question-${group}`;
          const question = projectRoomMessage({ ...deliveredQuestionRow, id: questionId,
            assessment: { ...deliveredQuestionRow.assessment, id: questionId } });
          messages.push(question);
          for (const attempt of [1, 2] as const) {
            const answerId = `answer-${group}-${attempt}`;
            const answer = { ...deliveredAnswerRow, id: answerId, parent_message_id: questionId };
            const result = assessmentResultMessage(attempt === 1 ? 'retry' : 'failed', attempt, answerId);
            messages.push(answer, projectRoomMessage({ ...result, created_at: '2020-01-01',
              assessment_event: { ...result.assessment_event!, assessment_id: questionId, question_message_id: questionId } }));
          }
          const first = assessmentResultMessage('retry', 1, `answer-${group}-1`).assessment_event!;
          messages.push(projectRoomMessage({ ...deliveredAnswerRow, id: `closure-${group}`, created_at: '2019-01-01',
            assessment_event: { ...first, event_key: `assessment-closure:${questionId}`, kind: 'closure',
              assessment_id: questionId, question_message_id: questionId, answer_message_id: null,
              attempt_number: null, outcome: null, attempts_used: 2, attempts_remaining: 0,
              terminal: true, lifecycle: 'cancelled', closure_reason: 'cancelled' } }));
        }
        while (messages.length < size) messages.push({ ...deliveredAnswerRow, id: `chat-${messages.length}`, parent_message_id: null });
        messages.reverse();
        const incoming = messages.filter((_, index) => index % 10 === 0);
        for (let warmup = 0; warmup < 10; warmup++) mergeRoomMessages(messages, incoming);
        const timings: number[] = [];
        let ordered: Message[] = [];
        for (let run = 0; run < 41; run++) {
          const start = performance.now();
          ordered = mergeRoomMessages(messages, incoming);
          timings.push(performance.now() - start);
        }
        timings.sort((a, b) => a - b);
        expect(ordered).toHaveLength(size);
        const summary = { phase: process.env.BENCHMARK_PHASE, size, density,
          assessmentEvents: groups * 3, incoming: incoming.length, samples: timings.length,
          medianMs: timings[20], p95Ms: timings[38], node: process.version };
        if (process.env.BENCHMARK_OUTPUT) {
          mkdirSync(process.env.BENCHMARK_OUTPUT, { recursive: true });
          writeFileSync(join(process.env.BENCHMARK_OUTPUT, `${summary.phase}-${size}-${density}.json`),
            JSON.stringify({ ...summary, warmups: 10, timestamp: new Date().toISOString(),
              timingsMs: timings, input: { existing: messages, incoming }, output: ordered }, null, 2));
        }
        console.log(JSON.stringify(summary));
      }
    }
  }, 120000);
});
