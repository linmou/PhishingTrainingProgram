// #!/usr/bin/env node
// Test responsibility: RoomContext.tsx browser drafts, shared review logging, saved comments, and character projection.
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { RoomProvider, useRoom } from '../RoomContext';
import { useAuth } from '../AuthContext';
import { supabase } from '../../services/supabase';
import { generateTutorSuggestion, recordAISuggestionFeedback, getAIConfig } from '../../services/aiService';
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
  generateTutorSuggestion: jest.fn(), getAIConfig: jest.fn(),
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
  room_id: cyberRoom.id, parent_message_id: learnerMessage.id,
  raw_character: 'victim', raw_response: 'A role reply.',
  raw_guard_mode: false, reason: 'Constructive upstanders',
  context_messages: [learnerMessage.id], generation_provenance: { model: 'fixture' },
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
  (recordAISuggestionFeedback as jest.Mock).mockResolvedValue(undefined);
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
  expect(room.cyberbullyingDraft).toEqual(draft);
  expect(room.messages).toHaveLength(1);
  await act(async () => { room.updateFinalCharacter('older_peer'); });
  const stored = { ...learnerMessage, id: 'reply-1', user_id: tutorUser.id, user_role: 'tutor',
    content: 'Reviewed reply', character: 'older_peer', persona_id: 'copilot:tom', persona_name: 'Tom', persona_avatar: '/images/profile_2.png', guard_mode: false };
  (sendReviewedTutorResponse as jest.Mock).mockResolvedValue({ message: stored, room: cyberRoom });
  await act(async () => { await room.sendMessage('Reviewed reply'); });
  expect(sendReviewedTutorResponse).toHaveBeenCalledWith(expect.objectContaining({
    rawCharacter: 'victim', finalCharacter: 'older_peer', tutorId: tutorUser.id, tutorAction: 'modified',
    rawDecision: expect.objectContaining({ suggested_response: draft.raw_response }),
    generationProvenance: draft.generation_provenance,
  }));
  expect(room.messages.find(message => message.id === 'reply-1')).toMatchObject({
    user_id: tutorUser.id, character: 'older_peer', display_name: 'Tom', avatar_url: '/images/profile_2.png',
  });
  expect(room.cyberbullyingDraft).toBeNull();
});

