import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import StudentView from '../../pages/StudentView';
import ObserverView from '../../pages/ObserverView';
import RoomPage from '../../pages/RoomPage';
import { supabase } from '../../services/supabase';

// Mock Supabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(),
      getSession: jest.fn(),
    },
    from: jest.fn(),
    channel: jest.fn(),
  },
}));

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock AuthContext
let mockAuthUser: any = null;
const mockJoinWithNameAndRole = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    loading: false,
    joinWithNameAndRole: mockJoinWithNameAndRole,
    signOut: jest.fn(),
    setUserRole: jest.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock RoomContext
let mockRoomContextValue: any = {
  currentRoom: null,
  messages: [],
  loading: false,
  createRoom: jest.fn(),
  joinRoom: jest.fn(),
  leaveRoom: jest.fn(),
  sendMessage: jest.fn(),
  generateAIResponse: jest.fn(),
  toggleAIAssistant: jest.fn(),
  aiConfig: null,
  loadingAI: false,
};

jest.mock('../../contexts/RoomContext', () => ({
  useRoom: () => mockRoomContextValue,
  RoomProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Test data factories
const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  display_name: 'Test User',
  current_role: 'student',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const createMockRoom = (overrides = {}) => ({
  id: '1',
  title: 'Test Room',
  description: 'Test Description',
  tutor_id: 'tutor-123',
  is_active: true,
  created_at: new Date().toISOString(),
  ...overrides,
});

const createMockTutor = (overrides = {}) => ({
  id: 'tutor-123',
  display_name: 'John Tutor',
  current_role: 'tutor',
  email: 'john@example.com',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Helper functions
const setupSupabaseMocks = (rooms = [], sessions = null) => {
  const mockSupabase = supabase as any;
  
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'rooms') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: rooms,
          error: null,
        }),
      };
    }
    if (table === 'sessions') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: sessions,
          error: sessions ? null : { code: 'PGRST116' },
        }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };
  });
  
  return mockSupabase;
};

const renderStudentView = () => {
  return render(
    <BrowserRouter>
      <StudentView />
    </BrowserRouter>
  );
};

const renderApp = () => {
  return render(<App />);
};

