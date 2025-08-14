import React from 'react';
import { X, Brain, User, MessageSquare, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { ChecklistItem, CoverageEvidence } from '../types/checklist';
import './EvidenceModal.css';

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ChecklistItem | null;
}

const EvidenceModal: React.FC<EvidenceModalProps> = ({
  isOpen,
  onClose,
  item
}) => {
  if (!isOpen || !item) return null;

  const getDetectionMethodIcon = (method: CoverageEvidence['detection_method']) => {
    switch (method) {
      case 'ai_analysis':
        return <Brain size={16} className="evidence-method-icon ai" />;
      case 'tutor_manual':
        return <User size={16} className="evidence-method-icon tutor" />;
      case 'student_self_assessment':
        return <MessageSquare size={16} className="evidence-method-icon student" />;
      default:
        return <AlertCircle size={16} className="evidence-method-icon unknown" />;
    }
  };

  const getDetectionMethodLabel = (method: CoverageEvidence['detection_method']) => {
    switch (method) {
      case 'ai_analysis':
        return 'AI Analysis';
      case 'tutor_manual':
        return 'Tutor Assessment';
      case 'student_self_assessment':
        return 'Student Self-Assessment';
      default:
        return 'Unknown Method';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'confidence-high';
    if (confidence >= 60) return 'confidence-medium';
    return 'confidence-low';
  };

  const getStatusBadge = (status: ChecklistItem['status']) => {
    const badges = {
      'covered': { text: 'Mastered', class: 'status-covered', icon: '✅' },
      'partially_covered': { text: 'In Progress', class: 'status-partial', icon: '🟡' },
      'pending': { text: 'Not Started', class: 'status-pending', icon: '⭕' },
      'needs_review': { text: 'Needs Review', class: 'status-review', icon: '⚠️' }
    };
    return badges[status];
  };

  const getUnderstandingLevel = (level: ChecklistItem['understanding_level']) => {
    const levels = {
      'excellent': { text: 'Excellent', class: 'understanding-excellent', description: 'Deep mastery, can teach others' },
      'good': { text: 'Good', class: 'understanding-good', description: 'Solid understanding with clear reasoning' },
      'basic': { text: 'Basic', class: 'understanding-basic', description: 'Recognizes concept but shallow explanation' },
      'none': { text: 'None', class: 'understanding-none', description: 'No evidence of understanding' }
    };
    return levels[level || 'none'];
  };

  const sortedEvidence = [...item.coverage_evidence].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const statusBadge = getStatusBadge(item.status);
  const understandingLevel = getUnderstandingLevel(item.understanding_level);

  return (
    <div className="evidence-modal-overlay" onClick={onClose}>
      <div className="evidence-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="evidence-modal-header">
          <div className="evidence-modal-title">
            <h3>Learning Evidence</h3>
            <div className="evidence-item-info">
              <span className="evidence-item-type">
                {item.item_type === 'detection_area' ? '🔍 Detection Area' : '✅ Verification Step'}
              </span>
              <span className={`evidence-priority priority-${item.priority || 'optional'}`}>
                {(item.priority || 'optional').toUpperCase()}
              </span>
            </div>
          </div>
          <button className="evidence-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="evidence-modal-body">
          {/* Area Description */}
          <div className="evidence-section">
            <h4>Learning Objective</h4>
            <div className="evidence-area-text">
              {item.area_text}
            </div>
          </div>

          {/* Current Status */}
          <div className="evidence-section">
            <h4>Current Status</h4>
            <div className="evidence-status-grid">
              <div className="status-item">
                <div className="status-label">Progress</div>
                <div className={`status-badge ${statusBadge.class}`}>
                  <span className="status-icon">{statusBadge.icon}</span>
                  {statusBadge.text}
                </div>
              </div>
              <div className="status-item">
                <div className="status-label">Understanding Level</div>
                <div className={`understanding-badge ${understandingLevel.class}`}>
                  {understandingLevel.text}
                </div>
                <div className="understanding-description">
                  {understandingLevel.description}
                </div>
              </div>
              <div className="status-item">
                <div className="status-label">Learning Attempts</div>
                <div className="attempts-count">
                  <TrendingUp size={16} />
                  {item.attempts_count} attempts
                </div>
              </div>
              {item.last_addressed && (
                <div className="status-item">
                  <div className="status-label">Last Addressed</div>
                  <div className="last-addressed">
                    <Clock size={16} />
                    {new Date(item.last_addressed).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tutor Notes */}
          {item.tutor_notes && (
            <div className="evidence-section">
              <h4>Tutor Notes</h4>
              <div className="tutor-notes">
                <User size={16} className="notes-icon" />
                <div className="notes-content">{item.tutor_notes}</div>
              </div>
            </div>
          )}

          {/* Evidence History */}
          <div className="evidence-section">
            <h4>Evidence History ({sortedEvidence.length} records)</h4>
            
            {sortedEvidence.length === 0 ? (
              <div className="no-evidence">
                <AlertCircle size={20} />
                <div>
                  <p><strong>No evidence recorded yet</strong></p>
                  <p>Evidence will appear here when the student demonstrates understanding of this concept through their responses or actions.</p>
                </div>
              </div>
            ) : (
              <div className="evidence-timeline">
                {sortedEvidence.map((evidence, index) => (
                  <div key={evidence.id} className="evidence-entry">
                    <div className="evidence-entry-header">
                      <div className="evidence-method">
                        {getDetectionMethodIcon(evidence.detection_method)}
                        <span className="method-label">
                          {getDetectionMethodLabel(evidence.detection_method)}
                        </span>
                      </div>
                      <div className="evidence-timestamp">
                        <Clock size={14} />
                        {new Date(evidence.timestamp).toLocaleString()}
                      </div>
                      <div className={`evidence-confidence ${getConfidenceColor(evidence.confidence_score)}`}>
                        {evidence.confidence_score}% confidence
                      </div>
                    </div>

                    <div className="evidence-entry-body">
                      <div className="evidence-quote">
                        <div className="quote-label">Student Evidence:</div>
                        <div className="quote-text">"{evidence.evidence_text}"</div>
                      </div>
                      
                      <div className="evidence-analysis">
                        <div className="analysis-label">Analysis:</div>
                        <div className="analysis-text">{evidence.analysis}</div>
                      </div>

                      {evidence.message_id && (
                        <div className="evidence-source">
                          <MessageSquare size={12} />
                          <span>From conversation message</span>
                        </div>
                      )}
                    </div>

                    {index < sortedEvidence.length - 1 && <div className="evidence-separator" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Learning Insights */}
          {sortedEvidence.length > 0 && (
            <div className="evidence-section">
              <h4>Learning Insights</h4>
              <div className="learning-insights">
                <div className="insight-item">
                  <div className="insight-label">Average Confidence:</div>
                  <div className="insight-value">
                    {Math.round(
                      sortedEvidence.reduce((sum, e) => sum + e.confidence_score, 0) / sortedEvidence.length
                    )}%
                  </div>
                </div>
                <div className="insight-item">
                  <div className="insight-label">Primary Detection Method:</div>
                  <div className="insight-value">
                    {(() => {
                      // Count detection methods
                      const methodCounts = sortedEvidence.reduce((acc, evidence) => {
                        const method = evidence.detection_method;
                        acc[method] = (acc[method] || 0) + 1;
                        return acc;
                      }, {} as Record<CoverageEvidence['detection_method'], number>);
                      
                      // Find most common method
                      const mostCommonMethod = Object.keys(methodCounts).reduce((a, b) => 
                        methodCounts[a as CoverageEvidence['detection_method']] >= methodCounts[b as CoverageEvidence['detection_method']] ? a : b
                      ) as CoverageEvidence['detection_method'];
                      
                      return getDetectionMethodLabel(mostCommonMethod);
                    })()}
                  </div>
                </div>
                <div className="insight-item">
                  <div className="insight-label">Learning Progression:</div>
                  <div className="insight-value">
                    {sortedEvidence.length > 1 
                      ? sortedEvidence[0].confidence_score > sortedEvidence[sortedEvidence.length - 1].confidence_score
                        ? '📈 Improving'
                        : '📊 Consistent'
                      : '🆕 Just started'
                    }
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="evidence-modal-footer">
          <div className="footer-info">
            <AlertCircle size={14} />
            <span>Evidence is automatically collected as students demonstrate understanding during conversations.</span>
          </div>
          <button className="button-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EvidenceModal;