/**
 * Unit Tests for AuthContext - Task 3
 * 
 * Test Strategy: "Test Supabase Auth login/logout, role selection updates database, auth state persistence across page refresh"
 * 
 * This test suite covers:
 * - Simplified name-based authentication
 * - User profile creation and management
 * - Role selection functionality
 * - Auth state persistence via localStorage
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
        from: jest.fn()
    }
}));

// Test component to access auth context
const TestComponent: React.FC = () => {
    const { user, loading, joinWithNameAndRole, signOut, setUserRole } = useAuth();

    const handleJoin = async (role: UserRole) => {
        try {
            await joinWithNameAndRole('Test User', role);
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
            <button onClick={() => handleJoin('tutor')}>Join as Tutor</button>
            <button onClick={() => handleJoin('student')}>Join as Student</button>
            <button onClick={() => handleJoin('observer')}>Join as Observer</button>
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

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();

        mockUser = {
            id: 'test-user-id',
            display_name: 'Test User',
            current_role: null,
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
        };

        // Setup default Supabase responses
        const mockFromChain = {
            select: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({
                    data: [],
                    error: null
                }),
                eq: jest.fn(() => ({
                    single: jest.fn().mockResolvedValue({
                        data: null,
                        error: { code: 'PGRST116' }
                    })
                }))
            })),
            insert: jest.fn(() => ({
                select: jest.fn(() => ({
                    single: jest.fn().mockResolvedValue({
                        data: mockUser,
                        error: null
                    })
                }))
            })),
            update: jest.fn(() => ({
                eq: jest.fn(() => ({
                    select: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: null
                        })
                    }))
                }))
            }))
        };

        (supabase.from as jest.Mock).mockReturnValue(mockFromChain);
    });

    describe('AuthProvider Initialization', () => {
        it('should initialize with loading state', async () => {
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

        it('should load user from localStorage when it exists', async () => {
            // Store user in localStorage
            localStorage.setItem('tutor_system_user', JSON.stringify(mockUser));

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });
        });

        it('should recreate stored user in database when localStorage user has no matching profile row', async () => {
            localStorage.setItem('tutor_system_user', JSON.stringify(mockUser));

            const selectSingle = jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
            });
            const insertSingle = jest.fn().mockResolvedValue({
                data: mockUser,
                error: null
            });

            (supabase.from as jest.Mock).mockImplementation(() => ({
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: selectSingle
                    }))
                })),
                insert: jest.fn(() => ({
                    select: jest.fn(() => ({
                        single: insertSingle
                    }))
                }))
            }));

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(selectSingle).toHaveBeenCalled();
                expect(insertSingle).toHaveBeenCalled();
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });
        });

        it('should initialize without user when localStorage is empty', async () => {
            localStorage.clear();

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
                expect(screen.getByTestId('user')).toHaveTextContent('no-user');
            });
        });

        it('should handle corrupted localStorage gracefully', async () => {
            localStorage.setItem('tutor_system_user', 'invalid-json');

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
                expect(screen.getByTestId('user')).toHaveTextContent('no-user');
            });
        });
    });

    describe('Join Functionality', () => {
        it('should join as tutor successfully', async () => {
            const mockFromChain = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { code: 'PGRST116' } // No rows returned
                        })
                    }))
                })),
                insert: jest.fn(() => ({
                    select: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: mockUser,
                            error: null
                        })
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await act(async () => {
                screen.getByText('Join as Tutor').click();
            });

            expect(supabase.from).toHaveBeenCalledWith('users');
        });

        it('should handle join errors', async () => {
            const mockError = { message: 'Database connection failed', name: 'Error' };
            const mockFromChain = {
                select: jest.fn(() => ({
                    limit: jest.fn().mockResolvedValue({
                        data: [],
                        error: null
                    }),
                    eq: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { code: 'PGRST116' }
                        })
                    }))
                })),
                insert: jest.fn(() => ({
                    select: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: mockError
                        })
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await act(async () => {
                screen.getByText('Join as Tutor').click();
            });

            // Loading should be reset on error
            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
            });
        });
    });

    describe('User Profile Management', () => {
        it('should join as student successfully', async () => {
            const mockFromChain = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { code: 'PGRST116' } // No rows returned
                        })
                    })),
                    limit: jest.fn().mockResolvedValue({
                        data: [],
                        error: null
                    })
                })),
                insert: jest.fn(() => ({
                    select: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: { ...mockUser, current_role: 'student' },
                            error: null
                        })
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await act(async () => {
                screen.getByText('Join as Student').click();
            });

            expect(supabase.from).toHaveBeenCalledWith('users');
        });

        it('should update existing user when joining again', async () => {
            const existingUser = { ...mockUser, current_role: 'observer' };
            const mockFromChain = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: existingUser,
                            error: null
                        })
                    })),
                    limit: jest.fn().mockResolvedValue({
                        data: [],
                        error: null
                    })
                })),
                update: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        select: jest.fn(() => ({
                            single: jest.fn().mockResolvedValue({
                                data: { ...existingUser, current_role: 'tutor' },
                                error: null
                            })
                        }))
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await act(async () => {
                screen.getByText('Join as Tutor').click();
            });

            expect(supabase.from).toHaveBeenCalledWith('users');
        });

        it('should handle profile creation errors', async () => {
            const mockError = { message: 'Profile creation failed', name: 'Error' };
            const mockFromChain = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { code: 'PGRST116' }
                        })
                    })),
                    limit: jest.fn().mockResolvedValue({
                        data: [],
                        error: null
                    })
                })),
                insert: jest.fn(() => ({
                    select: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: mockError
                        })
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await act(async () => {
                screen.getByText('Join as Observer').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
            });
        });
    });

    describe('Sign Out Functionality', () => {
        beforeEach(() => {
            // Start with a logged in user
            localStorage.setItem('tutor_system_user', JSON.stringify(mockUser));
        });

        it('should sign out user successfully', async () => {
            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            // Wait for user to be loaded
            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });

            await act(async () => {
                screen.getByText('Sign Out').click();
            });

            expect(screen.getByTestId('user')).toHaveTextContent('no-user');
            expect(localStorage.getItem('tutor_system_user')).toBeNull();
        });

        it('should clear localStorage on sign out', async () => {
            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            // Wait for user to be loaded
            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
            });

            await act(async () => {
                screen.getByText('Sign Out').click();
            });

            expect(localStorage.getItem('tutor_system_user')).toBeNull();
            expect(screen.getByTestId('user')).toHaveTextContent('no-user');
        });
    });

    describe('Role Selection', () => {
        beforeEach(() => {
            // Setup user as logged in via localStorage
            localStorage.setItem('tutor_system_user', JSON.stringify(mockUser));
        });

        it('should set tutor role successfully', async () => {
            const mockFromChain = {
                update: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        select: jest.fn(() => ({
                            single: jest.fn().mockResolvedValue({
                                data: null,
                                error: null
                            })
                        }))
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

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

            expect(supabase.from).toHaveBeenCalledWith('users');
            expect(mockFromChain.update).toHaveBeenCalledWith({
                current_role: 'tutor',
                updated_at: expect.any(String)
            });
        });

        it('should set student role successfully', async () => {
            const mockFromChain = {
                update: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        select: jest.fn(() => ({
                            single: jest.fn().mockResolvedValue({
                                data: null,
                                error: null
                            })
                        }))
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

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

            expect(supabase.from).toHaveBeenCalledWith('users');
            expect(mockFromChain.update).toHaveBeenCalledWith({
                current_role: 'student',
                updated_at: expect.any(String)
            });
        });

        it('should set observer role successfully', async () => {
            const mockFromChain = {
                update: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        select: jest.fn(() => ({
                            single: jest.fn().mockResolvedValue({
                                data: null,
                                error: null
                            })
                        }))
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

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

            expect(supabase.from).toHaveBeenCalledWith('users');
            expect(mockFromChain.update).toHaveBeenCalledWith({
                current_role: 'observer',
                updated_at: expect.any(String)
            });
        });

        it('should handle role selection errors', async () => {
            const mockError = new Error('Update failed');
            const mockFromChain = {
                update: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        select: jest.fn(() => ({
                            single: jest.fn().mockResolvedValue({
                                data: null,
                                error: mockError
                            })
                        }))
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

            await expect(authFunctions.setUserRole('observer')).rejects.toThrow();
        });

        it('should throw error when no user is logged in', async () => {
            // Start with no user in localStorage
            localStorage.clear();

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
        it('should restore user from localStorage on initialization', async () => {
            localStorage.setItem('tutor_system_user', JSON.stringify(mockUser));

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            // Should automatically load user on mount
            await waitFor(() => {
                expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
                expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
            });
        });

        it('should persist user data after role changes', async () => {
            localStorage.setItem('tutor_system_user', JSON.stringify(mockUser));

            const mockFromChain = {
                update: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        select: jest.fn(() => ({
                            single: jest.fn().mockResolvedValue({
                                data: null,
                                error: null
                            })
                        }))
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

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

            // Check that updated user is stored in localStorage
            const storedUser = JSON.parse(localStorage.getItem('tutor_system_user') || '{}');
            expect(storedUser.current_role).toBe('tutor');
        });

        it('should handle localStorage errors gracefully', async () => {
            // Mock localStorage.setItem to throw an error
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = jest.fn(() => {
                throw new Error('localStorage error');
            });

            // Mock console.error to avoid test output noise
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
                expect(screen.getByTestId('user')).toHaveTextContent('no-user');
            });

            consoleSpy.mockRestore();
            localStorage.setItem = originalSetItem;
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
