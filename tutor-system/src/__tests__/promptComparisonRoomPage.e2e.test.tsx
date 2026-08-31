#!/usr/bin/env node
/**
 * File: src/pages/RoomPagePost.tsx
 * Purpose: verify controlled-comparison rooms visibly identify Phase 0/refined conditions while ordinary rooms remain unchanged.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPagePost from '../pages/RoomPagePost';
import TestRoomsView from '../pages/TestRoomsView';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import type { AIAssistantConfig, Room, User } from '../types';
import { createRoom, getRoomTemplatesByTutor, getRoomsByTutor } from '../services/supabase';
import { getAIConfig, initializeAIAssistant, updateAIConfig } from '../services/aiService';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../contexts/RoomContext', () => ({ useRoom: jest.fn() }));
jest.mock('../components/RoomPost', () => () => <div data-testid="room-post">Room post</div>);
jest.mock('../components/PostComment', () => () => <div>Comment</div>);
jest.mock('../components/CommentInput', () => () => <div>Input</div>);
jest.mock('../components/StudentAIToneControl', () => () => null);
jest.mock('../components/ChecklistPanel', () => () => null);
jest.mock('../components/AISuggestionBox', () => () => <div data-testid="ai-suggestion-box">Suggestion</div>);
jest.mock('../services/supabase', () => ({
  createRoom: jest.fn(),
  deleteRoom: jest.fn(),
  getRoomTemplatesByTutor: jest.fn(),
  getRoomsByTutor: jest.fn(),
}));
jest.mock('../services/aiService', () => ({
  DEFAULT_AI_MODEL: 'gpt-4o-mini',
  getAIConfig: jest.fn(),
  initializeAIAssistant: jest.fn(),
  updateAIConfig: jest.fn(),
}));

const tutor = {
  id: 'tutor-1',
  display_name: 'Tutor',
  current_role: 'tutor',
  status: 'active',
  created_at: '2026-08-30T00:00:00.000Z',
  updated_at: '2026-08-30T00:00:00.000Z',
} as User;

const room = {
  id: 'room-1',
  tutor_id: 'tutor-1',
  title: 'Demo: Phase 0 — Lock Icon Myth',
  description: 'Controlled prompt comparison',
  image_url: null,
  is_active: true,
  ai_assistant_enabled: true,
  ai_assistant_model: 'gpt-4o-mini',
  ai_assistant_prompt: 'RAW_SYSTEM',
  op_id: 'tutor-1',
  op_display_name: 'Tutor',
  op_avatar_url: null,
  password: null,
  created_at: '2026-08-30T00:00:00.000Z',
  updated_at: '2026-08-30T00:00:00.000Z',
} as Room;

const comparisonConfig = (
  enabled: boolean,
  version: 'phase0' | 'refined' = 'phase0',
  pairId: 'lock_icon' | 'click_impulse' | 'personal_story' = 'lock_icon'
): AIAssistantConfig => ({
  id: 'config-1',
  room_id: 'room-1',
  model_name: 'gpt-4o-mini',
  system_prompt: 'RAW_SYSTEM',
  prompt_config: {
    role: { role: 'low' },
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
    detection_areas: [],
    verification_steps: [],
    ...(enabled ? {
      prompt_comparison: {
        version,
        pair_id: pairId,
        shared_scenario_context: pairId === 'lock_icon'
          ? 'Shared Lock Icon Myth scenario'
          : pairId === 'click_impulse'
            ? 'Shared Click Impulse scenario'
            : 'Shared Personal Story scenario',
        system_prompt_source_commit: version === 'phase0' ? '530bd59' : 'working-tree',
      },
    } : {}),
  } as any,
  temperature: 0,
  max_tokens: 100,
  is_active: true,
  created_at: '2026-08-30T00:00:00.000Z',
  updated_at: '2026-08-30T00:00:00.000Z',
});

const renderRoom = (aiConfig: AIAssistantConfig) => {
  (useAuth as jest.Mock).mockReturnValue({ user: tutor, loading: false });
  (useRoom as jest.Mock).mockReturnValue({
    currentRoom: room,
    messages: [],
    participants: [tutor],
    loading: false,
    typingUsers: [],
    joinRoom: jest.fn().mockResolvedValue(undefined),
    leaveRoom: jest.fn(),
    sendMessage: jest.fn(),
    generateAIResponse: jest.fn(),
    regenerateAIResponse: jest.fn(),
    startTyping: jest.fn(),
    stopTyping: jest.fn(),
    aiConfig,
    loadingAI: false,
    downloadChatHistory: jest.fn(),
    clearChatHistory: jest.fn(),
    aiSuggestion: 'Actual generated suggestion',
    clearAISuggestion: jest.fn(),
    recordAIFeedback: jest.fn(),
    currentSuggestionContext: null,
    submitMessageFeedback: jest.fn(),
    messageFeedbackStats: {},
  });

  return render(
    <MemoryRouter initialEntries={['/room/room-1']}>
      <Routes>
        <Route path="/room/:roomId" element={<RoomPagePost />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('prompt comparison room page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
  });

  it.each([
    ['phase0', 'lock_icon', 'Phase 0', 'Lock Icon Myth'],
    ['refined', 'lock_icon', 'Refined', 'Lock Icon Myth'],
    ['phase0', 'click_impulse', 'Phase 0', 'Click Impulse'],
    ['refined', 'click_impulse', 'Refined', 'Click Impulse'],
    ['phase0', 'personal_story', 'Phase 0', 'Personal Story'],
    ['refined', 'personal_story', 'Refined', 'Personal Story'],
  ] as const)(
    'derives %s and %s from persisted comparison metadata',
    (version, pairId, versionLabel, pairLabel) => {
      renderRoom(comparisonConfig(true, version, pairId));
      expect(screen.getByTestId('prompt-comparison-badge')).toHaveTextContent(versionLabel);
      expect(screen.getByTestId('prompt-comparison-badge')).toHaveTextContent(pairLabel);
      expect(screen.getByTestId('ai-suggestion-box')).toBeInTheDocument();
    }
  );

  it('does not show a comparison badge in an ordinary room', () => {
    renderRoom(comparisonConfig(false));
    expect(screen.queryByTestId('prompt-comparison-badge')).not.toBeInTheDocument();
  });

  it('passes the selected Phase 0 prompt and full comparison metadata through Test Rooms initialization', async () => {
    const promptComparison = {
      version: 'phase0',
      pair_id: 'lock_icon',
      shared_scenario_context: 'Shared Lock Icon Myth scenario',
      system_prompt_source_commit: '530bd59',
    };
    const promptConfig = {
      role: { role: 'low' },
      communication_style: {},
      cognitive_parameters: {},
      emotional_parameters: {},
      detection_areas: [],
      verification_steps: [],
      prompt_comparison: promptComparison,
    };
    (getRoomsByTutor as jest.Mock).mockResolvedValue([]);
    (getRoomTemplatesByTutor as jest.Mock).mockResolvedValue([{
      id: 'template-phase0-lock',
      tutor_id: 'global',
      template_name: 'Demo: Phase 0 — Lock Icon Myth',
      template_description: 'Controlled prompt comparison',
      title_template: 'Demo: Phase 0 — Lock Icon Myth',
      description_template: 'Controlled prompt comparison',
      image_url: null,
      pre_populated_dialogue: [],
      ai_config_template: {
        enabled: true,
        model_name: 'gpt-4o-mini',
        system_prompt: 'HISTORICAL_PHASE0_SYSTEM_PROMPT',
        preset: 'casual_peer',
        scenario: 'Account Security Alert',
        prompt_config: promptConfig,
        temperature: 0,
        max_tokens: 100,
      },
      op_config_template: null,
      password_config: null,
      usage_count: 0,
      created_at: '2026-08-30T00:00:00Z',
      updated_at: '2026-08-30T00:00:00Z',
    }]);
    (createRoom as jest.Mock).mockResolvedValue({ id: 'created-phase0-room' });
    (initializeAIAssistant as jest.Mock).mockResolvedValue('created-phase0-room');
    (getAIConfig as jest.Mock).mockResolvedValue({
      model_name: 'gpt-4o-mini',
      system_prompt: 'HISTORICAL_PHASE0_SYSTEM_PROMPT',
      prompt_config: promptConfig,
    });
    (updateAIConfig as jest.Mock).mockResolvedValue(undefined);
    (useAuth as jest.Mock).mockReturnValue({ user: tutor, loading: false });

    render(
      <MemoryRouter initialEntries={['/tutor/test-rooms']}>
        <Routes>
          <Route path="/tutor/test-rooms" element={<TestRoomsView />} />
          <Route path="/room/:roomId" element={<div>Created room</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('create-test-room'));
    const select = await screen.findByLabelText('Use Template');
    await screen.findByRole('option', { name: 'Demo: Phase 0 — Lock Icon Myth' });
    fireEvent.change(select, { target: { value: 'template-phase0-lock' } });
    const submit = screen.getByRole('button', { name: /create room/i });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(initializeAIAssistant).toHaveBeenCalledWith(
      'created-phase0-room',
      'gpt-4o-mini',
      'HISTORICAL_PHASE0_SYSTEM_PROMPT',
      'tutor-1',
      expect.objectContaining({ prompt_comparison: promptComparison })
    ));
    expect(updateAIConfig).toHaveBeenCalledWith(
      'created-phase0-room',
      expect.objectContaining({
        system_prompt: 'HISTORICAL_PHASE0_SYSTEM_PROMPT',
        prompt_config: expect.objectContaining({ prompt_comparison: promptComparison }),
        temperature: 0,
        max_tokens: 100,
      }),
      'tutor-1',
      'test_room_template_create'
    );
  });
});
