import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom';
import TutorView from '../pages/TutorView';
import RoomPagePost from '../pages/RoomPagePost';
import RoomCard from '../components/RoomCard';
import PostComment from '../components/PostComment';
import RoomPost from '../components/RoomPost';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { RoomProvider } from '../contexts/RoomContext';
import * as supabaseService from '../services/supabase';

// Mock Supabase service
jest.mock('../services/supabase');
jest.mock('../contexts/AuthContext', () => ({
    ...jest.requireActual('../contexts/AuthContext'),
    useAuth: jest.fn()
}));

// Mock implementations
const mockCreateRoom = jest.fn();
const mockGetRoomsByTutor = jest.fn();
const mockUseAuth = useAuth as jest.Mock;
let mockRoomQueryData: any = null;
const mockRoomChannel = {
    on: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
};

const createSupabaseQuery = (data: any = null) => {
    const query: any = {};
    query.select = jest.fn().mockReturnValue(query);
    query.eq = jest.fn().mockReturnValue(query);
    query.in = jest.fn().mockResolvedValue({ data: [], error: null });
    query.order = jest.fn().mockResolvedValue({ data: [], error: null });
    query.limit = jest.fn().mockResolvedValue({ data: [], error: null });
    query.single = jest.fn().mockResolvedValue({ data, error: null });
    return query;
};

// Setup mocks
beforeEach(() => {
    jest.clearAllMocks();
    mockRoomQueryData = null;
    
    (supabaseService.createRoom as jest.Mock) = mockCreateRoom;
    (supabaseService.getRoomsByTutor as jest.Mock) = mockGetRoomsByTutor;
    (supabaseService.getRoomTemplatesByTutor as jest.Mock).mockResolvedValue([]);
    (supabaseService.supabase.from as jest.Mock) = jest.fn().mockImplementation((table: string) =>
        createSupabaseQuery(table === 'rooms' ? mockRoomQueryData : null)
    );
    mockRoomChannel.on.mockReturnThis();
    mockRoomChannel.subscribe.mockReturnThis();
    (supabaseService.supabase.channel as jest.Mock) = jest.fn().mockReturnValue(mockRoomChannel);
});

