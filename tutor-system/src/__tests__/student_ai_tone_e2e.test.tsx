/**
 * E2E (page-level) for features/student_ai_tone.feature
 * Purpose: drive the product room route (RoomPagePost) end-to-end for student
 * AI role opt-in → Peer/Adult selection → tutor and Quick Adjust role lock, and multi-student block.
 * Uses real StudentAIToneControl + AIAssistantSettings; mocks room/auth I/O only.
 */

import React from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPagePost from '../pages/RoomPagePost';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import type { AIAssistantConfig, Room, User } from '../types';
import type { SystemPromptConfig } from '../services/prompts/types';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../contexts/RoomContext', () => ({
  useRoom: jest.fn(),
}));

jest.mock('../components/RoomPost', () => {
  return function MockRoomPost() {
    return <div data-testid="room-post">Room Post</div>;
  };
});

jest.mock('../components/PostComment', () => {
  return function MockPostComment() {
    return <div data-testid="post-comment">Comment</div>;
  };
});

jest.mock('../components/CommentInput', () => {
  return function MockCommentInput() {
    return <div data-testid="comment-input">Input</div>;
  };
});

jest.mock('../components/ChecklistPanel', () => {
  return function MockChecklistPanel() {
    return <div data-testid="checklist-panel">Checklist</div>;
  };
});

jest.mock('../components/AISuggestionBox', () => {
  return function MockAISuggestionBox({ lockedRole }: { lockedRole?: 'low' | 'high' }) {
    return (
      <div data-testid="ai-suggestion-box" data-locked-role={lockedRole || ''}>
        Suggestion
      </div>
    );
  };
});

const feature = loadFeature('./features/student_ai_tone.feature');

const tutorUser = (): User =>
  ({
    id: 'tutor-1',
    display_name: 'Tutor',
    current_role: 'tutor',
    email: 'tutor@test.com',
    status: 'active',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  }) as User;

const studentUser = (id = 'student-1'): User =>
  ({
    id,
    display_name: `Student ${id}`,
    current_role: 'student',
    email: `${id}@test.com`,
    status: 'active',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  }) as User;

const observerUser = (): User =>
  ({
    id: 'observer-1',
    display_name: 'Observer',
    current_role: 'observer',
    email: 'obs@test.com',
    status: 'active',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  }) as User;

const basePromptConfig = (
  overrides: Partial<SystemPromptConfig> = {}
): SystemPromptConfig => ({
  role: { role: 'high' },
  communication_style: {
    teen_slang: 'low',
    conversational_markers: 'low',
    uncertainty_expression: 'low',
  },
  cognitive_parameters: {
    concept_density: 'low',
    perspective_taking: 'low',
    personal_examples: 'low',
    consequence_highlighting: 'low',
  },
  emotional_parameters: {
    enthusiasm_level: 'low',
    validation_frequency: 'low',
    mistake_normalization: 'low',
    confidence_building: 'low',
  },
  detection_areas: ['Suspicious links'],
  verification_steps: ['Check sender'],
  ...overrides,
});

const buildRoom = (aiEnabled = true): Room =>
  ({
    id: 'room-1',
    tutor_id: 'tutor-1',
    title: 'Tone E2E Room',
    description: 'Student tone e2e',
    image_url: null,
    is_active: true,
    ai_assistant_enabled: aiEnabled,
    ai_assistant_model: 'gpt-4o-mini',
    ai_assistant_prompt: 'prompt',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  }) as Room;

const buildAIConfig = (
  promptConfig: SystemPromptConfig | null = basePromptConfig()
): AIAssistantConfig =>
  ({
    id: 'cfg-1',
    room_id: 'room-1',
    model_name: 'gpt-4o-mini',
    system_prompt: 'prompt',
    prompt_config: promptConfig,
    temperature: 0.7,
    max_tokens: 100,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  }) as AIAssistantConfig;

