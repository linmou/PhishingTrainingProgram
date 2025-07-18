import React, { useState, useEffect } from 'react';
import { Copy, X, CheckCircle, Sparkles } from 'lucide-react';
import './AISuggestionBox.css';

interface AISuggestionBoxProps {
    suggestion: string;
    onCopy: (text: string) => void;
    onReject: () => void;
    isVisible: boolean;
    parentMessage?: string;
}

const AISuggestionBox: React.FC<AISuggestionBoxProps> = ({
    suggestion,
    onCopy,
    onReject,
    isVisible,
    parentMessage
}) => {
    const [copied, setCopied] = useState(false);
    const [fadeIn, setFadeIn] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setTimeout(() => setFadeIn(true), 50);
        } else {
            setFadeIn(false);
        }
    }, [isVisible]);

    const handleCopy = () => {
        onCopy(suggestion);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isVisible) return null;

    return (
        <div className={`ai-suggestion-box ${fadeIn ? 'fade-in' : ''}`}>
            <div className="ai-suggestion-header">
                <div className="ai-suggestion-title">
                    <Sparkles size={16} className="ai-icon" />
                    <span>AI Suggested Response</span>
                </div>
                <button
                    onClick={onReject}
                    className="ai-suggestion-close"
                    title="Dismiss suggestion"
                >
                    <X size={16} />
                </button>
            </div>
            
            {parentMessage && (
                <div className="ai-suggestion-context">
                    <div className="ai-context-label">Responding to:</div>
                    <div className="ai-context-message">"{parentMessage}"</div>
                </div>
            )}
            
            <div className="ai-suggestion-content">
                <p>{suggestion}</p>
            </div>
            
            <div className="ai-suggestion-actions">
                <button
                    onClick={handleCopy}
                    className={`ai-suggestion-button ${copied ? 'copied' : ''}`}
                    disabled={copied}
                >
                    {copied ? (
                        <>
                            <CheckCircle size={16} />
                            <span>Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy size={16} />
                            <span>Copy to Input</span>
                        </>
                    )}
                </button>
                <button
                    onClick={onReject}
                    className="ai-suggestion-button ai-suggestion-reject"
                >
                    <X size={16} />
                    <span>Reject</span>
                </button>
            </div>
        </div>
    );
};

export default AISuggestionBox;