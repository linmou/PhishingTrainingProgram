// Purpose: let an authorized tutor review and confirm a structured transfer-assessment draft before delivery.

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Send, X } from 'lucide-react';
import { AssessmentOptionId, TutorDecisionV3 } from '../types/assessment';
import { renderAssessment, validateAssessmentRendering } from '../services/assessmentRendering';
import { parseTutorDecisionV3 } from '../services/tutorDecisionContract';
import { classifyAssessmentFailure, type ReviewStatus } from '../contexts/transferAssessmentUiAdapter';

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
  const [selectionType, setSelectionType] = useState(initialAssessment?.selection_type || 'single');
  const [options, setOptions] = useState(initialAssessment?.options || []);
  const [correctOptionIds, setCorrectOptionIds] = useState<AssessmentOptionId[]>(
    initialAssessment?.correct_option_ids || []
  );
  const [explanation, setExplanation] = useState(initialAssessment?.learner_safe_explanation || '');
  const [contentConfirmed, setContentConfirmed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<'validating' | ReviewStatus | null>(null);

  useEffect(() => {
    const assessment = decision.assessment;
    setStem(assessment?.stem || decision.response);
    setSelectionType(assessment?.selection_type || 'single');
    setOptions(assessment?.options || []);
    setCorrectOptionIds(assessment?.correct_option_ids || []);
    setExplanation(assessment?.learner_safe_explanation || '');
    setContentConfirmed(false);
    setDirty(false);
    setError(null);
    setErrorKind(null);
  }, [decision]);

  const renderedText = useMemo(() => renderAssessment({
    stem,
    selection_type: selectionType,
    options,
  }), [options, selectionType, stem]);

  if (!initialAssessment) return null;

  const reviewStatus = saving ? 'saving' : errorKind || (contentConfirmed ? 'confirmed' : dirty ? 'dirty' : 'ready');

  const clearServerFailure = () => {
    if (errorKind && errorKind !== 'validating') {
      setError(null);
      setErrorKind(null);
    }
  };

  const setOptionText = (id: AssessmentOptionId, text: string) => {
    setOptions((current) => current.map((option) => option.id === id ? { ...option, text } : option));
    setContentConfirmed(false);
    setDirty(true);
    clearServerFailure();
  };

  const setSelection = (id: AssessmentOptionId, checked: boolean) => {
    setCorrectOptionIds((current) => {
      if (selectionType === 'single') return checked ? [id] : [];
      return checked ? uniqueSelections([...current, id]) : current.filter((value) => value !== id);
    });
    setContentConfirmed(false);
    setDirty(true);
    clearServerFailure();
  };

  const handleSelectionTypeChange = (value: 'single' | 'multiple') => {
    setSelectionType(value);
    setCorrectOptionIds((current) => value === 'single' ? current.slice(0, 1) : uniqueSelections(current));
    setContentConfirmed(false);
    setDirty(true);
    clearServerFailure();
  };

  const handleSubmit = async () => {
    setError(null);
    setErrorKind(null);
    const validation = validateAssessmentRendering({ stem, selection_type: selectionType, options });
    const expectedKeys = selectionType === 'single'
      ? correctOptionIds.length === 1
      : correctOptionIds.length >= 2 && correctOptionIds.length <= 3;
    if (!validation.valid) {
      setError(validation.errors.join('. '));
      setErrorKind('validating');
      return;
    }
    if (!expectedKeys) {
      setError(selectionType === 'single'
        ? 'Choose exactly one correct option.'
        : 'Choose two or three correct options.');
      setErrorKind('validating');
      return;
    }
    if (!explanation.trim()) {
      setError('Enter a learner-safe explanation.');
      setErrorKind('validating');
      return;
    }
    if (!contentConfirmed) {
      setError('Confirm that the concept, changed context, and answer key are appropriate.');
      setErrorKind('validating');
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
        learner_safe_explanation: explanation.trim(),
      },
    };

    try {
      // Reuse the production validator so the editor cannot create a payload
      // that the trusted review operation would reject.
      parseTutorDecisionV3(JSON.stringify(nextDecision), {
        knownItemIds: knownItemIds || [decision.decision.target_item_id || ''],
        knownMessageIds: knownMessageIds || initialAssessment.transfer_basis?.source_evidence_message_ids || [],
      });
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Assessment could not be validated.');
      setErrorKind('validating');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(nextDecision);
    } catch (submitError) {
      const classified = classifyAssessmentFailure(submitError);
      setError(classified.message);
      setErrorKind(classified.status);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="assessment-draft-editor" aria-label="Transfer assessment review">
      <header className="assessment-draft-editor__header">
        <div>
          <h3>Review transfer assessment</h3>
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
            onChange={(event) => { setStem(event.target.value); setContentConfirmed(false); setDirty(true); clearServerFailure(); }}
            rows={3}
            disabled={saving}
          />
        </label>

        <label className="assessment-draft-editor__field">
          <span>Answer type</span>
          <select
            aria-label="Answer type"
            className="assessment-draft-editor__select"
            value={selectionType}
            onChange={(event) => handleSelectionTypeChange(event.target.value as 'single' | 'multiple')}
            disabled={saving}
          >
            <option value="single">Choose one</option>
            <option value="multiple">Select all that apply</option>
          </select>
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
                <input
                  type="text"
                  aria-label={`Option ${option.id}`}
                  value={option.text}
                  onChange={(event) => setOptionText(option.id, event.target.value)}
                  disabled={saving}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="assessment-draft-editor__answer-key" data-testid="assessment-answer-key" aria-live="polite">
          <span className="assessment-draft-editor__answer-key-mark" aria-hidden="true">
            <Check size={16} strokeWidth={3} />
          </span>
          <div>
            <span className="assessment-draft-editor__answer-key-label">
              Correct answer{selectionType === 'multiple' ? 's' : ''}
            </span>
            <p>
              {options
                .filter((option) => correctOptionIds.includes(option.id))
                .map((option) => `${option.id} — ${option.text.trim()}`)
                .join(' | ') || 'No correct answer selected.'}
            </p>
          </div>
        </div>

        <label className="assessment-draft-editor__field">
          <span>Learner-safe explanation</span>
          <textarea
            aria-label="Learner-safe explanation"
            value={explanation}
            onChange={(event) => { setExplanation(event.target.value); setContentConfirmed(false); setDirty(true); clearServerFailure(); }}
            rows={3}
            disabled={saving}
          />
        </label>

        <div className="assessment-draft-editor__preview">
          <p className="assessment-draft-editor__preview-label" aria-live="polite">Learner-visible preview</p>
          <pre className="assessment-draft-editor__preview-content">{renderedText}</pre>
        </div>

        <label className="assessment-draft-editor__confirmation">
          <input
            type="checkbox"
            checked={contentConfirmed}
            onChange={(event) => { setContentConfirmed(event.target.checked); clearServerFailure(); }}
            disabled={saving}
          />
          <span>I confirm the concept, changed context, and answer key are appropriate.</span>
        </label>
      </div>

      <footer className="assessment-draft-editor__footer">
        <div>
          {/* Local review state only: there is no draft row, so this never reports a server status. */}
          <p role="status" data-testid="assessment-review-status" data-review-status={reviewStatus}>
            {reviewStatus === 'saving'
              ? 'Sending the confirmed assessment…'
              : reviewStatus === 'validating'
                ? 'Review the highlighted validation error.'
              : reviewStatus === 'superseded'
                ? 'This candidate is no longer current.'
              : reviewStatus === 'unavailable'
                ? 'Transfer assessments are unavailable.'
              : reviewStatus === 'unauthorized'
                ? 'This account cannot send this assessment.'
              : reviewStatus === 'retryable'
                ? 'The request can be retried.'
              : reviewStatus === 'validation'
                ? 'The candidate needs correction before it can be sent.'
              : reviewStatus === 'confirmed'
                ? 'Confirmed and ready to send.'
              : reviewStatus === 'dirty'
                ? 'Unsaved edits — the previous confirmation was cleared.'
                : 'Ready to send once you confirm.'}
          </p>
          {error && <p className="assessment-draft-editor__error" role="alert">{error}</p>}
        </div>
        <div className="assessment-draft-editor__actions">
          {onCancel && (
            <button className="assessment-draft-editor__discard" type="button" onClick={onCancel} disabled={saving}>
              <X size={16} aria-hidden="true" />
              Discard candidate
            </button>
          )}
          <button className="assessment-draft-editor__send" type="button" onClick={handleSubmit} disabled={saving}>
            <Send size={16} aria-hidden="true" />
            {saving ? 'Saving…' : 'Confirm assessment'}
          </button>
        </div>
      </footer>
    </section>
  );
};

export default AssessmentDraftEditor;
