import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TutorView from '../TutorView';
import { useAuth } from '../../contexts/AuthContext';
import { getRoomsByTutor } from '../../services/supabase';
import { useRoomLearningStatus } from '../../hooks/useRoomLearningStatus';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../hooks/useRoomLearningStatus', () => ({ useRoomLearningStatus: jest.fn() }));
jest.mock('../../services/supabase', () => ({ getRoomsByTutor: jest.fn(), getRoomTemplatesByTutor: jest.fn().mockResolvedValue([]) }));
const status = { learnerId: 'learner', learnerName: 'Previous learner', joinedAt: null, targetsSaved: true, hasMessages: true };

it('neither queries nor displays a previous owner\'s learner after identity changes', async () => {
  let user = { id: 'owner-a', display_name: 'A', current_role: 'tutor' };
  (useAuth as jest.Mock).mockImplementation(() => ({ user }));
  (getRoomsByTutor as jest.Mock).mockResolvedValueOnce([{ id: 'room-a', tutor_id: 'owner-a', title: 'Room A', is_active: true }]).mockImplementation(() => new Promise(() => {}));
  (useRoomLearningStatus as jest.Mock).mockReturnValue({ statuses: { 'room-a': status }, error: false });
  const view = render(<MemoryRouter><TutorView /></MemoryRouter>);
  await screen.findByText('Learner: Previous learner');
  user = { id: 'owner-b', display_name: 'B', current_role: 'tutor' };
  view.rerender(<MemoryRouter><TutorView /></MemoryRouter>);
  await waitFor(() => expect(useRoomLearningStatus).toHaveBeenLastCalledWith([], 'owner-b'));
  expect(screen.queryByText('Learner: Previous learner')).toBeNull();
  user = { id: 'owner-a', display_name: 'A', current_role: 'observer' };
  view.rerender(<MemoryRouter><TutorView /></MemoryRouter>);
  expect(useRoomLearningStatus).toHaveBeenLastCalledWith(['room-a'], undefined);
  expect(screen.queryByText('Learner: Previous learner')).toBeNull();
});