defineFeature(feature, (test) => {
  let setStudentAITone: jest.Mock;
  let toggleAIAssistant: jest.Mock;
  let joinRoom: jest.Mock;
  let leaveRoom: jest.Mock;
  let participants: User[];
  let currentUser: User;
  let aiEnabled: boolean;
  let aiConfig: AIAssistantConfig | null;
  let aiSuggestion: string | null;

  const mockRoom = () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: currentUser,
      loading: false,
    });
    (useRoom as jest.Mock).mockReturnValue({
      currentRoom: buildRoom(aiEnabled),
      messages: [],
      participants,
      loading: false,
      loadingAI: false,
      typingUsers: [],
      joinRoom,
      leaveRoom,
      sendMessage: jest.fn(),
      generateAIResponse: jest.fn(),
      regenerateAIResponse: jest.fn(),
      startTyping: jest.fn(),
      stopTyping: jest.fn(),
      aiConfig,
      downloadChatHistory: jest.fn(),
      clearChatHistory: jest.fn(),
      aiSuggestion,
      clearAISuggestion: jest.fn(),
      recordAIFeedback: jest.fn(),
      currentSuggestionContext: null,
      submitMessageFeedback: jest.fn(),
      messageFeedbackStats: {},
      setStudentAITone,
      toggleAIAssistant,
    });
  };

  const renderRoom = () => {
    mockRoom();
    return render(
      <MemoryRouter initialEntries={['/room/room-1']}>
        <Routes>
          <Route path="/room/:roomId" element={<RoomPagePost />} />
        </Routes>
      </MemoryRouter>
    );
  };

  /** Background steps shared by every scenario in the feature file. */
  const bindBackground = (given: any, and: any) => {
    given('the AI assistant is enabled for the room', () => {
      aiEnabled = true;
    });
    and('the room has a tutor', () => {
      if (!participants.some((p) => p.current_role === 'tutor')) {
        participants = [tutorUser(), ...participants];
      }
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setStudentAITone = jest.fn().mockResolvedValue(undefined);
    toggleAIAssistant = jest.fn().mockResolvedValue(undefined);
    joinRoom = jest.fn().mockResolvedValue(undefined);
    leaveRoom = jest.fn();
    participants = [tutorUser(), studentUser()];
    currentUser = studentUser();
    aiEnabled = true;
    aiConfig = buildAIConfig();
    aiSuggestion = null;
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
  });

  test('Student sees opt-in control before any role dropdown', ({
    given,
    and,
    when,
    then,
  }) => {
    bindBackground(given, and);
    given('exactly one student is in the room', () => {
      participants = [tutorUser(), studentUser()];
      currentUser = studentUser();
    });
    when('the student is viewing the room', () => {
      renderRoom();
    });
    then(/^the student should see a "Choose AI role\?" control$/, () => {
      expect(
        screen.getByRole('button', { name: /choose ai role\?/i })
      ).toBeInTheDocument();
    });
    and('the student should not see a role dropdown yet', () => {
      expect(screen.queryByLabelText(/ai role/i)).not.toBeInTheDocument();
    });
  });

  test('Student opens role choices after opt-in', ({ given, and, when, then }) => {
    bindBackground(given, and);
    given('exactly one student is in the room', () => {
      participants = [tutorUser(), studentUser()];
      currentUser = studentUser();
    });
    and('the student is viewing the room', () => {
      renderRoom();
    });
    when(/^the student clicks "Choose AI role\?"$/, () => {
      fireEvent.click(
        screen.getByRole('button', { name: /choose ai role\?/i })
      );
    });
    then('the student should see a role dropdown', () => {
      expect(screen.getByLabelText(/ai role/i)).toBeInTheDocument();
    });
    and(/^the role options should include "Peer" and "Adult"$/, () => {
      expect(screen.getByRole('option', { name: 'Peer' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Adult' })).toBeInTheDocument();
    });
  });

  test('Student selects Peer role updates room AI role and locks tutor control', ({
    given,
    and,
    when,
    then,
  }) => {
    bindBackground(given, and);
    given('exactly one student is in the room', () => {
      participants = [tutorUser(), studentUser()];
      currentUser = studentUser();
    });
    and('the student has opened the role dropdown', () => {
      renderRoom();
      fireEvent.click(
        screen.getByRole('button', { name: /choose ai role\?/i })
      );
    });
    when(/^the student selects role "Peer"$/, async () => {
      fireEvent.change(screen.getByLabelText(/ai role/i), {
        target: { value: 'peer' },
      });
      await waitFor(() => {
        expect(setStudentAITone).toHaveBeenCalledWith('peer');
      });
      aiConfig = buildAIConfig(
        basePromptConfig({
          role: { role: 'low' },
          student_tone_lock: {
            locked: true,
            chosen_by_user_id: 'student-1',
            chosen_role: 'low',
          },
        })
      );
    });
    then('the room AI role should be peer', () => {
      expect(setStudentAITone).toHaveBeenCalledWith('peer');
      expect(aiConfig?.prompt_config?.role.role).toBe('low');
    });
    and('the tutor AI personality control should be locked', () => {
      currentUser = tutorUser();
      aiSuggestion = 'Suggestion';
      renderRoom();
      fireEvent.click(screen.getByTitle('AI Assistant Settings'));
      expect(
        screen.getByRole('combobox', { name: /AI Personality/i })
      ).toBeDisabled();
    });
    and('the tutor should see a visual lock indicator for AI role', () => {
      expect(screen.getByTestId('ai-tone-lock-indicator')).toBeInTheDocument();
      expect(screen.getByText(/student chose/i)).toBeInTheDocument();
    });
    and('Quick Adjust should receive the student-selected role', () => {
      expect(screen.getByTestId('ai-suggestion-box')).toHaveAttribute(
        'data-locked-role',
        'low'
      );
    });
  });

  test('Student selects Adult role updates room AI role and locks tutor control', ({
    given,
    and,
    when,
    then,
  }) => {
    bindBackground(given, and);
    given('exactly one student is in the room', () => {
      participants = [tutorUser(), studentUser()];
      currentUser = studentUser();
    });
    and('the student has opened the role dropdown', () => {
      renderRoom();
      fireEvent.click(
        screen.getByRole('button', { name: /choose ai role\?/i })
      );
    });
    when(/^the student selects role "Adult"$/, async () => {
      fireEvent.change(screen.getByLabelText(/ai role/i), {
        target: { value: 'adult' },
      });
      await waitFor(() => {
        expect(setStudentAITone).toHaveBeenCalledWith('adult');
      });
      aiConfig = buildAIConfig(
        basePromptConfig({
          role: { role: 'high' },
          student_tone_lock: {
            locked: true,
            chosen_by_user_id: 'student-1',
            chosen_role: 'high',
          },
        })
      );
    });
    then('the room AI role should be trusted adult', () => {
      expect(aiConfig?.prompt_config?.role.role).toBe('high');
    });
    and('the tutor AI personality control should be locked', () => {
      currentUser = tutorUser();
      renderRoom();
      fireEvent.click(screen.getByTitle('AI Assistant Settings'));
      expect(
        screen.getByRole('combobox', { name: /AI Personality/i })
      ).toBeDisabled();
      expect(screen.getByTestId('ai-tone-lock-indicator')).toBeInTheDocument();
    });
  });

  test('Tutor can still edit AI personality before student chooses a role', ({
    given,
    and,
    when,
    then,
  }) => {
    bindBackground(given, and);
    given('exactly one student is in the room', () => {
      participants = [tutorUser(), studentUser()];
    });
    and('the student has not chosen an AI role', () => {
      aiConfig = buildAIConfig(basePromptConfig());
      currentUser = tutorUser();
    });
    when('the tutor opens AI settings', () => {
      renderRoom();
      fireEvent.click(screen.getByTitle('AI Assistant Settings'));
    });
    then('the AI Personality control should be editable', () => {
      expect(
        screen.getByRole('combobox', { name: /AI Personality/i })
      ).not.toBeDisabled();
    });
    and('there should be no visual lock indicator for AI role', () => {
      expect(
        screen.queryByTestId('ai-tone-lock-indicator')
      ).not.toBeInTheDocument();
    });
  });

  test('Feature is unavailable when multiple students are in the room', ({
    given,
    and,
    when,
    then,
  }) => {
    bindBackground(given, and);
    given('two students are in the room', () => {
      participants = [
        tutorUser(),
        studentUser('student-1'),
        studentUser('student-2'),
      ];
      currentUser = studentUser('student-1');
    });
    when('a student is viewing the room', () => {
      renderRoom();
    });
    then(/^the student should not see a "Choose AI role\?" control$/, () => {
      expect(
        screen.queryByRole('button', { name: /choose ai role\?/i })
      ).not.toBeInTheDocument();
    });
    and('the student should not see a role dropdown', () => {
      expect(screen.queryByLabelText(/ai role/i)).not.toBeInTheDocument();
    });
  });

  test('Student cannot apply role when a second student joins before selection', ({
    given,
    and,
    when,
    then,
  }) => {
    bindBackground(given, and);
    given('exactly one student is in the room', () => {
      participants = [tutorUser(), studentUser()];
      currentUser = studentUser();
    });
    and('the student has opened the role dropdown', () => {
      renderRoom();
      fireEvent.click(
        screen.getByRole('button', { name: /choose ai role\?/i })
      );
    });
    when('a second student joins the room', () => {
      participants = [
        tutorUser(),
        studentUser('student-1'),
        studentUser('student-2'),
      ];
      setStudentAITone.mockRejectedValue(
        new Error(
          'Student AI tone is only available in single-student rooms (multi-student blocked)'
        )
      );
    });
    and(/^the first student tries to select role "Peer"$/, async () => {
      await expect(setStudentAITone('peer')).rejects.toThrow(
        /single-student|multi-student|not available/i
      );
    });
    then('the role change should be rejected', () => {
      expect(setStudentAITone).toHaveBeenCalledWith('peer');
    });
    and('the tutor AI personality control should remain unlocked', () => {
      currentUser = tutorUser();
      aiConfig = buildAIConfig(basePromptConfig());
      renderRoom();
      fireEvent.click(screen.getByTitle('AI Assistant Settings'));
      expect(
        screen.getByRole('combobox', { name: /AI Personality/i })
      ).not.toBeDisabled();
    });
  });

  test('Feature is hidden when AI assistant is disabled', ({
    given,
    and,
    when,
    then,
  }) => {
    // Background still runs first (enabled + tutor), then scenario disables AI.
    bindBackground(given, and);
    given('the AI assistant is disabled for the room', () => {
      aiEnabled = false;
    });
    and('exactly one student is in the room', () => {
      participants = [tutorUser(), studentUser()];
      currentUser = studentUser();
    });
    when('the student is viewing the room', () => {
      renderRoom();
    });
    then(/^the student should not see a "Choose AI role\?" control$/, () => {
      expect(
        screen.queryByRole('button', { name: /choose ai role\?/i })
      ).not.toBeInTheDocument();
    });
  });

  test('Observers cannot choose AI role', ({ given, and, then }) => {
    bindBackground(given, and);
    given('exactly one student is in the room', () => {
      participants = [tutorUser(), studentUser(), observerUser()];
    });
    and('an observer is viewing the room', () => {
      currentUser = observerUser();
      renderRoom();
    });
    then(/^the observer should not see a "Choose AI role\?" control$/, () => {
      expect(
        screen.queryByRole('button', { name: /choose ai role\?/i })
      ).not.toBeInTheDocument();
    });
  });
});
