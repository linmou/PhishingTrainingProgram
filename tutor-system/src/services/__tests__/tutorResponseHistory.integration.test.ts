// #!/usr/bin/env node
/** Tests simplifiedAIContext.ts and tutorResponseHistory.ts: replay sent model output, preserve human edits, and exclude undelivered/private metadata from other context consumers. */
import { buildAIContextFromExistingData } from '../simplifiedAIContext';
import { conversationMessagesToHistoryText } from '../ecologicalTutorCall';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../transferAssessmentService', () => ({ transferAssessmentService: { readReview: jest.fn() } }));

const room = { title: 'Example', description: 'A suspicious offer', created_at: '2026-11-14T12:00:00Z' };
const posted = {
  id: 'tutor-message', content: 'What would you do next?', user_role: 'tutor', user_id: 'tutor-1',
  response_mode: 'tutoring', created_at: room.created_at
};
const feedback = {
  id: 'feedback-1', created_at: room.created_at, tutor_message_id: posted.id, tutor_id: posted.user_id,
  tutor_action: 'accepted', ai_suggestion: posted.content, raw_guard_mode: false,
  raw_instruction: 'scaffolding', guard_reason: 'Recorded learner evidence and the selected remaining task.'
};
const modelOutput = {
  reason: feedback.guard_reason,
  decision: { guard_mode: false, instruction: 'scaffolding' }, response: feedback.ai_suggestion
};

function install(savedMessages: object[] = [posted], feedbackPages: object[][] = [[feedback]], error: object | null = null) {
  const messages = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(), range: jest.fn().mockResolvedValueOnce({ data: savedMessages, error: null })
      .mockResolvedValue({ data: [], error: null })
  };
  const audit = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(), or: jest.fn().mockReturnThis(), range: jest.fn()
  };
  feedbackPages.forEach(data => audit.range.mockResolvedValueOnce({ data, error }));
  audit.range.mockResolvedValue({ data: [], error: null });
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'messages') return messages;
    if (table === 'ai_suggestion_feedback') return audit;
    throw new Error(`Unexpected table ${table}`);
  });
  return audit;
}

beforeEach(() => jest.resetAllMocks());

it('replays all persisted fields of an accepted tutor output through final history serialization', async () => {
  const audit = install();
  const context = await buildAIContextFromExistingData('room-1', [], undefined, room, true);
  expect(context[1].content).toBe(`Tutor: ${JSON.stringify(modelOutput)}`);
  expect(conversationMessagesToHistoryText(context)).toBe(`Tutor/AI: Tutor: ${JSON.stringify(modelOutput)}`);
  expect(audit.eq).toHaveBeenCalledWith('room_id', 'room-1');
  expect(audit.in).toHaveBeenCalledWith('tutor_action', ['accepted', 'modified']);
});

it('preserves original output and separately labels the wording and mode actually posted after review', async () => {
  install([{ ...posted, content: 'Human-edited wording', response_mode: 'guard' }], [[{ ...feedback, tutor_action: 'modified' }]]);
  const context = await buildAIContextFromExistingData('room-1', [], undefined, room, true);
  expect(context[1].content).toBe(`Original AI suggestion: ${JSON.stringify(modelOutput)}\nTutor posted after human review: ${JSON.stringify({
    response: 'Human-edited wording', guard_mode: true
  })}`);
});

it('keeps public context free of private model metadata unless tutor generation opts in', async () => {
  install();
  const context = await buildAIContextFromExistingData('room-1', [], undefined, room);
  expect(context[1].content).toBe(`Tutor: ${posted.content}`);
  expect(supabase.from).not.toHaveBeenCalledWith('ai_suggestion_feedback');
});

it.each([
  { tutor_action: 'ignored' }, { tutor_action: 'rejected' }, { tutor_message_id: null },
  { tutor_message_id: 'another-message' }, { tutor_id: 'another-tutor' },
  { guard_reason: null }, { raw_instruction: null }
])('does not invent history from unused, mismatched or incomplete feedback: %j', async change => {
  install([posted], [[{ ...feedback, ...change }]]);
  const context = await buildAIContextFromExistingData('room-1', [], undefined, room, true);
  expect(context[1].content).toBe(`Tutor: ${posted.content}`);
});

it('leaves a manual tutor message as posted text', async () => {
  install([posted], [[]]);
  const context = await buildAIContextFromExistingData('room-1', [], undefined, room, true);
  expect(context[1].content).toBe(`Tutor: ${posted.content}`);
});

it('does not reinterpret a student message as tutor output even if feedback points at it', async () => {
  install([{ ...posted, user_role: 'student' }]);
  const context = await buildAIContextFromExistingData('room-1', [], undefined, room, true);
  expect(context[1].content).toBe(`Student: ${posted.content}`);
  expect(supabase.from).not.toHaveBeenCalledWith('ai_suggestion_feedback');
});

it('loads later feedback pages without truncating the prior reason', async () => {
  const reason = Array.from({ length: 80 }, (_, i) => `evidence-${i}`).join(' ');
  const audit = install([posted], [[{ ...feedback, id: 'unlinked', tutor_message_id: null }], [{ ...feedback, guard_reason: reason }]]);
  const context = await buildAIContextFromExistingData('room-1', [], undefined, room, true);
  expect(JSON.parse(context[1].content.slice('Tutor: '.length)).reason).toBe(reason);
  expect(audit.or).toHaveBeenCalledWith(`created_at.gt.${room.created_at},and(created_at.eq.${room.created_at},id.gt.unlinked)`);
});

it('surfaces feedback read errors instead of silently switching experimental history', async () => {
  install([posted], [[]], { message: 'Read denied' });
  await expect(buildAIContextFromExistingData('room-1', [], undefined, room, true)).rejects.toThrow('Tutor response history unavailable: Read denied');
});

it('rejects ambiguous duplicate output records for a posted turn', async () => {
  install([posted], [[feedback, { ...feedback, id: 'duplicate' }]]);
  await expect(buildAIContextFromExistingData('room-1', [], undefined, room, true)).rejects.toThrow('Ambiguous tutor response history');
});
