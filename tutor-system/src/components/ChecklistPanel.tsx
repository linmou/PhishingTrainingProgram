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
  progressLocked?: boolean;
}

interface ChecklistItemComponentProps {
  item: ChecklistItem;
  onStatusChange: (itemId: string, newStatus: ChecklistItem['status']) => void;
  onPriorityChange: (itemId: string, newPriority: ChecklistItem['priority']) => void;
  onAddNote: (itemId: string, note: string) => void;
  onViewEvidence: (itemId: string) => void;
  onEditItem: (itemId: string, newText: string) => void;
  progressLocked?: boolean;
  transferPolicy?: boolean;
}

const serializeChecklistItem = (item: ChecklistItem) => ({
  id: item.id,
  area_text: item.area_text,
  item_type: item.item_type,
  priority: item.priority ?? 'optional',
  status: item.status,
  understanding_level: item.understanding_level ?? 'none',
  tutor_notes: item.tutor_notes,
  attempts_count: item.attempts_count,
  last_addressed: item.last_addressed ? new Date(item.last_addressed).toISOString() : null,
  coverage_evidence: item.coverage_evidence.map(evidence => ({
    id: evidence.id,
    evidence_text: evidence.evidence_text,
    analysis: evidence.analysis,
    confidence_score: evidence.confidence_score,
    detection_method: evidence.detection_method,
    timestamp: new Date(evidence.timestamp).toISOString(),
    message_id: evidence.message_id ?? null
  }))
});

