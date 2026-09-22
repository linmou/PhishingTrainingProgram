// Purpose: let an authorized tutor review and confirm a structured transfer-assessment draft before delivery.

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Send, X } from 'lucide-react';
import { AssessmentOptionId, TutorDecisionV3 } from '../types/assessment';
import { renderAssessment, validateAssessmentRendering } from '../services/assessmentRendering';
import { parseTutorDecisionV3 } from '../services/tutorDecisionContract';

export interface AssessmentDraftEditorProps {
  decision: TutorDecisionV3;
  itemLabel?: string;
  knownItemIds?: ReadonlyArray<string>;
  knownMessageIds?: ReadonlyArray<string>;
  onSubmit: (decision: TutorDecisionV3) => Promise<void> | void;
  onCancel?: () => void;
}

const optionIds: AssessmentOptionId[] = ['A', 'B', 'C', 'D'];

const uniqueSelections = (ids: AssessmentOptionId[]): AssessmentOptionId[] =>
  optionIds.filter((id) => ids.includes(id));

const AssessmentDraftEditor: React.FC<AssessmentDraftEditorProps> = ({
  decision,
  itemLabel,
  knownItemIds,
  knownMessageIds,
  onSubmit,
  onCancel,
}) => {
  const initialAssessment = decision.assessment;
  const [stem, setStem] = useState(initialAssessment?.stem || decision.response);
  // The model decides whether this is single or multiple selection. Tutors only edit its key.
  const [selectionType, setSelectionType] = useState(initialAssessment?.selection_type || 'single');
  const [options, setOptions] = useState(initialAssessment?.options || []);
  const [correctOptionIds, setCorrectOptionIds] = useState<AssessmentOptionId[]>(
    initialAssessment?.correct_option_ids || []
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const assessment = decision.assessment;
    setStem(assessment?.stem || decision.response);
    setSelectionType(assessment?.selection_type || 'single');
    setOptions(assessment?.options || []);
    setCorrectOptionIds(assessment?.correct_option_ids || []);
    setDirty(false);
    setError(null);
  }, [decision]);

  const renderedText = useMemo(() => renderAssessment({
    stem,
    selection_type: selectionType,
    options,
  }), [options, selectionType, stem]);

  if (!initialAssessment) return null;

  const reviewStatus = saving ? 'saving' : dirty ? 'dirty' : 'ready';

  const setOptionText = (id: AssessmentOptionId, text: string) => {
    setOptions((current) => current.map((option) => option.id === id ? { ...option, text } : option));
    setDirty(true);
  };

  const setSelection = (id: AssessmentOptionId, checked: boolean) => {
    setCorrectOptionIds((current) => {
      if (selectionType === 'single') return checked ? [id] : [];
      return checked ? uniqueSelections([...current, id]) : current.filter((value) => value !== id);
    });
    setDirty(true);
  };

  const handleSubmit = async () => {
    if (saving) return;
    setError(null);
    const validation = validateAssessmentRendering({ stem, selection_type: selectionType, options });
    const expectedKeys = selectionType === 'single'
      ? correctOptionIds.length === 1
      : correctOptionIds.length >= 2 && correctOptionIds.length <= 3;
    if (!validation.valid) {
      setError(validation.errors.join('. '));
      return;
    }
    if (!expectedKeys) {
      setError(selectionType === 'single'
        ? 'Choose exactly one correct option.'
        : 'Choose two or three correct options.');
      return;
    }
    const nextDecision: TutorDecisionV3 = {
      ...decision,
      response: stem.trim(),
      decision: {
        ...decision.decision,
        mode: 'assessment',
        instruction: 'transfer_assess',
      },
      assessment: {
        ...initialAssessment,
        stem: stem.trim(),
        rendered_text: renderedText,
        selection_type: selectionType,
        options: options.map((option) => ({ id: option.id, text: option.text.trim() })),
        correct_option_ids: uniqueSelections(correctOptionIds),
      },
    };

    try {
      // Reuse the production validator so the editor cannot create a payload
      // that the trusted review operation would reject.
      parseTutorDecisionV3(JSON.stringify(nextDecision), {
        knownItemIds: knownItemIds || [decision.decision.target_item_id || ''],
        knownMessageIds: knownMessageIds || initialAssessment.transfer_basis?.source_evidence_message_ids || [],
      });
      setSaving(true);
      await onSubmit(nextDecision);
      setDirty(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Assessment could not be confirmed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="assessment-draft-editor" aria-labelledby="assessment-draft-editor-title">
      <header className="assessment-draft-editor__header">
        <div>
          <h3 id="assessment-draft-editor-title">Review transfer assessment</h3>
          {itemLabel && <p className="assessment-draft-editor__target">Target: {itemLabel}</p>}
        </div>
        <span className="assessment-draft-editor__badge">Draft</span>
      </header>

      <div className="assessment-draft-editor__body">
        <label className="assessment-draft-editor__field">
          <span>Question</span>
          <textarea
            aria-label="Question"
            value={stem}
            onChange={(event) => { setStem(event.target.value); setDirty(true); }}
            rows={3}
            disabled={saving}
          />
        </label>

        <fieldset className="assessment-draft-editor__choices">
          <legend>Answer choices</legend>
          <div className="assessment-draft-editor__options">
            {options.map((option) => (
              <label
                className={`assessment-draft-editor__option${correctOptionIds.includes(option.id) ? ' assessment-draft-editor__option--selected' : ''}`}
                key={option.id}
              >
                <input
                  aria-label={`Correct answer ${option.id}`}
                  type={selectionType === 'single' ? 'radio' : 'checkbox'}
                  name="assessment-correct-option"
                  checked={correctOptionIds.includes(option.id)}
                  onChange={(event) => setSelection(option.id, event.target.checked)}
                  disabled={saving}
                />
                <span className="assessment-draft-editor__letter" aria-hidden="true">{option.id}</span>
                <textarea
                  aria-label={`Option ${option.id}`}
                  value={option.text}
                  onChange={(event) => setOptionText(option.id, event.target.value)}
                  rows={2}
                  disabled={saving}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="assessment-draft-editor__answer-key" data-testid="assessment-answer-key" aria-live="polite">
          <span className="assessment-draft-editor__answer-key-mark" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>
          <div>
            <span className="assessment-draft-editor__answer-key-label">Correct answer{selectionType === 'multiple' ? 's' : ''}</span>
            <p>
              {options
                .filter((option) => correctOptionIds.includes(option.id))
                .map((option) => `${option.id} \u2014 ${option.text.trim()}`)
                .join(' | ') || 'No correct answer selected.'}
            </p>
          </div>
        </div>
      </div>

      <footer className="assessment-draft-editor__footer">
        <div>
          <p role="status" data-testid="assessment-review-status" data-review-status={reviewStatus}>
            {reviewStatus === 'saving' ? 'Sending assessment...' : reviewStatus === 'dirty' ? 'Unsaved edits' : 'Ready to send'}
          </p>
          {error && <p className="assessment-draft-editor__error" role="alert">{error}</p>}
        </div>
        <div className="assessment-draft-editor__actions">
          {onCancel && (
            <button className="assessment-draft-editor__discard" type="button" onClick={onCancel} disabled={saving}>
              <X size={16} aria-hidden="true" />
              Discard
            </button>
          )}
          <button className="assessment-draft-editor__send" type="button" onClick={handleSubmit} disabled={saving}>
            <Send size={16} aria-hidden="true" />
            {saving ? 'Sending...' : 'Send assessment'}
          </button>
        </div>
      </footer>
    </section>
  );
};

export default AssessmentDraftEditor;
