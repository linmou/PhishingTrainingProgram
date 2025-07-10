import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { RoomProvider } from '../contexts/RoomContext';
import RoomPage from '../pages/RoomPage';
import { supabase } from '../services/supabase';
import { User, Room, Message, UserRole } from '../types';

jest.mock('../services/supabase');
jest.mock('jspdf', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    setFontSize: jest.fn(),
    text: jest.fn(),
    save: jest.fn(),
  })),
}));


const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const mockTutor: User = {
  id: 'tutor-123',
  display_name: 'Prof. Smith',
  current_role: 'tutor',
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

const mockStudent: User = {
  id: 'student-456',
  display_name: 'John Doe',
  current_role: 'student',
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

const mockObserver: User = {
  id: 'observer-789',
  display_name: 'Jane Observer',
  current_role: 'observer',
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

const mockRoom: Room = {
  id: 'room-123',
  title: 'Phishing 101',
  tutor_id: 'tutor-123',
  description: 'A test room for phishing',
  image_url: null,
  is_active: true,
  ai_assistant_enabled: false,
  ai_assistant_model: null,
  ai_assistant_prompt: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

const mockMessages: Message[] = [
  {
    id: 'msg-1',
    room_id: 'room-123',
    user_id: 'tutor-123',
    content: 'Welcome to Phishing 101!',
    created_at: '2024-01-01T10:00:00Z',
    user_role: 'tutor',
    is_ai_generated: false,
    ai_model_used: null,
    ai_response_time_ms: null,
    parent_message_id: null,
    display_name: 'Prof. Smith',
  },
  {
    id: 'msg-2',
    room_id: 'room-123',
    user_id: 'student-456',
    content: 'Glad to be here!',
    created_at: '2024-01-01T10:01:00Z',
    user_role: 'student',
    is_ai_generated: false,
    ai_model_used: null,
    ai_response_time_ms: null,
    parent_message_id: null,
    display_name: 'John Doe',
  }
];

const renderWithProviders = (ui: React.ReactElement, currentUser: User) => {
  (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: currentUser.id, email: `${currentUser.display_name}@example.com` } as any },
    error: null
  });

  return render(
    <BrowserRouter>
      <AuthProvider>
        <RoomProvider>
          {ui}
        </RoomProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Chat History Download Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockRoom, error: null }),
      order: jest.fn().mockResolvedValue({ data: mockMessages, error: null })
    } as any);

    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();

    const mockDownloadLink = document.createElement('a');
    mockDownloadLink.click = jest.fn();
    jest.spyOn(document, 'createElement').mockReturnValue(mockDownloadLink);

    // Mock Blob
    global.Blob = jest.fn((content, options) => {
      return {
        content,
        options,
        size: content.join('').length,
        type: options?.type || '',
      } as any;
    }) as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Download button visibility', () => {
    it('should show download button for tutor role', async () => {
      renderWithProviders(<RoomPage />, mockTutor);

      const downloadButton = await screen.findByText('Download Chat');
      expect(downloadButton).toBeInTheDocument();
    });

    it('should show download button for student role', async () => {
      renderWithProviders(<RoomPage />, mockStudent);

      const downloadButton = await screen.findByText('Download Chat');
      expect(downloadButton).toBeInTheDocument();
    });

    it('should show download button for observer role', async () => {
      renderWithProviders(<RoomPage />, mockObserver);

      const downloadButton = await screen.findByText('Download Chat');
      expect(downloadButton).toBeInTheDocument();
    });
  });

  describe('TXT format download', () => {
    it('should download chat history as TXT file', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RoomPage />, mockStudent);

      const downloadButton = await screen.findByText('Download Chat');
      await user.click(downloadButton);

      const txtButton = await screen.findByText('TXT');
      await user.click(txtButton);

      await waitFor(() => {
        const mockLink = document.createElement('a');
        expect(mockLink.download).toBe('Phishing_101_chat_history.txt');
        expect(mockLink.click).toHaveBeenCalled();
      });
    });

    it('should include room title and messages with timestamps in TXT file', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RoomPage />, mockStudent);

      const downloadButton = await screen.findByText('Download Chat');
      await user.click(downloadButton);

      const txtButton = await screen.findByText('TXT');
      await user.click(txtButton);

      await waitFor(() => {
        const blobInstance = (global.Blob as jest.Mock).mock.instances[0];
        const content = blobInstance.content[0];

        expect(content).toContain('Phishing 101');
        expect(content).toContain('Welcome to Phishing 101!');
        expect(content).toContain('Glad to be here!');
        expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
      });
    });
  });

  describe('JSON format download', () => {
    it('should download chat history as JSON file', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RoomPage />, mockTutor);

      const downloadButton = await screen.findByText('Download Chat');
      await user.click(downloadButton);

      const jsonButton = await screen.findByText('JSON');
      await user.click(jsonButton);

      await waitFor(() => {
        const mockLink = document.createElement('a');
        expect(mockLink.download).toBe('Phishing_101_chat_history.json');
        expect(mockLink.click).toHaveBeenCalled();
      });
    });

    it('should include valid JSON with room info and participants', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RoomPage />, mockTutor);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [mockTutor, mockStudent, mockObserver], // Mock returning participants
          error: null
        }),
        single: jest.fn().mockResolvedValue({ data: mockRoom, error: null }),
        order: jest.fn().mockResolvedValue({
          data: mockMessages,
          error: null
        })
      } as any);

      const downloadButton = await screen.findByText('Download Chat');
      await user.click(downloadButton);

      const jsonButton = await screen.findByText('JSON');
      await user.click(jsonButton);

      await waitFor(() => {
        const blobInstance = (global.Blob as jest.Mock).mock.instances[0];
        const content = blobInstance.content[0];
        const jsonData = JSON.parse(content);

        expect(jsonData.room.title).toBe('Phishing 101');
        expect(jsonData.participants).toHaveLength(3);
        expect(jsonData.participants).toContainEqual(expect.objectContaining({
          id: mockTutor.id,
          display_name: mockTutor.display_name,
          role: mockTutor.current_role
        }));
        expect(jsonData.participants).toContainEqual(expect.objectContaining({
          id: mockStudent.id,
          display_name: mockStudent.display_name,
          role: mockStudent.current_role
        }));
        expect(jsonData.participants).toContainEqual(expect.objectContaining({
          id: mockObserver.id,
          display_name: mockObserver.display_name,
          role: mockObserver.current_role
        }));
        expect(jsonData.messages).toHaveLength(2);
        expect(jsonData.messages[0]).toHaveProperty('content', 'Welcome to Phishing 101!');
        expect(jsonData.messages[0]).toHaveProperty('display_name');
        expect(jsonData.messages[0]).toHaveProperty('user_role');
        expect(jsonData.messages[0]).toHaveProperty('created_at');
      });
    });
  });

  describe('PDF format download', () => {
    it('should download chat history as PDF file', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RoomPage />, mockObserver);

      const downloadButton = await screen.findByText('Download Chat');
      await user.click(downloadButton);

      const pdfButton = await screen.findByText('PDF');
      await user.click(pdfButton);

      await waitFor(async () => {
        const { default: jsPDF } = await import('jspdf');
        const pdfInstance = (jsPDF as jest.Mock).mock.instances[0];
        expect(pdfInstance.save).toHaveBeenCalledWith('Phishing_101_chat_history.pdf');
      });
    });

    it('should create a valid PDF document', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RoomPage />, mockObserver);

      const downloadButton = await screen.findByText('Download Chat');
      await user.click(downloadButton);

      const pdfButton = await screen.findByText('PDF');
      await user.click(pdfButton);

      await waitFor(async () => {
        const { default: jsPDF } = await import('jspdf');
        expect(jsPDF).toHaveBeenCalled();
        const pdfInstance = (jsPDF as jest.Mock).mock.instances[0];
        expect(pdfInstance.text).toHaveBeenCalled();
        expect(pdfInstance.setFontSize).toHaveBeenCalled();
      });
    });
  });

  describe('Downloaded content validation', () => {
    it('should include room creation date in downloaded file', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RoomPage />, mockTutor);

      const downloadButton = await screen.findByText('Download Chat');
      await user.click(downloadButton);

      const jsonButton = await screen.findByText('JSON');
      await user.click(jsonButton);

      await waitFor(() => {
        const blobInstance = (global.Blob as jest.Mock).mock.instances[0];
        const content = blobInstance.content[0];
        const jsonData = JSON.parse(content);

        expect(jsonData.room.created_at).toBe('2024-01-01T00:00:00Z');
      });
    });

    it('should include each participant display name and role', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RoomPage />, mockTutor);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [mockTutor, mockStudent, mockObserver],
          error: null
        }),
        single: jest.fn().mockResolvedValue({ data: mockRoom, error: null }),
        order: jest.fn().mockResolvedValue({
          data: mockMessages,
          error: null
        })
      } as any);

      const downloadButton = await screen.findByText('Download Chat');
      await user.click(downloadButton);

      const jsonButton = await screen.findByText('JSON');
      await user.click(jsonButton);

      await waitFor(() => {
        const blobInstance = (global.Blob as jest.Mock).mock.instances[0];
        const content = blobInstance.content[0];
        const jsonData = JSON.parse(content);

        const tutorParticipant = jsonData.participants.find((p: any) => p.id === mockTutor.id);
        expect(tutorParticipant.display_name).toBe('Prof. Smith');
        expect(tutorParticipant.role).toBe('tutor');

        const studentParticipant = jsonData.participants.find((p: any) => p.id === mockStudent.id);
        expect(studentParticipant.display_name).toBe('John Doe');
        expect(studentParticipant.role).toBe('student');
      });
    });

    it('should include message with unique ID, content, author display name, role, and timestamp', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RoomPage />, mockTutor);

      const downloadButton = await screen.findByText('Download Chat');
      await user.click(downloadButton);

      const jsonButton = await screen.findByText('JSON');
      await user.click(jsonButton);

      await waitFor(() => {
        const blobInstance = (global.Blob as jest.Mock).mock.instances[0];
        const content = blobInstance.content[0];
        const jsonData = JSON.parse(content);

        expect(jsonData.messages[0]).toHaveProperty('id', 'msg-1');
        expect(jsonData.messages[0]).toHaveProperty('content', 'Welcome to Phishing 101!');
        expect(jsonData.messages[0]).toHaveProperty('display_name', 'Prof. Smith');
        expect(jsonData.messages[0]).toHaveProperty('user_role', 'tutor');
        expect(jsonData.messages[0]).toHaveProperty('created_at', '2024-01-01T10:00:00Z');
      });
    });
  });
});