const ChecklistItemComponent: React.FC<ChecklistItemComponentProps> = ({
  item,
  onStatusChange,
  onPriorityChange,
  onAddNote,
  onViewEvidence,
  onEditItem,
  progressLocked = false,
  transferPolicy = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(item.tutor_notes);
  const [editingText, setEditingText] = useState(false);
  const [itemText, setItemText] = useState(item.area_text);

  // Update local state when item changes
  React.useEffect(() => {
    setItemText(item.area_text);
    setNoteText(item.tutor_notes);
  }, [item.area_text, item.tutor_notes]);

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

  const handleSaveItemText = () => {
    if (itemText.trim() && itemText !== item.area_text) {
      onEditItem(item.id, itemText.trim());
    }
    setEditingText(false);
  };

  const handleCancelEditText = () => {
    setItemText(item.area_text);
    setEditingText(false);
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
              {transferPolicy ? (
                <span className="status-policy-value">
                  {item.status === 'pending' && 'Not yet demonstrated'}
                  {item.status === 'partially_covered' && 'Ready for transfer check'}
                  {item.status === 'needs_review' && 'Needs review'}
                  {item.status === 'covered' && 'Transfer verified'}
                </span>
              ) : (
                <select
                  value={item.status}
                  onChange={(e) => onStatusChange(item.id, e.target.value as ChecklistItem['status'])}
                  className="status-select"
                  disabled={progressLocked}
                >
                  <option value="pending">Pending</option>
                  <option value="partially_covered">Partially Covered</option>
                  <option value="covered">Covered</option>
                  <option value="needs_review">Needs Review</option>
                </select>
              )}
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

          <div className="checklist-item-text-edit">
            <div className="text-edit-header">
              <label>Item Text:</label>
              {!editingText && !transferPolicy && (
                <button
                  className="edit-text-button"
                  onClick={() => setEditingText(true)}
                >
                  <Edit size={14} />
                  Edit
                </button>
              )}
            </div>
            {editingText ? (
              <div className="text-editor">
                <input
                  type="text"
                  value={itemText}
                  onChange={(e) => setItemText(e.target.value)}
                  className="text-edit-input"
                  placeholder="Enter checklist item text..."
                />
                <div className="text-actions">
                  <button onClick={handleSaveItemText} className="save-text">Save</button>
                  <button onClick={handleCancelEditText} className="cancel-text">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="text-display">
                {item.area_text}
              </div>
            )}
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
  onToggleVisibility,
  progressLocked = false
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
  const transferPolicy = checklist?.progress_policy_version === 'transfer_v1';
  const progressControlsLocked = progressLocked || transferPolicy;

  const handleStatusChange = async (itemId: string, newStatus: ChecklistItem['status']) => {
    if (progressControlsLocked) return;
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

  const handleExportReport = useCallback(() => {
    if (!checklist) {
      return;
    }

    const allItems = [...checklist.detection_areas, ...checklist.verification_steps];
    const safeTemplateName = checklist.template_name
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '');
    const exportDate = new Date().toISOString().split('T')[0];

    const exportData = {
      room_id: roomId,
      template_name: checklist.template_name,
      exported_at: new Date().toISOString(),
      summary: {
        completion_percentage: progress?.completion_percentage ?? checklist.completion_percentage,
        total_items: allItems.length,
        covered_items: progress?.covered_areas ?? checklist.completed_items,
        partially_covered_items: progress?.partially_covered_areas ?? allItems.filter(item => item.status === 'partially_covered').length,
        pending_items: progress?.pending_areas ?? allItems.filter(item => item.status === 'pending').length
      },
      detection_areas: checklist.detection_areas.map(serializeChecklistItem),
      verification_steps: checklist.verification_steps.map(serializeChecklistItem)
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');

    downloadLink.href = downloadUrl;
    downloadLink.download = `${safeTemplateName || 'learning_progress'}_learning_progress_${exportDate}.json`;

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadUrl);
  }, [checklist, progress, roomId]);

  const handleAddCustomArea = async (
    areaText: string, 
    priority: ChecklistItem['priority']
  ) => {
    try {
      // Default to 'detection_area' since we removed the type selector
      const itemType = 'detection_area';
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

  const handleEditItem = async (itemId: string, newText: string) => {
    try {
      console.log('Editing checklist item:', { itemId, newText });
      await updateItem(itemId, { area_text: newText });
    } catch (err) {
      console.error('Failed to edit item text:', err);
    }
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
                disabled={loading || progressControlsLocked}
              >
                <Zap size={16} />
                {loading ? 'Generating...' : 'Smart Generate'}
              </button>
              <button 
                onClick={openManualInput} 
                className="manual-checklist-button secondary"
                disabled={loading || progressControlsLocked}
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

  // Combine all checklist items
  const allItems = [...checklist.detection_areas, ...checklist.verification_steps];
  const itemGroups = groupItemsByPriority(allItems);

  return (
    <div className="checklist-panel">
      <div className="checklist-header">
        {progressLocked && (
          <div role="status" className="checklist-guard-notice">
            Learning progression is locked while Guard Mode is active. Corrective messages remain enabled.
          </div>
        )}
        {transferPolicy && (
          <div role="status" className="checklist-transfer-notice">
            Transfer policy is active. Progress is derived from recorded learner evidence or an explicit teacher confirmation.
          </div>
        )}
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
              ({progress?.covered_areas || 0}/{allItems.length} items)
            </div>
          </div>
        </div>

        <div className="checklist-sections">
          {/* All Items in One List */}
          <div className="checklist-section">
            <div className="section-content">
              {/* Critical Items */}
              {itemGroups.critical.length > 0 && (
                <div className="priority-group critical">
                  <h4>🔴 Critical Items ({itemGroups.critical.length})</h4>
                  {itemGroups.critical.map(item => (
                    <ChecklistItemComponent
                      key={item.id}
                      item={item}
                      onStatusChange={handleStatusChange}
                      onPriorityChange={handlePriorityChange}
                      onAddNote={handleAddNote}
                      onViewEvidence={handleViewEvidence}
                      onEditItem={handleEditItem}
                      progressLocked={progressControlsLocked}
                      transferPolicy={transferPolicy}
                    />
                  ))}
                </div>
              )}

              {/* Important Items */}
              {itemGroups.important.length > 0 && (
                <div className="priority-group important">
                  <h4>🟡 Important Items ({itemGroups.important.length})</h4>
                  {itemGroups.important.map(item => (
                    <ChecklistItemComponent
                      key={item.id}
                      item={item}
                      onStatusChange={handleStatusChange}
                      onPriorityChange={handlePriorityChange}
                      onAddNote={handleAddNote}
                      onViewEvidence={handleViewEvidence}
                      onEditItem={handleEditItem}
                      progressLocked={progressControlsLocked}
                      transferPolicy={transferPolicy}
                    />
                  ))}
                </div>
              )}

              {/* Optional Items */}
              {itemGroups.optional.length > 0 && (
                <div className="priority-group optional">
                  <h4>⚪ Optional Items ({itemGroups.optional.length})</h4>
                  {itemGroups.optional.map(item => (
                    <ChecklistItemComponent
                      key={item.id}
                      item={item}
                      onStatusChange={handleStatusChange}
                      onPriorityChange={handlePriorityChange}
                      onAddNote={handleAddNote}
                      onViewEvidence={handleViewEvidence}
                      onEditItem={handleEditItem}
                      progressLocked={progressControlsLocked}
                      transferPolicy={transferPolicy}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="checklist-actions">
          <button 
            className="action-button primary"
            onClick={() => setShowAddCustomArea(true)}
            disabled={progressControlsLocked}
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
