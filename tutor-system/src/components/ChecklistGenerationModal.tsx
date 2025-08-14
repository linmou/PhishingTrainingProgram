/**
 * ChecklistGenerationModal Component
 * Shows user options for generating checklists based on room context
 * TDD Green Phase: Minimal implementation to pass tests
 */

import React, { useEffect } from 'react';
import { X, Settings, Edit, Plus, FileText } from 'lucide-react';
import './ChecklistGenerationModal.css';

export interface ChecklistGenerationModalProps {
  mode: 'no_ai_config' | 'empty_system_prompt';
  message: string;
  onClose: () => void;
  onSetupAI?: () => void;
  onManualInput: () => void;
  onUseTemplate: () => void;
  onEditAIPrompt?: () => void;
}

export const ChecklistGenerationModal: React.FC<ChecklistGenerationModalProps> = ({
  mode,
  message,
  onClose,
  onSetupAI,
  onManualInput,
  onUseTemplate,
  onEditAIPrompt
}) => {
  // Handle Escape key press
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleContentClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div 
      className="checklist-generation-modal-overlay" 
      data-testid="modal-overlay"
      onClick={handleOverlayClick}
    >
      <div 
        className="checklist-generation-modal-content"
        data-testid="modal-content"
        onClick={handleContentClick}
      >
        <div className="modal-header">
          <h2>Checklist Generation Options</h2>
          <button 
            className="modal-close-button"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-message">{message}</p>

          <div className="modal-options">
            {mode === 'no_ai_config' && (
              <>
                {onSetupAI && (
                  <button 
                    className="modal-option-button primary"
                    onClick={onSetupAI}
                  >
                    <Settings size={16} />
                    Setup AI Assistant
                  </button>
                )}
                
                <button 
                  className="modal-option-button secondary"
                  onClick={onManualInput}
                >
                  <Edit size={16} />
                  Create Manual Checklist
                </button>

                <button 
                  className="modal-option-button tertiary"
                  onClick={onUseTemplate}
                >
                  <FileText size={16} />
                  Use Template
                </button>
              </>
            )}

            {mode === 'empty_system_prompt' && (
              <>
                <button 
                  className="modal-option-button primary"
                  onClick={onManualInput}
                >
                  <Plus size={16} />
                  Add Custom Areas
                </button>

                <button 
                  className="modal-option-button secondary"
                  onClick={onUseTemplate}
                >
                  <FileText size={16} />
                  Use Template
                </button>

                {onEditAIPrompt && (
                  <button 
                    className="modal-option-button tertiary"
                    onClick={onEditAIPrompt}
                  >
                    <Edit size={16} />
                    Edit AI Prompt
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};