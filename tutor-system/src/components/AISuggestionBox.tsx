import React, { useState, useEffect } from 'react';
import { Copy, X, CheckCircle, Sparkles, Settings, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import './AISuggestionBox.css';

interface ParameterOverrides {
    role?: 'peer' | 'trusted_adult';
    communication_style?: {
        teen_slang?: 'low' | 'high';
        conversational_markers?: 'low' | 'high';
        uncertainty_expression?: 'low' | 'high';
    };
    emotional_parameters?: {
        enthusiasm_level?: 'low' | 'high';
    };
    cognitive_parameters?: {
        concept_density?: 'low' | 'high';
    };
}

interface AISuggestionBoxProps {
    suggestion: string;
    onCopy: (text: string) => void;
    onReject: () => void;
    onRegenerate?: (parameters: ParameterOverrides) => void;
    isVisible: boolean;
    parentMessage?: string;
    isRegenerating?: boolean;
}

const AISuggestionBox: React.FC<AISuggestionBoxProps> = ({
    suggestion,
    onCopy,
    onReject,
    onRegenerate,
    isVisible,
    parentMessage,
    isRegenerating = false
}) => {
    const [copied, setCopied] = useState(false);
    const [fadeIn, setFadeIn] = useState(false);
    const [showParameters, setShowParameters] = useState(false);
    const [parameters, setParameters] = useState<ParameterOverrides>({
        role: 'peer',
        communication_style: {
            teen_slang: 'high',
            conversational_markers: 'high',
            uncertainty_expression: 'low'
        },
        emotional_parameters: {
            enthusiasm_level: 'high'
        },
        cognitive_parameters: {
            concept_density: 'low'
        }
    });

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

    const handleParameterChange = (path: string, value: string) => {
        setParameters(prev => {
            const newParams = { ...prev };
            const keys = path.split('.');
            let current: any = newParams;
            
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
            return newParams;
        });
    };

    const handleRegenerate = () => {
        if (onRegenerate) {
            onRegenerate(parameters);
        }
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

            <div className="ai-suggestion-parameters">
                <button
                    onClick={() => setShowParameters(!showParameters)}
                    className="ai-parameters-toggle"
                    title={showParameters ? "Hide parameters" : "Show parameters"}
                >
                    <Settings size={14} />
                    <span>Quick Adjust</span>
                    {showParameters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                
                {showParameters && (
                    <div className="ai-parameters-panel">
                        <div className="ai-parameter-row">
                            <label className="ai-parameter-label">Role:</label>
                            <select 
                                value={parameters.role}
                                onChange={(e) => handleParameterChange('role', e.target.value)}
                                className="ai-parameter-select"
                            >
                                <option value="peer">Peer</option>
                                <option value="trusted_adult">Trusted Adult</option>
                            </select>
                            
                            <label className="ai-parameter-label">Communication:</label>
                            <select 
                                value={parameters.communication_style?.teen_slang}
                                onChange={(e) => handleParameterChange('communication_style.teen_slang', e.target.value)}
                                className="ai-parameter-select"
                            >
                                <option value="high">Casual</option>
                                <option value="low">Formal</option>
                            </select>
                        </div>
                        
                        <div className="ai-parameter-row">
                            <label className="ai-parameter-label">Enthusiasm:</label>
                            <div className="ai-parameter-slider">
                                <span>Low</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="1"
                                    value={parameters.emotional_parameters?.enthusiasm_level === 'high' ? 1 : 0}
                                    onChange={(e) => handleParameterChange('emotional_parameters.enthusiasm_level', e.target.value === '1' ? 'high' : 'low')}
                                    className="ai-slider"
                                />
                                <span>High</span>
                            </div>
                            
                            <label className="ai-parameter-label">Complexity:</label>
                            <div className="ai-parameter-slider">
                                <span>Simple</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="1"
                                    value={parameters.cognitive_parameters?.concept_density === 'high' ? 1 : 0}
                                    onChange={(e) => handleParameterChange('cognitive_parameters.concept_density', e.target.value === '1' ? 'high' : 'low')}
                                    className="ai-slider"
                                />
                                <span>Complex</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="ai-suggestion-content">
                <p>{isRegenerating ? "Generating new response..." : suggestion}</p>
            </div>
            
            <div className="ai-suggestion-actions">
                <button
                    onClick={handleCopy}
                    className={`ai-suggestion-button ${copied ? 'copied' : ''}`}
                    disabled={copied || isRegenerating}
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
                {onRegenerate && (
                    <button
                        onClick={handleRegenerate}
                        className="ai-suggestion-button ai-suggestion-regenerate"
                        disabled={isRegenerating}
                        title="Regenerate with current parameters"
                    >
                        <RotateCcw size={16} className={isRegenerating ? 'spinning' : ''} />
                        <span>{isRegenerating ? 'Generating...' : 'Regenerate'}</span>
                    </button>
                )}
                <button
                    onClick={onReject}
                    className="ai-suggestion-button ai-suggestion-reject"
                    disabled={isRegenerating}
                >
                    <X size={16} />
                    <span>Reject</span>
                </button>
            </div>
        </div>
    );
};

export default AISuggestionBox;
export type { ParameterOverrides };