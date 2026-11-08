#!/usr/bin/env node
/**
 * Test responsible for the page-level transfer lifecycle states and download controls in
 * src/pages/RoomPagePost.tsx: preparation and delivery outcomes, plus TXT/JSON export selection.
 *
 * Responsibility: prove a teacher sees preparation, stale, retryable, and unavailable states,
 * catches up from persisted messages after a stale conflict, and a learner sees server-reported
 * remaining chances after the room page is mounted from persisted lifecycle state.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPagePost from '../RoomPagePost';
import { useAuth } from '../../contexts/AuthContext';
import { useRoom } from '../../contexts/RoomContext';
import { ChecklistService } from '../../services/checklistService';
import { transferAssessmentService } from '../../services/transferAssessmentService';
import {
  answerLifecycleFromProcessed,
  projectRoomMessage,
  withAnswerLifecycle,
} from '../../contexts/transferAssessmentUiAdapter';
import {
  DELIVERED_ANSWER_ID,
  DELIVERED_QUESTION_ID,
  LEARNER_A_MESSAGE_ID,
  TRANSFER_ROOM_ID,
  deliveredPublicAssessment,
  deliveredAnswerRow,
  deliveredQuestionRow,
  learnerAUser,
  learnerAMessageRow,
  preparedCandidate,
  transferRoom,
  transferChecklist,
  assessmentResultMessage,
} from '../../test-support/transferRoomFixtures';
import type { Message } from '../../types';

jest.mock('../../contexts/AuthContext');
jest.mock('../../contexts/RoomContext');
jest.mock('../../components/ChecklistPanel', () => function MockChecklistPanel() {
  return <div data-testid="checklist-panel" />;
});
jest.mock('../../components/AIAssistantSettings', () => function MockAIAssistantSettings() {
  return <div data-testid="ai-settings-modal" />;
});
jest.mock('../../components/StudentAIToneControl', () => function MockStudentAIToneControl() {
  return <div data-testid="student-ai-tone" />;
});
jest.mock('../../components/RoomPost', () => function MockRoomPost() {
  return <div data-testid="room-post" />;
});
jest.mock('../../components/AISuggestionBox', () => function MockAISuggestionBox() {
  return <div data-testid="ai-suggestion-box" />;
});

const learnerMessage: Message = {
  id: LEARNER_A_MESSAGE_ID,
  room_id: TRANSFER_ROOM_ID,
  user_id: 'learner-a',
  content: learnerAMessageRow.content,
  user_role: 'student',
  is_ai_generated: false,
  ai_model_used: null,
  ai_response_time_ms: null,
  parent_message_id: null,
  created_at: learnerAMessageRow.created_at,
  display_name: 'Learner A',
};

const transferDraft = {
  decision: preparedCandidate,
  progressSnapshotHash: 'snapshot-hash-abc',
  roomId: TRANSFER_ROOM_ID,
  studentId: 'learner-a',
  checklistId: 'checklist-1',
  itemId: 'item-1' as string | null,
  focusStudentMessageId: LEARNER_A_MESSAGE_ID,
};

describe('RoomPagePost transfer lifecycle states', () => {
  let generateAIResponse: jest.Mock;
  let downloadChatHistory: jest.Mock;
  let alertSpy: jest.SpyInstance;

  const mount = (overrides: Record<string, unknown> = {}, hashRouter = false) => {
    (useRoom as jest.Mock).mockReturnValue({
      currentRoom: { ...transferRoom, ai_assistant_enabled: true },
      messages: [learnerMessage],
      participants: [],
      loading: false,
      loadingAI: false,
      typingUsers: [],
      joinRoom: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn(),
      sendMessage: jest.fn().mockResolvedValue(undefined),
      generateAIResponse,
      regenerateAIResponse: jest.fn(),
      startTyping: jest.fn(),
      stopTyping: jest.fn(),
      aiConfig: { model_name: 'qwen3.5-flash', prompt_config: null },
      downloadChatHistory,
      clearChatHistory: jest.fn(),
      transferDraft: null,
      confirmTransferDraft: jest.fn().mockResolvedValue(undefined),
      clearAISuggestion: jest.fn(),
      aiSuggestion: null,
      finalGuardMode: false,
      messageFeedbackStats: {},
      ...overrides,
    });

    const content = (
        <Routes>
          <Route path="/room/:roomId" element={<RoomPagePost />} />
          <Route path="/" element={<p>Dashboard destination</p>} />
        </Routes>
    );
    return render(hashRouter ? <HashRouter>{content}</HashRouter>
      : <MemoryRouter initialEntries={[`/room/${TRANSFER_ROOM_ID}`]}>{content}</MemoryRouter>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() });
    alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    generateAIResponse = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(transferAssessmentService, 'joinRoom').mockResolvedValue({ room_role: 'learner' } as never);
    downloadChatHistory = jest.fn();
    // The generate control is the room's AI button; it is enabled for a tutor in an AI room.
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'tutor-1',
        display_name: 'Tutor',
        current_role: 'tutor',
        status: 'active',
        created_at: '2026-09-12T08:00:00Z',
        updated_at: '2026-09-12T08:00:00Z',
      },
      loading: false,
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // RoomPagePost.tsx: targets synchronized after learner join clear waiting without a reload or new message.
  it('refreshes learner target readiness and stops polling when targets arrive', async () => {
    jest.useFakeTimers();
    const readTargets = jest.spyOn(ChecklistService, 'getChecklistForStudent')
      .mockResolvedValueOnce(null).mockResolvedValueOnce(transferChecklist as never);
    (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
    mount();
    await act(async () => undefined);
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for the tutor');
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(screen.queryByText('Waiting for the tutor to set up learning targets.')).not.toBeInTheDocument();
    expect(readTargets).toHaveBeenCalledTimes(2);
    await act(async () => { jest.advanceTimersByTime(9000); });
    expect(readTargets).toHaveBeenCalledTimes(2);
  });

  // RoomPagePost.tsx: failed readiness reads retry, but leaving the room cancels scheduled checks.
  it('retries failed learner readiness reads and cancels polling on unmount', async () => {
    jest.useFakeTimers();
    const readTargets = jest.spyOn(ChecklistService, 'getChecklistForStudent')
      .mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue(null);
    (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
    const { unmount } = mount();
    await act(async () => undefined);
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for the tutor');
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(readTargets).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => { jest.advanceTimersByTime(9000); });
    expect(readTargets).toHaveBeenCalledTimes(2);
  });

  it('shows a preparing state while a transfer turn is being prepared', () => {
    mount({ loadingAI: true, transferDraft: null });

    expect(screen.getByText('Preparing the transfer turn…')).toBeInTheDocument();
    expect(screen.getByText('Preparing the transfer turn…')).toHaveAttribute('data-transfer-status', 'preparing');
  });

  it('shows an unavailable state when the capability is disabled', async () => {
    generateAIResponse.mockRejectedValue(new Error('ASSESSMENT_FEATURE_DISABLED: Transfer assessment is disabled'));
    mount();

    fireEvent.click(screen.getByTitle(/Generate AI Response/));

    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="unavailable"]')).not.toBeNull();
    });
  });

  it('catches up from persisted room state when a transfer turn is stale', async () => {
    generateAIResponse.mockRejectedValue(new Error('ASSESSMENT_ALREADY_OPEN: assessment already delivered'));
    let finishCatchUp: (() => void) | null = null;
    const joinRoom = jest.fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        finishCatchUp = () => resolve();
      }));
    mount({ joinRoom });

    fireEvent.click(screen.getByTitle(/Generate AI Response/));

    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="catching-up"]')).not.toBeNull();
    });
    await act(async () => {
      finishCatchUp?.();
    });
    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="stale"]')).not.toBeNull();
    });
    expect(screen.getByText(/refreshed after a transfer conflict/)).toBeInTheDocument();
    expect(joinRoom).toHaveBeenCalledWith(TRANSFER_ROOM_ID);
  });

  it('keeps room catch-up retryable until persisted state can be refreshed', async () => {
    const joinRoom = jest.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce(undefined);
    generateAIResponse.mockRejectedValue(new Error('temporary transfer service failure'));
    mount({ joinRoom });

    fireEvent.click(screen.getByTitle(/Generate AI Response/));

    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="retryable"]')).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh room state' }));
    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="retryable"]')).not.toBeNull();
      expect(joinRoom).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Refresh room state' }));
    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="caught-up"]')).not.toBeNull();
    });
    expect(joinRoom).toHaveBeenCalledTimes(3);
  });

  it('refreshes saved room state when preparation is superseded by another learner focus', async () => {
    generateAIResponse.mockRejectedValue(new Error('WRONG_LEARNER: focus message belongs to another learner'));
    mount();

    fireEvent.click(screen.getByTitle(/Generate AI Response/));

    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="stale"]')).not.toBeNull();
    });
    expect(screen.queryByText('Review transfer assessment')).not.toBeInTheDocument();
  });

  it('keeps the reviewed candidate instead of a lifecycle state while it is open', () => {
    mount({ transferDraft });

    expect(screen.getByRole('heading', { name: 'Review transfer assessment' })).toBeInTheDocument();
    expect(document.querySelector('[data-transfer-status]')).toBeNull();
  });

  it('submits the public question parent ID and assessment ID separately', async () => {
    const questionMessageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const question = projectRoomMessage(
      { ...deliveredQuestionRow, id: questionMessageId },
      deliveredPublicAssessment
    );
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
    mount({ messages: [question], sendMessage });

    expect(screen.getByRole('textbox')).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Submit answer' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Back to Dashboard/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /A\./ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
    });

    expect(sendMessage).toHaveBeenCalledWith('A', {
      replyToMessageId: questionMessageId,
      assessmentId: DELIVERED_QUESTION_ID,
      selectedOptionIds: ['A'],
    });
  });

  // RoomPagePost.tsx: browser navigation and reload cannot silently skip an open exit question.
  it('intercepts browser Back and prompts before unloading only while questions remain open', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
    const { unmount } = mount({ messages: [projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment)] });
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
    fireEvent(window, new PopStateEvent('popstate'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    unmount();
    const afterUnmount = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });

  // RoomPagePost.tsx: exercise real hash-history traversal and resume its blocked destination after completion.
  it('resumes actual HashRouter Back navigation after the last question closes', async () => {
    const originalUrl = window.location.href;
    window.history.replaceState(null, '', '#/');
    window.history.pushState(null, '', `#/room/${TRANSFER_ROOM_ID}`);
    (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
    const question = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    const view = mount({ messages: [question] }, true);
    act(() => window.history.back());
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(window.location.hash).toBe(`#/room/${TRANSFER_ROOM_ID}`);
    (useRoom as jest.Mock).mockReturnValue({ ...(useRoom as jest.Mock).mock.results.slice(-1)[0].value,
      messages: [{ ...question, publicQuestion: { ...question.publicQuestion!, lifecycle: 'passed' } }] });
    view.rerender(<HashRouter><Routes>
      <Route path="/room/:roomId" element={<RoomPagePost />} />
      <Route path="/" element={<p>Dashboard destination</p>} />
    </Routes></HashRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    await waitFor(() => expect(screen.getByText('Dashboard destination')).toBeInTheDocument());
    view.unmount();
    window.history.replaceState(null, '', originalUrl);
  });

  // RoomPagePost.tsx: hidden exit questions do not block either ordinary posting or rating's resumed send.
  it('resumes a rated draft while an unseen exit question is open', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    const submitMessageFeedback = jest.fn().mockResolvedValue(undefined);
    mount({ messages: [{ ...learnerMessage, id: 'tutor-response', user_id: 'tutor-1', user_role: 'tutor', content: 'Tutor response' },
      projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment)], sendMessage, submitMessageFeedback });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My ordinary reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send comment' }));
    expect(sendMessage).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Tutor response');
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent(deliveredPublicAssessment.stem);
    fireEvent.click(screen.getByRole('button', { name: 'Helpful' }));
    fireEvent.click(screen.getByRole('button', { name: '4 stars' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit rating and send' })));
    expect(submitMessageFeedback).toHaveBeenCalledWith('tutor-response', 'like', 4);
    expect(sendMessage).toHaveBeenCalledWith('My ordinary reply', { replyToMessageId: undefined });
  });

  // RoomPagePost.tsx: failed transport leaves the quiz open and lets the learner retry under Guard.
  it('keeps Guard waiting and allows retry after an answer transport error', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
    const sendMessage = jest.fn().mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValue(undefined);
    mount({ currentRoom: { ...transferRoom, guard_mode: true }, messages: [projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment)], sendMessage });
    fireEvent.click(screen.getByRole('link', { name: /Back to Dashboard/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Waiting for your tutor to turn Guard off.');
    fireEvent.click(screen.getByRole('radio', { name: /A\./ }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit answer' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Your answer could not be submitted.');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit answer' })));
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // RoomPagePost.tsx: an exit asks every open question in delivery order and retains final feedback until Next.
  it('answers two exit questions in delivery order before allowing Leave', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
    const first = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    const second = projectRoomMessage({ ...deliveredQuestionRow, id: 'question-2', created_at: '2026-09-12T09:20:00Z' },
      { ...deliveredPublicAssessment, id: 'assessment-2', stem: 'Second exit question' });
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    const view = mount({ messages: [second, first], sendMessage });
    fireEvent.click(screen.getByRole('link', { name: /Back to Dashboard/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Question 1 of 2');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Second exit question');
    fireEvent.click(screen.getByRole('radio', { name: /A\./ }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit answer' })));
    expect(sendMessage).toHaveBeenCalledWith('A', expect.objectContaining({ assessmentId: DELIVERED_QUESTION_ID }));
    const updateMessages = (messages: Message[]) => {
      (useRoom as jest.Mock).mockReturnValue({ ...(useRoom as jest.Mock).mock.results.slice(-1)[0].value, messages });
      view.rerender(<MemoryRouter initialEntries={[`/room/${TRANSFER_ROOM_ID}`]}><Routes>
        <Route path="/room/:roomId" element={<RoomPagePost />} />
        <Route path="/" element={<p>Dashboard destination</p>} />
      </Routes></MemoryRouter>);
    };
    const passed = { ...first, publicQuestion: { ...first.publicQuestion!, lifecycle: 'passed' as const } };
    updateMessages([passed, second]);
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Second exit question');
    expect(screen.getByRole('dialog')).toHaveTextContent('Question 2 of 2');
    const failed = { ...second, publicQuestion: { ...second.publicQuestion!, lifecycle: 'failed' as const } };
    updateMessages([passed, failed]);
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByText('Dashboard destination')).toBeInTheDocument();
  });

  it('renders persisted remaining chances after the page is mounted from saved messages', () => {
    const question = withAnswerLifecycle(
      projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment),
      answerLifecycleFromProcessed({
        result_message: null,
        message_id: DELIVERED_ANSWER_ID,
        assessment_id: DELIVERED_QUESTION_ID,
        processing_state: 'applied',
        answer_outcome: 'retry',
        attempt_number: 1,
        attempts_used: 1,
        attempts_remaining: 1,
        selected_option_ids: ['A'],
        terminal: false,
        transition: null,
        code: null,
        feedback_required: false,
        already_processed: true,
        terminal_failure_feedback: null,
      })
    );
    (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
    mount({ messages: [question,projectRoomMessage(assessmentResultMessage('retry',1,DELIVERED_ANSWER_ID) as unknown as Record<string,unknown>)] });

    expect(screen.queryByText('Incorrect. One attempt remaining.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Back to Dashboard/ }));
    expect(screen.getByText('Incorrect. One attempt remaining.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled();
    expect(screen.getByRole('textbox')).toBeEnabled();
    expect(screen.getAllByRole('radio')[0]).toBeEnabled();
  });

  // RoomPagePost.tsx: only the assessment owner is gated; tutors and other learners can continue discussion.
  it.each(['student', 'tutor'] as const)('leaves the composer available for a different %s', (role) => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { ...learnerAUser, id: 'another-user', current_role: role }, loading: false,
    });
    mount({ messages: [projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment)] });
    expect(screen.getByRole('textbox')).toBeEnabled();
    if (role === 'student') expect(screen.queryByRole('button', { name: 'Submit answer' })).not.toBeInTheDocument();
  });

  // RoomPagePost.tsx: persisted terminal question state releases discussion after a reload.
  it.each(['passed', 'failed', 'cancelled', 'legacy_incomplete'] as const)(
    'restores discussion when the saved question is %s', (lifecycle) => {
      (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
      mount({ messages: [projectRoomMessage({ ...deliveredQuestionRow, assessment_lifecycle: lifecycle }, deliveredPublicAssessment)] });
      expect(screen.getByRole('textbox')).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Submit answer' })).not.toBeInTheDocument();
    }
  );

  it('shows saved learner submissions inside their question instead of separate comments', () => {
    const question = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    const first = withAnswerLifecycle(
      projectRoomMessage({ ...deliveredAnswerRow, content: 'A' }),
      answerLifecycleFromProcessed({
        result_message: null,
        message_id: DELIVERED_ANSWER_ID,
        assessment_id: DELIVERED_QUESTION_ID,
        processing_state: 'applied',
        answer_outcome: 'retry',
        attempt_number: 1,
        attempts_used: 1,
        attempts_remaining: 1,
        selected_option_ids: ['A'],
        terminal: false,
        transition: null,
        feedback_required: false,
        code: null,
        already_processed: true,
        terminal_failure_feedback: null,
      })
    );
    const second = withAnswerLifecycle(
      projectRoomMessage({ ...deliveredAnswerRow, id: 'answer-2', content: 'B', created_at: '2026-09-12T09:16:00Z' }),
      answerLifecycleFromProcessed({
        result_message: null,
        message_id: 'answer-2',
        assessment_id: DELIVERED_QUESTION_ID,
        processing_state: 'applied',
        answer_outcome: 'passed',
        attempt_number: 2,
        attempts_used: 2,
        attempts_remaining: 0,
        selected_option_ids: ['B'],
        terminal: true,
        transition: null,
        feedback_required: false,
        code: null,
        already_processed: true,
        terminal_failure_feedback: null,
      })
    );
    (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
    const { container } = mount({ messages: [question, first, second,
      projectRoomMessage(assessmentResultMessage('retry',1,DELIVERED_ANSWER_ID) as unknown as Record<string,unknown>),
      projectRoomMessage(assessmentResultMessage('passed',2,'answer-2') as unknown as Record<string,unknown>)] });

    expect(container.querySelectorAll('.post-comment')).toHaveLength(3);
    expect(screen.getByText('Answer 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Correct.')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous answer' }));
    expect(screen.getByText('Incorrect. One attempt remaining.')).toBeInTheDocument();
  });

  it('keeps a plain reply visible while embedding a pending answer to the same question', () => {
    const question = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment);
    const reply = projectRoomMessage({
      ...deliveredAnswerRow,
      id: 'plain-reply',
      assessment_id: null,
      content: 'Can you explain this question?',
    });
    const pendingAnswer = projectRoomMessage({
      ...deliveredAnswerRow,
      id: 'pending-answer',
      assessment_id: DELIVERED_QUESTION_ID,
      content: 'A',
      created_at: '2026-09-12T09:16:00Z',
    });
    (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
    mount({ messages: [question, reply, pendingAnswer] });

    expect(screen.getByText('Can you explain this question?')).toBeInTheDocument();
    expect(screen.getByText(/Discussion \(1 message\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Back to Dashboard/ }));
    expect(screen.getByText('Answer 1 of 1')).toBeInTheDocument();
    expect(screen.getByText('Your answer is still processing.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled();
    expect(screen.getByRole('textbox')).toBeEnabled();
  });

  it('clears a previous lifecycle state when a new preparation starts and succeeds', async () => {
    generateAIResponse
      .mockRejectedValueOnce(new Error('ASSESSMENT_ALREADY_OPEN: assessment already delivered'))
      .mockResolvedValueOnce(undefined);
    mount();

    fireEvent.click(screen.getByTitle(/Generate AI Response/));
    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="stale"]')).not.toBeNull();
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle(/Generate AI Response/));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status]')).toBeNull();
    });
  });

  it('offers TXT and JSON downloads without offering PDF', () => {
    mount();

    fireEvent.click(screen.getByTitle('Download Chat History'));

    expect(screen.getByRole('heading', { name: 'Download Room Data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat History (TXT)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete Data (JSON)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'PDF' })).not.toBeInTheDocument();
  });

  it('requests a TXT export when the chat-history option is selected', () => {
    mount();

    fireEvent.click(screen.getByTitle('Download Chat History'));
    fireEvent.click(screen.getByRole('button', { name: 'Chat History (TXT)' }));

    expect(downloadChatHistory).toHaveBeenCalledWith('txt');
    expect(screen.queryByRole('heading', { name: 'Download Room Data' })).not.toBeInTheDocument();
  });

  it('requests a JSON export when the complete-data option is selected', () => {
    mount();

    fireEvent.click(screen.getByTitle('Download Chat History'));
    fireEvent.click(screen.getByRole('button', { name: 'Complete Data (JSON)' }));

    expect(downloadChatHistory).toHaveBeenCalledWith('json');
    expect(screen.queryByRole('heading', { name: 'Download Room Data' })).not.toBeInTheDocument();
  });
});
