// Mock the service module directly instead of the SDK
jest.mock('../services/supabase', () => {
  console.log('🔧 Mocking ../services/supabase at module level');
  
  const mockRoomData = {
    id: 'room-1',
    title: 'Phishing 101',
    description: 'Learn about phishing attacks',
    created_by: 'tutor-1',
    is_active: true,
    tutor_id: 'tutor-1',
    ai_assistant_enabled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const mockCurrentUser = {
    id: 'tutor-1',
    display_name: 'Tutor',
    current_role: 'tutor',
    created_at: new Date().toISOString()
  };

  const mockSupabaseClient = {
    from: jest.fn().mockImplementation((table) => {
      console.log(`🔧 Mock supabase.from('${table}') called`);
      
      if (table === 'rooms') {
        // For rooms table, create a chainable query object
        const roomsQuery = {
          select: jest.fn().mockImplementation((fields) => {
            console.log(`🔧 Mock rooms.select('${fields}') called`);
            return roomsQuery;
          }),
          eq: jest.fn().mockImplementation((field, value) => {
            console.log(`🔧 Mock rooms.eq('${field}', '${value}') called`);
            return roomsQuery;
          }),
          single: jest.fn().mockImplementation(() => {
            console.log('🔧 Mock rooms.single() called - returning:', mockRoomData);
            return Promise.resolve({ 
              data: mockRoomData, 
              error: null 
            });
          })
        };
        return roomsQuery;
      } else if (table === 'messages') {
        // For messages table, handle both select and insert operations
        const messagesQuery = {
          select: jest.fn().mockImplementation((fields) => {
            console.log(`🔧 Mock messages.select('${fields}') called`);
            return messagesQuery;
          }),
          eq: jest.fn().mockImplementation((field, value) => {
            console.log(`🔧 Mock messages.eq('${field}', '${value}') called`);
            return messagesQuery;
          }),
          order: jest.fn().mockImplementation((field, options) => {
            console.log(`🔧 Mock messages.order('${field}', ${JSON.stringify(options)}) called`);
            return Promise.resolve({ 
              data: [], 
              error: null 
            });
          }),
          insert: jest.fn().mockImplementation((data) => {
            // Mock insert operation for messages
            const insertedMessage = {
              id: `msg-${Date.now()}`,
              ...data,
              created_at: new Date().toISOString(),
              display_name: data.user_role === 'tutor' ? 'Tutor' : 
                           data.user_role === 'student' ? 'Student' : 'Observer'
            };
            return {
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: insertedMessage,
                error: null
              })
            };
          })
        };
        return messagesQuery;
      } else if (table === 'users') {
        // For users table, handle select -> in chain
        const usersQuery = {
          select: jest.fn().mockImplementation((fields) => {
            console.log(`🔧 Mock users.select('${fields}') called`);
            return usersQuery;
          }),
          in: jest.fn().mockImplementation((field, values) => {
            console.log(`🔧 Mock users.in('${field}', ${JSON.stringify(values)}) called`);
            return Promise.resolve({ 
              data: [mockCurrentUser], 
              error: null 
            });
          })
        };
        return usersQuery;
      }
      
      // Default fallback for other tables
      return {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      };
    }),
    channel: jest.fn().mockImplementation((channelName) => {
      console.log(`🔧 Mock supabase.channel('${channelName}') called`);
      const channelMock = {
        on: jest.fn().mockImplementation((event, options, callback) => {
          console.log(`🔧 Mock channel.on('${event}', ${JSON.stringify(options)}) called`);
          return channelMock;
        }),
        subscribe: jest.fn().mockImplementation((callback) => {
          console.log('🔧 Mock channel.subscribe() called');
          if (callback) callback('SUBSCRIBED');
          return jest.fn(); // Return unsubscribe function
        }),
        unsubscribe: jest.fn()
      };
      return channelMock;
    }),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null })
    },
    storage: {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'http://test-url' } })
    }
  };

  return {
    supabase: mockSupabaseClient,
    // Also export helper functions that might be used
    getCurrentUser: jest.fn(),
    signOut: jest.fn(),
    getUserProfile: jest.fn(),
    updateUserProfile: jest.fn()
  };
});

