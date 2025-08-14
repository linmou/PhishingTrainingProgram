/**
 * ManualChecklistInput Component
 * Form for manually creating checklist items
 * TDD Green Phase: Minimal implementation to pass tests
 */

import React, { useState, useMemo } from 'react';
import { Check, X, Download, Eye } from 'lucide-react';
import './ManualChecklistInput.css';

export interface ManualChecklistInputProps {
  onSubmit: (detectionAreas: string[], verificationSteps: string[]) => void;
  onCancel: () => void;
  suggestedTemplate?: string;
}

export const ManualChecklistInput: React.FC<ManualChecklistInputProps> = ({
  onSubmit,
  onCancel,
  suggestedTemplate
}) => {
  const [detectionAreasText, setDetectionAreasText] = useState('');
  const [verificationStepsText, setVerificationStepsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Parse text areas into arrays, filtering empty lines and trimming
  const parsedItems = useMemo(() => {
    const parseTextArea = (text: string): string[] => {
      return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    };

    const detectionAreas = parseTextArea(detectionAreasText);
    const verificationSteps = parseTextArea(verificationStepsText);

    return { detectionAreas, verificationSteps };
  }, [detectionAreasText, verificationStepsText]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError('');

    // Validation: At least one detection area required
    if (parsedItems.detectionAreas.length === 0) {
      setValidationError('At least one detection area is required');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit(parsedItems.detectionAreas, parsedItems.verificationSteps);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportTemplate = () => {
    // TODO: Implement template import functionality
    console.log('Import from template:', suggestedTemplate);
  };

  return (
    <div className="manual-checklist-input">
      <div className="manual-checklist-header">
        <h2>Create Manual Checklist</h2>
      </div>

      <form onSubmit={handleSubmit} className="manual-checklist-form">
        <div className="form-group">
          <label htmlFor="detection-areas" className="form-label">
            Detection Areas
          </label>
          <textarea
            id="detection-areas"
            className="form-textarea"
            value={detectionAreasText}
            onChange={(e) => setDetectionAreasText(e.target.value)}
            placeholder="Enter detection areas, one per line:&#10;&#10;Too good to be true pricing&#10;Urgent language pressure&#10;Suspicious or shortened URLs&#10;Poor grammar and spelling"
            rows={6}
            aria-label="Detection Areas"
          />
        </div>

        <div className="form-group">
          <label htmlFor="verification-steps" className="form-label">
            Verification Steps
          </label>
          <textarea
            id="verification-steps"
            className="form-textarea"
            value={verificationStepsText}
            onChange={(e) => setVerificationStepsText(e.target.value)}
            placeholder="Enter verification steps, one per line:&#10;&#10;Check sender authenticity&#10;Verify website legitimacy&#10;Look for official contact methods&#10;Cross-reference with known sources"
            rows={6}
            aria-label="Verification Steps"
          />
        </div>

        <div className="form-preview">
          <div className="preview-header">
            <Eye size={16} />
            <span>
              Preview ({parsedItems.detectionAreas.length} detection areas, {parsedItems.verificationSteps.length} verification steps)
            </span>
          </div>
        </div>

        {suggestedTemplate && (
          <div className="template-import-section">
            <button
              type="button"
              className="template-import-button"
              onClick={handleImportTemplate}
            >
              <Download size={16} />
              Import from "{suggestedTemplate}" template
            </button>
          </div>
        )}

        {validationError && (
          <div className="validation-error">
            {validationError}
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <X size={16} />
            Cancel
          </button>
          
          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting}
          >
            <Check size={16} />
            {isSubmitting ? 'Creating...' : 'Create Checklist'}
          </button>
        </div>
      </form>
    </div>
  );
};