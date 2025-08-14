/**
 * Test for ChecklistGenerationModal component
 * TDD Red Phase: Testing user interaction modal
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChecklistGenerationModal, ChecklistGenerationModalProps } from '../ChecklistGenerationModal';

describe('ChecklistGenerationModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSetupAI = jest.fn();
  const mockOnManualInput = jest.fn();
  const mockOnUseTemplate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('no_ai_config mode', () => {
    const defaultProps: ChecklistGenerationModalProps = {
      mode: 'no_ai_config',
      message: 'No AI assistant found. Would you like to set up AI first or create a manual checklist?',
      onClose: mockOnClose,
      onSetupAI: mockOnSetupAI,
      onManualInput: mockOnManualInput,
      onUseTemplate: mockOnUseTemplate
    };

    it('should render modal with correct message and options', () => {
      // Red Phase: Component doesn't exist yet
      render(<ChecklistGenerationModal {...defaultProps} />);
      
      expect(screen.getByText('Checklist Generation Options')).toBeInTheDocument();
      expect(screen.getByText(defaultProps.message)).toBeInTheDocument();
      expect(screen.getByText('Setup AI Assistant')).toBeInTheDocument();
      expect(screen.getByText('Create Manual Checklist')).toBeInTheDocument();
      expect(screen.getByText('Use Template')).toBeInTheDocument();
    });

    it('should call onSetupAI when Setup AI Assistant button is clicked', () => {
      render(<ChecklistGenerationModal {...defaultProps} />);
      
      const setupButton = screen.getByText('Setup AI Assistant');
      fireEvent.click(setupButton);
      
      expect(mockOnSetupAI).toHaveBeenCalledTimes(1);
    });

    it('should call onManualInput when Create Manual Checklist button is clicked', () => {
      render(<ChecklistGenerationModal {...defaultProps} />);
      
      const manualButton = screen.getByText('Create Manual Checklist');
      fireEvent.click(manualButton);
      
      expect(mockOnManualInput).toHaveBeenCalledTimes(1);
    });

    it('should call onUseTemplate when Use Template button is clicked', () => {
      render(<ChecklistGenerationModal {...defaultProps} />);
      
      const templateButton = screen.getByText('Use Template');
      fireEvent.click(templateButton);
      
      expect(mockOnUseTemplate).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button is clicked', () => {
      render(<ChecklistGenerationModal {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty_system_prompt mode', () => {
    const emptyPromptProps: ChecklistGenerationModalProps = {
      mode: 'empty_system_prompt',
      message: 'No detection areas found in AI system prompt. Add custom areas or use a template?',
      onClose: mockOnClose,
      onManualInput: mockOnManualInput,
      onUseTemplate: mockOnUseTemplate,
      onEditAIPrompt: jest.fn()
    };

    it('should render different options for empty system prompt mode', () => {
      render(<ChecklistGenerationModal {...emptyPromptProps} />);
      
      expect(screen.getByText('Add Custom Areas')).toBeInTheDocument();
      expect(screen.getByText('Use Template')).toBeInTheDocument();
      expect(screen.getByText('Edit AI Prompt')).toBeInTheDocument();
      
      // Should not show Setup AI option
      expect(screen.queryByText('Setup AI Assistant')).not.toBeInTheDocument();
    });

    it('should call onEditAIPrompt when Edit AI Prompt button is clicked', () => {
      const mockOnEditAIPrompt = jest.fn();
      render(<ChecklistGenerationModal {...emptyPromptProps} onEditAIPrompt={mockOnEditAIPrompt} />);
      
      const editButton = screen.getByText('Edit AI Prompt');
      fireEvent.click(editButton);
      
      expect(mockOnEditAIPrompt).toHaveBeenCalledTimes(1);
    });
  });

  describe('modal overlay and accessibility', () => {
    const props: ChecklistGenerationModalProps = {
      mode: 'no_ai_config',
      message: 'Test message',
      onClose: mockOnClose,
      onSetupAI: mockOnSetupAI,
      onManualInput: mockOnManualInput,
      onUseTemplate: mockOnUseTemplate
    };

    it('should close modal when overlay is clicked', () => {
      render(<ChecklistGenerationModal {...props} />);
      
      const overlay = screen.getByTestId('modal-overlay');
      fireEvent.click(overlay);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not close modal when modal content is clicked', () => {
      render(<ChecklistGenerationModal {...props} />);
      
      const modalContent = screen.getByTestId('modal-content');
      fireEvent.click(modalContent);
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should close modal when Escape key is pressed', () => {
      render(<ChecklistGenerationModal {...props} />);
      
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});