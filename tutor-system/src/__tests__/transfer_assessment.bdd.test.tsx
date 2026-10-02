#!/usr/bin/env node
// Test responsible for executable bindings to features/transfer_assessment.feature, excluding only its explicitly non-feasible scenario.

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { defineFeature, loadFeature } from 'jest-cucumber';
import RoomPagePost from '../pages/RoomPagePost';
import { RoomProvider, useRoom } from '../contexts/RoomContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { ChecklistService } from '../services/checklistService';
import { generateTutorSuggestion, getAIConfig } from '../services/aiService';
import { transferAssessmentService } from '../services/transferAssessmentService';
import { TransferAssessmentService } from '../services/transferAssessmentService';
import type { TransferAssessment } from '../services/transferAssessmentOrchestrator';
import {
  resolveTransferAnswer,
  type TransferLifecycleContext,
} from '../services/transferAssessmentOrchestrator';
import { applyLearningEvent } from '../services/learningProgressTransitions';
import {
  answerLifecycleFromProcessed,
  createReviewCandidate,
  projectRoomMessage,
} from '../contexts/transferAssessmentUiAdapter';
import {
  DELIVERED_ANSWER_ID,
  DELIVERED_QUESTION_ID,
  LEARNER_A_MESSAGE_ID,
  CHECKLIST_ID,
  CHECKLIST_ITEM_ID,
  PRIVATE_ASSESSMENT_KEY,
  deliveredQuestionRow,
  learnerAMessageRow,
  preparedCandidate,
  preparedTurnResult,
  processedFirstIncorrectRetry,
  processedCorrectTerminal,
  processedSecondIncorrectTerminal,
  reviewedDelivery,
  tutorUser,
  transferChecklist,
  transferRoom,
} from '../test-support/transferRoomFixtures';
import { isValidTransferProgress, type TransferProgress } from '../types/learningProgress';

jest.mock('../services/supabase', () => ({
  supabase: { channel: jest.fn(), from: jest.fn(), storage: { from: jest.fn() } },
  validateRoomPassword: jest.fn(),
  submitMessageFeedback: jest.fn(),
  getMessageFeedbackStats: jest.fn(),
  getUserMessageFeedback: jest.fn(),
  getRoomFeedbackSummary: jest.fn(),
  clearChatHistory: jest.fn(),
}));

jest.mock('../services/aiService', () => ({
  generateTutorSuggestion: jest.fn(),
  recordAISuggestionFeedback: jest.fn(),
  updateAIConfig: jest.fn(),
  getAIConfig: jest.fn(),
  DEFAULT_AI_MODEL: 'qwen3.5-flash',
}));

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../services/checklistService', () => ({
  ChecklistService: {
    getActiveTransferChecklistForRoom: jest.fn(),
    getChecklistForStudent: jest.fn(),
  },
}));

jest.mock('../components/ChecklistPanel', () => function MockChecklistPanel() {
  return <div data-testid="checklist-panel" />;
});
jest.mock('../components/AIAssistantSettings', () => function MockAIAssistantSettings() {
  return <div data-testid="ai-settings-modal" />;
});
jest.mock('../components/StudentAIToneControl', () => function MockStudentAIToneControl() {
  return <div data-testid="student-ai-tone" />;
});
jest.mock('../components/RoomPost', () => function MockRoomPost() {
  return <div data-testid="room-post" />;
});
jest.mock('../components/CommentInput', () => function MockCommentInput() {
  return <div data-testid="comment-input" />;
});
jest.mock('../components/AISuggestionBox', () => function MockAISuggestionBox() {
  return <div data-testid="ai-suggestion-box" />;
});

const feature = loadFeature('features/transfer_assessment.feature', {
  tagFilter: 'not @non_feasible',
});

const OPTIONS = [
  { id: 'A' as const, text: 'Trust the displayed sender name' },
  { id: 'B' as const, text: 'Verify through a separate trusted channel' },
  { id: 'C' as const, text: 'Forward the message to coworkers' },
  { id: 'D' as const, text: 'Open the link to inspect it' },
];

const PARTIAL_PROGRESS: TransferProgress = {
  status: 'partially_covered',
  understanding_level: 'basic',
};

interface ScenarioState {
  progress: TransferProgress;
  lifecycle: TransferLifecycleContext;
  assessment: TransferAssessment;
  firstResult: ReturnType<typeof resolveTransferAnswer> | null;
  result: ReturnType<typeof resolveTransferAnswer> | null;
  draft: Record<string, unknown> | null;
  serviceCalls: Array<Record<string, unknown>>;
  delivered: Record<string, unknown> | null;
  tutorTurn: { mode: string; instruction: string | null; response: string } | null;
  room: ReturnType<typeof useRoom> | null;
  prepareSpy: jest.SpyInstance | null;
  analyzeSpy: jest.SpyInstance | null;
  sendReviewedSpy: jest.SpyInstance | null;
}

