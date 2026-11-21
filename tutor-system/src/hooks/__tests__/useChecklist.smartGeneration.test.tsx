/** Approved room targets become a draft until the learner owner is available. */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useChecklist } from '../useChecklist';
import { assessChecklistGenerationContext } from '../../services/checklistGenerationContext';

jest.mock('../../hooks/useRealtimeInvalidation', () => ({ useRealtimeInvalidation: () => null }));
jest.mock('../../contexts/AuthContext', () => ({ useOptionalAuth: () => ({ user: { id: 'tutor', current_role: 'tutor' } }) }));
jest.mock('../../services/roomFeaturesService', () => ({ RoomFeaturesService: { checklist: {
  read: jest.fn().mockResolvedValue(null), getActiveTransferChecklistForRoom: jest.fn().mockResolvedValue(null),
} } }));
jest.mock('../../services/checklistGenerationContext', () => ({ assessChecklistGenerationContext: jest.fn() }));

it.each([false, true])('saves approved targets locally with assessments enabled=%s until a learner joins', async enabled => {
  window.localStorage.clear();
  (assessChecklistGenerationContext as jest.Mock).mockResolvedValue({
    type: 'ready_for_extraction', detectionAreas: ['Protect location privacy'], verificationSteps: ['Use private messages'],
  });
  const { result } = renderHook(() => useChecklist('room', { enabled, studentId: null }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => result.current.startSmartGeneration());
  expect(assessChecklistGenerationContext).toHaveBeenCalledWith('room', true);
  expect(result.current.checklist?.id).toBe('draft-room');
  expect(JSON.parse(window.localStorage.getItem('room-learning-target-draft:room')!)).toEqual({
    detectionAreas: ['Protect location privacy'], verificationSteps: ['Use private messages'],
  });
});
