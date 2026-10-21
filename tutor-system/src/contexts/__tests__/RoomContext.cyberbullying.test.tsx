// #!/usr/bin/env node
// Test responsibility: RoomContext's Cyberbullying workflow, proposal review, saved comments, and character projection.
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { RoomProvider, useRoom } from '../RoomContext';
import { useAuth } from '../AuthContext';
import { supabase } from '../../services/supabase';
import { generateTutorSuggestion, reviewCyberbullyingSuggestion, getAIConfig } from '../../services/aiService';
import { ChecklistService } from '../../services/checklistService';
import { transferAssessmentService } from '../../services/transferAssessmentService';
import { sendReviewedTutorResponse } from '../../services/guardModeService';
import { transferRoom, tutorUser, learnerAUser, learnerAMessageRow } from '../../test-support/transferRoomFixtures';
import type { CyberbullyingSuggestion, Room } from '../../types';
import { resolveMessagePresentation } from '../../utils/messagePresentation';
import { projectRoomMessage } from '../transferAssessmentUiAdapter';

jest.mock('../../services/supabase', () => ({
  supabase: { channel: jest.fn(), from: jest.fn() }, validateRoomPassword: jest.fn(),
  getMessageFeedbackStats: jest.fn(), getUserMessageFeedback: jest.fn(), getRoomFeedbackSummary: jest.fn(),
}));
jest.mock('../../services/aiService', () => ({
  generateTutorSuggestion: jest.fn(), reviewCyberbullyingSuggestion: jest.fn(), getAIConfig: jest.fn(),
  recordAISuggestionFeedback: jest.fn(), DEFAULT_AI_MODEL: 'qwen3.8-flash',
}));
jest.mock('../../services/checklistService', () => ({
  ChecklistService: { analyzeStudentMessages: jest.fn(), getActiveTransferChecklistForRoom: jest.fn(), getChecklistForStudent: jest.fn() },
}));
jest.mock('../../services/guardModeService', () => ({ sendReviewedTutorResponse: jest.fn(), setRoomGuardMode: jest.fn() }));
jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));

const cyberRoom: Room = { ...transferRoom, practice_type: 'cyberbullying', transfer_learning_enabled: false };
const learnerMessage = { ...learnerAMessageRow, content: 'I can check how Dylan feels.' };
const draft: CyberbullyingSuggestion = {
  id: 'proposal-1', room_id: cyberRoom.id, parent_message_id: learnerMessage.id, context_revision: 1,
  status: 'ready', requested_character: null, raw_character: 'victim', raw_response: 'A role reply.',
  raw_guard_mode: false, reason: 'Constructive upstanders',
};
let room: ReturnType<typeof useRoom>;
function Probe() {
  room = useRoom();
  return null;
}
const response = (proposal = draft) => ({
  success: true, suggestion: proposal.raw_response, contextMessages: [learnerMessage.id],
  decision: { guard_mode: false, instruction: null, guard_reason: proposal.reason, suggested_response: proposal.raw_response },
  cyberbullyingDraft: proposal,
});

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ user: tutorUser, loading: false });
  (getAIConfig as jest.Mock).mockResolvedValue(null);
  (supabase.channel as jest.Mock).mockReturnValue({ on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis(), unsubscribe: jest.fn() });
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    const result = table === 'rooms' ? cyberRoom : table === 'messages' ? [learnerMessage] : table === 'users' ? [tutorUser, learnerAUser] : [];
    const query: any = {
      select: jest.fn(() => query), eq: jest.fn(() => query), in: jest.fn(() => query), order: jest.fn(() => query),
      single: jest.fn(async () => ({ data: result, error: null })),
      then: (resolve: (value: unknown) => void) => Promise.resolve({ data: result, error: null }).then(resolve),
    };
    return query;
  });
  (generateTutorSuggestion as jest.Mock).mockResolvedValue(response());
  (ChecklistService.analyzeStudentMessages as jest.Mock).mockResolvedValue(undefined);
  (ChecklistService.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(null);
  (ChecklistService.getChecklistForStudent as jest.Mock).mockResolvedValue(null);
  (reviewCyberbullyingSuggestion as jest.Mock).mockResolvedValue({ ...draft, status: 'rejected' });
});
afterEach(() => jest.restoreAllMocks());

async function mount() {
  render(<RoomProvider><Probe /></RoomProvider>);
  await act(async () => { await room.joinRoom(cyberRoom.id); });
  await waitFor(() => expect(room.currentRoom?.id).toBe(cyberRoom.id));
}

