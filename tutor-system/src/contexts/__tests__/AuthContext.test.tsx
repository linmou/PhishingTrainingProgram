/**
 * Unit Tests for AuthContext - Task 3
 * 
 * Test Strategy: "Test Supabase Auth login/logout, role selection updates database, auth state persistence across page refresh"
 * 
 * This test suite covers:
 * - Supabase Authentication (login/logout)
 * - User registration and profile creation
 * - Role selection and capacity management
 * - Auth state persistence
 * - Error handling scenarios
 * - Context provider functionality
 * 
 * Run with: npm test src/contexts/__tests__/AuthContext.test.tsx
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../AuthContext';
import { supabase } from '../../services/supabase';
import { User, UserRole } from '../../types';

// Mock Supabase
jest.mock('../../services/supabase', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(),
            onAuthStateChange: jest.fn(),
            signInWithPassword: jest.fn(),
            signUp: jest.fn(),
            signOut: jest.fn(),
            getUser: jest.fn()
        },
        from: jest.fn()
    },
    getCurrentUser: jest.fn(),
    getUserProfile: jest.fn(),
    updateUserProfile: jest.fn()
}));

// Test component to access auth context
const TestComponent: React.FC = () => {
    const { user, loading, signIn, signUp, signOut, setUserRole } = useAuth();

    const handleSignIn = async () => {
        try {
            await signIn('test@example.com', 'password');
        } catch (error) {
            // Errors are expected in tests, silently handle them
        }
    };

    const handleSignUp = async () => {
        try {
            await signUp('test@example.com', 'password', 'Test User');
        } catch (error) {
            // Errors are expected in tests, silently handle them
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (error) {
            // Errors are expected in tests, silently handle them
        }
    };

    const handleSetRole = async (role: UserRole) => {
        try {
            await setUserRole(role);
        } catch (error) {
            // Errors are expected in tests, silently handle them
        }
    };

    return (
        <div>
            <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
            <div data-testid="user">{user ? JSON.stringify(user) : 'no-user'}</div>
            <button onClick={handleSignIn}>Sign In</button>
            <button onClick={handleSignUp}>Sign Up</button>
            <button onClick={handleSignOut}>Sign Out</button>
            <button onClick={() => handleSetRole('tutor')}>Set Tutor Role</button>
            <button onClick={() => handleSetRole('student')}>Set Student Role</button>
            <button onClick={() => handleSetRole('observer')}>Set Observer Role</button>
        </div>
    );
};

// Helper component that exposes auth functions for direct testing
const TestHelper: React.FC<{ onAuthFunctions?: (functions: any) => void }> = ({ onAuthFunctions }) => {
    const authFunctions = useAuth();

    React.useEffect(() => {
        if (onAuthFunctions) {
            onAuthFunctions(authFunctions);
        }
    }, [authFunctions, onAuthFunctions]);

    return null;
};

describe('AuthContext - Task 3 Tests', () => {
    let mockUser: User;
    let mockSubscription: any;
    let mockAuthStateCallback: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockUser = {
            id: 'test-user-id',
            email: 'test@example.com',
            display_name: 'Test User',
            current_role: null,
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
        };

        mockSubscription = {
            unsubscribe: jest.fn()
        };

        // Setup auth state change listener mock
        (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
            mockAuthStateCallback = callback;
            return { data: { subscription: mockSubscription } };
        });

        // Setup default session response
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: null },
            error: null
        });
    });

    describe('AuthProvider Initialization', () => {
        it('should initialize with loading state', async () => {
            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: { session: null },
                error: null
            });

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            expect(screen.getByTestId('loading')).toHaveTextContent('loading');

            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
            });
        });

        it('should load user profile when session exists', async () => {
            const mockSession = {
                user: { id: mockUser.id, email: mockUser.email }
            };

            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: { session: mockSession },
                error: null
            });

            const { getUserProfile } = require('../../services/supabase');
            (getUserProfile as jest.Mock).mockResolvedValue(mockUser);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(getUserProfile).toHaveBeenCalledWith(mockUser.id);
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });
        });

        it('should setup auth state change listener', () => {
            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();
        });

        it('should cleanup subscription on unmount', () => {
            const { unmount } = render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            unmount();

            expect(mockSubscription.unsubscribe).toHaveBeenCalled();
        });
    });

    describe('Sign In Functionality', () => {
        it('should sign in user successfully', async () => {
            (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
                data: { user: { id: mockUser.id } },
                error: null
            });

            const { getUserProfile } = require('../../services/supabase');
            (getUserProfile as jest.Mock).mockResolvedValue(mockUser);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await act(async () => {
                screen.getByText('Sign In').click();
            });

            expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password'
            });
        });

        it('should handle sign in errors', async () => {
            const mockError = { message: 'Invalid credentials', name: 'Error' };
            (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
                data: { user: null },
                error: mockError
            });

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await act(async () => {
                screen.getByText('Sign In').click();
            });

            // Loading should be reset on error
            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
            });
        });

        it('should handle SIGNED_IN auth state change', async () => {
            const { getUserProfile } = require('../../services/supabase');
            (getUserProfile as jest.Mock).mockResolvedValue(mockUser);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            // Simulate SIGNED_IN event
            await act(async () => {
                await mockAuthStateCallback('SIGNED_IN', {
                    user: { id: mockUser.id }
                });
            });

            expect(getUserProfile).toHaveBeenCalledWith(mockUser.id);
        });
    });

    describe('Sign Up Functionality', () => {
        it('should sign up user successfully and create profile', async () => {
            const mockAuthUser = { id: mockUser.id, email: mockUser.email };

            (supabase.auth.signUp as jest.Mock).mockResolvedValue({
                data: { user: mockAuthUser },
                error: null
            });

            const mockFromChain = {
                insert: jest.fn().mockResolvedValue({
                    data: mockUser,
                    error: null
                })
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await act(async () => {
                screen.getByText('Sign Up').click();
            });

            expect(supabase.auth.signUp).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password'
            });

            expect(supabase.from).toHaveBeenCalledWith('users');
            expect(mockFromChain.insert).toHaveBeenCalledWith({
                id: mockUser.id,
                email: mockUser.email,
                display_name: 'Test User',
                status: 'active'
            });
        });

        it('should handle sign up auth errors', async () => {
            const mockError = { message: 'Email already exists', name: 'Error' };
            (supabase.auth.signUp as jest.Mock).mockResolvedValue({
                data: { user: null },
                error: mockError
            });

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await act(async () => {
                screen.getByText('Sign Up').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
            });
        });

        it('should handle profile creation errors', async () => {
            const mockAuthUser = { id: mockUser.id, email: mockUser.email };

            (supabase.auth.signUp as jest.Mock).mockResolvedValue({
                data: { user: mockAuthUser },
                error: null
            });

            const mockError = { message: 'Profile creation failed', name: 'Error' };
            const mockFromChain = {
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: mockError
                })
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await act(async () => {
                screen.getByText('Sign Up').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
            });
        });
    });

    describe('Sign Out Functionality', () => {
        it('should sign out user successfully', async () => {
            (supabase.auth.signOut as jest.Mock).mockResolvedValue({
                error: null
            });

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await act(async () => {
                screen.getByText('Sign Out').click();
            });

            expect(supabase.auth.signOut).toHaveBeenCalled();
        });

        it('should handle sign out errors', async () => {
            const mockError = new Error('Sign out failed');
            (supabase.auth.signOut as jest.Mock).mockResolvedValue({
                error: mockError
            });

            let authFunctions: any;
            render(
                <AuthProvider>
                    <TestComponent />
                    <TestHelper onAuthFunctions={(functions) => { authFunctions = functions; }} />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(authFunctions).toBeDefined();
            });

            await expect(authFunctions.signOut()).rejects.toThrow('Sign out failed');
        });

        it('should handle SIGNED_OUT auth state change', async () => {
            // Start with a logged in user
            const { getUserProfile } = require('../../services/supabase');
            (getUserProfile as jest.Mock).mockResolvedValue(mockUser);

            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: { session: { user: { id: mockUser.id } } },
                error: null
            });

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            // Wait for initial load
            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });

            // Simulate SIGNED_OUT event
            await act(async () => {
                await mockAuthStateCallback('SIGNED_OUT', null);
            });

            expect(screen.getByTestId('user')).toHaveTextContent('no-user');
            expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
        });
    });

    describe('Role Selection and Capacity Management', () => {
        beforeEach(() => {
            // Setup user as logged in
            const { getUserProfile } = require('../../services/supabase');
            (getUserProfile as jest.Mock).mockResolvedValue(mockUser);

            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: { session: { user: { id: mockUser.id } } },
                error: null
            });
        });

        it('should set tutor role when capacity allows', async () => {
            // Mock capacity check - no active tutors
            const mockFromChain = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        not: jest.fn().mockResolvedValue({
                            data: [], // No active users
                            error: null
                        })
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            const { updateUserProfile } = require('../../services/supabase');
            const updatedUser = { ...mockUser, current_role: 'tutor' as UserRole };
            (updateUserProfile as jest.Mock).mockResolvedValue(updatedUser);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            // Wait for initial load
            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });

            await act(async () => {
                screen.getByText('Set Tutor Role').click();
            });

            expect(updateUserProfile).toHaveBeenCalledWith(mockUser.id, {
                current_role: 'tutor',
                updated_at: expect.any(String)
            });
        });

        it('should prevent setting tutor role when capacity reached', async () => {
            // Mock capacity check - one active tutor already
            const mockFromChain = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        not: jest.fn().mockResolvedValue({
                            data: [
                                { id: 'other-user-id', current_role: 'tutor' }
                            ],
                            error: null
                        })
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            let authFunctions: any;
            render(
                <AuthProvider>
                    <TestComponent />
                    <TestHelper onAuthFunctions={(functions) => { authFunctions = functions; }} />
                </AuthProvider>
            );

            // Wait for initial load
            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
                expect(authFunctions).toBeDefined();
            });

            await expect(authFunctions.setUserRole('tutor')).rejects.toThrow('Maximum number of tutors (1) already reached');
        });

        it('should set student role when capacity allows', async () => {
            // Mock capacity check - no active students
            const mockFromChain = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        not: jest.fn().mockResolvedValue({
                            data: [], // No active users
                            error: null
                        })
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            const { updateUserProfile } = require('../../services/supabase');
            const updatedUser = { ...mockUser, current_role: 'student' as UserRole };
            (updateUserProfile as jest.Mock).mockResolvedValue(updatedUser);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            // Wait for initial load
            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });

            await act(async () => {
                screen.getByText('Set Student Role').click();
            });

            expect(updateUserProfile).toHaveBeenCalledWith(mockUser.id, {
                current_role: 'student',
                updated_at: expect.any(String)
            });
        });

        it('should prevent setting student role when capacity reached', async () => {
            // Mock capacity check - one active student already
            const mockFromChain = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        not: jest.fn().mockResolvedValue({
                            data: [
                                { id: 'other-user-id', current_role: 'student' }
                            ],
                            error: null
                        })
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            let authFunctions: any;
            render(
                <AuthProvider>
                    <TestComponent />
                    <TestHelper onAuthFunctions={(functions) => { authFunctions = functions; }} />
                </AuthProvider>
            );

            // Wait for initial load
            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
                expect(authFunctions).toBeDefined();
            });

            await expect(authFunctions.setUserRole('student')).rejects.toThrow('Maximum number of students (1) already reached');
        });

        it('should allow unlimited observers', async () => {
            // Observer role shouldn't check capacity
            const { updateUserProfile } = require('../../services/supabase');
            const updatedUser = { ...mockUser, current_role: 'observer' as UserRole };
            (updateUserProfile as jest.Mock).mockResolvedValue(updatedUser);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            // Wait for initial load
            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });

            await act(async () => {
                screen.getByText('Set Observer Role').click();
            });

            expect(updateUserProfile).toHaveBeenCalledWith(mockUser.id, {
                current_role: 'observer',
                updated_at: expect.any(String)
            });

            // Should not have called capacity check for observer
            expect(supabase.from).not.toHaveBeenCalledWith('users');
        });

        it('should handle role selection errors', async () => {
            const { updateUserProfile } = require('../../services/supabase');
            (updateUserProfile as jest.Mock).mockRejectedValue(new Error('Update failed'));

            let authFunctions: any;
            render(
                <AuthProvider>
                    <TestComponent />
                    <TestHelper onAuthFunctions={(functions) => { authFunctions = functions; }} />
                </AuthProvider>
            );

            // Wait for initial load
            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
                expect(authFunctions).toBeDefined();
            });

            await expect(authFunctions.setUserRole('observer')).rejects.toThrow('Update failed');
        });

        it('should throw error when no user is logged in', async () => {
            // Start with no user
            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: { session: null },
                error: null
            });

            let authFunctions: any;
            render(
                <AuthProvider>
                    <TestComponent />
                    <TestHelper onAuthFunctions={(functions) => { authFunctions = functions; }} />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent('no-user');
                expect(authFunctions).toBeDefined();
            });

            await expect(authFunctions.setUserRole('tutor')).rejects.toThrow('No user logged in');
        });
    });

    describe('Auth State Persistence', () => {
        it('should restore user session on page refresh', async () => {
            const mockSession = {
                user: { id: mockUser.id, email: mockUser.email }
            };

            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: { session: mockSession },
                error: null
            });

            const { getUserProfile } = require('../../services/supabase');
            (getUserProfile as jest.Mock).mockResolvedValue(mockUser);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            // Should automatically load user on mount
            await waitFor(() => {
                expect(getUserProfile).toHaveBeenCalledWith(mockUser.id);
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });
        });

        it('should handle session restoration errors gracefully', async () => {
            (supabase.auth.getSession as jest.Mock).mockRejectedValue(
                new Error('Session restoration failed')
            );

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            // Should still finish loading even with errors
            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
                expect(screen.getByTestId('user')).toHaveTextContent('no-user');
            });
        });

        it('should handle user profile loading errors during restoration', async () => {
            const mockSession = {
                user: { id: mockUser.id, email: mockUser.email }
            };

            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: { session: mockSession },
                error: null
            });

            const { getUserProfile } = require('../../services/supabase');
            (getUserProfile as jest.Mock).mockRejectedValue(new Error('Profile load failed'));

            // Mock console.error to avoid test output noise
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith('Error loading user profile:', expect.any(Error));
                expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
            });

            consoleSpy.mockRestore();
        });
    });

    describe('Context Error Handling', () => {
        it('should throw error when useAuth is used outside AuthProvider', () => {
            // Mock console.error to avoid test output noise
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            expect(() => {
                render(<TestComponent />);
            }).toThrow('useAuth must be used within an AuthProvider');

            consoleSpy.mockRestore();
        });
    });
}); 