// Mock AuthContext
jest.mock('../contexts/AuthContext', () => ({
  ...jest.requireActual('../contexts/AuthContext'),
  useAuth: jest.fn()
}));

// Mock AI service
jest.mock('../services/aiService', () => ({
  initializeAIAssistant: jest.fn(),
  getAIConfig: jest.fn(),
  updateAIConfig: jest.fn(),
  generateAndSaveAIResponse: jest.fn()
}));

import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useParams, Routes, Route } from 'react-router-dom';
import RoomPagePost from '../pages/RoomPagePost';
import { useAuth, AuthProvider } from '../contexts/AuthContext';
import { RoomProvider, useRoom } from '../contexts/RoomContext';
import * as RoomContextModule from '../contexts/RoomContext';
import { supabase } from '../services/supabase';
import { User, UserRole, Room, Message } from '../types';

interface TestUser {
  id: string;
  display_name: string;
  current_role: UserRole;
}

interface TestRoom {
  id: string;
  title: string;
  description?: string;
  created_by: string;
}

interface TestMessage {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  user_role: UserRole;
  created_at: string;
  display_name: string;
}

const MockAuthClientContext = React.createContext<any>(null);
const MockRoomClientContext = React.createContext<any>(null);

describe('Real-time Chat System BDD Tests', () => {
  let mockTutor: TestUser;
  let mockStudent: TestUser;
  let mockObserver: TestUser;
  let mockRoom: TestRoom;
  let mockMessages: TestMessage[];
  let mockTypingUsers: Set<string>;
  let mockNetworkConnected: boolean;
  let mockOfflinePollObserved: boolean;
  let mockMessageInsertError: { message: string } | null;
  let mockChannel: any;

  beforeEach(() => {
    // Reset mocks and test data
    jest.clearAllMocks();
    
    mockTutor = {
      id: 'tutor-1',
      display_name: 'Tutor',
      current_role: 'tutor'
    };

    mockStudent = {
      id: 'student-1',
      display_name: 'Student',
      current_role: 'student'
    };

    mockObserver = {
      id: 'observer-1',
      display_name: 'Observer',
      current_role: 'observer'
    };

    mockRoom = {
      id: 'room-1',
      title: 'Phishing 101',
      description: 'Learn about phishing attacks',
      created_by: mockTutor.id,
      is_active: true,
      tutor_id: mockTutor.id,
      ai_assistant_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockMessages = [];
    mockTypingUsers = new Set();
    mockNetworkConnected = true;
    mockOfflinePollObserved = false;
    mockMessageInsertError = null;
    Element.prototype.scrollIntoView = jest.fn();

    mockChannel = {
      on: jest.fn().mockReturnThis(),
      send: jest.fn().mockResolvedValue('ok'),
      subscribe: jest.fn().mockImplementation((callback?: (status: string) => void) => {
        callback?.('SUBSCRIBED');
        return mockChannel;
      }),
      unsubscribe: jest.fn()
    };

    const mockSupabase = supabase as any;
    mockSupabase.from.mockImplementation((table: string) => {
      const query: any = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        in: jest.fn((_field: string, ids: string[]) => Promise.resolve({
          data: [mockTutor, mockStudent, mockObserver].filter((participant) => ids.includes(participant.id)),
          error: null
        })),
        order: jest.fn(() => {
          if (table !== 'messages') return Promise.resolve({ data: [], error: null });
          if (!mockNetworkConnected) {
            mockOfflinePollObserved = true;
            return Promise.resolve({ data: [], error: { message: 'network unavailable' } });
          }
          return Promise.resolve({ data: mockMessages, error: null });
        }),
        single: jest.fn(() => Promise.resolve({
          data: table === 'rooms' ? mockRoom : null,
          error: null
        })),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        insert: jest.fn((data: Record<string, any>) => {
          const insertedMessage = {
            id: `msg-saved-${mockMessages.length + 1}`,
            ...data,
            ai_model_used: null,
            ai_response_time_ms: null,
            parent_message_id: data.parent_message_id || null,
            created_at: new Date().toISOString()
          };
          mockMessages.push(insertedMessage);
          const insertQuery: any = {
            select: jest.fn(() => insertQuery),
            single: jest.fn().mockImplementation(() => Promise.resolve(mockMessageInsertError
              ? { data: null, error: mockMessageInsertError }
              : { data: insertedMessage, error: null }))
          };
          return insertQuery;
        })
      };
      return query;
    });
    mockSupabase.channel.mockReturnValue(mockChannel);

    console.log('🔧 Setting up mock data:', { mockRoom });
  });

  const renderWithProviders = (currentUser: TestUser, roomId: string = 'room-1') => {
    // Mock useAuth hook
    (useAuth as jest.Mock).mockReturnValue({
      user: currentUser as User,
      loading: false,
      joinWithNameAndRole: jest.fn(),
      signOut: jest.fn(),
      setUserRole: jest.fn()
    });

  return render(
    <MemoryRouter initialEntries={[`/room/${roomId}`]}>
      <RoomProvider>
        <Routes>
          <Route path="/room/:roomId" element={<RoomPagePost />} />
        </Routes>
      </RoomProvider>
    </MemoryRouter>
  );
  };

  const getChannelCallback = (event: string, matches: (filter: any) => boolean) => {
    const registration = mockChannel.on.mock.calls
      .slice()
      .reverse()
      .find(([registeredEvent, filter]) => registeredEvent === event && matches(filter));
    return registration?.[2];
  };

  describe('Background: User role display and room functionality', () => {
    test('should display tutor role indicator in participant list', async () => {
      console.log('🐛 TEST: Starting test with mockTutor:', mockTutor);
      
      // First, let's verify the mock is working
      console.log('🐛 TEST: Testing supabase mock directly');
      console.log('🐛 TEST: supabase object:', supabase);
      console.log('🐛 TEST: supabase.from:', supabase.from);
      
      // Test the mock directly
      console.log('🐛 TEST: Calling supabase.from("rooms")...');
      try {
        const fromResult = supabase.from('rooms');
        console.log('🐛 TEST: from() returned:', fromResult);
        console.log('🐛 TEST: Mock called count:', (supabase.from as jest.Mock).mock.calls.length);
        console.log('🐛 TEST: Mock calls:', (supabase.from as jest.Mock).mock.calls);
      } catch (e) {
        console.log('🐛 TEST: Error calling from():', e);
      }
      
      // Now render using the original renderWithProviders
      renderWithProviders(mockTutor, 'room-1');
      
      await waitFor(() => {
        // Test that tutor role is displayed in the UI
        expect(screen.getByText(mockTutor.display_name)).toBeInTheDocument();
        // Look for role indicator or badge
        const roleElements = screen.queryAllByText(/tutor/i);
        expect(roleElements.length).toBeGreaterThan(0);
      });
    });

    test('should display student role indicator in participant list', async () => {
      renderWithProviders(mockStudent, 'room-1');
      
      await waitFor(() => {
        // Test that student role is displayed in the UI
        expect(screen.getByText(mockStudent.display_name)).toBeInTheDocument();
        // Look for role indicator or badge
        const roleElements = screen.queryAllByText(/student/i);
        expect(roleElements.length).toBeGreaterThan(0);
      });
    });

    test('should show room title and creation info in UI', async () => {
      renderWithProviders(mockTutor, 'room-1');
      
      await waitFor(() => {
        // Test that room information is displayed to users
        expect(screen.getByText(mockRoom.title)).toBeInTheDocument();
      });
    });

    test('should allow users to access room when it is active', async () => {
      renderWithProviders(mockStudent, 'room-1');
      
      // Test room accessibility through UI - room should be rendered without errors
      await waitFor(() => {
        // Should show room interface elements
        expect(screen.getByText(mockRoom.title)).toBeInTheDocument();
        // Should not show "room not found" or similar error messages
        expect(screen.queryByText(/room not found/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Scenario 1: Messages appear immediately without page refresh', () => {
    test('should show new messages immediately via real-time subscription', async () => {
      renderWithProviders(mockTutor, 'room-1');
      await screen.findByText(mockRoom.title);

      const newMessage = {
        id: 'msg-realtime-1',
        room_id: 'room-1',
        user_id: mockTutor.id,
        content: 'Real-time test message',
        user_role: 'tutor',
        created_at: new Date().toISOString(),
        display_name: mockTutor.display_name
      };

      let messageCallback: ((payload: any) => void) | undefined;
      await waitFor(() => {
        messageCallback = getChannelCallback('postgres_changes', (filter) => filter.table === 'messages');
        expect(messageCallback).toEqual(expect.any(Function));
      });

      act(() => {
        messageCallback?.({ new: newMessage });
      });

      expect(await screen.findByText(newMessage.content)).toBeInTheDocument();
    });

    test('should apply room updates received from the realtime subscription', async () => {
      renderWithProviders(mockTutor, 'room-1');
      await screen.findByText(mockRoom.title);

      let roomCallback: ((payload: any) => void) | undefined;
      await waitFor(() => {
        roomCallback = getChannelCallback('postgres_changes', (filter) => filter.table === 'rooms');
        expect(roomCallback).toEqual(expect.any(Function));
      });

      act(() => {
        roomCallback?.({
          new: { ...mockRoom, title: 'Updated room title' }
        });
      });

      expect(await screen.findByText('Updated room title')).toBeInTheDocument();
    });
  });

  describe('Scenario 2: Tutor and Student can exchange messages', () => {
    test('should allow tutor to send message and add to messages array', async () => {
      renderWithProviders(mockTutor, 'room-1');
      const messageInput = await screen.findByPlaceholderText('Write a comment...');
      await userEvent.type(messageInput, 'Welcome to the session!');
      await userEvent.click(screen.getByTitle('Send comment'));

      expect(await screen.findByText('Welcome to the session!')).toBeInTheDocument();
      expect(supabase.from).toHaveBeenCalledWith('messages');
    });

    test('should allow student to send message and add to messages array', async () => {
      renderWithProviders(mockStudent, 'room-1');
      const messageInput = await screen.findByPlaceholderText('Write a comment...');
      await userEvent.type(messageInput, 'Hi, glad to be here.');
      await userEvent.click(screen.getByTitle('Send comment'));

      expect(await screen.findByText('Hi, glad to be here.')).toBeInTheDocument();
      expect(supabase.from).toHaveBeenCalledWith('messages');
    });
  });

  describe('Scenario 2: Observer has read-only access to the chat', () => {
    test('should prevent observer from sending messages', async () => {
      renderWithProviders(mockObserver, 'room-1');
      
      await waitFor(() => {
        // Test that observer UI doesn't show message input field
        const messageInput = screen.queryByPlaceholderText(/type a message/i);
        expect(messageInput).not.toBeInTheDocument();
        
        // Test that send button is not visible to observers
        const sendButton = screen.queryByRole('button', { name: /send/i });
        expect(sendButton).not.toBeInTheDocument();
        
        // Test that observer sees read-only indicator
        const readOnlyIndicator = screen.queryByText(/cannot participate/i) || screen.queryByTestId('observer-mode');
        expect(readOnlyIndicator).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 3: Chat history is preserved', () => {
    test('should retrieve previous messages when loading room', async () => {
      // Pre-populate messages to simulate existing chat history
      mockMessages.push({
        id: 'msg-1',
        room_id: mockRoom.id,
        user_id: mockTutor.id,
        content: 'This is the first message.',
        user_role: 'tutor',
        created_at: new Date().toISOString(),
        display_name: mockTutor.display_name
      });
      
      mockMessages.push({
        id: 'msg-2',
        room_id: mockRoom.id,
        user_id: mockStudent.id,
        content: 'This is the second message.',
        user_role: 'student',
        created_at: new Date().toISOString(),
        display_name: mockStudent.display_name
      });

      // Test that previous messages are displayed when room loads
      renderWithProviders(mockTutor, 'room-1');
      
      await waitFor(() => {
        // Should show previous messages in chronological order
        expect(screen.getByText('This is the first message.')).toBeInTheDocument();
        expect(screen.getByText('This is the second message.')).toBeInTheDocument();
        
        // Should show message authors and preserve chronological order.
        const firstMessage = screen.getByText('This is the first message.');
        const secondMessage = screen.getByText('This is the second message.');
        expect(within(firstMessage.closest('.post-comment') as HTMLElement).getByText('Tutor')).toBeInTheDocument();
        expect(within(secondMessage.closest('.post-comment') as HTMLElement).getByText('Student')).toBeInTheDocument();
        expect(firstMessage.compareDocumentPosition(secondMessage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      });
    });
  });

  describe('Scenario 4: Typing indicators are shown between tutor and student', () => {
    test('should broadcast typing state when a user types', async () => {
      renderWithProviders(mockTutor, 'room-1');
      const messageInput = await screen.findByPlaceholderText('Write a comment...');
      await userEvent.type(messageInput, 'Draft message');

      expect(mockChannel.send).toHaveBeenCalledWith(expect.objectContaining({
        type: 'broadcast',
        event: 'typing_start',
        payload: { userId: mockTutor.id, displayName: mockTutor.display_name }
      }));
    });

    // src/__tests__/real_time_chat.test.tsx: verify incoming realtime typing events render in the room.
    test('should display incoming typing indicators', async () => {
      const view = renderWithProviders(mockTutor, 'room-1');
      await screen.findByText(mockRoom.title);

      let typingCallback: ((payload: any) => void) | undefined;
      await waitFor(() => {
        typingCallback = getChannelCallback('broadcast', (filter) => filter.event === 'typing_start');
        expect(typingCallback).toEqual(expect.any(Function));
      });

      act(() => {
        typingCallback?.({ payload: { userId: mockStudent.id, displayName: mockStudent.display_name } });
      });

      await waitFor(() => {
        expect(view.container.querySelector('.comments-list')?.textContent).toContain(
          `${mockStudent.display_name} is typing...`
        );
      });
    });

    test('should only show typing indicators for tutors and students, not observers', async () => {
      renderWithProviders(mockObserver, 'room-1');
      
      // Test that observer UI doesn't show typing input or indicators
      await waitFor(() => {
        // Observers should not have typing input field
        const typingInput = screen.queryByTestId('message-input');
        expect(typingInput).not.toBeInTheDocument();
        
        // Observers should not show typing indicator UI
        const typingIndicator = screen.queryByTestId('typing-indicator-trigger');
        expect(typingIndicator).not.toBeInTheDocument();
      });
    });
  });

  describe('Scenario 5: Offline message synchronization', () => {
    // src/__tests__/real_time_chat.test.tsx: verify missed messages arrive after database access returns.
    test('should synchronize a tutor message after the student reconnects', async () => {
      const view = renderWithProviders(mockStudent, 'room-1');
      await screen.findByText(mockRoom.title);

      mockNetworkConnected = false;
      await waitFor(() => expect(mockOfflinePollObserved).toBe(true), { timeout: 3000 });

      mockMessages.push({
        id: 'msg-offline-1',
        room_id: mockRoom.id,
        user_id: mockTutor.id,
        content: 'Can you see this message?',
        user_role: 'tutor',
        created_at: new Date().toISOString(),
        display_name: mockTutor.display_name
      });
      mockNetworkConnected = true;

      await waitFor(() => {
        expect(view.container.querySelector('.comments-list')?.textContent).toContain('Can you see this message?');
      }, { timeout: 3000 });
    });
  });

  describe('Scenario 6: Message delivery failures', () => {
    // src/__tests__/real_time_chat.test.tsx: verify failed persistence removes an optimistic message.
    test('should remove an optimistic message when persistence fails', async () => {
      mockMessageInsertError = { message: 'network unavailable' };
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);

      try {
        const view = renderWithProviders(mockTutor, 'room-1');
        const messageInput = await screen.findByPlaceholderText('Write a comment...');
        await userEvent.type(messageInput, 'This message cannot be saved.');
        await userEvent.click(screen.getByTitle('Send comment'));

        await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Failed to send message. Please try again.'));
        expect(view.container.querySelector('.comments-list')?.textContent).not.toContain('This message cannot be saved.');
        expect(messageInput).toHaveValue('This message cannot be saved.');
      } finally {
        alertSpy.mockRestore();
      }
    });
  });

  describe('Scenario 7: Two-rendered-client page seam', () => {
    const buildRoomValue = (overrides: Record<string, any> = {}) => ({
      currentRoom: mockRoom,
      messages: [],
      participants: [
        { ...mockTutor, status: 'active' },
        { ...mockStudent, status: 'active' },
        { ...mockObserver, status: 'active' }
      ],
      loading: false,
      typingUsers: [],
      joinRoom: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn().mockResolvedValue(undefined),
      generateAIResponse: jest.fn().mockResolvedValue(undefined),
      regenerateAIResponse: jest.fn().mockResolvedValue(undefined),
      startTyping: jest.fn(),
      stopTyping: jest.fn(),
      aiConfig: null,
      loadingAI: false,
      downloadChatHistory: jest.fn(),
      clearChatHistory: jest.fn().mockResolvedValue(undefined),
      aiSuggestion: null,
      clearAISuggestion: jest.fn(),
      aiInteractions: [],
      currentSuggestionContext: null,
      recordAIFeedback: jest.fn().mockResolvedValue(undefined),
      submitMessageFeedback: jest.fn().mockResolvedValue(undefined),
      getMessageFeedbackStats: jest.fn().mockResolvedValue(null),
      messageFeedbackStats: {},
      ...overrides
    });

    const renderClientPage = (authUser: TestUser, roomValue: Record<string, any>) =>
      render(
        <MockAuthClientContext.Provider value={{ user: authUser, loading: false }}>
          <MockRoomClientContext.Provider value={roomValue}>
            <MemoryRouter initialEntries={['/room/room-1']}>
              <Routes>
                <Route path="/room/:roomId" element={<RoomPagePost />} />
              </Routes>
            </MemoryRouter>
          </MockRoomClientContext.Provider>
        </MockAuthClientContext.Provider>
      );

    beforeEach(() => {
      (useAuth as jest.Mock).mockImplementation(() => React.useContext(MockAuthClientContext));
      jest.spyOn(RoomContextModule, 'useRoom').mockImplementation(() => React.useContext(MockRoomClientContext));
    });

    afterEach(() => {
      jest.restoreAllMocks();
      (useAuth as jest.Mock).mockReset();
    });

    test('should render new realtime messages on another rendered client page', async () => {
      const baseMessages = [
        {
          id: 'msg-base-1',
          room_id: mockRoom.id,
          user_id: mockTutor.id,
          content: 'Welcome to the room.',
          user_role: 'tutor' as const,
          ai_model_used: null,
          ai_response_time_ms: null,
          parent_message_id: null,
          created_at: new Date().toISOString(),
          display_name: mockTutor.display_name,
          avatar_url: null
        }
      ];

      const studentRealtimeMessage = {
        id: 'msg-base-2',
        room_id: mockRoom.id,
        user_id: mockStudent.id,
        content: 'I can see the update without refreshing.',
        user_role: 'student' as const,
        ai_model_used: null,
        ai_response_time_ms: null,
        parent_message_id: null,
        created_at: new Date().toISOString(),
        display_name: mockStudent.display_name,
        avatar_url: null
      };

      const tutorView = renderClientPage(mockTutor, buildRoomValue({ messages: baseMessages }));
      const observerView = renderClientPage(mockObserver, buildRoomValue({ messages: baseMessages }));

      expect(within(tutorView.container).queryByText(studentRealtimeMessage.content)).not.toBeInTheDocument();
      expect(within(observerView.container).queryByText(studentRealtimeMessage.content)).not.toBeInTheDocument();

      tutorView.rerender(
        <MockAuthClientContext.Provider value={{ user: mockTutor, loading: false }}>
          <MockRoomClientContext.Provider value={buildRoomValue({ messages: [...baseMessages, studentRealtimeMessage] })}>
            <MemoryRouter initialEntries={['/room/room-1']}>
              <Routes>
                <Route path="/room/:roomId" element={<RoomPagePost />} />
              </Routes>
            </MemoryRouter>
          </MockRoomClientContext.Provider>
        </MockAuthClientContext.Provider>
      );

      observerView.rerender(
        <MockAuthClientContext.Provider value={{ user: mockObserver, loading: false }}>
          <MockRoomClientContext.Provider value={buildRoomValue({ messages: [...baseMessages, studentRealtimeMessage] })}>
            <MemoryRouter initialEntries={['/room/room-1']}>
              <Routes>
                <Route path="/room/:roomId" element={<RoomPagePost />} />
              </Routes>
            </MemoryRouter>
          </MockRoomClientContext.Provider>
        </MockAuthClientContext.Provider>
      );

      expect(within(tutorView.container).getByText(studentRealtimeMessage.content)).toBeInTheDocument();
      expect(within(observerView.container).getByText(studentRealtimeMessage.content)).toBeInTheDocument();
    });

    test('should render realtime feedback changes on tutor and observer pages at the same time', async () => {
      const tutorMessage = {
        id: 'msg-feedback-1',
        room_id: mockRoom.id,
        user_id: mockTutor.id,
        content: 'Please inspect the sender address carefully.',
        user_role: 'tutor' as const,
        ai_model_used: null,
        ai_response_time_ms: null,
        parent_message_id: null,
        created_at: new Date().toISOString(),
        display_name: mockTutor.display_name,
        avatar_url: null
      };

      const baseRoomValue = buildRoomValue({
        messages: [tutorMessage],
        messageFeedbackStats: {}
      });

      const tutorView = renderClientPage(mockTutor, baseRoomValue);
      const observerView = renderClientPage(mockObserver, baseRoomValue);

      expect(within(tutorView.container).queryByText('(4.0★)')).not.toBeInTheDocument();
      expect(within(observerView.container).queryByText('(4.0★)')).not.toBeInTheDocument();

      const likedRoomValue = buildRoomValue({
        messages: [tutorMessage],
        messageFeedbackStats: {
          [tutorMessage.id]: {
            message_id: tutorMessage.id,
            total_feedback_count: 1,
            like_count: 1,
            dislike_count: 0,
            average_like_rating: 4,
            average_dislike_rating: null,
            overall_average_rating: 4,
            user_feedback: null
          }
        }
      });

      tutorView.rerender(
        <MockAuthClientContext.Provider value={{ user: mockTutor, loading: false }}>
          <MockRoomClientContext.Provider value={likedRoomValue}>
            <MemoryRouter initialEntries={['/room/room-1']}>
              <Routes>
                <Route path="/room/:roomId" element={<RoomPagePost />} />
              </Routes>
            </MemoryRouter>
          </MockRoomClientContext.Provider>
        </MockAuthClientContext.Provider>
      );

      observerView.rerender(
        <MockAuthClientContext.Provider value={{ user: mockObserver, loading: false }}>
          <MockRoomClientContext.Provider value={likedRoomValue}>
            <MemoryRouter initialEntries={['/room/room-1']}>
              <Routes>
                <Route path="/room/:roomId" element={<RoomPagePost />} />
              </Routes>
            </MemoryRouter>
          </MockRoomClientContext.Provider>
        </MockAuthClientContext.Provider>
      );

      expect(within(tutorView.container).getByText('(4.0★)')).toBeInTheDocument();
      expect(within(observerView.container).getByText('(4.0★)')).toBeInTheDocument();

      const dislikedRoomValue = buildRoomValue({
        messages: [tutorMessage],
        messageFeedbackStats: {
          [tutorMessage.id]: {
            message_id: tutorMessage.id,
            total_feedback_count: 1,
            like_count: 0,
            dislike_count: 1,
            average_like_rating: null,
            average_dislike_rating: 2,
            overall_average_rating: 2,
            user_feedback: null
          }
        }
      });

      tutorView.rerender(
        <MockAuthClientContext.Provider value={{ user: mockTutor, loading: false }}>
          <MockRoomClientContext.Provider value={dislikedRoomValue}>
            <MemoryRouter initialEntries={['/room/room-1']}>
              <Routes>
                <Route path="/room/:roomId" element={<RoomPagePost />} />
              </Routes>
            </MemoryRouter>
          </MockRoomClientContext.Provider>
        </MockAuthClientContext.Provider>
      );

      observerView.rerender(
        <MockAuthClientContext.Provider value={{ user: mockObserver, loading: false }}>
          <MockRoomClientContext.Provider value={dislikedRoomValue}>
            <MemoryRouter initialEntries={['/room/room-1']}>
              <Routes>
                <Route path="/room/:roomId" element={<RoomPagePost />} />
              </Routes>
            </MemoryRouter>
          </MockRoomClientContext.Provider>
        </MockAuthClientContext.Provider>
      );

      expect(within(tutorView.container).queryByText('(4.0★)')).not.toBeInTheDocument();
      expect(within(observerView.container).queryByText('(4.0★)')).not.toBeInTheDocument();
      expect(within(tutorView.container).getByText('(2.0★)')).toBeInTheDocument();
      expect(within(observerView.container).getByText('(2.0★)')).toBeInTheDocument();
    });
  });
});