describe('Room OP Configuration', () => {
    const mockTutor = {
        id: 'tutor-123',
        email: 'tutor@test.com',
        display_name: 'John Tutor',
        current_role: 'tutor' as const,
        status: 'active' as const,
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const mockRoomWithProfileOP = {
        id: 'room-123',
        tutor_id: 'tutor-123',
        title: 'Personal Study Session',
        description: 'One-on-one tutoring',
        image_url: null,
        is_active: true,
        ai_assistant_enabled: false,
        ai_assistant_model: null,
        ai_assistant_prompt: null,
        pre_populated_dialogue: null,
        op_id: 'tutor-123',
        op_display_name: 'John Tutor',
        op_avatar_url: 'https://example.com/avatar.jpg',
        password: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const mockRoomWithCustomOP = {
        id: 'room-456',
        tutor_id: 'tutor-123',
        title: 'Corporate Training',
        description: 'Company-wide security training',
        image_url: null,
        is_active: true,
        ai_assistant_enabled: false,
        ai_assistant_model: null,
        ai_assistant_prompt: null,
        pre_populated_dialogue: null,
        op_id: null,
        op_display_name: 'Security Department',
        op_avatar_url: null,
        password: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    describe('OP Configuration in Room Creation', () => {
        it('should show OP configuration section in room creation form', async () => {
            mockGetRoomsByTutor.mockResolvedValueOnce([]);
            mockUseAuth.mockReturnValue({ user: mockTutor, loading: false });
            
            const TestApp = () => (
                <MemoryRouter initialEntries={['/tutor']}>
                    <AuthProvider>
                        <RoomProvider>
                            <Routes>
                                <Route path="/tutor" element={<TutorView />} />
                            </Routes>
                        </RoomProvider>
                    </AuthProvider>
                </MemoryRouter>
            );

            render(<TestApp />);

            // Click create room button
            const createButton = await screen.findByRole('button', { name: /Create a new Room/i });
            fireEvent.click(createButton);

            // Check for OP settings section
            expect(screen.getByText('Original Poster (OP) Settings')).toBeInTheDocument();
            expect(screen.getByText('Use my profile as OP')).toBeInTheDocument();
            expect(screen.getByText('Use custom OP name')).toBeInTheDocument();
            
            // Default selection should be profile
            const profileRadio = screen.getAllByRole('radio')[0] as HTMLInputElement;
            expect(profileRadio.checked).toBe(true);
            
            // Should show tutor name preview
            expect(screen.getByText((_, element) => element?.textContent === 'OP will be: John Tutor')).toBeInTheDocument();
        });

        it('should create room with tutor profile as OP by default', async () => {
            mockCreateRoom.mockResolvedValueOnce(mockRoomWithProfileOP);
            mockGetRoomsByTutor.mockResolvedValueOnce([]);
            mockUseAuth.mockReturnValue({ user: mockTutor, loading: false });
            
            const TestApp = () => (
                <MemoryRouter initialEntries={['/tutor']}>
                    <AuthProvider>
                        <RoomProvider>
                            <Routes>
                                <Route path="/tutor" element={<TutorView />} />
                            </Routes>
                        </RoomProvider>
                    </AuthProvider>
                </MemoryRouter>
            );

            render(<TestApp />);

            // Click create room button
            const createButton = await screen.findByRole('button', { name: /Create a new Room/i });
            fireEvent.click(createButton);

            // Fill in room details
            const titleInput = screen.getByLabelText('Room Title');
            fireEvent.change(titleInput, { target: { value: 'Personal Study Session' } });

            // Submit form (using default OP settings)
            const submitButton = screen.getByText('🚀 Create Room');
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(mockCreateRoom).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Personal Study Session',
                        op_id: 'tutor-123',
                        op_display_name: 'John Tutor',
                        op_avatar_url: 'https://example.com/avatar.jpg'
                    })
                );
            });
        });

        it('should create room with custom OP name when selected', async () => {
            mockCreateRoom.mockResolvedValueOnce(mockRoomWithCustomOP);
            mockGetRoomsByTutor.mockResolvedValueOnce([]);
            mockUseAuth.mockReturnValue({ user: mockTutor, loading: false });
            
            const TestApp = () => (
                <MemoryRouter initialEntries={['/tutor']}>
                    <AuthProvider>
                        <RoomProvider>
                            <Routes>
                                <Route path="/tutor" element={<TutorView />} />
                            </Routes>
                        </RoomProvider>
                    </AuthProvider>
                </MemoryRouter>
            );

            render(<TestApp />);

            // Click create room button
            const createButton = await screen.findByRole('button', { name: /Create a new Room/i });
            fireEvent.click(createButton);

            // Fill in room details
            const titleInput = screen.getByLabelText('Room Title');
            fireEvent.change(titleInput, { target: { value: 'Corporate Training' } });

            // Select custom OP option
            fireEvent.click(screen.getByText('Use custom OP name'));
            expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(true);

            // Enter custom OP name
            const customOPInput = screen.getByPlaceholderText('Enter custom OP name');
            expect(customOPInput).toBeInTheDocument();
            fireEvent.change(customOPInput, { target: { value: 'Security Department' } });

            // Submit form
            const submitButton = screen.getByText('🚀 Create Room');
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(mockCreateRoom).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Corporate Training',
                        op_id: null,
                        op_display_name: 'Security Department',
                        op_avatar_url: null
                    })
                );
            });
        });

        it('should validate custom OP name when selected', async () => {
            mockGetRoomsByTutor.mockResolvedValueOnce([]);
            mockUseAuth.mockReturnValue({ user: mockTutor, loading: false });
            
            const TestApp = () => (
                <MemoryRouter initialEntries={['/tutor']}>
                    <AuthProvider>
                        <RoomProvider>
                            <Routes>
                                <Route path="/tutor" element={<TutorView />} />
                            </Routes>
                        </RoomProvider>
                    </AuthProvider>
                </MemoryRouter>
            );

            render(<TestApp />);

            // Click create room button
            const createButton = await screen.findByRole('button', { name: /Create a new Room/i });
            fireEvent.click(createButton);

            // Fill in room details
            const titleInput = screen.getByLabelText('Room Title');
            fireEvent.change(titleInput, { target: { value: 'Test Room' } });

            // Select custom OP option but don't enter name
            fireEvent.click(screen.getByText('Use custom OP name'));
            expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(true);

            // Submit form without entering custom OP name
            const submitButton = screen.getByText('🚀 Create Room');
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getAllByText('Custom OP name is required when using custom OP').length).toBeGreaterThan(0);
                expect(mockCreateRoom).not.toHaveBeenCalled();
            });
        });
    });

    describe('OP Display in Room Components', () => {
        it('should display profile OP in RoomPost when showOp is true', () => {
            render(
                <RoomPost
                    room={mockRoomWithProfileOP}
                    tutor={mockTutor}
                    messageCount={0}
                    participantCount={1}
                    showOp={true}
                />
            );

            expect(screen.getByText('John Tutor')).toBeInTheDocument();
            expect(screen.getByText('📝 OP')).toBeInTheDocument();
            expect(screen.queryByText('👨‍🏫 Tutor')).not.toBeInTheDocument();
        });

        it('should display custom OP in RoomPost when showOp is true', () => {
            render(
                <RoomPost
                    room={mockRoomWithCustomOP}
                    tutor={mockTutor}
                    messageCount={0}
                    participantCount={1}
                    showOp={true}
                />
            );

            expect(screen.getByText('Security Department')).toBeInTheDocument();
            expect(screen.getByText('📝 OP')).toBeInTheDocument();
        });

        it('should display tutor info when showOp is false', () => {
            render(
                <RoomPost
                    room={mockRoomWithProfileOP}
                    tutor={mockTutor}
                    messageCount={0}
                    participantCount={1}
                    showOp={false}
                />
            );

            expect(screen.getByText('John Tutor')).toBeInTheDocument();
            expect(screen.getByText('👨‍🏫 Tutor')).toBeInTheDocument();
            expect(screen.queryByText('📝 OP')).not.toBeInTheDocument();
        });

        it('should display OP in RoomCard when showOp is true', () => {
            render(
                <RoomCard
                    room={mockRoomWithCustomOP}
                    tutor={mockTutor}
                    onJoin={() => {}}
                    showOp={true}
                />
            );

            expect(screen.getByText('OP:')).toBeInTheDocument();
            expect(screen.getByText('Security Department')).toBeInTheDocument();
            expect(screen.queryByText('Tutor:')).not.toBeInTheDocument();
        });

        it('should display tutor in RoomCard when showOp is false', () => {
            render(
                <RoomCard
                    room={mockRoomWithCustomOP}
                    tutor={mockTutor}
                    onJoin={() => {}}
                    showOp={false}
                />
            );

            expect(screen.getByText('Tutor:')).toBeInTheDocument();
            expect(screen.getByText('John Tutor')).toBeInTheDocument();
            expect(screen.queryByText('OP:')).not.toBeInTheDocument();
        });
    });

    describe('RoomPagePost OP Display', () => {
        it('should always show OP in RoomPagePost', async () => {
            mockRoomQueryData = mockRoomWithCustomOP;
            mockUseAuth.mockReturnValue({ user: mockTutor, loading: false });

            const TestApp = () => (
                <MemoryRouter initialEntries={['/room/room-456']}>
                    <AuthProvider>
                        <RoomProvider>
                            <Routes>
                                <Route path="/room/:roomId" element={<RoomPagePost />} />
                            </Routes>
                        </RoomProvider>
                    </AuthProvider>
                </MemoryRouter>
            );

            render(<TestApp />);

            // RoomPagePost should have showOp={true} by default
            await waitFor(() => {
                expect(screen.getByText('Security Department')).toBeInTheDocument();
                expect(screen.getByText('📝 OP')).toBeInTheDocument();
            });
        });
    });

    describe('PostComment feedback display', () => {
        it('should render updated feedback stats when thumb ratings change', () => {
            const message = {
                id: 'message-1',
                room_id: 'room-456',
                user_id: 'student-456',
                content: 'This response helped me understand the red flags.',
                user_role: 'student' as const,
                ai_model_used: null,
                ai_response_time_ms: null,
                parent_message_id: null,
                created_at: new Date().toISOString(),
                display_name: 'Student One',
                avatar_url: null
            };

            const { rerender } = render(
                <PostComment
                    message={message}
                    currentUserId="tutor-123"
                    currentUserRole="tutor"
                    feedbackStats={{
                        message_id: message.id,
                        total_feedback_count: 0,
                        like_count: 0,
                        dislike_count: 0,
                        average_like_rating: null,
                        average_dislike_rating: null,
                        overall_average_rating: null,
                        user_feedback: null
                    }}
                />
            );

            expect(screen.queryByText('(4.0★)')).not.toBeInTheDocument();
            expect(screen.queryByText('(2.0★)')).not.toBeInTheDocument();

            rerender(
                <PostComment
                    message={message}
                    currentUserId="tutor-123"
                    currentUserRole="tutor"
                    feedbackStats={{
                        message_id: message.id,
                        total_feedback_count: 1,
                        like_count: 1,
                        dislike_count: 0,
                        average_like_rating: 4,
                        average_dislike_rating: null,
                        overall_average_rating: 4,
                        user_feedback: null
                    }}
                />
            );

            expect(screen.getByText('(4.0★)')).toBeInTheDocument();

            rerender(
                <PostComment
                    message={message}
                    currentUserId="tutor-123"
                    currentUserRole="tutor"
                    feedbackStats={{
                        message_id: message.id,
                        total_feedback_count: 1,
                        like_count: 0,
                        dislike_count: 1,
                        average_like_rating: null,
                        average_dislike_rating: 2,
                        overall_average_rating: 2,
                        user_feedback: null
                    }}
                />
            );

            expect(screen.queryByText('(4.0★)')).not.toBeInTheDocument();
            expect(screen.getByText('(2.0★)')).toBeInTheDocument();
        });
    });
});
