/**
 * Purpose: human-review editor for one Multi-agent (Riley + AI Tutor) draft.
 * Renders exactly the two decoded character messages in model-generated order and lets the
 * tutor edit, regenerate, reject or approve them. Thumbnail controls stay out on purpose:
 * the pair is a fixed two-character contrast, not a configurable dialogue.
 */

import React, { useEffect, useState } from 'react';
import { RotateCcw, X, CheckCircle } from 'lucide-react';
import type { DecodedAgentMessage } from '../types';

const CHARACTER_LABELS: Record<DecodedAgentMessage['character'], string> = {
  riley: 'Riley',
  tutor: 'AI Tutor'
};

interface MultiAgentSuggestionEditorProps {
  messages: [DecodedAgentMessage, DecodedAgentMessage];
  parentMessage?: string;
  isRegenerating?: boolean;
  errorMessage?: string | null;
  onApprove: (editedMessages: [string, string]) => void | Promise<void>;
  onReject: () => void;
  onRegenerate: () => void | Promise<void>;
}

const MultiAgentSuggestionEditor: React.FC<MultiAgentSuggestionEditorProps> = ({
  messages,
  parentMessage,
  isRegenerating = false,
  errorMessage = null,
  onApprove,
  onReject,
  onRegenerate
}) => {
  const [drafts, setDrafts] = useState<[string, string]>([
    messages[0].content,
    messages[1].content
  ]);

  // A regenerated or newly decoded pair replaces whatever the tutor was editing.
  useEffect(() => {
    setDrafts([messages[0].content, messages[1].content]);
  }, [messages]);

  const updateDraft = (index: 0 | 1, value: string) => {
    setDrafts(prev => (index === 0 ? [value, prev[1]] : [prev[0], value]));
  };

  const canApprove = drafts.every(draft => draft.trim().length > 0) && !isRegenerating;

  return (
    <section className="multi-agent-suggestion" data-testid="multi-agent-suggestion-editor">
      <header className="multi-agent-suggestion-header">
        <h3>Multi-agent response</h3>
        <p className="multi-agent-suggestion-hint">
          Two simulated characters answer this turn. Review both messages before approving.
        </p>
        {parentMessage && (
          <blockquote className="multi-agent-suggestion-parent">{parentMessage}</blockquote>
        )}
      </header>

      {messages.map((message, index) => (
        <div
          className={`multi-agent-card multi-agent-card--${message.character}`}
          key={`${message.character}-${index}`}
          data-testid={`multi-agent-card-${index}`}
        >
          <label className="multi-agent-card-label" htmlFor={`multi-agent-message-${index}`}>
            {CHARACTER_LABELS[message.character]}
          </label>
          <textarea
            id={`multi-agent-message-${index}`}
            className="multi-agent-card-input"
            aria-label={CHARACTER_LABELS[message.character]}
            value={drafts[index]}
            rows={3}
            disabled={isRegenerating}
            onChange={(event) => updateDraft(index as 0 | 1, event.target.value)}
          />
        </div>
      ))}

      {errorMessage && (
        <p className="multi-agent-suggestion-error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="multi-agent-suggestion-actions">
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={onRegenerate}
          disabled={isRegenerating}
        >
          <RotateCcw size={14} /> {isRegenerating ? 'Regenerating…' : 'Regenerate'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={onReject}
          disabled={isRegenerating}
        >
          <X size={14} /> Reject
        </button>
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={() => onApprove([drafts[0].trim(), drafts[1].trim()])}
          disabled={!canApprove}
        >
          <CheckCircle size={14} /> Approve
        </button>
      </div>
    </section>
  );
};

export default MultiAgentSuggestionEditor;
