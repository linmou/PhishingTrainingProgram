#!/usr/bin/env node
/**
 * Test responsible for the learner-visible Multi-agent playback in RoomPagePost: staged reveal at
 * T / T+2s, tag-free character rendering, submission blocking during playback, the Tutor rating
 * target for both character orders, and the two-card editor replacing the single-response box.
 */

import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPagePost from '../pages/RoomPagePost';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import type { Message, Room, User } from '../types';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../contexts/RoomContext', () => ({ useRoom: jest.fn() }));
jest.mock('../components/RoomPost', () => () => <div data-testid="room-post" />);
jest.mock('../components/AIAssistantSettings', () => () => <div data-testid="ai-settings" />);
jest.mock('../components/StudentAIToneControl', () => () => <div data-testid="student-tone" />);
jest.mock('../components/ChecklistPanel', () => () => <div data-testid="checklist" />);
jest.mock('../components/AISuggestionBox', () => () => <div data-testid="ai-suggestion-box" />);

const START = '2026-09-12T10:00:00.000Z';
const at = (offsetMs: number) => new Date(new Date(START).getTime() + offsetMs).toISOString();

const student: User = {
  id: 'student-1', display_name: 'Sam Student', current_role: 'student', email: 'sam@example.test',
  status: 'active', created_at: START, updated_at: START
};

const tutor: User = {
  id: 'tutor-1', display_name: 'Taylor Tutor', current_role: 'tutor', email: 'taylor@example.test',
  status: 'active', created_at: START, updated_at: START
};

const room: Room = {
  id: 'room-1', tutor_id: tutor.id, title: 'Multi-agent room', description: 'Playback behavior test',
  image_url: null, is_active: true, ai_assistant_enabled: true, ai_assistant_model: 'qwen3.5-flash',
  ai_assistant_prompt: 'prompt', op_id: null, op_display_name: null, op_avatar_url: null,
  password: null, created_at: START, updated_at: START
};

const learnerMessage: Message = {
  id: 'message-1', room_id: room.id, user_id: student.id, content: 'The logo looks familiar.',
  user_role: 'student', ai_model_used: null, ai_response_time_ms: null,
  parent_message_id: null, created_at: at(0), display_name: 'Sam Student'
} as Message;

const agentRow = (id: string, character: 'riley' | 'tutor', content: string, offsetMs: number): Message => {
  return {
    id, room_id: room.id, user_id: tutor.id, content: `[agent:${character}] ${content}`,
    user_role: 'tutor', ai_model_used: 'qwen3.5-flash', ai_response_time_ms: 900,
    parent_message_id: learnerMessage.id, created_at: at(offsetMs), response_mode: 'multiagent',
    display_name: 'Taylor Tutor', avatar_url: 'https://example.test/taylor.png'
  } as Message;
};

const RILEY_TEXT = 'The logo looks official, so I would trust it.';
const TUTOR_TEXT = 'A logo does not prove the sender. What could you verify yourself?';

let deliveredMessages: Message[] = [];

let forceHarnessRender: (() => void) | null = null;

/** Stable wrapper whose state bumps re-render the page tree without remounting it. */
const RoomHarness: React.FC = () => {
  const [, setTick] = React.useState(0);
  forceHarnessRender = () => setTick((tick) => tick + 1);
  return (
    <MemoryRouter initialEntries={['/room/room-1']}>
      <Routes>
        <Route path="/room/:roomId" element={<RoomPagePost />} />
      </Routes>
    </MemoryRouter>
  );
};

const renderRoom = (messages: Message[], overrides: Record<string, unknown> = {}) => {
  const sendMessage = jest.fn().mockResolvedValue(undefined);
  const { user = student, ...roomOverrides } = overrides as { user?: User } & Record<string, unknown>;
  deliveredMessages = messages;

  (useAuth as jest.Mock).mockReturnValue({ user, loading: false });
  (useRoom as jest.Mock).mockReturnValue({
    currentRoom: room,
    get messages() { return deliveredMessages; },
    participants: [tutor, student],
    loading: false,
    typingUsers: [],
    joinRoom: jest.fn(),
    leaveRoom: jest.fn(),
    sendMessage,
    generateAIResponse: jest.fn(),
    regenerateAIResponse: jest.fn(),
    startTyping: jest.fn(),
    stopTyping: jest.fn(),
    aiConfig: null,
    loadingAI: false,
    downloadChatHistory: jest.fn(),
    clearChatHistory: jest.fn(),
    aiSuggestion: null,
    aiDecision: null,
    transferDraft: null,
    confirmTransferDraft: jest.fn(),
    finalMode: 'tutoring',
    updateFinalResponse: jest.fn(),
    updateFinalMode: jest.fn(),
    setResponseMode: jest.fn(),
    clearAISuggestion: jest.fn(),
    recordAIFeedback: jest.fn(),
    currentSuggestionContext: null,
    multiAgentDraft: null,
    approveMultiAgentDraft: jest.fn(),
    regenerateMultiAgentDraft: jest.fn(),
    rejectMultiAgentDraft: jest.fn(),
    submitMessageFeedback: jest.fn(),
    messageFeedbackStats: {},
    ...roomOverrides
  });

  render(<RoomHarness />);

  /** Deliver a later poll batch to the same mounted page. */
  const deliver = (nextMessages: Message[]) => {
    deliveredMessages = nextMessages;
    forceHarnessRender?.();
  };

  return { sendMessage, deliver };
};

