/**
 * Test to diagnose the modal blinking issue
 */

import React, { useState, useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Simplified component that reproduces the issue
const TestModalComponent = () => {
  const [showModal, setShowModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    if (showModal) {
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    };
  }, [showModal]);

  const handleDelete = () => {
    // This blur might be causing issues
    (document.activeElement as HTMLElement)?.blur();
    setShowModal(true);
  };

  const handleConfirm = async () => {
    setIsDeleting(true);
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    setShowModal(false);
    setIsDeleting(false);
  };

  const handleCancel = () => {
    if (!isDeleting) {
      setShowModal(false);
    }
  };

  return (
    <div>
      <button 
        className="delete-button"
        onClick={handleDelete}
        style={{
          padding: '10px',
          background: 'red',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          transition: 'transform 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = '';
        }}
      >
        Delete Item
      </button>

      {showModal && (
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              handleCancel();
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div 
            className="modal-content"
            style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              minWidth: '300px'
            }}
          >
            <h2>Confirm Delete</h2>
            <p>Are you sure?</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={handleCancel}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

describe('Modal Blinking Issue', () => {
  beforeEach(() => {
    document.body.className = '';
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.className = '';
    document.body.style.overflow = '';
  });

  test('should track modal visibility changes', async () => {
    const { container } = render(<TestModalComponent />);
    
    const deleteButton = screen.getByText('Delete Item');
    
    // Track DOM mutations
    let modalAppearances = 0;
    let modalDisappearances = 0;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement && node.classList?.contains('modal-overlay')) {
              modalAppearances++;
              console.log(`Modal appeared (count: ${modalAppearances})`);
            }
          });
          mutation.removedNodes.forEach((node) => {
            if (node instanceof HTMLElement && node.classList?.contains('modal-overlay')) {
              modalDisappearances++;
              console.log(`Modal disappeared (count: ${modalDisappearances})`);
            }
          });
        }
      });
    });

    observer.observe(container, { childList: true, subtree: true });

    // Click delete button
    fireEvent.click(deleteButton);

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    });

    // Wait a bit to catch any flickering
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check for blinking (modal should appear only once)
    expect(modalAppearances).toBe(1);
    expect(modalDisappearances).toBe(0);

    observer.disconnect();
  });

  test('should handle focus correctly', async () => {
    render(<TestModalComponent />);
    
    const deleteButton = screen.getByText('Delete Item');
    
    // Focus the delete button
    deleteButton.focus();
    expect(document.activeElement).toBe(deleteButton);
    
    // Click delete button
    fireEvent.click(deleteButton);
    
    // Check that focus was removed
    expect(document.activeElement).not.toBe(deleteButton);
    
    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    });
  });

  test('should handle hover state transitions', async () => {
    render(<TestModalComponent />);
    
    const deleteButton = screen.getByText('Delete Item') as HTMLButtonElement;
    
    // Initial state
    expect(deleteButton.style.transform).toBe('');
    
    // Hover over button
    fireEvent.mouseEnter(deleteButton);
    expect(deleteButton.style.transform).toBe('translateY(-2px)');
    
    // Click while hovering
    fireEvent.click(deleteButton);
    
    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    });
    
    // Button transform should be reset when modal opens
    expect(document.body.classList.contains('modal-open')).toBe(true);
  });

  test('should not flicker when clicking rapidly', async () => {
    const { container } = render(<TestModalComponent />);
    
    const deleteButton = screen.getByText('Delete Item');
    
    let modalCount = 0;
    const observer = new MutationObserver(() => {
      if (document.querySelector('.modal-overlay')) {
        modalCount++;
      }
    });
    
    observer.observe(container, { childList: true, subtree: true });
    
    // Rapid clicks
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);
    
    await waitFor(() => {
      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    });
    
    // Should only show modal once despite rapid clicks
    expect(modalCount).toBeLessThanOrEqual(1);
    
    observer.disconnect();
  });
});