function makeAssessment(selectionType: 'single' | 'multiple' = 'single'): TransferAssessment {
  return {
    id: DELIVERED_QUESTION_ID,
    item_id: CHECKLIST_ITEM_ID,
    selection_type: selectionType,
    options: OPTIONS,
    correct_option_ids: selectionType === 'single' ? ['B'] : ['B', 'D'],
    learner_safe_explanation: 'Verify the request through a trusted channel.',
    progress_snapshot_hash: 'snapshot-1',
  };
}

function makeLifecycle(
  progress: TransferProgress = PARTIAL_PROGRESS,
  acceptedAttemptCount: 0 | 1 | 2 = 0,
  processedAnswerIds: string[] = [],
  resolution: 'open' | 'passed' | 'failed' = 'open',
  overrides: Partial<TransferLifecycleContext> = {}
): TransferLifecycleContext {
  return {
    progress,
    participation_mode: 'tutoring',
    progress_snapshot_hash: 'snapshot-1',
    feedback_required: false,
    eligible_assessment_item_ids: [CHECKLIST_ITEM_ID],
    unresolved_assessment: {
      id: DELIVERED_QUESTION_ID,
      selection_type: 'single',
      options: OPTIONS,
      stem: deliveredQuestionRow.content,
      rendered_text: deliveredQuestionRow.content,
    },
    pending_repair_message_id: null,
    attempt_snapshot: {
      assessment_id: DELIVERED_QUESTION_ID,
      accepted_attempt_count: acceptedAttemptCount,
      resolution,
      processed_answer_message_ids: processedAnswerIds,
    },
    ...overrides,
  };
}

function makeState(): ScenarioState {
  const progress: TransferProgress = { status: 'pending', understanding_level: 'none' };
  return {
    progress,
    lifecycle: makeLifecycle(progress),
    assessment: makeAssessment(),
    firstResult: null,
    result: null,
    draft: null,
    serviceCalls: [],
    delivered: null,
    tutorTurn: null,
    room: null,
    prepareSpy: null,
    analyzeSpy: null,
    sendReviewedSpy: null,
  };
}

const RoomProbe: React.FC<{ onReady: (room: ReturnType<typeof useRoom>) => void }> = ({ onReady }) => {
  const room = useRoom();
  React.useEffect(() => onReady(room), [onReady, room]);
  return null;
};

function configureRoomBackend(messages: Array<Record<string, unknown>>, checklist: typeof transferChecklist | null) {
  (useAuth as jest.Mock).mockReturnValue({ user: tutorUser, loading: false });
  (getAIConfig as jest.Mock).mockResolvedValue(null);
  (supabase.channel as jest.Mock).mockReturnValue({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn(),
  });
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'rooms') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: transferRoom, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === 'messages') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: messages, error: null }),
          }),
        }),
      };
    }
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [
              { id: tutorUser.id, display_name: 'Tutor', current_role: 'tutor' },
              { id: preparedTurnResult.student_id, display_name: 'Learner A', current_role: 'student' },
            ],
            error: null,
          }),
        }),
      };
    }
    throw new Error('Unexpected Supabase table ' + table);
  });
  (ChecklistService.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(checklist);
  (ChecklistService.getChecklistForStudent as jest.Mock).mockResolvedValue(checklist);
}

