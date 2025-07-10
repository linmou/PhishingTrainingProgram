import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SimpleLogin from '../SimpleLogin';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the auth context
const mockJoinWithNameAndRole = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
    ...jest.requireActual('../../contexts/AuthContext'),
    useAuth: () => ({
        joinWithNameAndRole: mockJoinWithNameAndRole,
        user: null,
        loading: false,
        signOut: jest.fn(),
        setUserRole: jest.fn()
    })
}));

// Mock supabase
jest.mock('../../services/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    not: jest.fn(() => ({
                        data: [],
                        error: null
                    }))
                }))
            })),
            insert: jest.fn(() => ({
                data: null,
                error: null
            }))
        }))
    }
}));

describe('SimpleLogin Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Clear localStorage
        localStorage.clear();
    });

    test('renders name input and role selection', () => {
        render(<SimpleLogin />);

        expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/student/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/tutor/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/observer/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /join session/i })).toBeInTheDocument();
    });

    test('shows error when submitting empty name', async () => {
        render(<SimpleLogin />);

        const submitButton = screen.getByRole('button', { name: /join session/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/please enter your name/i)).toBeInTheDocument();
        });

        expect(mockJoinWithNameAndRole).not.toHaveBeenCalled();
    });

    test('calls joinWithNameAndRole with correct parameters', async () => {
        mockJoinWithNameAndRole.mockResolvedValue(undefined);
        render(<SimpleLogin />);

        const nameInput = screen.getByLabelText(/your name/i);
        const tutorRadio = screen.getByLabelText(/tutor/i);
        const submitButton = screen.getByRole('button', { name: /join session/i });

        fireEvent.change(nameInput, { target: { value: 'John Doe' } });
        fireEvent.click(tutorRadio);
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockJoinWithNameAndRole).toHaveBeenCalledWith('John Doe', 'tutor');
        });
    });

    test('defaults to student role', () => {
        render(<SimpleLogin />);

        const studentRadio = screen.getByLabelText(/student/i) as HTMLInputElement;
        expect(studentRadio.checked).toBe(true);
    });

    test('allows role selection change', () => {
        render(<SimpleLogin />);

        const observerRadio = screen.getByLabelText(/observer/i) as HTMLInputElement;
        fireEvent.click(observerRadio);

        expect(observerRadio.checked).toBe(true);
    });

    test('shows loading state during submission', async () => {
        // Mock a delayed response
        mockJoinWithNameAndRole.mockImplementation(() =>
            new Promise(resolve => setTimeout(resolve, 100))
        );

        render(<SimpleLogin />);

        const nameInput = screen.getByLabelText(/your name/i);
        const submitButton = screen.getByRole('button', { name: /join session/i });

        fireEvent.change(nameInput, { target: { value: 'Test User' } });
        fireEvent.click(submitButton);

        expect(screen.getByText(/joining.../i)).toBeInTheDocument();
        expect(screen.getByText(/setting up your session.../i)).toBeInTheDocument();

        await waitFor(() => {
            expect(mockJoinWithNameAndRole).toHaveBeenCalled();
        });
    });

    test('handles join error gracefully', async () => {
        const errorMessage = 'Maximum number of tutors (1) already reached';
        mockJoinWithNameAndRole.mockRejectedValue(new Error(errorMessage));

        render(<SimpleLogin />);

        const nameInput = screen.getByLabelText(/your name/i);
        const tutorRadio = screen.getByLabelText(/tutor/i);
        const submitButton = screen.getByRole('button', { name: /join session/i });

        fireEvent.change(nameInput, { target: { value: 'Test User' } });
        fireEvent.click(tutorRadio);
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });
    });

    test('trims whitespace from name input', async () => {
        mockJoinWithNameAndRole.mockResolvedValue(undefined);
        render(<SimpleLogin />);

        const nameInput = screen.getByLabelText(/your name/i);
        const submitButton = screen.getByRole('button', { name: /join session/i });

        fireEvent.change(nameInput, { target: { value: '  John Doe  ' } });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockJoinWithNameAndRole).toHaveBeenCalledWith('John Doe', 'student');
        });
    });
}); 