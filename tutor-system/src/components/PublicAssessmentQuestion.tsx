// Purpose: render the public assessment a learner is allowed to see, and nothing else.

import React from 'react';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AssessmentOptionId } from '../types/assessment';
import type { AnswerLifecycleView, PublicQuestionView } from '../contexts/transferAssessmentUiAdapter';

export interface PublicAssessmentQuestionProps {
  question: PublicQuestionView;
  answerLifecycle?: AnswerLifecycleView | null;
  attempts?: AssessmentAnswerAttempt[];
  canAnswer?: boolean;
  onSubmit?: (selectedOptionIds: AssessmentOptionId[]) => Promise<void> | void;
}

export interface AssessmentAnswerAttempt {
  messageId: string;
  lifecycle: AnswerLifecycleView | null;
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
  attempts = [],
  canAnswer = false,
  onSubmit,
}) => {
  const [selected, setSelected] = useState<AssessmentOptionId[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [viewedAnswerId, setViewedAnswerId] = useState<string | null>(null);
  const selectedIndex = viewedAnswerId === null
    ? attempts.length - 1
    : Math.max(0, attempts.findIndex((attempt) => attempt.messageId === viewedAnswerId));
  const viewedAnswer = attempts[selectedIndex];
  const displayedLifecycle = attempts.length > 0 ? viewedAnswer.lifecycle : answerLifecycle;
  const latestAnswer = attempts[attempts.length - 1];
  const currentLifecycle = answerLifecycle ?? latestAnswer?.lifecycle;
  const pendingAnswer = latestAnswer && (!latestAnswer.lifecycle || latestAnswer.lifecycle.processingState === 'deferred');
  const resolved = currentLifecycle?.answerOutcome === 'passed' || currentLifecycle?.answerOutcome === 'failed';
  const disabled = !canAnswer || submitting || pendingAnswer || currentLifecycle?.terminal === true || resolved;

  const toggle = (id: AssessmentOptionId) => {
    if (disabled) return;
    setSelected((current) => question.selectionType === 'single'
      ? [id]
      : current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  const submit = async () => {
    if (!onSubmit || disabled || selected.length === 0) return;
    const selectedInOptionOrder = question.options
      .filter((option) => selected.includes(option.id))
      .map((option) => option.id);
    if (selectedInOptionOrder.length === 0) return;

    setSubmitting(true);
    try {
      await onSubmit(selectedInOptionOrder);
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
      {attempts.length > 0 && (
        <section className="public-assessment-history" aria-label="Answer history">
          <div className="public-assessment-history-nav">
            <button
              type="button"
              aria-label="Previous answer"
              title="Previous answer"
              disabled={selectedIndex === 0}
              onClick={() => setViewedAnswerId(attempts[selectedIndex - 1].messageId)}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <span>Answer {selectedIndex + 1} of {attempts.length}</span>
            <button
              type="button"
              aria-label="Next answer"
              title="Next answer"
              disabled={selectedIndex === attempts.length - 1}
              onClick={() => setViewedAnswerId(attempts[selectedIndex + 1].messageId)}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          {displayedLifecycle?.selectedOptionIds && (
            <div className="public-assessment-saved-selection">
              <strong>Your answer</strong>
              <ul>
                {displayedLifecycle.selectedOptionIds.map((id) => {
                  const option = question.options.find((candidate) => candidate.id === id);
                  return <li key={id}>{id}. {option?.text ?? id}</li>;
                })}
              </ul>
            </div>
          )}
        </section>
      )}
      {attempts.length > 0 && !displayedLifecycle && (
        <p role="status">Your answer is still processing.</p>
      )}
      {displayedLifecycle?.answerOutcome === 'retry' && (
        <p role="status">
          Incorrect. {displayedLifecycle.attemptsRemaining} {displayedLifecycle.attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining.
        </p>
      )}
      {displayedLifecycle?.answerOutcome === 'passed' && <p role="status">Correct.</p>}
      {displayedLifecycle?.answerOutcome === 'failed' && displayedLifecycle.terminalFailureFeedback && (
        <div role="status">
          <p>{displayedLifecycle.terminalFailureFeedback.learner_safe_explanation}</p>
          <p>Correct option(s): {displayedLifecycle.terminalFailureFeedback.correct_option_ids.join(', ')}</p>
        </div>
      )}
      {displayedLifecycle?.processingState === 'deferred' && displayedLifecycle.answerOutcome === null && (
        <p role="status">Your answer is still processing.</p>
      )}
      {displayedLifecycle?.processingState === 'rejected' && displayedLifecycle.answerOutcome === null && (
        <p role="alert">This answer was rejected. Please try again.</p>
      )}
    </div>
  );
};

export default PublicAssessmentQuestion;