describe('Multi-agent room playback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(START));
    // jsdom has no layout engine; the feed's auto-scroll needs a stub.
    (Element.prototype as unknown as { scrollIntoView: jest.Mock }).scrollIntoView = jest.fn();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('shows the first character immediately and hides the second until T plus two seconds', () => {
    renderRoom([
      learnerMessage,
      agentRow('ai-1', 'riley', RILEY_TEXT, 0),
      agentRow('ai-2', 'tutor', TUTOR_TEXT, 2000)
    ]);

    expect(screen.getByText(RILEY_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(TUTOR_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(/\[agent:/)).not.toBeInTheDocument();
    expect(screen.getByText('Riley')).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(2100); });

    expect(screen.getByText(TUTOR_TEXT)).toBeInTheDocument();
    expect(screen.getByText('Taylor Tutor')).toBeInTheDocument();
  });

  it('reveals a Tutor-first pair in the same staged order', () => {
    renderRoom([
      learnerMessage,
      agentRow('ai-1', 'tutor', TUTOR_TEXT, 0),
      agentRow('ai-2', 'riley', RILEY_TEXT, 2000)
    ]);

    expect(screen.getByText(TUTOR_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(RILEY_TEXT)).not.toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(2100); });

    expect(screen.getByText(RILEY_TEXT)).toBeInTheDocument();
  });

  it('lets the learner type but blocks submission until the pair is complete', () => {
    const { sendMessage } = renderRoom(
      [
        learnerMessage,
        agentRow('ai-1', 'riley', RILEY_TEXT, 0),
        agentRow('ai-2', 'tutor', TUTOR_TEXT, 2000)
      ],
      {
        // Already rated, so the compulsory-rating gate cannot mask the playback gate.
        messageFeedbackStats: {
          'ai-2': {
            message_id: 'ai-2', total_feedback_count: 1, like_count: 1, dislike_count: 0,
            average_like_rating: 4, average_dislike_rating: null, overall_average_rating: 4,
            user_feedback: { feedback_type: 'like', rating: 4 }
          }
        }
      }
    );

    const input = screen.getByPlaceholderText('Write a comment...');
    fireEvent.change(input, { target: { value: 'I think you are right' } });
    expect(input).not.toBeDisabled();

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(screen.queryByTestId('rating-reminder-backdrop')).not.toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(2100); });

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    expect(sendMessage).toHaveBeenCalledWith('I think you are right', { replyToMessageId: undefined });
  });

  it('renders the pair with ordinary message styling and the shared role badge', () => {
    renderRoom([
      learnerMessage,
      agentRow('ai-1', 'riley', RILEY_TEXT, 0),
      agentRow('ai-2', 'tutor', TUTOR_TEXT, 2000)
    ], { user: tutor });

    act(() => { jest.advanceTimersByTime(2100); });

    const rileyRow = screen.getByText(RILEY_TEXT).closest('.post-comment');
    expect(rileyRow).toHaveClass('post-comment-character');
    // The lavender AI tint is reserved for assistant rows without a character tag.
    expect(rileyRow).not.toHaveClass('post-comment-ai');
    const rileyName = within(rileyRow as HTMLElement).getByText('Riley');
    expect(rileyName.textContent).toBe('Riley');
    // Same role badge as every other tutor-side row, not a model-specific chip.
    expect(within(rileyRow as HTMLElement).getByText(/AI chatbot/)).toBeInTheDocument();
    expect(within(rileyRow as HTMLElement).queryByText(/qwen3.5-flash/i)).not.toBeInTheDocument();
    // The meta line carries the ordinary relative timestamp only, never the stored ms.
    const rileyMeta = (rileyRow as HTMLElement).querySelector('.comment-meta');
    expect(rileyMeta?.textContent || '').not.toMatch(/ms/);
    expect(rileyMeta?.querySelector('.comment-response-time')).toBeNull();
    expect(within(rileyRow as HTMLElement).getByTitle('Riley')).toBeInTheDocument();
    expect(within(rileyRow as HTMLElement).queryByTitle('Taylor Tutor')).not.toBeInTheDocument();
    expect(within(rileyRow as HTMLElement).queryByRole('img')).not.toBeInTheDocument();

    const tutorRow = screen.getByText(TUTOR_TEXT).closest('.post-comment');
    expect(within(tutorRow as HTMLElement).getByText('Taylor Tutor')).toBeInTheDocument();
    expect(within(tutorRow as HTMLElement).getByTitle('Taylor Tutor')).toBeInTheDocument();
    expect(within(tutorRow as HTMLElement).getByRole('img')).toHaveAttribute('src', 'https://example.test/taylor.png');
    expect(screen.queryByText(/\[agent:(?:riley|tutor)\]/)).not.toBeInTheDocument();
  });

  it('keeps a valid agent tag literal outside Multi-agent mode', () => {
    renderRoom([
      learnerMessage,
      {
        ...agentRow('tutor-1', 'riley', RILEY_TEXT, 0),
        response_mode: 'tutoring'
      }
    ]);

    expect(screen.getByText('Taylor Tutor')).toBeInTheDocument();
    expect(screen.getByTitle('Taylor Tutor')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.test/taylor.png');
    expect(screen.getByText(`[agent:riley] ${RILEY_TEXT}`)).toBeInTheDocument();
    expect(screen.queryByText('Riley')).not.toBeInTheDocument();
  });

  it('still staggers a fresh pair when the poll delivers both rows in one batch', () => {
    // Mounted first, then a single poll lands 5s after approval: both rows are already due.
    const { deliver } = renderRoom([learnerMessage]);
    jest.setSystemTime(new Date(new Date(START).getTime() + 5000));

    act(() => {
      deliver([
        learnerMessage,
        agentRow('ai-1', 'riley', RILEY_TEXT, 1000),
        agentRow('ai-2', 'tutor', TUTOR_TEXT, 3000)
      ]);
    });

    // eslint-disable-next-line no-console
    expect(screen.getByText(RILEY_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(TUTOR_TEXT)).not.toBeInTheDocument();
    expect(screen.getByTitle('Wait for the second AI message')).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(2100); });

    expect(screen.getByText(TUTOR_TEXT)).toBeInTheDocument();
  });

  it('shows a pair approved before the page opened without replaying the stagger', () => {
    // Opening the room long after approval: both rows predate this mount.
    jest.setSystemTime(new Date(new Date(START).getTime() + 600000));
    renderRoom([
      learnerMessage,
      agentRow('ai-1', 'riley', RILEY_TEXT, -60000),
      agentRow('ai-2', 'tutor', TUTOR_TEXT, -58000)
    ]);

    expect(screen.getByText(RILEY_TEXT)).toBeInTheDocument();
    expect(screen.getByText(TUTOR_TEXT)).toBeInTheDocument();
  });

  it('keeps a learner message that literally contains an agent tag attributed to the learner', () => {
    renderRoom([
      {
        ...learnerMessage,
        content: '[agent:riley] The logo looks official, so I would trust it.'
      }
    ]);

    expect(screen.getAllByText('Sam Student').length).toBeGreaterThan(0);
    expect(screen.queryByText('Riley')).not.toBeInTheDocument();
    expect(screen.getByText('[agent:riley] The logo looks official, so I would trust it.')).toBeInTheDocument();
  });

  it('keeps a malformed Multi-agent tag literal instead of inventing a character identity', () => {
    renderRoom([
      learnerMessage,
      { ...agentRow('ai-1', 'riley', RILEY_TEXT, 0), content: '[agent:riley Trust the logo.' }
    ]);

    expect(screen.getByText('[agent:riley Trust the logo.')).toBeInTheDocument();
    expect(screen.queryByText('Riley')).not.toBeInTheDocument();
  });

  it.each([
    ['Riley first', [agentRow('ai-1', 'riley', RILEY_TEXT, 0), agentRow('ai-2', 'tutor', TUTOR_TEXT, 2000)]],
    ['Tutor first', [agentRow('ai-1', 'tutor', TUTOR_TEXT, 0), agentRow('ai-2', 'riley', RILEY_TEXT, 2000)]]
  ])('requires the Tutor message as the rating target with %s', (_label, pair) => {
    const { sendMessage } = renderRoom([learnerMessage, ...pair]);

    act(() => { jest.advanceTimersByTime(2100); });

    const input = screen.getByPlaceholderText('Write a comment...');
    fireEvent.change(input, { target: { value: 'next question' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    expect(sendMessage).not.toHaveBeenCalled();
    const reminder = within(screen.getByTestId('rating-reminder-backdrop'));
    expect(reminder.getByText(TUTOR_TEXT)).toBeInTheDocument();
    expect(reminder.queryByText(RILEY_TEXT)).not.toBeInTheDocument();
  });

  it('replaces the single-response suggestion box only for an actual Multi-agent decision', () => {
    const draft = {
      rawDecision: {
        mode: 'multiagent', instruction: 'multiagent', mode_reason: 'Contrast',
        suggested_response: `[agent:riley] ${RILEY_TEXT}\n[agent:tutor] ${TUTOR_TEXT}`
      },
      parentMessageId: learnerMessage.id,
      parentMessageContent: learnerMessage.content,
      generatedMessages: [
        { character: 'riley', content: RILEY_TEXT },
        { character: 'tutor', content: TUTOR_TEXT }
      ],
      startTime: new Date(START).getTime(),
      contextMessages: []
    };

    renderRoom([learnerMessage], { user: tutor, multiAgentDraft: draft });

    expect(screen.getByTestId('multi-agent-suggestion-editor')).toBeInTheDocument();
    expect(screen.getByTestId('multi-agent-card-0')).toHaveTextContent('Riley');
    expect(screen.getByTestId('multi-agent-card-1')).toHaveTextContent('Taylor Tutor');
    expect(screen.queryByTestId('ai-suggestion-box')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Regenerate/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve/ })).toBeInTheDocument();
  });

  it('falls back to Tutor when the active tutor profile has no display name', () => {
    const draft = {
      rawDecision: {
        mode: 'multiagent', instruction: 'multiagent', mode_reason: 'Contrast',
        suggested_response: `[agent:tutor] ${TUTOR_TEXT}`
      },
      parentMessageId: learnerMessage.id,
      parentMessageContent: learnerMessage.content,
      generatedMessages: [{ character: 'tutor', content: TUTOR_TEXT }],
      startTime: new Date(START).getTime(),
      contextMessages: []
    };

    renderRoom([learnerMessage], {
      user: { ...tutor, display_name: '' } as User,
      multiAgentDraft: draft
    });

    expect(screen.getByTestId('multi-agent-card-0')).toHaveTextContent('Tutor');
    expect(screen.queryByText('AI Tutor')).not.toBeInTheDocument();
  });

  it('renders one editable card for a Riley-only multiagent decision', () => {
    const draft = {
      rawDecision: {
        mode: 'multiagent', instruction: 'multiagent', mode_reason: 'Contrast',
        suggested_response: `[agent:riley] ${RILEY_TEXT}`
      },
      parentMessageId: learnerMessage.id,
      parentMessageContent: learnerMessage.content,
      generatedMessages: [{ character: 'riley', content: RILEY_TEXT }],
      startTime: new Date(START).getTime(),
      contextMessages: []
    };

    renderRoom([learnerMessage], { user: tutor, multiAgentDraft: draft });

    expect(screen.getByTestId('multi-agent-card-0')).toHaveTextContent('Riley');
    expect(screen.queryByTestId('multi-agent-card-1')).not.toBeInTheDocument();
  });

  it('keeps the ordinary suggestion box for an allowed Multi-agent explanation exception', () => {
    renderRoom([learnerMessage], {
      user: tutor,
      aiSuggestion: TUTOR_TEXT,
      aiDecision: {
        mode: 'tutoring', instruction: 'explanation', mode_reason: 'Direct teaching request',
        suggested_response: TUTOR_TEXT
      },
      currentSuggestionContext: {
        rawDecision: {
          mode: 'tutoring', instruction: 'explanation', mode_reason: 'Direct teaching request',
          suggested_response: TUTOR_TEXT
        },
        finalMode: 'tutoring',
        finalResponse: TUTOR_TEXT,
        parentMessageId: learnerMessage.id,
        parentMessageContent: learnerMessage.content,
        startTime: new Date(START).getTime(),
        contextMessages: []
      }
    });

    expect(screen.getByTestId('ai-suggestion-box')).toBeInTheDocument();
    expect(screen.queryByTestId('multi-agent-suggestion-editor')).not.toBeInTheDocument();
  });
});