describe('Feature: Room Discovery and Joining', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = supabase as any;
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
    
    // Setup realtime channel mock
    mockSupabase.channel.mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      unsubscribe: jest.fn(),
    });
    
    // Mock scrollIntoView for JSDOM
    Element.prototype.scrollIntoView = jest.fn();
    
    // Reset auth user
    mockAuthUser = null;
    
    // Reset room context
    mockRoomContextValue.currentRoom = null;
    mockRoomContextValue.messages = [];
    mockRoomContextValue.loading = false;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Background: System has users', () => {
    const users = [
      { display_name: 'John Tutor', current_role: 'tutor' },
      { display_name: 'Jane Student', current_role: 'student' },
      { display_name: 'Bob Student', current_role: 'student' },
      { display_name: 'Alice Observer', current_role: 'observer' },
    ];

    beforeEach(() => {
      // Mock users exist in database
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockImplementation((field, value) => ({
              single: jest.fn().mockResolvedValue({
                data: users.find(u => u.display_name === value),
                error: null,
              }),
            })),
          };
        }
        return mockSupabase.from();
      });
    });

    describe('Scenario: Student views available rooms', () => {
      it('should show available rooms when tutor has created a room', async () => {
        // Given the tutor "John Tutor" has created a room
        const mockRoom = createMockRoom({
          title: 'Math Basics',
          description: 'Introduction to algebra',
          tutor: createMockTutor(),
        });

        setupSupabaseMocks([mockRoom]);

        // When I am logged in as "Jane Student" and viewing the student dashboard
        renderStudentView();

        // Then I should see the available rooms section and room details
        await waitFor(() => {
          expect(screen.getByText(/available rooms/i)).toBeInTheDocument();
          expect(screen.getByText('Math Basics')).toBeInTheDocument();
          expect(screen.getByText('John Tutor')).toBeInTheDocument();
          expect(screen.getByText('Introduction to algebra')).toBeInTheDocument();
          expect(screen.getByText('Available')).toBeInTheDocument();
        });
      });
    });

    describe('Scenario: Student sees waiting message when no rooms available', () => {
      it('should show waiting message when there are no active rooms', async () => {
        // Given I am logged in as "Jane Student" and there are no active rooms
        mockAuthUser = createMockUser({
          id: 'jane-student-id',
          display_name: 'Jane Student',
          current_role: 'student',
        });

        setupSupabaseMocks([]); // Empty rooms array

        // When I view the student dashboard
        renderStudentView();

        // Then I should see waiting messages
        await waitFor(() => {
          expect(screen.getByText('No rooms available')).toBeInTheDocument();
          expect(screen.getByText('Please wait for a tutor to create a room')).toBeInTheDocument();
        });
      });
    });

    describe('Scenario: Student joins an available room', () => {
      it('should allow student to join an available room', async () => {
        // Given I am logged in as "Jane Student" and the tutor has created a room
        mockAuthUser = createMockUser({
          id: 'jane-student-id',
          display_name: 'Jane Student',
        });

        const mockRoom = createMockRoom({
          id: '2',
          title: 'Physics 101',
          tutor: createMockTutor(),
        });

        setupSupabaseMocks([mockRoom], null); // null session = room available

        // When I view the student dashboard
        renderStudentView();

        // And I click "Join Room" on the "Physics 101" room card
        await waitFor(() => {
          expect(screen.getByText('Physics 101')).toBeInTheDocument();
          expect(screen.getByText('John Tutor')).toBeInTheDocument();
        });
        
        const joinButton = screen.getByRole('button', { name: /join room/i });
        await userEvent.click(joinButton);

        // Then I should be redirected to the room view
        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith('/room/2');
        });
      });
    });

    describe('Scenario: Student cannot join a full room', () => {
      it('should disable join button when room is full', async () => {
        // Given I am logged in as "Jane Student" with role "student"
        // And the tutor "John Tutor" has created a room titled "Chemistry Lab"
        // And the student "Bob Student" has already joined the room
        const mockRoom = {
          id: '3',
          title: 'Chemistry Lab',
          tutor_id: 'tutor-123',
          is_active: true,
          created_at: new Date().toISOString(),
          tutor: {
            id: 'tutor-123',
            display_name: 'John Tutor',
            current_role: 'tutor',
            email: 'john@example.com',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        };

        const mockSession = {
          id: 'session-1',
          room_id: '3',
          student_id: 'bob-student-id',
          tutor_id: 'tutor-123',
          status: 'active',
          started_at: new Date().toISOString(),
        };

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'rooms') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: [mockRoom],
                error: null,
              }),
            };
          }
          if (table === 'sessions') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockImplementation((field: string, value: any) => ({
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: mockSession,
                  error: null,
                }),
              })),
            };
          }
          return mockSupabase.from();
        });

        // When I view the student dashboard
        render(
          <BrowserRouter>
            <StudentView />
          </BrowserRouter>
        );

        // Then I should see the "Chemistry Lab" room card
        await waitFor(() => {
          expect(screen.getByText('Chemistry Lab')).toBeInTheDocument();
          expect(screen.getByText('John Tutor')).toBeInTheDocument();
        });

        // And the room card should show "Room Full" status
        expect(screen.getByText('Room Full')).toBeInTheDocument();

        // And the "Join Room" button should be disabled
        const joinButton = screen.getByRole('button', { name: /join room/i });
        expect(joinButton).toBeDisabled();
      });
    });

    describe('Scenario: Observer views available rooms', () => {
      it('should show available rooms when tutor has created a room', async () => {
        // Given I am logged in as "Alice Observer" with role "observer"
        // And the tutor "John Tutor" has created a room titled "History Class"
        mockAuthUser = createMockUser({
          id: 'alice-observer-id',
          display_name: 'Alice Observer',
          current_role: 'observer',
        });

        const mockRoom = createMockRoom({
          id: '5',
          title: 'History Class',
          tutor: createMockTutor(),
        });

        setupSupabaseMocks([mockRoom]);

        // When I view the observer dashboard
        render(
          <BrowserRouter>
            <ObserverView />
          </BrowserRouter>
        );

        // Then I should see the available rooms section
        await waitFor(() => {
          expect(screen.getByText(/available rooms/i)).toBeInTheDocument();
        });

        // And I should see a room card for "History Class"
        await waitFor(() => {
          expect(screen.getByText('History Class')).toBeInTheDocument();
          expect(screen.getByText('John Tutor')).toBeInTheDocument();
        });
      });
    });

    describe('Scenario: Observer joins a room as read-only', () => {
      it('should allow observer to join room in read-only mode', async () => {
        // Given I am logged in as "Alice Observer" with role "observer"
        // And the tutor "John Tutor" has created a room titled "English Literature"  
        // And the student "Jane Student" has joined the room
        mockAuthUser = createMockUser({
          id: 'alice-observer-id',
          display_name: 'Alice Observer',
          current_role: 'observer',
        });

        const mockRoom = {
          id: '4',
          title: 'English Literature',
          description: 'Study of classic literature',
          tutor_id: 'tutor-123',
          is_active: true,
          ai_assistant_enabled: false,
          ai_assistant_model: null,
          ai_assistant_prompt: null,
          image_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const mockMessages = [
          {
            id: 'msg-1',
            content: 'Hello, this is a test message from Jane',
            user_id: 'jane-student-id',
            room_id: '4',
            user_role: 'student' as const,
            is_ai_generated: false,
            ai_model_used: null,
            ai_response_time_ms: null,
            parent_message_id: null,
            created_at: new Date().toISOString(),
          },
          {
            id: 'msg-2', 
            content: 'Welcome to the English Literature session!',
            user_id: 'tutor-123',
            room_id: '4',
            user_role: 'tutor' as const,
            is_ai_generated: false,
            ai_model_used: null,
            ai_response_time_ms: null,
            parent_message_id: null,
            created_at: new Date().toISOString(),
          }
        ];

        // Set up the room context mock data
        mockRoomContextValue.currentRoom = mockRoom;
        mockRoomContextValue.messages = mockMessages;
        mockRoomContextValue.loading = false;

        // When I view the room page directly (simulating navigation after clicking "Observe Room")
        render(
          <BrowserRouter>
            <RoomPage />
          </BrowserRouter>
        );

        // Then I should be redirected to room view
        // And I should see "English Literature" as the room title
        await waitFor(() => {
          expect(screen.getByText('English Literature')).toBeInTheDocument();
        });

        // And I should see the chat messages
        expect(screen.getByText('Hello, this is a test message from Jane')).toBeInTheDocument();
        expect(screen.getByText('Welcome to the English Literature session!')).toBeInTheDocument();

        // But I should not see the message input field
        expect(screen.queryByPlaceholderText(/type your message/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();

        // And I should see "Observer Mode - Read Only" indicator
        expect(screen.getByText(/you are observing this session/i)).toBeInTheDocument();
        expect(screen.getByText(/you cannot send messages/i)).toBeInTheDocument();
      });
    });

    describe('Scenario: Multiple observers can join the same room', () => {
      it('should allow multiple observers to join the same room', async () => {
        // Given I am logged in as "Alice Observer" with role "observer"
        // And the tutor "John Tutor" has created a room titled "Science Lab"
        // And the student "Jane Student" has joined the room
        // And 3 observers have already joined the room
        mockAuthUser = createMockUser({
          id: 'alice-observer-id',
          display_name: 'Alice Observer',
          current_role: 'observer',
        });

        const mockRoom = {
          id: '5',
          title: 'Science Lab',
          description: 'Hands-on science experiments',
          tutor_id: 'tutor-123',
          is_active: true,
          ai_assistant_enabled: false,
          ai_assistant_model: null,
          ai_assistant_prompt: null,
          image_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Mock active session with student
        const mockActiveSession = {
          id: 'session-1',
          room_id: '5',
          student_id: 'jane-student-id',
          tutor_id: 'tutor-123',
          status: 'active',
          started_at: new Date().toISOString(),
          ended_at: null,
        };

        // Mock 3 existing observer sessions
        const mockObserverSessions = [
          {
            id: 'observer-session-1',
            room_id: '5',
            student_id: null,
            tutor_id: null,
            observer_id: 'observer-1',
            status: 'active',
            started_at: new Date().toISOString(),
            ended_at: null,
          },
          {
            id: 'observer-session-2',
            room_id: '5',
            student_id: null,
            tutor_id: null,
            observer_id: 'observer-2',
            status: 'active',
            started_at: new Date().toISOString(),
            ended_at: null,
          },
          {
            id: 'observer-session-3',
            room_id: '5',
            student_id: null,
            tutor_id: null,
            observer_id: 'observer-3',
            status: 'active',
            started_at: new Date().toISOString(),
            ended_at: null,
          }
        ];

        // Set up Supabase mocks for ObserverView to fetch the room
        setupSupabaseMocks([mockRoom]);

        // When I view the observer dashboard
        render(
          <BrowserRouter>
            <ObserverView />
          </BrowserRouter>
        );

        // And I click "Observe Room" on the "Science Lab" room card
        await waitFor(() => {
          expect(screen.getByText('Science Lab')).toBeInTheDocument();
        });
        
        const observeButton = screen.getByRole('button', { name: /observe room/i });
        await userEvent.click(observeButton);

        // Then I should successfully join the room as an observer
        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith('/room/5');
        });

        // Simulate joining the room and updating observer count
        mockRoomContextValue.currentRoom = {
          ...mockRoom,
          observer_count: 4, // Now 4 observers including the new one
        };
        mockRoomContextValue.messages = [];
        mockRoomContextValue.loading = false;

        // Render the room page to check observer count display
        render(
          <BrowserRouter>
            <RoomPage />
          </BrowserRouter>
        );

        // And I should see "4 observers" in the room info
        await waitFor(() => {
          expect(screen.getByText(/4 observers/i)).toBeInTheDocument();
        });
      });
    });

    describe('Scenario: Room list updates in real-time', () => {
      it('should show new rooms without refreshing', async () => {
        // Setup realtime subscription
        const mockChannel = {
          on: jest.fn().mockReturnThis(),
          subscribe: jest.fn().mockReturnThis(),
          unsubscribe: jest.fn(),
        };
        
        let realtimeCallback: any;
        mockChannel.on.mockImplementation((event: string, filter: any, callback: any) => {
          if (event === 'postgres_changes') {
            realtimeCallback = callback;
          }
          return mockChannel;
        });

        mockSupabase.channel.mockReturnValue(mockChannel);

        // Initially no rooms, but will be updated after real-time event
        let currentRooms: any[] = [];
        
        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'rooms') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: currentRooms,
                error: null,
              }),
            };
          }
          if (table === 'sessions') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            };
          }
          return mockSupabase.from();
        });

        // Set up auth user as student
        mockAuthUser = createMockUser({
          id: 'jane-student-id',
          display_name: 'Jane Student',
          current_role: 'student',
        });

        // Render StudentView directly since we're testing real-time updates
        render(
          <BrowserRouter>
            <StudentView />
          </BrowserRouter>
        );

        // Verify no rooms initially
        await waitFor(() => {
          expect(screen.getByText('No rooms available')).toBeInTheDocument();
        });

        // When a new room is created (simulate realtime event)
        const newRoom = {
          id: '5',
          title: 'Calculus Help',
          tutor_id: 'tutor-123',
          is_active: true,
          description: 'Math tutoring help',
          image_url: null,
          ai_assistant_enabled: false,
          ai_assistant_model: null,
          ai_assistant_prompt: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tutor: {
            id: 'tutor-123',
            display_name: 'John Tutor',
            current_role: 'tutor',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        };

        act(() => {
          // Update the rooms array when real-time event occurs
          currentRooms.push(newRoom);
          
          realtimeCallback({
            eventType: 'INSERT',
            new: newRoom,
          });
        });

        // Then the new room should appear
        await waitFor(() => {
          expect(screen.getByText('Calculus Help')).toBeInTheDocument();
          expect(screen.getByText('Available')).toBeInTheDocument();
        });
      });
    });

    describe('Scenario: Student sees room status change in real-time', () => {
      it('should update room status when another student joins', async () => {
        // Setup realtime subscription
        const mockChannel = {
          on: jest.fn().mockReturnThis(),
          subscribe: jest.fn().mockReturnThis(),
          unsubscribe: jest.fn(),
        };
        
        let realtimeCallback: any;
        mockChannel.on.mockImplementation((event: string, filter: any, callback: any) => {
          if (event === 'postgres_changes') {
            realtimeCallback = callback;
          }
          return mockChannel;
        });

        mockSupabase.channel.mockReturnValue(mockChannel);

        // Given I am logged in as "Jane Student" with role "student"
        // And the tutor "John Tutor" has created a room titled "Programming 101"
        mockAuthUser = createMockUser({
          id: 'jane-student-id',
          display_name: 'Jane Student',
          current_role: 'student',
        });

        const mockRoom = {
          id: '7',
          title: 'Programming 101',
          description: 'Learn programming basics',
          tutor_id: 'tutor-123',
          is_active: true,
          ai_assistant_enabled: false,
          ai_assistant_model: null,
          ai_assistant_prompt: null,
          image_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tutor: {
            id: 'tutor-123',
            display_name: 'John Tutor',
            current_role: 'tutor',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        };

        // Initially the room is available (no active session)
        let currentSessionData: any = null;
        
        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'rooms') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: [mockRoom],
                error: null,
              }),
            };
          }
          if (table === 'sessions') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: currentSessionData,
                error: currentSessionData ? null : { code: 'PGRST116' },
              }),
            };
          }
          return mockSupabase.from();
        });

        // And I am viewing the student dashboard
        render(
          <BrowserRouter>
            <StudentView />
          </BrowserRouter>
        );

        // Verify room is initially available
        await waitFor(() => {
          expect(screen.getByText('Programming 101')).toBeInTheDocument();
          expect(screen.getByText('Available')).toBeInTheDocument();
        });

        // Verify join button is initially enabled
        const joinButton = screen.getByRole('button', { name: /join room/i });
        expect(joinButton).not.toBeDisabled();

        // When another student "Bob Student" joins the "Programming 101" room
        act(() => {
          // Create a new session (Bob joins the room)
          currentSessionData = {
            id: 'session-2',
            room_id: '7',
            student_id: 'bob-student-id',
            tutor_id: 'tutor-123',
            status: 'active',
            started_at: new Date().toISOString(),
            ended_at: null,
          };
          
          // Trigger real-time event (session created)
          realtimeCallback({
            eventType: 'INSERT',
            new: currentSessionData,
            table: 'sessions',
          });
        });

        // Then I should see the room status change to "Room Full"
        await waitFor(() => {
          expect(screen.getByText('Room Full')).toBeInTheDocument();
        });

        // And the "Join Room" button should become disabled
        await waitFor(() => {
          const updatedJoinButton = screen.getByRole('button', { name: /join room/i });
          expect(updatedJoinButton).toBeDisabled();
        });
      });
    });

    describe('Scenario: Room displays preview image', () => {
      it('should display room preview image', async () => {
        // Given I am logged in as "Jane Student" with role "student"
        // And the tutor "John Tutor" has created a room titled "Art History" with image "art-history.jpg"
        mockAuthUser = createMockUser({
          id: 'jane-student-id',
          display_name: 'Jane Student',
          current_role: 'student',
        });

        const mockRoom = {
          id: '6',
          title: 'Art History',
          description: 'Study of classical art',
          tutor_id: 'tutor-123',
          image_url: 'https://storage.supabase.co/images/art-history.jpg',
          is_active: true,
          ai_assistant_enabled: false,
          ai_assistant_model: null,
          ai_assistant_prompt: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tutor: {
            id: 'tutor-123',
            display_name: 'John Tutor',
            current_role: 'tutor',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        };

        setupSupabaseMocks([mockRoom]);

        // When I view the student dashboard
        render(
          <BrowserRouter>
            <StudentView />
          </BrowserRouter>
        );

        // Then I should see the room card for "Art History"
        await waitFor(() => {
          expect(screen.getByText('Art History')).toBeInTheDocument();
          expect(screen.getByText('John Tutor')).toBeInTheDocument();
        });

        // And the room card should display the "art-history.jpg" preview image
        await waitFor(() => {
          const roomImage = screen.getByAltText('Art History');
          expect(roomImage).toBeInTheDocument();
          expect(roomImage).toHaveAttribute('src', 'https://storage.supabase.co/images/art-history.jpg');
        });
      });
    });
  });
});