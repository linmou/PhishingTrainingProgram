#!/usr/bin/env node
/**
 * Test responsible for src/contexts/roomExportBuilder.ts on the transfer-assessment path: a role
 * scoped export of a room that contains a delivered question.
 *
 * Responsibility: prove the learner export renders the public question (stem, instruction,
 * options) while no export of any role carries the assessment key, transfer basis, or teacher-only
 * assessment material.
 */

import { buildRoomExportData, buildRoomTextExport } from '../roomExportBuilder';
import {
  answerLifecycleFromProcessed,
  projectRoomMessage,
  withAnswerLifecycle,
} from '../transferAssessmentUiAdapter';
import {
  DELIVERED_ANSWER_ID,
  DELIVERED_QUESTION_ID,
  LEARNER_A_ID,
  LEARNER_B_ID,
  TUTOR_ID,
  TRANSFER_ROOM_ID,
  deliveredAnswerRow,
  deliveredPublicAssessment,
  deliveredQuestionRow,
  learnerAMessageRow,
  transferRoom,
} from '../../test-support/transferRoomFixtures';
import {
  expectNoPrivateAssessmentFields,
  expectSerializedWithoutPrivateFields,
} from '../../test-support/transferPrivacyAssertions';
import type { UserRole } from '../../types';

const questionMessage = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
const answerMessage = projectRoomMessage(deliveredAnswerRow as unknown as Record<string, unknown>);
const ordinaryMessage = projectRoomMessage(learnerAMessageRow);

const buildExport = (
  userRole: UserRole,
  userId: string,
  messages = [ordinaryMessage, questionMessage, answerMessage]
) => ({
  room: transferRoom,
  messages,
  messageFeedbackStats: {},
  feedbackSummary: null,
  aiInteractions: [],
  userRole,
  userId,
});

const terminalFailureLifecycle = (answerOutcome: 'retry' | 'failed') => answerLifecycleFromProcessed({
  message_id: DELIVERED_ANSWER_ID,
  assessment_id: DELIVERED_QUESTION_ID,
  processing_state: 'applied',
  answer_outcome: answerOutcome,
  attempt_number: answerOutcome === 'retry' ? 1 : 2,
  attempts_used: answerOutcome === 'retry' ? 1 : 2,
  attempts_remaining: answerOutcome === 'retry' ? 1 : 0,
  selected_option_ids: ['A'],
  terminal: answerOutcome === 'failed',
  transition: null,
  feedback_required: true,
  code: null,
  already_processed: true,
  terminal_failure_feedback: {
    correct_option_ids: ['B'],
    learner_safe_explanation: 'Use an official channel to verify the request.',
  },
});

const messagesWithLifecycle = (answerOutcome: 'retry' | 'failed') => {
  const lifecycle = terminalFailureLifecycle(answerOutcome);
  return [
    ordinaryMessage,
    withAnswerLifecycle(questionMessage, lifecycle),
    withAnswerLifecycle(answerMessage, lifecycle),
  ];
};

const DISTINCT_QUESTION_MESSAGE_ID = 'question-message-id-distinct-from-assessment-id';

const messagesWithDistinctQuestionIdentity = () => {
  const [ordinary, question, answer] = messagesWithLifecycle('failed');
  return [
    ordinary,
    { ...question, id: DISTINCT_QUESTION_MESSAGE_ID },
    { ...answer, parent_message_id: DISTINCT_QUESTION_MESSAGE_ID },
  ];
};

