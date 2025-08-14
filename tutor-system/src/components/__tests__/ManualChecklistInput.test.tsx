/**
 * Test for ManualChecklistInput component
 * TDD Red Phase: Testing manual checklist input form
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManualChecklistInput, ManualChecklistInputProps } from '../ManualChecklistInput';

describe('ManualChecklistInput', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps: ManualChecklistInputProps = {
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel
  };

  describe('basic rendering', () => {
    it('should render form with detection areas and verification steps inputs', () => {
      // Red Phase: Component doesn't exist yet
      render(<ManualChecklistInput {...defaultProps} />);
      
      expect(screen.getByText('Create Manual Checklist')).toBeInTheDocument();
      expect(screen.getByLabelText('Detection Areas')).toBeInTheDocument();
      expect(screen.getByLabelText('Verification Steps')).toBeInTheDocument();
      expect(screen.getByText('Create Checklist')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should show placeholders with examples', () => {
      render(<ManualChecklistInput {...defaultProps} />);
      
      const detectionAreasInput = screen.getByLabelText('Detection Areas');
      const verificationStepsInput = screen.getByLabelText('Verification Steps');
      
      expect(detectionAreasInput).toHaveAttribute('placeholder', expect.stringContaining('Too good to be true pricing'));
      expect(verificationStepsInput).toHaveAttribute('placeholder', expect.stringContaining('Check sender authenticity'));
    });

    it('should display real-time preview of checklist items', () => {
      render(<ManualChecklistInput {...defaultProps} />);
      
      const detectionInput = screen.getByLabelText('Detection Areas');
      fireEvent.change(detectionInput, { 
        target: { value: 'Urgent language\nSuspicious URLs' } 
      });
      
      expect(screen.getByText('Preview (2 detection areas, 0 verification steps)')).toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    it('should require at least one detection area', async () => {
      render(<ManualChecklistInput {...defaultProps} />);
      
      const submitButton = screen.getByText('Create Checklist');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('At least one detection area is required')).toBeInTheDocument();
      });
      
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should allow submission with only detection areas', async () => {
      render(<ManualChecklistInput {...defaultProps} />);
      
      const detectionInput = screen.getByLabelText('Detection Areas');
      fireEvent.change(detectionInput, { 
        target: { value: 'Urgent language pressure\nToo good to be true pricing' } 
      });
      
      const submitButton = screen.getByText('Create Checklist');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          ['Urgent language pressure', 'Too good to be true pricing'],
          []
        );
      });
    });

    it('should submit both detection areas and verification steps', async () => {
      render(<ManualChecklistInput {...defaultProps} />);
      
      const detectionInput = screen.getByLabelText('Detection Areas');
      const verificationInput = screen.getByLabelText('Verification Steps');
      
      fireEvent.change(detectionInput, { 
        target: { value: 'Suspicious URLs\nUrgent language' } 
      });
      
      fireEvent.change(verificationInput, { 
        target: { value: 'Check sender identity\nVerify website legitimacy' } 
      });
      
      const submitButton = screen.getByText('Create Checklist');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          ['Suspicious URLs', 'Urgent language'],
          ['Check sender identity', 'Verify website legitimacy']
        );
      });
    });

    it('should filter out empty lines and trim whitespace', async () => {
      render(<ManualChecklistInput {...defaultProps} />);
      
      const detectionInput = screen.getByLabelText('Detection Areas');
      fireEvent.change(detectionInput, { 
        target: { value: '  Urgent language  \n\n  Too good pricing  \n  ' } 
      });
      
      const submitButton = screen.getByText('Create Checklist');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          ['Urgent language', 'Too good pricing'],
          []
        );
      });
    });
  });

  describe('template import feature', () => {
    const propsWithTemplate: ManualChecklistInputProps = {
      ...defaultProps,
      suggestedTemplate: 'General Scam Indicators'
    };

    it('should show import template button when template is suggested', () => {
      render(<ManualChecklistInput {...propsWithTemplate} />);
      
      expect(screen.getByText('Import from "General Scam Indicators" template')).toBeInTheDocument();
    });

    it('should not show import button when no template suggested', () => {
      render(<ManualChecklistInput {...defaultProps} />);
      
      expect(screen.queryByText(/Import from/)).not.toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should call onCancel when Cancel button is clicked', () => {
      render(<ManualChecklistInput {...defaultProps} />);
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should update preview count as user types', () => {
      render(<ManualChecklistInput {...defaultProps} />);
      
      const detectionInput = screen.getByLabelText('Detection Areas');
      const verificationInput = screen.getByLabelText('Verification Steps');
      
      // Initially no preview
      expect(screen.getByText('Preview (0 detection areas, 0 verification steps)')).toBeInTheDocument();
      
      // Add detection areas
      fireEvent.change(detectionInput, { target: { value: 'Area 1\nArea 2' } });
      expect(screen.getByText('Preview (2 detection areas, 0 verification steps)')).toBeInTheDocument();
      
      // Add verification steps
      fireEvent.change(verificationInput, { target: { value: 'Step 1' } });
      expect(screen.getByText('Preview (2 detection areas, 1 verification steps)')).toBeInTheDocument();
    });

    it('should disable submit button while processing', async () => {
      render(<ManualChecklistInput {...defaultProps} />);
      
      const detectionInput = screen.getByLabelText('Detection Areas');
      fireEvent.change(detectionInput, { target: { value: 'Test area' } });
      
      const submitButton = screen.getByText('Create Checklist');
      fireEvent.click(submitButton);
      
      // Button should show loading state
      expect(screen.getByText('Creating...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });
});