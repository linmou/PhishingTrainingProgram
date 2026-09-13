/**
 * Purpose: human-review editor for one Multi-agent draft.
 * Renders one or two decoded character messages in model-generated order and lets the tutor
 * edit, regenerate, reject or approve them. Thumbnail controls stay out on purpose: the
 * response has fixed model-selected characters, not a configurable dialogue.
 */

import React, { useEffect, useState } from 'react';
import { RotateCcw, X, CheckCircle } from 'lucide-react';
import type { DecodedAgentMessage } from '../types';

const CHARACTER_LABELS: Record<DecodedAgentMessage['character'], string> = {
  riley: 'Riley',
  tutor: 'AI Tutor'
};

interface MultiAgentSuggestionEditorProps {
  messages: DecodedAgentMessage[];
  parentMessage?: string;
  isRegenerating?: boolean;
  errorMessage?: string | null;
  onApprove: (editedMessages: string[]) => void | Promise<void>;
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
  const [drafts, setDrafts] = useState<string[]>(() => messages.map(message => message.content));

  // A regenerated or newly decoded response replaces whatever the tutor was editing.
  useEffect(() => {
    setDrafts(messages.map(message => message.content));
  }, [messages]);

  const updateDraft = (index: number, value: string) => {
    setDrafts(previous => previous.map((draft, draftIndex) => draftIndex === index ? value : draft));
  };

  const canApprove = drafts.every(draft => draft.trim().length > 0) && !isRegenerating;

  return (
    <section className="multi-agent-suggestion" data-testid="multi-agent-suggestion-editor">
      <header className="multi-agent-suggestion-header">
        <h3>Multi-agent response</h3>
        <p className="multi-agent-suggestion-hint">
          Review each simulated character response before approving.
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
            onChange={(event) => updateDraft(index, event.target.value)}
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
          onClick={() => onApprove(drafts.map(draft => draft.trim()))}
          disabled={!canApprove}
        >
          <CheckCircle size={14} /> Approve
        </button>
      </div>
    </section>
  );
};

export default MultiAgentSuggestionEditor;
