/**
 * UserProfile Page Tests
 * 
 * Test basic rendering and functionality
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import UserProfile from '../UserProfile';
import { useAuth } from '../../contexts/AuthContext';

// Mock the auth context
jest.mock('../../contexts/AuthContext', () => ({
    useAuth: jest.fn()
}));

// Mock the image upload services
jest.mock('../../services/imageUpload', () => ({
    deleteAvatarImage: jest.fn(),
    uploadAvatarImage: jest.fn(),
    validateImageFile: jest.fn()
}));

// Mock supabase
jest.mock('../../services/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            update: jest.fn(() => ({
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null
                })
            }))
        }))
    }
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const renderWithRouter = (component: React.ReactElement) => {
    return render(
        <BrowserRouter>
            {component}
        </BrowserRouter>
    );
};

describe('UserProfile Page', () => {
    const mockUser = {
        id: 'test-user-id',
        display_name: 'Test User',
        current_role: 'student' as const,
        status: 'active' as const,
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
    };

    const mockSignOut = jest.fn();
    const mockSetUserRole = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockUseAuth.mockReturnValue({
            user: mockUser,
            loading: false,
            joinWithNameAndRole: jest.fn(),
            signOut: mockSignOut,
            setUserRole: mockSetUserRole
        });
    });

    describe('Rendering', () => {
        it('should render user profile page', () => {
            renderWithRouter(<UserProfile />);
            
            expect(screen.getByText('User Profile')).toBeInTheDocument();
            expect(screen.getByText('Profile Picture')).toBeInTheDocument();
            expect(screen.getByText('Profile Information')).toBeInTheDocument();
        });

        it('should display user information', () => {
            renderWithRouter(<UserProfile />);
            
            expect(screen.getAllByText('Test User')).toHaveLength(2); // Avatar section and profile section
            expect(screen.getAllByText('Student')).toHaveLength(2); // Avatar section and profile section
            expect(screen.getByText('Edit Profile')).toBeInTheDocument();
        });

        it('should show avatar upload component', () => {
            renderWithRouter(<UserProfile />);
            
            expect(screen.getByText(/Click to select avatar/)).toBeInTheDocument();
        });

        it('should show preset avatar options', () => {
            renderWithRouter(<UserProfile />);
            
            expect(screen.getByText('Choose from Preset Avatars')).toBeInTheDocument();
            expect(screen.getByText('Or Upload Custom Avatar')).toBeInTheDocument();
            expect(screen.getByAltText('Cute Avatar')).toBeInTheDocument();
        });

        it('should show navigation links', () => {
            renderWithRouter(<UserProfile />);
            
            expect(screen.getByText('← Back to Dashboard')).toBeInTheDocument();
            expect(screen.getByText('Sign Out')).toBeInTheDocument();
        });
    });

    describe('User with avatar', () => {
        it('should display current avatar and delete button', () => {
            const userWithAvatar = {
                ...mockUser,
                avatar_url: 'https://example.com/avatar.jpg'
            };

            mockUseAuth.mockReturnValue({
                user: userWithAvatar,
                loading: false,
                joinWithNameAndRole: jest.fn(),
                signOut: mockSignOut,
                setUserRole: mockSetUserRole
            });

            renderWithRouter(<UserProfile />);
            
            expect(screen.getByText('Delete Avatar')).toBeInTheDocument();
        });
    });

    describe('Edit Mode', () => {
        it('should enter edit mode when clicking edit button', () => {
            renderWithRouter(<UserProfile />);
            
            const editButton = screen.getByText('Edit Profile');
            fireEvent.click(editButton);
            
            expect(screen.getByText('Save')).toBeInTheDocument();
            expect(screen.getByText('Cancel')).toBeInTheDocument();
        });

        it('should cancel edit mode', () => {
            renderWithRouter(<UserProfile />);
            
            // Enter edit mode
            fireEvent.click(screen.getByText('Edit Profile'));
            
            // Cancel edit
            fireEvent.click(screen.getByText('Cancel'));
            
            expect(screen.getByText('Edit Profile')).toBeInTheDocument();
            expect(screen.queryByText('Save')).not.toBeInTheDocument();
        });
    });

    describe('Preset Avatar Selection', () => {
        it('should allow selecting preset avatars', () => {
            renderWithRouter(<UserProfile />);
            
            const avatarImage = screen.getByAltText('Cute Avatar');
            fireEvent.click(avatarImage.parentElement!);
            
            // Should call supabase update function
            expect(require('../../services/supabase').supabase.from).toHaveBeenCalledWith('users');
        });
    });

    describe('Actions', () => {
        it('should handle sign out', () => {
            renderWithRouter(<UserProfile />);
            
            const signOutButton = screen.getByText('Sign Out');
            fireEvent.click(signOutButton);
            
            expect(mockSignOut).toHaveBeenCalled();
        });
    });

    describe('Loading State', () => {
        it('should show loading when authentication is being checked', () => {
            mockUseAuth.mockReturnValue({
                user: null,
                loading: true,
                joinWithNameAndRole: jest.fn(),
                signOut: mockSignOut,
                setUserRole: mockSetUserRole
            });

            renderWithRouter(<UserProfile />);
            
            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });
    });

    describe('Unauthenticated User', () => {
        it('should redirect when user is not authenticated', () => {
            mockUseAuth.mockReturnValue({
                user: null,
                loading: false,
                joinWithNameAndRole: jest.fn(),
                signOut: mockSignOut,
                setUserRole: mockSetUserRole
            });

            renderWithRouter(<UserProfile />);
            
            // Component should return null and redirect
            expect(screen.queryByText('User Profile')).not.toBeInTheDocument();
        });
    });

    describe('Different User Roles', () => {
        it('should show correct navigation link for tutor', () => {
            const tutorUser = { ...mockUser, current_role: 'tutor' as const };
            
            mockUseAuth.mockReturnValue({
                user: tutorUser,
                loading: false,
                joinWithNameAndRole: jest.fn(),
                signOut: mockSignOut,
                setUserRole: mockSetUserRole
            });

            renderWithRouter(<UserProfile />);
            
            const backLink = screen.getByText('← Back to Dashboard');
            expect(backLink).toHaveAttribute('href', '/tutor');
        });

        it('should show correct navigation link for observer', () => {
            const observerUser = { ...mockUser, current_role: 'observer' as const };
            
            mockUseAuth.mockReturnValue({
                user: observerUser,
                loading: false,
                joinWithNameAndRole: jest.fn(),
                signOut: mockSignOut,
                setUserRole: mockSetUserRole
            });

            renderWithRouter(<UserProfile />);
            
            const backLink = screen.getByText('← Back to Dashboard');
            expect(backLink).toHaveAttribute('href', '/observer');
        });
    });
});