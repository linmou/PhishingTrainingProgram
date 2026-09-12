// Purpose: render the public assessment a learner is allowed to see, and nothing else.

import React from 'react';
import type { PublicQuestionView } from '../contexts/transferAssessmentUiAdapter';

export interface PublicAssessmentQuestionProps {
  question: PublicQuestionView;
}

/**
 * The learner-visible question: stem, instruction, and ordered options A-D.
 *
 * The promoted one-table design does not persist the selection type on the delivered message, so
 * when it is unknown this component states that explicitly instead of guessing "Choose one." or
 * deriving it from the private answer key.
 */
const PublicAssessmentQuestion: React.FC<PublicAssessmentQuestionProps> = ({ question }) => (
  <div
    className="public-assessment"
    data-testid={`public-assessment-${question.id}`}
    data-selection-type={question.selectionType ?? 'unrecorded'}
  >
    <p className="public-assessment-stem">{question.stem}</p>
    {question.selectionType ? (
      <p className="public-assessment-instruction">
        {question.selectionType === 'multiple' ? 'Select all that apply.' : 'Choose one.'}
      </p>
    ) : (
      <p className="public-assessment-instruction" data-assessment-instruction="unrecorded">
        Answer type not recorded for this question. Submit the option labels you believe are correct.
      </p>
    )}
    <ol className="public-assessment-options">
      {question.options.map((option) => (
        <li key={option.id}>
          {option.id}. {option.text}
        </li>
      ))}
    </ol>
  </div>
);

export default PublicAssessmentQuestion;
