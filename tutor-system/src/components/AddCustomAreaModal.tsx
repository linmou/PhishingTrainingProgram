import React, { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { ChecklistItem } from '../types/checklist';
import './AddCustomAreaModal.css';

interface AddCustomAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    areaText: string,
    itemType: 'detection_area' | 'verification_step',
    priority: ChecklistItem['priority']
  ) => Promise<void>;
}

const AddCustomAreaModal: React.FC<AddCustomAreaModalProps> = ({
  isOpen,
  onClose,
  onAdd
}) => {
  const [areaText, setAreaText] = useState('');
  const [itemType, setItemType] = useState<'detection_area' | 'verification_step'>('detection_area');
  const [priority, setPriority] = useState<ChecklistItem['priority']>('important');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!areaText.trim()) {
      setError('Please enter a description for the area');
      return;
    }

    if (areaText.trim().length < 10) {
      setError('Description should be at least 10 characters long');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      await onAdd(areaText.trim(), itemType, priority);
      
      // Reset form
      setAreaText('');
      setItemType('detection_area');
      setPriority('important');
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add custom area');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setAreaText('');
      setItemType('detection_area');
      setPriority('important');
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Custom Learning Area</h3>
          <button
            className="modal-close"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="item-type">Type:</label>
            <select
              id="item-type"
              value={itemType}
              onChange={(e) => setItemType(e.target.value as 'detection_area' | 'verification_step')}
              disabled={isSubmitting}
              className="form-select"
            >
              <option value="detection_area">🔍 Detection Area</option>
              <option value="verification_step">✅ Verification Step</option>
            </select>
            <div className="form-help">
              Detection areas help students identify threats. Verification steps teach how to confirm suspicions.
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="priority">Priority:</label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as ChecklistItem['priority'])}
              disabled={isSubmitting}
              className="form-select"
            >
              <option value="critical">🔴 Critical - Essential for safety</option>
              <option value="important">🟡 Important - Recommended skill</option>
              <option value="optional">⚪ Optional - Additional knowledge</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="area-text">
              {itemType === 'detection_area' ? 'Detection Area Description:' : 'Verification Step Description:'}
            </label>
            <textarea
              id="area-text"
              value={areaText}
              onChange={(e) => setAreaText(e.target.value)}
              disabled={isSubmitting}
              className="form-textarea"
              rows={4}
              placeholder={itemType === 'detection_area' 
                ? "e.g., Emotional manipulation through false urgency - Student should recognize pressure tactics that create artificial time pressure"
                : "e.g., Cross-reference with official sources - Check the company's official website or social media for verification"
              }
              maxLength={500}
            />
            <div className="form-counter">
              {areaText.length}/500 characters
            </div>
            {areaText.length < 10 && areaText.length > 0 && (
              <div className="form-warning">
                <AlertCircle size={14} />
                Description should be more detailed (at least 10 characters)
              </div>
            )}
          </div>

          {error && (
            <div className="form-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="button-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !areaText.trim() || areaText.trim().length < 10}
              className="button-primary"
            >
              {isSubmitting ? (
                <>
                  <div className="spinner" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Add Area
                </>
              )}
            </button>
          </div>
        </form>

        <div className="modal-tips">
          <h4>💡 Tips for Creating Effective Learning Areas:</h4>
          <ul>
            <li><strong>Be specific:</strong> "Check for urgent language like 'Act now!'" vs "Look for urgency"</li>
            <li><strong>Include context:</strong> Explain why this skill matters for online safety</li>
            <li><strong>Make it actionable:</strong> Students should know exactly what to look for or do</li>
            <li><strong>Consider difficulty:</strong> Start with basic concepts before advanced ones</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AddCustomAreaModal;