test('analyzes saved evidence and publishes the edited character through shared tutor approval', async () => {
  const prepare = jest.spyOn(transferAssessmentService, 'prepareAssessment');
  await mount();
  await act(async () => { await room.generateAIResponse(); });
  expect(ChecklistService.analyzeStudentMessages).toHaveBeenCalledWith(cyberRoom.id, learnerAUser.id, learnerMessage.id);
  expect(prepare).not.toHaveBeenCalled();
  expect(room.cyberbullyingDraft?.id).toBe(draft.id);
  expect(room.messages).toHaveLength(1);
  await act(async () => { room.updateFinalCharacter('older_peer'); });
  const stored = { ...learnerMessage, id: 'reply-1', user_id: tutorUser.id, user_role: 'tutor',
    content: 'Reviewed reply', character: 'older_peer', persona_id: 'copilot:tom', persona_name: 'Tom', persona_avatar: '/images/profile_2.png', guard_mode: false };
  (sendReviewedTutorResponse as jest.Mock).mockResolvedValue({ message: stored, room: cyberRoom });
  await act(async () => { await room.sendMessage('Reviewed reply'); });
  expect(sendReviewedTutorResponse).toHaveBeenCalledWith(expect.objectContaining({
    suggestionId: draft.id, finalCharacter: 'older_peer', tutorId: tutorUser.id, tutorAction: 'modified',
  }));
  expect(room.messages.find(message => message.id === 'reply-1')).toMatchObject({
    user_id: tutorUser.id, character: 'older_peer', display_name: 'Tom', avatar_url: '/images/profile_2.png',
  });
  expect(room.cyberbullyingDraft).toBeNull();
});

test('keeps the edited character on regeneration and lets the next proposal choose its role', async () => {
  await mount();
  await act(async () => { await room.generateAIResponse(); });
  await act(async () => { room.updateFinalCharacter('educator'); });
  (generateTutorSuggestion as jest.Mock).mockResolvedValue(response({ ...draft, id: 'proposal-2', raw_character: 'educator' }));
  await act(async () => { await room.regenerateAIResponse({}); });
  expect(generateTutorSuggestion).toHaveBeenLastCalledWith(cyberRoom.id, tutorUser.id, undefined,
    expect.objectContaining({ previousSuggestionId: 'proposal-1', character: 'educator' }));
  await act(async () => { await room.recordAIFeedback('rejected'); room.clearAISuggestion(); });
  expect(reviewCyberbullyingSuggestion).toHaveBeenCalledWith(cyberRoom.id, tutorUser.id, 'proposal-2', true);
  await act(async () => { await room.generateAIResponse(); });
  expect(generateTutorSuggestion).toHaveBeenLastCalledWith(cyberRoom.id, tutorUser.id, undefined,
    expect.objectContaining({ previousSuggestionId: undefined, character: null }));
});

test('stores a learner comment before analysis and leaves it available when analysis fails', async () => {
  (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
  const post = jest.spyOn(transferAssessmentService, 'postMessage').mockResolvedValue({ message: { ...learnerMessage, id: 'new-comment' } });
  (ChecklistService.analyzeStudentMessages as jest.Mock).mockRejectedValue(new Error('provider unavailable'));
  await mount();
  await act(async () => { await room.sendMessage('A new comment'); });
  expect(post).toHaveBeenCalledTimes(1);
  expect(room.messages.some(message => message.id === 'new-comment')).toBe(true);
  expect(ChecklistService.analyzeStudentMessages).toHaveBeenCalledWith(cyberRoom.id, learnerAUser.id, 'new-comment');
});

test('realtime/reload projection keeps stored character identity for every viewer', () => {
  const stored = { ...learnerMessage, user_id: tutorUser.id, user_role: 'tutor',
    character: 'victim', persona_id: 'copilot:dylan', persona_name: 'Dylan',
    persona_avatar: '/images/victim_profile.jpeg', guard_mode: true, response_mode: 'guard' };
  const projected = projectRoomMessage(stored);
  for (const viewer of ['student', 'observer', 'tutor']) {
    expect(resolveMessagePresentation(projected, viewer)).toMatchObject({
      displayName: 'Dylan', avatarUrl: '/images/victim_profile.jpeg', body: stored.content,
    });
  }
  expect(projected.user_id).toBe(tutorUser.id);
});

test('retains the edited character after failed regeneration and retries without publishing the old draft', async () => {
  await mount();
  await act(async () => { await room.generateAIResponse(); });
  await act(async () => { room.updateFinalCharacter('educator'); });
  (generateTutorSuggestion as jest.Mock).mockResolvedValueOnce({ success: false, error: 'Provider unavailable' });
  await act(async () => {
    await expect(room.regenerateAIResponse({})).rejects.toThrow('Provider unavailable');
  });
  expect(room.cyberbullyingDraft?.status).toBe('failed');
  await act(async () => { await expect(room.sendMessage('Old draft')).rejects.toThrow(); });
  expect(sendReviewedTutorResponse).not.toHaveBeenCalled();
  await act(async () => { await room.regenerateAIResponse({}); });
  expect(generateTutorSuggestion).toHaveBeenLastCalledWith(cyberRoom.id, tutorUser.id, undefined,
    expect.objectContaining({ previousSuggestionId: undefined, character: 'educator' }));
});
