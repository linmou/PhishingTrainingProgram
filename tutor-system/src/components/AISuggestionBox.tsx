import React, { useState, useEffect } from 'react';
import { Copy, X, CheckCircle, Sparkles, Settings, RotateCcw, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { DynamicParameterOverrides } from '../services/prompts/types';
import { getParameterMetadata, createDefaultParameters, filterParameterOverrides, getDefaultParameterSelection } from '../services/prompts/parameterConfig';
import './AISuggestionBox.css';

// Use the dynamic parameter overrides interface
type ParameterOverrides = DynamicParameterOverrides;

interface AISuggestionBoxProps {
    suggestion: string;
    onCopy: (text: string) => void;
    onReject: () => void;
    onRegenerate?: (parameters: ParameterOverrides) => void;
    isVisible: boolean;
    parentMessage?: string;
    isRegenerating?: boolean;
    parameterConfig?: any; // Dynamic configuration structure
}

const AISuggestionBox: React.FC<AISuggestionBoxProps> = ({
    suggestion,
    onCopy,
    onReject,
    onRegenerate,
    isVisible,
    parentMessage,
    isRegenerating = false,
    parameterConfig = getDefaultParameterSelection()
}) => {
    const [copied, setCopied] = useState(false);
    const [fadeIn, setFadeIn] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    const [quickAdjustCollapsed, setQuickAdjustCollapsed] = useState(true); // Start collapsed by default
    const [showInfoModal, setShowInfoModal] = useState<string | null>(null);
    const [parameters, setParameters] = useState<ParameterOverrides>(() => 
        createDefaultParameters(parameterConfig)
    );
    
    const metadata = getParameterMetadata();

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
        console.log('🎛️ Parameter change:', path, '→', value);
        setParameters(prev => {
            const newParams = { ...prev };
            const keys = path.split('.');
            let current: any = newParams;
            
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
            console.log('🎛️ Updated parameters:', newParams);
            return newParams;
        });
    };

    const handleRegenerate = () => {
        const filteredParams = filterParameterOverrides(parameters, parameterConfig);
        console.log('🔄 Regenerating with filtered parameters:', filteredParams);
        if (onRegenerate) {
            onRegenerate(filteredParams);
        }
    };
    
    const toggleSection = (sectionKey: string) => {
        setCollapsedSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    };
    
    const renderParameterSection = (sectionKey: string, sectionConfig: any, sectionMeta: any) => {
        if (!sectionConfig.enabled) return null;
        
        const isCollapsed = collapsedSections[sectionKey];
        
        return (
            <div key={sectionKey} className="ai-parameter-section">
                <div className="ai-parameter-section-header">
                    <div 
                        className="ai-parameter-section-title-area"
                        onClick={() => toggleSection(sectionKey)}
                    >
                        <span className="ai-parameter-section-title">{sectionMeta.label}</span>
                        {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </div>
                    <button 
                        className="ai-parameter-info-btn"
                        onClick={() => setShowInfoModal(sectionKey)}
                        title={`View detailed information about ${sectionMeta.label}`}
                    >
                        <Info size={14} />
                    </button>
                </div>
                
                {!isCollapsed && (
                    <div className="ai-parameter-section-content">
                        {renderGenericParameters(sectionKey, sectionConfig, sectionMeta)}
                    </div>
                )}
            </div>
        );
    };
    
    const renderGenericParameters = (sectionKey: string, sectionConfig: any, sectionMeta: any) => {
        return Object.entries(sectionConfig.parameters)
            .filter(([, enabled]) => enabled)
            .map(([paramKey]) => {
                const paramMeta = sectionMeta.parameters[paramKey];
                const sectionParams = parameters[sectionKey as keyof ParameterOverrides] as any;
                const currentValue = sectionParams?.[paramKey] || 'low';
                
                return (
                    <div key={paramKey} className="ai-parameter-group">
                        <label className="ai-parameter-label">{paramMeta.label}:</label>
                        <select 
                            value={currentValue}
                            onChange={(e) => handleParameterChange(`${sectionKey}.${paramKey}`, e.target.value)}
                            className="ai-parameter-select"
                        >
                            <option value="low">{paramMeta.labels?.low || 'low'}</option>
                            <option value="high">{paramMeta.labels?.high || 'high'}</option>
                        </select>
                    </div>
                );
            });
    };
    
    const renderInfoModal = () => {
        if (!showInfoModal) return null;
        
        const sectionMeta = metadata[showInfoModal];
        if (!sectionMeta) return null;
        
        return (
            <div className="ai-info-modal-overlay" onClick={() => setShowInfoModal(null)}>
                <div className="ai-info-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="ai-info-modal-header">
                        <h3>{sectionMeta.label} Parameters</h3>
                        <button 
                            onClick={() => setShowInfoModal(null)}
                            className="ai-info-modal-close"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="ai-info-modal-content">
                        <div className="ai-info-section">
                            {sectionMeta.parameters && Object.entries(sectionMeta.parameters).map(([paramKey, paramInfo]: [string, any]) => (
                                <div key={paramKey} className="ai-info-parameter">
                                    <h4>{paramKey}</h4>
                                    <div className="ai-info-option">
                                        <strong>Low:</strong> {paramInfo.low}
                                    </div>
                                    <div className="ai-info-option">
                                        <strong>High:</strong> {paramInfo.high}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (!isVisible) return null;

    return (
        <>
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
                <div className="ai-parameters-header" onClick={() => setQuickAdjustCollapsed(!quickAdjustCollapsed)}>
                    <div className="ai-parameters-header-content">
                        <Settings size={16} />
                        <span className="ai-parameters-title">Quick Adjust</span>
                    </div>
                    {quickAdjustCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>
                
                {!quickAdjustCollapsed && (
                    <div className="ai-parameters-menu">
                        {renderParameterSection('role', parameterConfig.role, metadata.role)}
                        {renderParameterSection('communication_style', parameterConfig.communication_style, metadata.communication_style)}
                        {renderParameterSection('cognitive_parameters', parameterConfig.cognitive_parameters, metadata.cognitive_parameters)}
                        {renderParameterSection('emotional_parameters', parameterConfig.emotional_parameters, metadata.emotional_parameters)}
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
            {renderInfoModal()}
        </>
    );
};

export default AISuggestionBox;
export type { ParameterOverrides };