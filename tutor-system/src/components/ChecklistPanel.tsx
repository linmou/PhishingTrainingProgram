import React, { useState, useCallback } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Download, 
  Settings,
  Eye,
  EyeOff,
  RotateCcw,
  Edit,
  Zap
} from 'lucide-react';
import { ChecklistItem } from '../types/checklist';
import { useChecklist } from '../hooks/useChecklist';
import { ChecklistGenerationModal } from './ChecklistGenerationModal';
import { ManualChecklistInput } from './ManualChecklistInput';
import AddCustomAreaModal from './AddCustomAreaModal';
import { RoomFeaturesService } from '../services/roomFeaturesService';
import './ChecklistPanel.css';

interface ChecklistPanelProps {
  roomId: string;
  isVisible: boolean;
  onToggleVisibility: () => void;
}

interface ChecklistItemComponentProps {
  item: ChecklistItem;
  onStatusChange: (itemId: string, newStatus: ChecklistItem['status']) => void;
  onPriorityChange: (itemId: string, newPriority: ChecklistItem['priority']) => void;
  onAddNote: (itemId: string, note: string) => void;
  onViewEvidence: (itemId: string) => void;
}

const ChecklistItemComponent: React.FC<ChecklistItemComponentProps> = ({
  item,
  onStatusChange,
  onPriorityChange,
  onAddNote,
  onViewEvidence
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(item.tutor_notes);

  const getStatusIcon = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'covered':
        return <CheckCircle2 size={16} className="status-icon covered" />;
      case 'partially_covered':
        return <Clock size={16} className="status-icon partial" />;
      case 'needs_review':
        return <AlertTriangle size={16} className="status-icon review" />;
      default:
        return <div className="status-icon pending" />;
    }
  };

  const getPriorityColor = (priority: ChecklistItem['priority']) => {
    switch (priority || 'optional') {
      case 'critical': return 'priority-critical';
      case 'important': return 'priority-important';
      default: return 'priority-optional';
    }
  };

  const getUnderstandingBadge = (level: ChecklistItem['understanding_level']) => {
    const badges = {
      'excellent': { text: 'Excellent', class: 'understanding-excellent' },
      'good': { text: 'Good', class: 'understanding-good' },
      'basic': { text: 'Basic', class: 'understanding-basic' },
      'none': { text: 'None', class: 'understanding-none' }
    };
    return badges[level || 'none'];
  };

  const handleSaveNote = () => {
    onAddNote(item.id, noteText);
    setEditingNote(false);
  };

  return (
    <div className={`checklist-item ${getPriorityColor(item.priority)}`}>
      <div className="checklist-item-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="checklist-item-main">
          {getStatusIcon(item.status)}
          <span className="checklist-item-text">{item.area_text}</span>
          <div className="checklist-item-badges">
            <span className={`priority-badge ${getPriorityColor(item.priority)}`}>
              {(item.priority || 'optional').toUpperCase()}
            </span>
            {item.status !== 'pending' && (
              <span className={`understanding-badge ${getUnderstandingBadge(item.understanding_level).class}`}>
                {getUnderstandingBadge(item.understanding_level).text}
              </span>
            )}
          </div>
        </div>
        <div className="checklist-item-controls">
          {item.coverage_evidence.length > 0 && (
            <button
              className="evidence-button"
              onClick={(e) => {
                e.stopPropagation();
                onViewEvidence(item.id);
              }}
              title="View evidence"
            >
              <Eye size={14} />
            </button>
          )}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {isExpanded && (
        <div className="checklist-item-details">
          <div className="checklist-item-controls-expanded">
            <div className="control-group">
              <label>Status:</label>
              <select
                value={item.status}
                onChange={(e) => onStatusChange(item.id, e.target.value as ChecklistItem['status'])}
                className="status-select"
              >
                <option value="pending">Pending</option>
                <option value="partially_covered">Partially Covered</option>
                <option value="covered">Covered</option>
                <option value="needs_review">Needs Review</option>
              </select>
            </div>

            <div className="control-group">
              <label>Priority:</label>
              <select
                value={item.priority}
                onChange={(e) => onPriorityChange(item.id, e.target.value as ChecklistItem['priority'])}
                className="priority-select"
              >
                <option value="critical">Critical</option>
                <option value="important">Important</option>
                <option value="optional">Optional</option>
              </select>
            </div>
          </div>

          <div className="checklist-item-notes">
            <div className="notes-header">
              <label>Tutor Notes:</label>
              {!editingNote && (
                <button
                  className="edit-note-button"
                  onClick={() => setEditingNote(true)}
                >
                  Edit
                </button>
              )}
            </div>
            {editingNote ? (
              <div className="note-editor">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add notes about student's understanding..."
                  rows={3}
                />
                <div className="note-actions">
                  <button onClick={handleSaveNote} className="save-note">Save</button>
                  <button onClick={() => setEditingNote(false)} className="cancel-note">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="note-display">
                {item.tutor_notes || <span className="no-notes">No notes added</span>}
              </div>
            )}
          </div>

          {item.coverage_evidence.length > 0 && (
            <div className="evidence-summary">
              <strong>Latest Evidence:</strong>
              <div className="evidence-item">
                <div className="evidence-text">"{item.coverage_evidence[0].evidence_text}"</div>
                <div className="evidence-meta">
                  {item.coverage_evidence[0].detection_method} • 
                  Confidence: {item.coverage_evidence[0].confidence_score}%
                </div>
              </div>
            </div>
          )}

          <div className="item-metadata">
            <div className="metadata-item">
              <strong>Attempts:</strong> {item.attempts_count}
            </div>
            {item.last_addressed && (
              <div className="metadata-item">
                <strong>Last Addressed:</strong> {new Date(item.last_addressed).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ChecklistPanel: React.FC<ChecklistPanelProps> = ({
  roomId,
  isVisible,
  onToggleVisibility
}) => {
  // Use the enhanced service layer hook
  const { 
    checklist, 
    loading, 
    error, 
    progress,
    updateItem,
    refreshChecklist,
    generateChecklist,
    // New enhanced functionality
    showGenerationModal,
    showManualInput,
    startSmartGeneration,
    openManualInput,
    closeModals,
    handleSetupAI,
    handleManualSubmit
  } = useChecklist(roomId);

  const [showAddCustomArea, setShowAddCustomArea] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const handleStatusChange = async (itemId: string, newStatus: ChecklistItem['status']) => {
    try {
      await updateItem(itemId, { status: newStatus });
    } catch (err) {
      console.error('Failed to update status:', err);
      // Error handling is done in the hook
    }
  };

  const handlePriorityChange = async (itemId: string, newPriority: ChecklistItem['priority']) => {
    try {
      await updateItem(itemId, { priority: newPriority });
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  const handleAddNote = async (itemId: string, note: string) => {
    try {
      await updateItem(itemId, { tutor_notes: note });
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  };

  const handleViewEvidence = (itemId: string) => {
    // TODO: Open evidence modal
    console.log('View evidence for item:', itemId);
  };

  const handleExportReport = () => {
    // TODO: Generate and download progress report
    console.log('Export progress report');
  };

  const handleAddCustomArea = async (
    areaText: string, 
    itemType: 'detection_area' | 'verification_step', 
    priority: ChecklistItem['priority']
  ) => {
    try {
      console.log('Adding custom area:', { areaText, itemType, priority });
      
      // Use the ChecklistService method to add the custom area
      await RoomFeaturesService.checklist.addCustomArea(roomId, areaText, itemType, priority);
      
      // Refresh the checklist to show the new area
      await refreshChecklist();
      
      console.log('✅ Custom area added successfully');
    } catch (error) {
      console.error('Failed to add custom area:', error);
      throw error;
    }
  };

  const toggleSection = (sectionName: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const groupItemsByPriority = (items: ChecklistItem[]) => {
    return {
      critical: items.filter(item => item.priority === 'critical'),
      important: items.filter(item => item.priority === 'important'),
      optional: items.filter(item => item.priority === 'optional')
    };
  };

  if (!isVisible) {
    return (
      <div className="checklist-panel-collapsed">
        <button className="checklist-toggle" onClick={onToggleVisibility}>
          <Settings size={16} />
          <span>Learning Progress</span>
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="checklist-panel">
        <div className="checklist-header">
          <div className="checklist-title">
            <Settings size={16} />
            <span>Learning Progress</span>
          </div>
          <button className="checklist-close" onClick={onToggleVisibility}>
            <EyeOff size={16} />
          </button>
        </div>
        <div className="checklist-loading">Loading checklist...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="checklist-panel">
        <div className="checklist-header">
          <div className="checklist-title">
            <Settings size={16} />
            <span>Learning Progress</span>
          </div>
          <button className="checklist-close" onClick={onToggleVisibility}>
            <EyeOff size={16} />
          </button>
        </div>
        <div className="checklist-error">
          <p>Error: {error}</p>
          <button onClick={refreshChecklist} className="retry-button">
            <RotateCcw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="checklist-panel">
        <div className="checklist-header">
          <div className="checklist-title">
            <Settings size={16} />
            <span>Learning Progress</span>
          </div>
          <button className="checklist-close" onClick={onToggleVisibility}>
            <EyeOff size={16} />
          </button>
        </div>
        
        {/* Show manual input form */}
        {showManualInput && (
          <div className="checklist-manual-input">
            <ManualChecklistInput
              onSubmit={handleManualSubmit}
              onCancel={closeModals}
            />
          </div>
        )}
        
        {/* Show generation options when no manual input */}
        {!showManualInput && (
          <div className="checklist-empty">
            <p>No checklist found for this room.</p>
            <div className="checklist-generation-options">
              <button 
                onClick={() => startSmartGeneration('General Scam Indicators')} 
                className="generate-checklist-button primary"
                disabled={loading}
              >
                <Zap size={16} />
                {loading ? 'Generating...' : 'Smart Generate'}
              </button>
              <button 
                onClick={openManualInput} 
                className="manual-checklist-button secondary"
                disabled={loading}
              >
                <Edit size={16} />
                Manual Input
              </button>
            </div>
          </div>
        )}
        
        {/* Generation modal */}
        {showGenerationModal && (
          <ChecklistGenerationModal
            mode={showGenerationModal.mode}
            message={showGenerationModal.message}
            onClose={closeModals}
            onSetupAI={handleSetupAI}
            onManualInput={openManualInput}
            onUseTemplate={() => generateChecklist('General Scam Indicators')}
            onEditAIPrompt={() => {
              closeModals();
              // TODO: Navigate to AI settings
              console.log('Navigating to AI settings...');
            }}
          />
        )}
      </div>
    );
  }

  const detectionGroups = groupItemsByPriority(checklist.detection_areas);
  const verificationGroups = groupItemsByPriority(checklist.verification_steps);

  return (
    <div className="checklist-panel">
      <div className="checklist-header">
        <div className="checklist-title">
          <Settings size={16} />
          <span>Learning Progress</span>
        </div>
        <button className="checklist-close" onClick={onToggleVisibility}>
          <EyeOff size={16} />
        </button>
      </div>

      <div className="checklist-content">
        <div className="checklist-summary">
          <div className="template-info">
            <strong>{checklist.template_name}</strong>
          </div>
          <div className="progress-display">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress?.completion_percentage || 0}%` }}
              />
            </div>
            <div className="progress-text">
              {progress?.completion_percentage?.toFixed(1) || 0}% Complete 
              ({progress?.covered_areas || 0}/{checklist ? checklist.detection_areas.length + checklist.verification_steps.length : 0} areas)
            </div>
          </div>
        </div>

        <div className="checklist-sections">
          {/* Detection Areas */}
          <div className="checklist-section">
            <div 
              className="section-header"
              onClick={() => toggleSection('detection')}
            >
              <span>🔍 Detection Areas ({checklist.detection_areas.length})</span>
              {collapsedSections.detection ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </div>
            
            {!collapsedSections.detection && (
              <div className="section-content">
                {/* Critical Areas */}
                {detectionGroups.critical.length > 0 && (
                  <div className="priority-group critical">
                    <h4>🔴 Critical Areas ({detectionGroups.critical.length})</h4>
                    {detectionGroups.critical.map(item => (
                      <ChecklistItemComponent
                        key={item.id}
                        item={item}
                        onStatusChange={handleStatusChange}
                        onPriorityChange={handlePriorityChange}
                        onAddNote={handleAddNote}
                        onViewEvidence={handleViewEvidence}
                      />
                    ))}
                  </div>
                )}

                {/* Important Areas */}
                {detectionGroups.important.length > 0 && (
                  <div className="priority-group important">
                    <h4>🟡 Important Areas ({detectionGroups.important.length})</h4>
                    {detectionGroups.important.map(item => (
                      <ChecklistItemComponent
                        key={item.id}
                        item={item}
                        onStatusChange={handleStatusChange}
                        onPriorityChange={handlePriorityChange}
                        onAddNote={handleAddNote}
                        onViewEvidence={handleViewEvidence}
                      />
                    ))}
                  </div>
                )}

                {/* Optional Areas */}
                {detectionGroups.optional.length > 0 && (
                  <div className="priority-group optional">
                    <h4>⚪ Optional Areas ({detectionGroups.optional.length})</h4>
                    {detectionGroups.optional.map(item => (
                      <ChecklistItemComponent
                        key={item.id}
                        item={item}
                        onStatusChange={handleStatusChange}
                        onPriorityChange={handlePriorityChange}
                        onAddNote={handleAddNote}
                        onViewEvidence={handleViewEvidence}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Verification Steps */}
          <div className="checklist-section">
            <div 
              className="section-header"
              onClick={() => toggleSection('verification')}
            >
              <span>✅ Verification Steps ({checklist.verification_steps.length})</span>
              {collapsedSections.verification ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </div>
            
            {!collapsedSections.verification && (
              <div className="section-content">
                {/* Similar structure for verification steps */}
                {verificationGroups.critical.length > 0 && (
                  <div className="priority-group critical">
                    <h4>🔴 Critical Steps ({verificationGroups.critical.length})</h4>
                    {verificationGroups.critical.map(item => (
                      <ChecklistItemComponent
                        key={item.id}
                        item={item}
                        onStatusChange={handleStatusChange}
                        onPriorityChange={handlePriorityChange}
                        onAddNote={handleAddNote}
                        onViewEvidence={handleViewEvidence}
                      />
                    ))}
                  </div>
                )}

                {verificationGroups.important.length > 0 && (
                  <div className="priority-group important">
                    <h4>🟡 Important Steps ({verificationGroups.important.length})</h4>
                    {verificationGroups.important.map(item => (
                      <ChecklistItemComponent
                        key={item.id}
                        item={item}
                        onStatusChange={handleStatusChange}
                        onPriorityChange={handlePriorityChange}
                        onAddNote={handleAddNote}
                        onViewEvidence={handleViewEvidence}
                      />
                    ))}
                  </div>
                )}

                {verificationGroups.optional.length > 0 && (
                  <div className="priority-group optional">
                    <h4>⚪ Optional Steps ({verificationGroups.optional.length})</h4>
                    {verificationGroups.optional.map(item => (
                      <ChecklistItemComponent
                        key={item.id}
                        item={item}
                        onStatusChange={handleStatusChange}
                        onPriorityChange={handlePriorityChange}
                        onAddNote={handleAddNote}
                        onViewEvidence={handleViewEvidence}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="checklist-actions">
          <button 
            className="action-button primary"
            onClick={() => setShowAddCustomArea(true)}
          >
            <Plus size={16} />
            Add Custom Area
          </button>
          <button 
            className="action-button secondary"
            onClick={handleExportReport}
          >
            <Download size={16} />
            Export Report
          </button>
          <button 
            className="action-button secondary"
            onClick={refreshChecklist}
            disabled={loading}
          >
            <RotateCcw size={16} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Add Custom Area Modal */}
      <AddCustomAreaModal
        isOpen={showAddCustomArea}
        onClose={() => setShowAddCustomArea(false)}
        onAdd={handleAddCustomArea}
      />
      
      {/* TODO: Add evidence viewing modal */}
    </div>
  );
};

export default ChecklistPanel;