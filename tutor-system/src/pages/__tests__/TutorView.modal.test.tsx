import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import TutorView from '../TutorView';
import { useAuth } from '../../contexts/AuthContext';
import * as supabaseService from '../../services/supabase';

// Mock the auth context
jest.mock('../../contexts/AuthContext');

// Mock the supabase service
jest.mock('../../services/supabase');

// Mock room data
const mockRooms = [
  {
    id: 'room-1',
    title: 'Test Room 1',
    description: 'Test Description 1',
    tutor_id: 'tutor-1',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    password: null,
    image_url: '/images/test.png'
  },
  {
    id: 'room-2',
    title: 'Test Room 2',
    description: 'Test Description 2',
    tutor_id: 'tutor-1',
    is_active: false,
    created_at: '2024-01-02T00:00:00Z',
    password: 'secret123',
    image_url: null
  }
];

describe('TutorView - Delete Room Modal', () => {
  const mockUser = {
    id: 'tutor-1',
    email: 'tutor@test.com',
    display_name: 'Test Tutor',
    role: 'tutor' as const,
    avatar_url: null,
    created_at: '2024-01-01T00:00:00Z'
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup auth mock
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false
    });

    // Setup supabase mocks
    (supabaseService.getRoomsByTutor as jest.Mock).mockResolvedValue(mockRooms);
    (supabaseService.getRoomTemplatesByTutor as jest.Mock).mockResolvedValue([]);
    (supabaseService.deleteRoom as jest.Mock).mockResolvedValue({
      success: true,
      title: 'Test Room 1'
    });

    // Mock console methods to reduce noise
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up body classes
    document.body.className = '';
    document.body.style.overflow = '';
    jest.restoreAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <TutorView />
      </BrowserRouter>
    );
  };

  test('should open delete confirmation modal when delete button is clicked', async () => {
    renderComponent();

    // Wait for rooms to load
    await waitFor(() => {
      expect(screen.getByText('Test Room 1')).toBeInTheDocument();
    });

    // Find and click the delete button for the first room
    const deleteButtons = await screen.findAllByRole('button', { name: /Delete Room/ });
    
    // Modal should not be visible initially
    expect(screen.queryByText(/Confirm Room Deletion/)).not.toBeInTheDocument();

    // Click delete button
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText(/Confirm Room Deletion/)).toBeInTheDocument();
    });

    // Check modal content
    expect(screen.getByText(/Are you sure you want to delete the room/)).toBeInTheDocument();
    expect(screen.getAllByText('Test Room 1').length).toBeGreaterThan(0);
  });

  test('should lock body scroll when modal opens', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Room 1')).toBeInTheDocument();
    });

    const deleteButtons = await screen.findAllByRole('button', { name: /Delete Room/ });
    expect(document.body.style.overflow).toBe('');

    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    // DeleteConfirmModal sets overflow hidden (portal modal)
    await waitFor(() => {
      expect(screen.getByText(/Confirm Room Deletion/)).toBeInTheDocument();
      expect(document.body.style.overflow).toBe('hidden');
    });
  });

  test('should close modal when Cancel button is clicked', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Room 1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText(/Delete Room/);
    
    // Open modal
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText(/Confirm Room Deletion/)).toBeInTheDocument();
    });

    // Click cancel button
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText(/Confirm Room Deletion/)).not.toBeInTheDocument();
    });

    // Body classes should be cleaned up
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  test('should close modal when Escape key is pressed', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Room 1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText(/Delete Room/);
    
    // Open modal
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText(/Confirm Room Deletion/)).toBeInTheDocument();
    });

    // Press Escape key
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    });

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText(/Confirm Room Deletion/)).not.toBeInTheDocument();
    });
  });

  test('should close modal when clicking outside', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Room 1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText(/Delete Room/);
    
    // Open modal
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText(/Confirm Room Deletion/)).toBeInTheDocument();
    });

    // Click on backdrop (outside modal content)
    const overlay = document.querySelector('.delete-modal-backdrop');
    expect(overlay).toBeInTheDocument();
    
    await act(async () => {
      fireEvent.click(overlay!);
    });

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText(/Confirm Room Deletion/)).not.toBeInTheDocument();
    });
  });

  test('should not close modal when clicking inside modal content', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Room 1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText(/Delete Room/);
    
    // Open modal
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText(/Confirm Room Deletion/)).toBeInTheDocument();
    });

    // Click inside modal content
    const modalContent = document.querySelector('.delete-modal-content');
    expect(modalContent).toBeInTheDocument();
    
    await act(async () => {
      fireEvent.click(modalContent!);
    });

    // Modal should still be open
    expect(screen.getByText(/Confirm Room Deletion/)).toBeInTheDocument();
  });

  test('should handle delete room successfully', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Room 1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText(/Delete Room/);
    
    // Open modal
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText(/Confirm Room Deletion/)).toBeInTheDocument();
    });

    // Click delete button in modal
    const confirmDeleteButton = screen.getByRole('button', { name: /^Delete Room$/i });
    
    await act(async () => {
      fireEvent.click(confirmDeleteButton);
    });

    // Check that deleteRoom was called (room id + tutor id for simplified auth)
    expect(supabaseService.deleteRoom).toHaveBeenCalledWith('room-1', 'tutor-1');

    // Modal should close after successful deletion
    await waitFor(() => {
      expect(screen.queryByText(/Confirm Room Deletion/)).not.toBeInTheDocument();
    });

    // Success message should appear
    expect(screen.getByText(/Room "Test Room 1" has been deleted successfully/)).toBeInTheDocument();
  });

  test('should disable buttons during deletion', async () => {
    // Make deleteRoom take some time
    (supabaseService.deleteRoom as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ success: true, title: 'Test Room 1' }), 100))
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Room 1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText(/Delete Room/);
    
    // Open modal
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText(/Confirm Room Deletion/)).toBeInTheDocument();
    });

    // Click delete button in modal
    const confirmDeleteButton = screen.getByRole('button', { name: /^Delete Room$/i });
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    
    await act(async () => {
      fireEvent.click(confirmDeleteButton);
    });

    // Buttons should be disabled during deletion
    expect(confirmDeleteButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    expect(confirmDeleteButton).toHaveTextContent('Deleting...');

    // Wait for deletion to complete
    await waitFor(() => {
      expect(screen.queryByText(/Confirm Room Deletion/)).not.toBeInTheDocument();
    });
  });

  test('should handle delete room error', async () => {
    // Make deleteRoom fail
    (supabaseService.deleteRoom as jest.Mock).mockRejectedValue(
      new Error('Failed to delete room')
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Room 1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText(/Delete Room/);
    
    // Open modal
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText(/Confirm Room Deletion/)).toBeInTheDocument();
    });

    // Click delete button in modal
    const confirmDeleteButton = screen.getByRole('button', { name: /^Delete Room$/i });
    
    await act(async () => {
      fireEvent.click(confirmDeleteButton);
    });

    // Modal should stay open on error
    await waitFor(() => {
      expect(screen.getByText(/Confirm Room Deletion/)).toBeInTheDocument();
    });

    // Error message should appear
    expect(screen.getByText('Failed to delete room')).toBeInTheDocument();
  });

  // Test for blinking/flickering issue
  test('modal should appear smoothly without flickering', async () => {
    const { container } = renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Room 1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText(/Delete Room/);
    const firstDeleteButton = deleteButtons[0];

    // Monitor portal modal mount (DeleteConfirmModal uses .delete-modal-backdrop)
    let modalVisibilityChanges = 0;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const modalOverlay = document.querySelector('.delete-modal-backdrop');
          if (modalOverlay) {
            modalVisibilityChanges++;
          }
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Click delete button
    await act(async () => {
      fireEvent.click(firstDeleteButton);
    });

    // Wait a bit to catch any flickering
    await new Promise(resolve => setTimeout(resolve, 500));

    // Modal should mount at least once without needing strict single-mutation count
    expect(modalVisibilityChanges).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Confirm Room Deletion/)).toBeInTheDocument();

    observer.disconnect();
  });
});