async function mountTeacherRoom(
  state: ScenarioState,
  options: {
    messages?: Array<Record<string, unknown>>;
    checklist?: typeof transferChecklist | null;
    page?: boolean;
  } = {}
) {
  const messages = options.messages ?? [learnerAMessageRow];
  const checklist = options.checklist === undefined ? transferChecklist : options.checklist;
  configureRoomBackend(messages, checklist);
  state.room = null;
  state.analyzeSpy = jest.spyOn(transferAssessmentService, 'analyzeMessage').mockResolvedValue({ applied: [] });
  state.prepareSpy = jest.spyOn(transferAssessmentService, 'prepareAssessment').mockResolvedValue(preparedTurnResult);
  state.sendReviewedSpy = jest.spyOn(transferAssessmentService, 'sendReviewed').mockResolvedValue(reviewedDelivery);

  if (options.page) {
    render(
      <RoomProvider>
        <RoomProbe onReady={(room) => { state.room = room; }} />
        <MemoryRouter initialEntries={['/room/' + transferRoom.id]}>
          <Routes>
            <Route path="/room/:roomId" element={<RoomPagePost />} />
          </Routes>
        </MemoryRouter>
      </RoomProvider>
    );
    await waitFor(() => expect(state.room?.currentRoom?.id).toBe(transferRoom.id));
    return;
  }

  render(
    <RoomProvider>
      <RoomProbe onReady={(room) => { state.room = room; }} />
    </RoomProvider>
  );
  await waitFor(() => expect(state.room).not.toBeNull());
  await act(async () => {
    await state.room!.joinRoom(transferRoom.id);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

function resolveSelection(state: ScenarioState, content: string, answerId: string) {
  state.lifecycle = { ...state.lifecycle, progress: state.progress };
  state.result = resolveTransferAnswer(state.lifecycle, {
    delivered: true,
    answer_message_id: answerId,
    content,
    assessment: state.assessment,
  });
  state.progress = state.result.progress;
  state.lifecycle = {
    ...state.lifecycle,
    progress: state.result.progress,
    feedback_required: state.result.feedback_required,
    attempt_snapshot: state.result.attempt_snapshot,
  };
  return state.result;
}

function serviceFor(response: unknown, state: ScenarioState): TransferAssessmentService {
  return new TransferAssessmentService({
    api: {
      invoke: async (body) => {
        state.serviceCalls.push(body);
        return { data: { ok: true, data: response }, error: null };
      },
    },
    requestId: () => 'bdd-request-1',
  });
}

function expectBackground(state: ScenarioState) {
  expect(state.progress).toMatchObject({
    status: 'pending',
    understanding_level: 'none',
  });
  expect(isValidTransferProgress(state.progress)).toBe(true);
}

defineFeature(feature, (test) => {
  test('Eligible learner evidence updates progress and prepares an assessment draft', ({ given, and, when, then }) => {
    const state = makeState();
    given('the transfer assessment policy is enabled for a new learner-owned checklist', () => {
      expectBackground(state);
    });
    and('the checklist uses the existing status and understanding_level pair', () => {
      expect(isValidTransferProgress(state.progress)).toBe(true);
    });
    given('the learner has given a correct explanation for a configured concept', () => {
      expect(learnerAMessageRow.user_role).toBe('student');
      const transition = applyLearningEvent(state.progress, 'initial_signal');
      expect(transition.disposition).toBe('apply');
      if (transition.disposition === 'apply') state.progress = transition.next;
    });
    and('the learner has not already demonstrated transfer for that concept', () => {
      expect(state.progress).toEqual({ status: 'partially_covered', understanding_level: 'basic' });
    });
    and('analysis has identified one fully eligible transfer target', () => {
      const candidate = createReviewCandidate(preparedTurnResult);
      expect(candidate?.scope.itemId).toBe(CHECKLIST_ITEM_ID);
      expect(candidate?.scope.studentId).toBe(preparedTurnResult.student_id);
    });
    when('the teacher requests the next AI-generated response', async () => {
      await mountTeacherRoom(state);
      await act(async () => {
        await state.room!.generateAIResponse();
      });
      state.draft = state.room!.transferDraft?.decision as unknown as Record<string, unknown> ?? null;
    });
    then('the learner progress pair for that concept becomes partially_covered with understanding_level basic', () => {
      expect(state.progress).toEqual({ status: 'partially_covered', understanding_level: 'basic' });
    });
    and('the teacher receives one assessment draft for review', () => {
      expect(state.draft).toEqual(preparedCandidate);
      expect(state.prepareSpy).toHaveBeenCalledTimes(1);
      expect(state.analyzeSpy?.mock.invocationCallOrder[0]).toBeLessThan(state.prepareSpy!.mock.invocationCallOrder[0]);
      expect(generateTutorSuggestion).not.toHaveBeenCalled();
    });
  });

  test('Protection and correction precede transfer assessment', ({ given, and, when, then }) => {
    const state = makeState();
    given('the transfer assessment policy is enabled for a new learner-owned checklist', () => expectBackground(state));
    and('the checklist uses the existing status and understanding_level pair', () => expect(isValidTransferProgress(state.progress)).toBe(true));
    given('the learner is about to open a suspicious link', () => {
      state.lifecycle = { ...state.lifecycle, participation_mode: 'guard' };
    });
    when('the tutor evaluates the next turn', async () => {
      await mountTeacherRoom(state);
      state.prepareSpy!.mockResolvedValue(null);
      (generateTutorSuggestion as jest.Mock).mockResolvedValue({
        success: true,
        suggestion: 'Stop before opening the link and verify it independently.',
        decision: {
          mode: 'guard',
          instruction: 'protective_instruction',
          suggested_response: 'Stop before opening the link and verify it independently.',
        },
        contextMessages: [LEARNER_A_MESSAGE_ID],
      });
      await act(async () => {
        await state.room!.generateAIResponse();
      });
      const decision = state.room!.aiDecision as unknown as Record<string, unknown>;
      state.tutorTurn = {
        mode: String(decision.mode),
        instruction: String(decision.instruction),
        response: state.room!.aiSuggestion || '',
      };
    });
    then('the tutor protects or corrects the learner before proposing an assessment', () => {
      expect(state.tutorTurn).toMatchObject({ mode: 'guard', instruction: 'protective_instruction' });
      expect(state.prepareSpy).toHaveBeenCalledTimes(1);
      expect(state.room?.transferDraft).toBeNull();
    });
    and('the assessment cannot be the first response to the imminent unsafe action', () => {
      expect(state.tutorTurn?.response).toMatch(/stop|verify/i);
      expect(state.room?.finalMode).toBe('guard');
    });
  });

  test('Teacher reviews and delivers an assessment as a tutor turn', ({ given, and, when, then }) => {
    const state = makeState();
    given('the transfer assessment policy is enabled for a new learner-owned checklist', () => expectBackground(state));
    and('the checklist uses the existing status and understanding_level pair', () => expect(isValidTransferProgress(state.progress)).toBe(true));
    given('the tutor has generated a structured transfer assessment draft', async () => {
      await mountTeacherRoom(state);
      await act(async () => {
        await state.room!.generateAIResponse();
      });
      state.draft = preparedCandidate as unknown as Record<string, unknown>;
      expect(state.room!.transferDraft?.decision).toEqual(preparedCandidate);
    });
    and('the draft contains four options labelled A, B, C, and D', () => {
      expect(preparedCandidate.assessment.options.map((option) => option.id)).toEqual(['A', 'B', 'C', 'D']);
    });
    when('the teacher reviews and explicitly sends the draft', async () => {
      const privateRow = {
        ...deliveredQuestionRow,
        assessment: {
          ...deliveredQuestionRow.assessment,
          correct_option_ids: PRIVATE_ASSESSMENT_KEY,
          transfer_basis: preparedCandidate.assessment.transfer_basis,
        },
      };
      const service = serviceFor({
        message: privateRow,
        room: { ...transferRoom, active_response_mode: 'tutoring' },
      }, state);
      state.delivered = await service.sendReviewed({
        reviewedPayload: preparedCandidate,
        roomId: transferRoom.id,
        studentId: preparedTurnResult.student_id,
        checklistId: CHECKLIST_ID,
        itemId: CHECKLIST_ITEM_ID,
        focusStudentMessageId: LEARNER_A_MESSAGE_ID,
      }) as unknown as Record<string, unknown>;
      state.sendReviewedSpy!.mockResolvedValue(state.delivered);
      await act(async () => {
        await state.room!.confirmTransferDraft(preparedCandidate);
      });
      expect(state.sendReviewedSpy).toHaveBeenCalledWith({
        reviewedPayload: preparedCandidate,
        roomId: transferRoom.id,
        studentId: preparedTurnResult.student_id,
        checklistId: CHECKLIST_ID,
        itemId: CHECKLIST_ITEM_ID,
        focusStudentMessageId: LEARNER_A_MESSAGE_ID,
      });
      expect(state.room!.messages.some((message) => message.id === DELIVERED_QUESTION_ID)).toBe(true);
    });
    then('the delivered tutor message has response_mode assessment', () => {
      const message = state.delivered?.message as Record<string, unknown>;
      expect(message.response_mode).toBe('assessment');
    });
    and('the room participation mode remains tutoring', () => {
      expect((state.delivered?.room as Record<string, unknown>).active_response_mode).toBe('tutoring');
    });
    and('the learner can see only the stem, instruction, and four options', () => {
      const message = state.delivered?.message as Record<string, unknown>;
      const view = projectRoomMessage(message);
      expect(view.publicQuestion).toMatchObject({
        id: DELIVERED_QUESTION_ID,
        stem: preparedCandidate.assessment.stem,
        options: preparedCandidate.assessment.options,
      });
      expect(view.publicQuestion).not.toHaveProperty('correct_option_ids');
      expect(view.publicQuestion).not.toHaveProperty('transfer_basis');
    });
    and('the answer key, transfer basis, and model rationale remain private', () => {
      const serialized = JSON.stringify(state.delivered);
      expect(serialized).not.toContain('correct_option_ids');
      expect(serialized).not.toContain('transfer_basis');
      expect(serialized).not.toContain('raw_model_output');
    });
  });

  test('A correct first delivered answer passes by exact selection', ({ given, and, when, then }) => {
    const state = makeState();
    given('the transfer assessment policy is enabled for a new learner-owned checklist', () => expectBackground(state));
    and('the checklist uses the existing status and understanding_level pair', () => expect(isValidTransferProgress(state.progress)).toBe(true));
    given('a delivered single-answer assessment has answer key B', () => {
      state.progress = PARTIAL_PROGRESS;
      state.lifecycle = makeLifecycle(state.progress);
      state.assessment = makeAssessment();
    });
    when('the learner submits "B?" with an optional explanation', () => {
      state.result = resolveSelection(state, 'B? because I would verify it in the official app.', DELIVERED_ANSWER_ID);
    });
    then('the answer is graded as correct without requiring confidence', () => {
      expect(state.result?.disposition).toBe('passed');
      expect(state.result?.attempt_snapshot.accepted_attempt_count).toBe(1);
    });
    and('the assessment resolves exactly once', () => {
      expect(state.result?.attempt_snapshot.resolution).toBe('passed');
      expect(state.result?.attempt_snapshot.processed_answer_message_ids).toEqual([DELIVERED_ANSWER_ID]);
    });
    and('a later guess cannot create a second grade', () => {
      const replay = resolveSelection(state, 'A', 'later-guess');
      expect(replay.disposition).toBe('duplicate');
      expect(replay.applied_transition).toBeNull();
      expect(replay.attempt_snapshot.accepted_attempt_count).toBe(1);
    });
  });

  test('An incorrect first selection leaves one attempt', ({ given, and, when, then }) => {
    const state = makeState();
    given('the transfer assessment policy is enabled for a new learner-owned checklist', () => expectBackground(state));
    and('the checklist uses the existing status and understanding_level pair', () => expect(isValidTransferProgress(state.progress)).toBe(true));
    given('a delivered single-answer assessment has answer key B and two attempts available', () => {
      state.progress = PARTIAL_PROGRESS;
      state.lifecycle = makeLifecycle(state.progress);
    });
    when('the learner submits A as the first valid selection', () => {
      state.result = resolveSelection(state, 'A', DELIVERED_ANSWER_ID);
    });
    then('the assessment remains open with one attempt remaining', () => {
      expect(state.result?.disposition).toBe('retryable');
      expect(state.result?.attempt_snapshot.resolution).toBe('open');
      expect(state.result?.remaining_attempts).toBe(1);
    });
    and('the learner progress pair remains partially_covered with understanding_level basic', () => {
      expect(state.result?.progress).toEqual(PARTIAL_PROGRESS);
    });
    and('no answer key or terminal explanation is disclosed', () => {
      expect(state.result).not.toHaveProperty('terminal_feedback');
      expect(state.result).not.toHaveProperty('learner_feedback_authorized');
    });
  });

  test('A correct second selection passes after an incorrect first selection', ({ given, and, when, then }) => {
    const state = makeState();
    given('the transfer assessment policy is enabled for a new learner-owned checklist', () => expectBackground(state));
    and('the checklist uses the existing status and understanding_level pair', () => expect(isValidTransferProgress(state.progress)).toBe(true));
    given('a delivered single-answer assessment has answer key B', () => {
      state.progress = PARTIAL_PROGRESS;
      state.lifecycle = makeLifecycle(state.progress);
    });
    and("the learner's first valid selection A was incorrect with one attempt remaining", () => {
      state.firstResult = resolveSelection(state, 'A', DELIVERED_ANSWER_ID);
      expect(state.firstResult.disposition).toBe('retryable');
      expect(state.firstResult.remaining_attempts).toBe(1);
    });
    when('the learner submits B as the second valid selection', () => {
      state.result = resolveSelection(state, 'B', 'answer-2');
    });
    then('the assessment passes with no attempts remaining', () => {
      expect(state.result?.disposition).toBe('passed');
      expect(state.result?.remaining_attempts).toBe(0);
    });
    and('the learner progress pair becomes covered with understanding_level good', () => {
      expect(state.result?.progress).toEqual({ status: 'covered', understanding_level: 'good' });
    });
    and('assessment_pass is applied exactly once', () => {
      expect(state.result?.applied_transition).toBe('assessment_pass');
      const replay = resolveTransferAnswer(state.lifecycle, {
        delivered: true,
        answer_message_id: 'answer-2',
        content: 'B',
        assessment: state.assessment,
      });
      expect(replay.disposition).toBe('duplicate');
      expect(replay.applied_transition).toBeNull();
    });
  and('the answer key remains private to the teacher', () => {
      const lifecycle = answerLifecycleFromProcessed(processedCorrectTerminal);
      expect(lifecycle.state).toBe('passed');
      expect(lifecycle.terminalFailureFeedback).toBeNull();
    });
  });

  test('Two incorrect selections fail and disclose the answer', ({ given, and, when, then }) => {
    const state = makeState();
    given('the transfer assessment policy is enabled for a new learner-owned checklist', () => expectBackground(state));
    and('the checklist uses the existing status and understanding_level pair', () => expect(isValidTransferProgress(state.progress)).toBe(true));
    given('a delivered single-answer assessment has answer key B', () => {
      state.progress = PARTIAL_PROGRESS;
      state.lifecycle = makeLifecycle(state.progress);
    });
    and("the learner's first valid selection A was incorrect with one attempt remaining", () => {
      state.firstResult = resolveSelection(state, 'A', DELIVERED_ANSWER_ID);
      expect(state.firstResult.disposition).toBe('retryable');
    });
    when('the learner submits C as the second valid selection', () => {
      state.result = resolveSelection(state, 'C', 'answer-2');
    });
    then('the assessment fails with no attempts remaining', () => {
      expect(state.result?.disposition).toBe('failed');
      expect(state.result?.remaining_attempts).toBe(0);
    });
    and('the learner progress pair becomes needs_review with understanding_level basic', () => {
      expect(state.result?.progress).toEqual({ status: 'needs_review', understanding_level: 'basic' });
    });
    and('assessment_fail is applied exactly once', () => {
      expect(state.result?.applied_transition).toBe('assessment_fail');
      const replay = resolveTransferAnswer(state.lifecycle, {
        delivered: true,
        answer_message_id: 'answer-2',
        content: 'C',
        assessment: state.assessment,
      });
      expect(replay.disposition).toBe('duplicate');
      expect(replay.applied_transition).toBeNull();
    });
    and('the learner receives the correct option B and a learner-safe explanation', () => {
      expect(state.result?.terminal_feedback).toEqual({
        correct_option_ids: ['B'],
        learner_safe_explanation: 'Verify the request through a trusted channel.',
      });
      expect(answerLifecycleFromProcessed(processedSecondIncorrectTerminal).terminalFailureFeedback)
        .toEqual(processedSecondIncorrectTerminal.terminal_failure_feedback);
    });
    and('a later guess cannot create a third attempt or grade', () => {
      const laterGuess = resolveSelection(state, 'B', 'third-guess');
      expect(laterGuess.disposition).toBe('duplicate');
      expect(laterGuess.attempt_snapshot.accepted_attempt_count).toBe(2);
      expect(laterGuess.applied_transition).toBeNull();
    });
  });

  test('Reload and duplicate tabs preserve the accepted attempt count', ({ given, and, when, then }) => {
    const state = makeState();
    given('the transfer assessment policy is enabled for a new learner-owned checklist', () => expectBackground(state));
    and('the checklist uses the existing status and understanding_level pair', () => expect(isValidTransferProgress(state.progress)).toBe(true));
    given('a delivered single-answer assessment has answer key B', () => {
      state.progress = PARTIAL_PROGRESS;
      state.lifecycle = makeLifecycle(state.progress);
    });
    and("the learner's first valid selection A was incorrect with one attempt remaining", () => {
      state.firstResult = resolveSelection(state, 'A', DELIVERED_ANSWER_ID);
      expect(state.firstResult.disposition).toBe('retryable');
    });
    when('the learner reloads the room or opens the same assessment in another tab', () => {
      const restored = answerLifecycleFromProcessed(processedFirstIncorrectRetry);
      expect(restored.attemptsUsed).toBe(1);
      expect(restored.attemptsRemaining).toBe(1);
      state.lifecycle = makeLifecycle(
        state.firstResult!.progress,
        state.firstResult!.attempt_snapshot.accepted_attempt_count,
        [...state.firstResult!.attempt_snapshot.processed_answer_message_ids],
        state.firstResult!.attempt_snapshot.resolution
      );
    });
    then('both views show one attempt remaining from the persisted assessment state', () => {
      const viewOne = answerLifecycleFromProcessed(processedFirstIncorrectRetry);
      const viewTwo = answerLifecycleFromProcessed(processedFirstIncorrectRetry);
      expect(viewOne.attemptsRemaining).toBe(1);
      expect(viewTwo.attemptsRemaining).toBe(1);
    });
    when('the first answer is replayed or both tabs submit the same answer message', () => {
      state.result = resolveSelection(state, 'A', DELIVERED_ANSWER_ID);
    });
    then('the accepted attempt count remains one', () => {
      expect(state.result?.attempt_snapshot.accepted_attempt_count).toBe(1);
      expect(state.result?.disposition).toBe('duplicate');
    });
    and('the learner still has only one valid selection available', () => {
      expect(state.result?.remaining_attempts).toBe(1);
    });
  });

  test('Ambiguity and assistance do not create a failing grade', ({ given, and, when, then }) => {
    const state = makeState();
    given('the transfer assessment policy is enabled for a new learner-owned checklist', () => expectBackground(state));
    and('the checklist uses the existing status and understanding_level pair', () => expect(isValidTransferProgress(state.progress)).toBe(true));
    given('a delivered multiple-answer assessment has answer key B and D', () => {
      state.progress = PARTIAL_PROGRESS;
      state.lifecycle = makeLifecycle(state.progress);
      state.assessment = makeAssessment('multiple');
    });
    when('the learner submits "B or D"', () => {
      state.result = resolveSelection(state, 'B or D', DELIVERED_ANSWER_ID);
    });
    then('the assessment remains unresolved and the tutor may clarify the format', () => {
      expect(state.result?.disposition).toBe('unresolved');
      expect(state.result?.clarification_code).toBe('AMBIGUOUS_SELECTION');
      expect(state.result?.attempt_snapshot.accepted_attempt_count).toBe(0);
    });
    when('the learner receives content help that could reveal the solution', () => {
      state.result = resolveSelection(state, 'Can you explain how to check whether the sender is genuine?', 'help-request');
    });
    then('the assessment is cancelled as assisted without issuing a failing grade', () => {
      expect(state.result?.disposition).toBe('assisted');
      expect(state.result?.applied_transition).toBeNull();
      expect(state.result?.attempt_snapshot.accepted_attempt_count).toBe(0);
      expect(state.result?.progress).toEqual(PARTIAL_PROGRESS);
    });
  });

  test('An unsent assessment is not delivered or gradable', ({ given, and, when, then }) => {
    const state = makeState();
    given('the transfer assessment policy is enabled for a new learner-owned checklist', () => expectBackground(state));
    and('the checklist uses the existing status and understanding_level pair', () => expect(isValidTransferProgress(state.progress)).toBe(true));
    given('the tutor has generated an assessment draft', () => {
      state.draft = preparedCandidate as unknown as Record<string, unknown>;
    });
    and('the teacher has not sent the draft', () => {
      expect(state.serviceCalls).toHaveLength(0);
    });
    when('the learner submits an option in the existing chat', () => {
      state.result = resolveTransferAnswer(state.lifecycle, {
        delivered: false,
        answer_message_id: DELIVERED_ANSWER_ID,
        content: 'B',
        assessment: state.assessment,
      });
    });
    then('the option is not graded', () => {
      expect(state.result?.disposition).toBe('not_delivered');
      expect(state.result?.attempt_snapshot.accepted_attempt_count).toBe(0);
    });
    and('no assessment feedback is created', () => {
      expect(state.result).not.toHaveProperty('terminal_feedback');
      expect(state.result?.feedback_required).toBe(false);
    });
    and('the learner progress pair is unchanged', () => {
      expect(state.result?.progress).toEqual(state.lifecycle.progress);
    });
  });

  test('Feedback precedes another assessment', ({ given, and, when, then }) => {
    const state = makeState();
    given('the transfer assessment policy is enabled for a new learner-owned checklist', () => expectBackground(state));
    and('the checklist uses the existing status and understanding_level pair', () => expect(isValidTransferProgress(state.progress)).toBe(true));
    given('the learner has answered and resolved one delivered assessment', () => {
      state.progress = PARTIAL_PROGRESS;
      state.lifecycle = makeLifecycle(state.progress);
      state.result = resolveSelection(state, 'B', DELIVERED_ANSWER_ID);
      expect(state.result.disposition).toBe('passed');
    });
    when('the tutor generates the next response', async () => {
      await mountTeacherRoom(state);
      state.prepareSpy!.mockResolvedValue(null);
      (generateTutorSuggestion as jest.Mock).mockResolvedValue({
        success: true,
        suggestion: 'You used independent verification instead of trusting the display name.',
        decision: {
          mode: 'tutoring',
          instruction: 'consolidation',
          suggested_response: 'You used independent verification instead of trusting the display name.',
        },
        contextMessages: [LEARNER_A_MESSAGE_ID],
      });
      await act(async () => {
        await state.room!.generateAIResponse();
      });
      const decision = state.room!.aiDecision as unknown as Record<string, unknown>;
      state.tutorTurn = {
        mode: String(decision.mode),
        instruction: String(decision.instruction),
        response: state.room!.aiSuggestion || '',
      };
    });
    then('the next response is tutoring feedback or an independently required Guard response', () => {
      expect(state.tutorTurn?.mode).toBe('tutoring');
      expect(state.tutorTurn?.instruction).toBe('consolidation');
      expect(state.tutorTurn?.response).toMatch(/verification/i);
    });
    and('it contains no new assessment payload', () => {
      expect(state.room?.transferDraft).toBeNull();
      expect(JSON.stringify(state.room?.aiDecision)).not.toContain('assessment');
    });
    and('another assessment is not eligible until the feedback turn is delivered', () => {
      expect(state.prepareSpy).toHaveBeenCalledTimes(1);
      expect(generateTutorSuggestion).toHaveBeenCalledTimes(1);
      expect(state.result?.feedback_required).toBe(true);
    });
  });

  test('Verification and later contradiction update the same progress authority', ({ given, and, when, then }) => {
    const state = makeState();
    given('the transfer assessment policy is enabled for a new learner-owned checklist', () => expectBackground(state));
    and('the checklist uses the existing status and understanding_level pair', () => expect(isValidTransferProgress(state.progress)).toBe(true));
    given('the learner demonstrates the concept in a meaningfully changed context', () => {
      state.progress = PARTIAL_PROGRESS;
      expect(learnerAMessageRow.content).not.toBe(preparedCandidate.assessment.transfer_basis.changed_context);
    });
    when('the tutor records spontaneous transfer', () => {
      const event = applyLearningEvent(state.progress, 'spontaneous_transfer');
      expect(event.disposition).toBe('apply');
      if (event.disposition === 'apply') state.progress = event.next;
    });
    then('the concept becomes covered with understanding_level good without requiring a quiz', () => {
      expect(state.progress).toEqual({ status: 'covered', understanding_level: 'good' });
    });
    when('a later learner message genuinely contradicts that understanding', () => {
      const event = applyLearningEvent(state.progress, 'contradiction');
      expect(event.disposition).toBe('apply');
      if (event.disposition === 'apply') state.progress = event.next;
    });
    then('the concept reopens as needs_review with understanding_level basic', () => {
      expect(state.progress).toEqual({ status: 'needs_review', understanding_level: 'basic' });
    });
    and('the tutor does not routinely reassess an already verified concept without new contradictory evidence', () => {
      const verified = applyLearningEvent({ status: 'covered', understanding_level: 'good' }, 'spontaneous_transfer');
      expect(verified.disposition).toBe('no_change');
      if (verified.disposition !== 'no_change') throw new Error('Expected unchanged verified progress');
      expect(verified.next).toEqual({ status: 'covered', understanding_level: 'good' });
    });
  });

  test('A transfer room waits for approved learning targets', ({ given, and, when, then }) => {
    const state = makeState();
    given('the transfer assessment policy is enabled for a new learner-owned checklist', () => expectBackground(state));
    and('the checklist uses the existing status and understanding_level pair', () => expect(isValidTransferProgress(state.progress)).toBe(true));
    given('a transfer-enabled room has no approved learning targets', () => {
      expect(transferRoom.transfer_learning_enabled).toBe(true);
    });
    when('the teacher opens the room', async () => {
      await mountTeacherRoom(state, {
        checklist: { ...transferChecklist, detection_areas: [], verification_steps: [] },
        page: true,
      });
    });
    then('the room shows the learning-target setup reminder', () => {
      expect(screen.getByRole('status')).toHaveTextContent(/learning targets/i);
    });
    and('no transfer assessment is prepared', () => {
      expect(state.prepareSpy).not.toHaveBeenCalled();
      expect(state.room?.transferDraft).toBeNull();
    });
  });

  test('An eligible assessment bypasses the shared tutor', ({ given, and, when, then }) => {
    const state = makeState();
    given('the transfer assessment policy is enabled for a new learner-owned checklist', () => expectBackground(state));
    and('the checklist uses the existing status and understanding_level pair', () => expect(isValidTransferProgress(state.progress)).toBe(true));
    given('approved room targets and learner-owned evidence make one target eligible', () => {
      state.progress = PARTIAL_PROGRESS;
      expect(createReviewCandidate(preparedTurnResult)?.scope.itemId).toBe(CHECKLIST_ITEM_ID);
    });
    and('no Guard, protection, correction, feedback, or repair blocker applies', () => {
      expect(state.lifecycle.participation_mode).toBe('tutoring');
      expect(state.lifecycle.feedback_required).toBe(false);
      expect(state.lifecycle.pending_repair_message_id).toBeNull();
    });
    when('the teacher requests the next AI-generated response', async () => {
      await mountTeacherRoom(state);
      await act(async () => {
        await state.room!.generateAIResponse();
      });
      state.draft = state.room!.transferDraft?.decision as unknown as Record<string, unknown> ?? null;
    });
    then('TransferLearning prepares one assessment-only draft', () => {
      expect(state.room?.transferDraft?.decision).toEqual(preparedCandidate);
      expect(state.prepareSpy).toHaveBeenCalledTimes(1);
    });
    and('the shared tutor is not called', () => {
      expect(generateTutorSuggestion).not.toHaveBeenCalled();
    });
  });
});
