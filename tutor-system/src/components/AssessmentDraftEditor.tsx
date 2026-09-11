// Purpose: let an authorized tutor review and confirm a structured transfer-assessment draft before delivery.

import React, { useEffect, useMemo, useState } from 'react';
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
  const [selectionType, setSelectionType] = useState(initialAssessment?.selection_type || 'single');
  const [options, setOptions] = useState(initialAssessment?.options || []);
  const [correctOptionIds, setCorrectOptionIds] = useState<AssessmentOptionId[]>(
    initialAssessment?.correct_option_ids || []
  );
  const [contentConfirmed, setContentConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const assessment = decision.assessment;
    setStem(assessment?.stem || decision.response);
    setSelectionType(assessment?.selection_type || 'single');
    setOptions(assessment?.options || []);
    setCorrectOptionIds(assessment?.correct_option_ids || []);
    setContentConfirmed(false);
    setError(null);
  }, [decision]);

  const renderedText = useMemo(() => renderAssessment({
    stem,
    selection_type: selectionType,
    options,
  }), [options, selectionType, stem]);

  if (!initialAssessment) return null;

  const setOptionText = (id: AssessmentOptionId, text: string) => {
    setOptions((current) => current.map((option) => option.id === id ? { ...option, text } : option));
    setContentConfirmed(false);
  };

  const setSelection = (id: AssessmentOptionId, checked: boolean) => {
    setCorrectOptionIds((current) => {
      if (selectionType === 'single') return checked ? [id] : [];
      return checked ? uniqueSelections([...current, id]) : current.filter((value) => value !== id);
    });
    setContentConfirmed(false);
  };

  const handleSelectionTypeChange = (value: 'single' | 'multiple') => {
    setSelectionType(value);
    setCorrectOptionIds((current) => value === 'single' ? current.slice(0, 1) : uniqueSelections(current));
    setContentConfirmed(false);
  };

  const handleSubmit = async () => {
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
    if (!contentConfirmed) {
      setError('Confirm that the concept, changed context, and answer key are appropriate.');
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
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Assessment could not be confirmed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="Transfer assessment review">
      <h3>Review transfer assessment</h3>
      {itemLabel && <p>Target: {itemLabel}</p>}
      <label>
        Question
        <textarea value={stem} onChange={(event) => { setStem(event.target.value); setContentConfirmed(false); }} rows={3} />
      </label>
      <label>
        Answer type
        <select value={selectionType} onChange={(event) => handleSelectionTypeChange(event.target.value as 'single' | 'multiple')}>
          <option value="single">Choose one</option>
          <option value="multiple">Select all that apply</option>
        </select>
      </label>
      <fieldset>
        <legend>Options and correct answer</legend>
        {options.map((option) => (
          <label key={option.id}>
            <input
              type={selectionType === 'single' ? 'radio' : 'checkbox'}
              name="assessment-correct-option"
              checked={correctOptionIds.includes(option.id)}
              onChange={(event) => setSelection(option.id, event.target.checked)}
            />
            <span>{option.id}.</span>
            <input value={option.text} onChange={(event) => setOptionText(option.id, event.target.value)} />
          </label>
        ))}
      </fieldset>
      <p aria-live="polite">Learner-visible preview:</p>
      <pre>{renderedText}</pre>
      <label>
        <input type="checkbox" checked={contentConfirmed} onChange={(event) => setContentConfirmed(event.target.checked)} />
        I confirm the concept, changed context, and answer key are appropriate.
      </label>
      {error && <p role="alert">{error}</p>}
      <div>
        <button type="button" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving…' : 'Confirm assessment'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>}
      </div>
    </section>
  );
};

export default AssessmentDraftEditor;
