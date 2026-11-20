// Test support for room-page tests that mock AuthContext: the signed-in student already holds the room's
// learner seat (they entered through an explicit Join), so the room page opens as that learner.
// Use: jest.mock('<path>/services/roomSeatService', () => require('<path>/test-support/seatSignedInStudent'));
import { useAuth } from '../contexts/AuthContext';

export const readRoomLearnerIds = jest.fn(async (_roomId: string): Promise<string[]> => {
  const signedInId = (useAuth() as { user?: { id?: string } } | undefined)?.user?.id;
  return signedInId ? [signedInId] : [];
});
