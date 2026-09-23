// Purpose: render the public assessment a learner is allowed to see, and nothing else.

import React from 'react';
import { useState } from 'react';
import type { AssessmentOptionId } from '../types/assessment';
import type { AnswerLifecycleView, PublicQuestionView } from '../contexts/transferAssessmentUiAdapter';

export interface PublicAssessmentQuestionProps {
  question: PublicQuestionView;
  answerLifecycle?: AnswerLifecycleView | null;
  canAnswer?: boolean;
  onSubmit?: (selectedOptionIds: AssessmentOptionId[]) => Promise<void> | void;
}

/**
 * The learner-visible question: stem, instruction, and ordered options A-D.
 *
 * The promoted one-table design does not persist the selection type on the delivered message, so
 * when it is unknown this component states that explicitly instead of guessing "Choose one." or
 * deriving it from the private answer key.
 */
const PublicAssessmentQuestion: React.FC<PublicAssessmentQuestionProps> = ({
  question,
  answerLifecycle = null,
  canAnswer = false,
  onSubmit,
}) => {
  const [selected, setSelected] = useState<AssessmentOptionId[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const terminal = answerLifecycle?.terminal === true;
  const disabled = !canAnswer || submitting || terminal;

  const toggle = (id: AssessmentOptionId) => {
    if (disabled) return;
    setSelected((current) => question.selectionType === 'single'
      ? [id]
      : current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  const submit = async () => {
    if (!onSubmit || disabled || selected.length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit(selected);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="public-assessment"
      data-testid={`public-assessment-${question.id}`}
      data-selection-type={question.selectionType}
    >
      <p className="public-assessment-stem">{question.stem}</p>
      <p className="public-assessment-instruction">
        {question.selectionType === 'multiple' ? 'Select all that apply.' : 'Choose one.'}
      </p>
      <ol className="public-assessment-options">
        {question.options.map((option) => (
          <li key={option.id}>
            <label>
              <input
                type={question.selectionType === 'multiple' ? 'checkbox' : 'radio'}
                name={`assessment-${question.id}`}
                value={option.id}
                checked={selected.includes(option.id)}
                disabled={disabled}
                onChange={() => toggle(option.id)}
              />
              <span>{option.id}. {option.text}</span>
            </label>
          </li>
        ))}
      </ol>
      {canAnswer && (
        <button type="button" disabled={disabled || selected.length === 0} onClick={submit}>
          {submitting ? 'Submitting answer…' : 'Submit answer'}
        </button>
      )}
      {answerLifecycle?.answerOutcome === 'retry' && <p role="status">Try again. {answerLifecycle.attemptsRemaining} attempt(s) remaining.</p>}
      {answerLifecycle?.answerOutcome === 'passed' && <p role="status">Correct.</p>}
      {answerLifecycle?.answerOutcome === 'failed' && answerLifecycle.terminalFailureFeedback && (
        <div role="status">
          <p>{answerLifecycle.terminalFailureFeedback.learner_safe_explanation}</p>
          <p>Correct option(s): {answerLifecycle.terminalFailureFeedback.correct_option_ids.join(', ')}</p>
        </div>
      )}
      {answerLifecycle?.processingState === 'deferred' && <p role="status">Your answer is still processing.</p>}
      {answerLifecycle?.processingState === 'rejected' && <p role="alert">This answer was rejected. Please try again.</p>}
    </div>
  );
};

export default PublicAssessmentQuestion;