test('logs regeneration and rejection through shared feedback and lets a new draft choose its role', async () => {
  await mount();
  await act(async () => { await room.generateAIResponse(); });
  await act(async () => { room.updateFinalCharacter('educator'); });
  (generateTutorSuggestion as jest.Mock).mockResolvedValue(response({ ...draft, raw_character: 'educator' }));
  await act(async () => { await room.regenerateAIResponse({}); });
  expect(generateTutorSuggestion).toHaveBeenLastCalledWith(cyberRoom.id, tutorUser.id, undefined,
    expect.objectContaining({ parentMessageId: learnerMessage.id, character: 'educator' }));
  expect((recordAISuggestionFeedback as jest.Mock).mock.calls[0]).toEqual([
    cyberRoom.id, tutorUser.id, learnerMessage.id, draft.raw_response, 'modified', draft.raw_response,
    undefined, expect.any(Number), [learnerMessage.id], false, null, draft.reason, false,
    { rawCharacter: 'victim', finalCharacter: 'educator', generationProvenance: draft.generation_provenance },
  ]);
  await act(async () => { await room.recordAIFeedback('rejected'); room.clearAISuggestion(); });
  expect((recordAISuggestionFeedback as jest.Mock).mock.calls[1][4]).toBe('rejected');
  await act(async () => { await room.generateAIResponse(); });
  expect(generateTutorSuggestion).toHaveBeenLastCalledWith(cyberRoom.id, tutorUser.id, undefined,
    expect.objectContaining({ parentMessageId: learnerMessage.id, character: null }));
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

test('retains the browser draft and character when regeneration fails, following ordinary reply behavior', async () => {
  await mount();
  await act(async () => { await room.generateAIResponse(); });
  await act(async () => { room.updateFinalCharacter('educator'); });
  (generateTutorSuggestion as jest.Mock).mockResolvedValueOnce({ success: false, error: 'Provider unavailable' });
  await act(async () => {
    await expect(room.regenerateAIResponse({})).rejects.toThrow('Provider unavailable');
  });
  expect(room.cyberbullyingDraft).toEqual(draft);
  expect(room.finalCharacter).toBe('educator');
  await act(async () => { await room.regenerateAIResponse({}); });
  expect(generateTutorSuggestion).toHaveBeenLastCalledWith(cyberRoom.id, tutorUser.id, undefined,
    expect.objectContaining({ parentMessageId: learnerMessage.id, character: 'educator' }));
});

test('records replacement as ignored with original text and edited character, then discard clears the draft', async () => {
  await mount();
  await act(async () => { await room.generateAIResponse(); });
  await act(async () => { room.updateFinalResponse('Edited browser text'); room.updateFinalCharacter('educator'); });
  await act(async () => { await room.generateAIResponse(); });
  const review = (recordAISuggestionFeedback as jest.Mock).mock.calls[0];
  expect(review[3]).toBe(draft.raw_response);
  expect(review[4]).toBe('ignored');
  expect(review[5]).toBe('Edited browser text');
  expect(review[13]).toMatchObject({ rawCharacter: 'victim', finalCharacter: 'educator' });
  await act(async () => { room.clearAISuggestion(); });
  expect(room.cyberbullyingDraft).toBeNull();
  expect(room.aiSuggestion).toBeNull();
  expect(sendReviewedTutorResponse).not.toHaveBeenCalled();
});

test('Guard-only override is accepted and carries independent raw/final Guard values', async () => {
  await mount();
  await act(async () => { await room.generateAIResponse(); });
  await act(async () => { room.updateFinalGuardMode(true); });
  (sendReviewedTutorResponse as jest.Mock).mockResolvedValue({
    message: { ...learnerMessage, id: 'guard-reply', user_role: 'tutor', user_id: tutorUser.id }, room: cyberRoom,
  });
  await act(async () => { await room.sendMessage(draft.raw_response); });
  expect(sendReviewedTutorResponse).toHaveBeenCalledWith(expect.objectContaining({
    tutorAction: 'accepted', rawCharacter: 'victim', finalCharacter: 'victim',
    rawDecision: expect.objectContaining({ guard_mode: false }), finalGuardMode: true,
  }));
});

test('a character-only edit is modified even when the original text and Guard are unchanged', async () => {
  await mount();
  await act(async () => { await room.generateAIResponse(); });
  await act(async () => { room.updateFinalCharacter('older_peer'); });
  (sendReviewedTutorResponse as jest.Mock).mockResolvedValue({
    message: { ...learnerMessage, id: 'character-reply', user_role: 'tutor', user_id: tutorUser.id }, room: cyberRoom,
  });
  await act(async () => { await room.sendMessage(draft.raw_response); });
  expect(sendReviewedTutorResponse).toHaveBeenCalledWith(expect.objectContaining({
    tutorAction: 'modified', rawCharacter: 'victim', finalCharacter: 'older_peer',
    finalResponse: draft.raw_response, finalGuardMode: false,
  }));
});

test('discard invalidates a late generation result without publishing or restoring the draft', async () => {
  await mount();
  let resolve!: (value: ReturnType<typeof response>) => void;
  (generateTutorSuggestion as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
  let pending!: Promise<void>;
  await act(async () => { pending = room.generateAIResponse(); });
  await waitFor(() => expect(generateTutorSuggestion).toHaveBeenCalled());
  await act(async () => { room.clearAISuggestion(); });
  await act(async () => { resolve(response()); await pending; });
  expect(room.cyberbullyingDraft).toBeNull();
  expect(room.aiSuggestion).toBeNull();
  expect(sendReviewedTutorResponse).not.toHaveBeenCalled();
});