describe('roomExportBuilder transfer assessment projections', () => {
  it('renders the public question in the learner text export', () => {
    const text = buildRoomTextExport(buildExport('student', LEARNER_A_ID));

    expect(text).toContain(deliveredQuestionRow.content);
    expect(text).toContain('Choose one.');
    expect(text).toContain('B. Stop and verify the offer through an official channel.');
    expect(text).not.toContain('assessment_key');
  });

  it('renders the public question in the teacher text export too', () => {
    const text = buildRoomTextExport(buildExport('tutor', TUTOR_ID));

    expect(text).toContain('A. Pay the fee quickly.');
    expect(text).not.toContain('assessment_key');
  });

  it('keeps every private assessment field out of the learner JSON export', () => {
    const data = buildRoomExportData(buildExport('student', LEARNER_A_ID));

    expectNoPrivateAssessmentFields(data);
    expectSerializedWithoutPrivateFields(data);
  });

  it('keeps every private assessment field out of the teacher JSON export', () => {
    const data = buildRoomExportData(buildExport('tutor', TUTOR_ID));

    expectNoPrivateAssessmentFields(data);
    expectSerializedWithoutPrivateFields(data);
  });

  it('still separates teacher-only interaction metadata from the learner projection', () => {
    const learner = buildRoomExportData(buildExport('student', LEARNER_A_ID));
    const teacher = buildRoomExportData(buildExport('tutor', TUTOR_ID));

    expect(learner).not.toHaveProperty('ai_interactions');
    expect(teacher).toHaveProperty('ai_interactions');
    expect(transferRoom.id).toBe(TRANSFER_ROOM_ID);
  });

  it('exports the target learner retry state without terminal disclosure', () => {
    const data = buildRoomExportData(buildExport(
      'student',
      LEARNER_A_ID,
      messagesWithLifecycle('retry')
    ));
    const question = data.messages.find((message) => message.id === DELIVERED_QUESTION_ID)!;

    expect(question.public_question).toEqual({
      id: DELIVERED_QUESTION_ID,
      stem: deliveredQuestionRow.content,
      selection_type: 'single',
      options: deliveredPublicAssessment.options,
    });
    expect(question.answer_lifecycle).toMatchObject({
      assessment_id: DELIVERED_QUESTION_ID,
      answer_outcome: 'retry',
      attempts_remaining: 1,
      terminal: false,
    });
    expect(question.answer_lifecycle).not.toHaveProperty('terminal_explanation');
    expect(JSON.stringify(data)).not.toContain('Use an official channel to verify the request.');
    expect(JSON.stringify(data)).not.toMatch(/"(assessment_key|transfer_basis|correct_option_ids|learner_safe_explanation)"/);
  });

  it('exports terminal failure explanation only to the target learner', () => {
    const messages = messagesWithLifecycle('failed');
    const learner = buildRoomExportData(buildExport('student', LEARNER_A_ID, messages));
    const teacher = buildRoomExportData(buildExport('tutor', TUTOR_ID, messages));
    const observer = buildRoomExportData(buildExport('observer', 'observer-1', messages));
    const otherLearner = buildRoomExportData(buildExport('student', LEARNER_B_ID, messages));
    const question = (data: typeof learner) => data.messages.find(
      (message) => message.id === DELIVERED_QUESTION_ID
    )!;

    expect(question(learner).answer_lifecycle).toMatchObject({
      answer_outcome: 'failed',
      attempts_remaining: 0,
      terminal: true,
      terminal_explanation: 'Use an official channel to verify the request.',
    });
    expect(question(teacher).answer_lifecycle).toBeUndefined();
    expect(question(observer).answer_lifecycle).toBeUndefined();
    expect(question(otherLearner).answer_lifecycle).toBeUndefined();
    [learner, teacher, observer, otherLearner].forEach((data) => {
      expectNoPrivateAssessmentFields(data);
      expectSerializedWithoutPrivateFields(data);
      expect(JSON.stringify(data)).not.toContain('correct_option_ids');
    });
  });

  it('keeps the answer parent message id separate from its assessment id', () => {
    const messages = messagesWithDistinctQuestionIdentity();
    const data = buildRoomExportData(buildExport('student', LEARNER_A_ID, messages));
    const question = data.messages.find((message) => message.id === DISTINCT_QUESTION_MESSAGE_ID)!;
    const answer = messages.find((message) => message.id === DELIVERED_ANSWER_ID)!;

    expect(DISTINCT_QUESTION_MESSAGE_ID).not.toBe(DELIVERED_QUESTION_ID);
    expect(answer.parent_message_id).toBe(DISTINCT_QUESTION_MESSAGE_ID);
    expect(question.public_question?.id).toBe(DELIVERED_QUESTION_ID);
    expect(question.answer_lifecycle?.assessment_id).toBe(DELIVERED_QUESTION_ID);
  });

  it('keeps terminal feedback out of observer text exports while retaining the public question', () => {
    const messages = messagesWithLifecycle('failed');
    const learnerText = buildRoomTextExport(buildExport(
      'student',
      LEARNER_A_ID,
      messages
    ));
    const observerText = buildRoomTextExport(buildExport(
      'observer',
      'observer-1',
      messages
    ));
    const teacherText = buildRoomTextExport(buildExport('tutor', TUTOR_ID, messages));

    expect(learnerText).toContain('Use an official channel to verify the request.');
    expect(teacherText).not.toContain('Use an official channel to verify the request.');
    expect(observerText).toContain(deliveredQuestionRow.content);
    expect(observerText).not.toContain('Use an official channel to verify the request.');
    expect(observerText).not.toMatch(/Correct option|attempts remaining/);
  });
});
