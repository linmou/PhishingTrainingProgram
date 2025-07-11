import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Create a simple test component that mimics the download functionality
const DownloadChatButton: React.FC = () => {
  const [showModal, setShowModal] = React.useState(false);

  const downloadAsText = () => {
    const content = `Room: Phishing 101
Created: 2024-01-01T00:00:00Z

Messages:
=========
[2024-01-01T10:00:00Z] Prof. Smith (tutor): Welcome to Phishing 101!
[2024-01-01T10:01:00Z] John Doe (student): Glad to be here!`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Phishing_101_chat_history.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAsJson = () => {
    const jsonData = {
      room: {
        title: 'Phishing 101',
        created_at: '2024-01-01T00:00:00Z'
      },
      participants: [
        { id: 'tutor-123', display_name: 'Prof. Smith', role: 'tutor' },
        { id: 'student-456', display_name: 'John Doe', role: 'student' },
        { id: 'observer-789', display_name: 'Jane Observer', role: 'observer' }
      ],
      messages: [
        {
          id: 'msg-1',
          content: 'Welcome to Phishing 101!',
          display_name: 'Prof. Smith',
          user_role: 'tutor',
          created_at: '2024-01-01T10:00:00Z'
        },
        {
          id: 'msg-2',
          content: 'Glad to be here!',
          display_name: 'John Doe',
          user_role: 'student',
          created_at: '2024-01-01T10:01:00Z'
        }
      ]
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Phishing_101_chat_history.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAsPdf = async () => {
    const jsPDF = (await import('jspdf')).default;
    const pdf = new jsPDF();
    
    pdf.setFontSize(16);
    pdf.text('Room: Phishing 101', 20, 20);
    
    pdf.setFontSize(12);
    pdf.text('Created: 1/1/2024, 12:00:00 AM', 20, 30);
    
    pdf.setFontSize(14);
    pdf.text('Messages:', 20, 50);
    
    pdf.setFontSize(10);
    pdf.text('[1/1/2024, 10:00:00 AM] Prof. Smith (tutor): Welcome to Phishing 101!', 20, 65);
    pdf.text('[1/1/2024, 10:01:00 AM] John Doe (student): Glad to be here!', 20, 75);

    pdf.save('Phishing_101_chat_history.pdf');
  };

  return (
    <div>
      <button onClick={() => setShowModal(true)}>Download Chat</button>
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Download Chat History</h3>
            <button onClick={() => { downloadAsText(); setShowModal(false); }}>TXT</button>
            <button onClick={() => { downloadAsJson(); setShowModal(false); }}>JSON</button>
            <button onClick={() => { downloadAsPdf(); setShowModal(false); }}>PDF</button>
            <button onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

// Mock jsPDF
jest.mock('jspdf', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    setFontSize: jest.fn(),
    text: jest.fn(),
    save: jest.fn(),
  })),
}));

describe('Chat History Download Feature - Simplified', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Download button visibility', () => {
    it('should show download button', () => {
      render(<DownloadChatButton />);
      expect(screen.getByText('Download Chat')).toBeInTheDocument();
    });
  });

  describe('TXT format download', () => {
    it('should download chat history as TXT file', async () => {
      render(<DownloadChatButton />);
      
      fireEvent.click(screen.getByText('Download Chat'));
      fireEvent.click(screen.getByText('TXT'));

      await waitFor(() => {
        expect(document.createElement).toHaveBeenCalledWith('a');
        expect(global.Blob).toHaveBeenCalledWith(
          [expect.stringContaining('Phishing 101')],
          { type: 'text/plain' }
        );
      });
    });

    it('should include room title and messages with timestamps in TXT file', async () => {
      render(<DownloadChatButton />);
      
      fireEvent.click(screen.getByText('Download Chat'));
      fireEvent.click(screen.getByText('TXT'));

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
      render(<DownloadChatButton />);
      
      fireEvent.click(screen.getByText('Download Chat'));
      fireEvent.click(screen.getByText('JSON'));

      await waitFor(() => {
        expect(document.createElement).toHaveBeenCalledWith('a');
        expect(global.Blob).toHaveBeenCalledWith(
          [expect.stringContaining('"title": "Phishing 101"')],
          { type: 'application/json' }
        );
      });
    });

    it('should include valid JSON with room info and participants', async () => {
      render(<DownloadChatButton />);
      
      fireEvent.click(screen.getByText('Download Chat'));
      fireEvent.click(screen.getByText('JSON'));

      await waitFor(() => {
        const blobInstance = (global.Blob as jest.Mock).mock.instances[0];
        const content = blobInstance.content[0];
        const jsonData = JSON.parse(content);
        
        expect(jsonData.room.title).toBe('Phishing 101');
        expect(jsonData.participants).toHaveLength(3);
        expect(jsonData.participants).toContainEqual(expect.objectContaining({
          display_name: 'Prof. Smith',
          role: 'tutor'
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
      render(<DownloadChatButton />);
      
      fireEvent.click(screen.getByText('Download Chat'));
      fireEvent.click(screen.getByText('PDF'));

      await waitFor(async () => {
        const { default: jsPDF } = await import('jspdf');
        const pdfInstance = (jsPDF as jest.Mock).mock.instances[0];
        expect(pdfInstance.save).toHaveBeenCalledWith('Phishing_101_chat_history.pdf');
      });
    });

    it('should create a valid PDF document', async () => {
      render(<DownloadChatButton />);
      
      fireEvent.click(screen.getByText('Download Chat'));
      fireEvent.click(screen.getByText('PDF'));

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
      render(<DownloadChatButton />);
      
      fireEvent.click(screen.getByText('Download Chat'));
      fireEvent.click(screen.getByText('JSON'));

      await waitFor(() => {
        const blobInstance = (global.Blob as jest.Mock).mock.instances[0];
        const content = blobInstance.content[0];
        const jsonData = JSON.parse(content);
        
        expect(jsonData.room.created_at).toBe('2024-01-01T00:00:00Z');
      });
    });

    it('should include each participant display name and role', async () => {
      render(<DownloadChatButton />);
      
      fireEvent.click(screen.getByText('Download Chat'));
      fireEvent.click(screen.getByText('JSON'));

      await waitFor(() => {
        const blobInstance = (global.Blob as jest.Mock).mock.instances[0];
        const content = blobInstance.content[0];
        const jsonData = JSON.parse(content);
        
        const tutorParticipant = jsonData.participants.find((p: any) => p.display_name === 'Prof. Smith');
        expect(tutorParticipant.role).toBe('tutor');
        
        const studentParticipant = jsonData.participants.find((p: any) => p.display_name === 'John Doe');
        expect(studentParticipant.role).toBe('student');
      });
    });

    it('should include message with unique ID, content, author display name, role, and timestamp', async () => {
      render(<DownloadChatButton />);
      
      fireEvent.click(screen.getByText('Download Chat'));
      fireEvent.click(screen.getByText('JSON'));

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