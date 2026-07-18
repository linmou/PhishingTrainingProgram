/**
 * Tests for StudentAIToneControl.tsx
 * Purpose: opt-in "Choose AI tone?" then Peer/Adult dropdown; multi-student hide.
 * Spec: features/student_ai_tone.feature
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StudentAIToneControl from '../StudentAIToneControl';
import { useRoom } from '../../contexts/RoomContext';
import { useAuth } from '../../contexts/AuthContext';

jest.mock('../../contexts/RoomContext', () => ({
  useRoom: jest.fn(),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('StudentAIToneControl (features/student_ai_tone.feature)', () => {
  const setStudentAITone = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 's1', current_role: 'student', display_name: 'Stu' },
    });
  });

  function mockRoom(overrides: Record<string, unknown> = {}) {
    (useRoom as jest.Mock).mockReturnValue({
      currentRoom: {
        id: 'room-1',
        ai_assistant_enabled: true,
      },
      participants: [
        { id: 't1', current_role: 'tutor', display_name: 'Tutor' },
        { id: 's1', current_role: 'student', display_name: 'Stu' },
      ],
      aiConfig: {
        prompt_config: {
          role: { role: 'high' },
        },
      },
      setStudentAITone,
      loadingAI: false,
      ...overrides,
    });
  }

  it('shows Choose AI tone? and not a tone dropdown before opt-in', () => {
    mockRoom();
    render(<StudentAIToneControl />);

    expect(
      screen.getByRole('button', { name: /choose ai tone\?/i })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/ai tone/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('reveals Peer and Adult options after opt-in click', () => {
    mockRoom();
    render(<StudentAIToneControl />);

    fireEvent.click(screen.getByRole('button', { name: /choose ai tone\?/i }));

    const select = screen.getByLabelText(/ai tone/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Peer' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Adult' })).toBeInTheDocument();
  });

  it('calls setStudentAITone with peer when Peer is selected', async () => {
    setStudentAITone.mockResolvedValue(undefined);
    mockRoom();
    render(<StudentAIToneControl />);

    fireEvent.click(screen.getByRole('button', { name: /choose ai tone\?/i }));
    fireEvent.change(screen.getByLabelText(/ai tone/i), {
      target: { value: 'peer' },
    });

    await waitFor(() => {
      expect(setStudentAITone).toHaveBeenCalledWith('peer');
    });
  });

  it('hides control when multiple students are present', () => {
    mockRoom({
      participants: [
        { id: 't1', current_role: 'tutor', display_name: 'Tutor' },
        { id: 's1', current_role: 'student', display_name: 'Stu' },
        { id: 's2', current_role: 'student', display_name: 'Stu2' },
      ],
    });
    render(<StudentAIToneControl />);

    expect(
      screen.queryByRole('button', { name: /choose ai tone\?/i })
    ).not.toBeInTheDocument();
  });

  it('hides control when AI is disabled', () => {
    mockRoom({
      currentRoom: { id: 'room-1', ai_assistant_enabled: false },
    });
    render(<StudentAIToneControl />);

    expect(
      screen.queryByRole('button', { name: /choose ai tone\?/i })
    ).not.toBeInTheDocument();
  });

  it('hides control for non-students', () => {
    mockRoom();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'o1', current_role: 'observer', display_name: 'Obs' },
    });
    render(<StudentAIToneControl />);

    expect(
      screen.queryByRole('button', { name: /choose ai tone\?/i })
    ).not.toBeInTheDocument();
  });

  it('shows dropdown already open when tone is already locked by student', () => {
    mockRoom({
      aiConfig: {
        prompt_config: {
          role: { role: 'low' },
          student_tone_lock: {
            locked: true,
            chosen_by_user_id: 's1',
            chosen_role: 'low',
          },
        },
      },
    });
    render(<StudentAIToneControl />);

    expect(
      screen.queryByRole('button', { name: /choose ai tone\?/i })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/ai tone/i)).toHaveValue('peer');
  });
});
