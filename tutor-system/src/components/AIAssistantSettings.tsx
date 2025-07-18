import React, { useState, useEffect } from 'react';
import { useRoom } from '../contexts/RoomContext';
import { useAuth } from '../contexts/AuthContext';
import { AI_MODELS, AIModelName } from '../services/aiService';
import { AIAssistantConfig } from '../types';

interface AIAssistantSettingsProps {
    onClose: () => void;
}

const AIAssistantSettings: React.FC<AIAssistantSettingsProps> = ({ onClose }) => {
    const { currentRoom, aiConfig, toggleAIAssistant, loadingAI } = useRoom();
    const { user } = useAuth();

    const [isEnabled, setIsEnabled] = useState(false);
    const [selectedModel, setSelectedModel] = useState<AIModelName>('gpt-4o');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [temperature, setTemperature] = useState(0.7);
    const [maxTokens, setMaxTokens] = useState(150);
    const [isSaving, setIsSaving] = useState(false);

    // Initialize form with current configuration
    useEffect(() => {
        if (currentRoom) {
            setIsEnabled(currentRoom.ai_assistant_enabled);
        }

        if (aiConfig) {
            setSelectedModel(aiConfig.model_name as AIModelName);
            setSystemPrompt(aiConfig.system_prompt || '');
            setTemperature(aiConfig.temperature);
            setMaxTokens(aiConfig.max_tokens);
        } else {
            // Set default values
            setSystemPrompt(
                'You are a helpful AI assistant in an educational tutoring session. ' +
                'Provide clear, educational responses to help students learn. ' +
                'Be encouraging, patient, and focus on building understanding.'
            );
        }
    }, [currentRoom, aiConfig]);

    const handleSave = async () => {
        if (!currentRoom || user?.current_role !== 'tutor') return;

        setIsSaving(true);
        try {
            await toggleAIAssistant(isEnabled, {
                model_name: selectedModel,
                system_prompt: systemPrompt,
                temperature,
                max_tokens: maxTokens
            });

            onClose();
        } catch (error) {
            console.error('Failed to save AI settings:', error);
            let errorMessage = 'Failed to save AI assistant settings.';
            
            if (error instanceof Error) {
                if (error.message.includes('function') && error.message.includes('does not exist')) {
                    errorMessage += '\n\nDatabase functions are missing. Please run the migration script in apply_ai_migrations.sql';
                } else if (error.message.includes('ai_assistant_configs')) {
                    errorMessage += '\n\nAI tables are missing. Please run the migration script in apply_ai_migrations.sql';
                } else {
                    errorMessage += '\n\n' + error.message;
                }
            }
            
            alert(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        onClose();
    };

    if (!currentRoom || user?.current_role !== 'tutor') {
        return null;
    }

    return (
        <div className="ai-settings-overlay">
            <div className="ai-settings-modal">
                <div className="ai-settings-header">
                    <h3>AI Assistant Settings</h3>
                    <button
                        className="ai-settings-close"
                        onClick={onClose}
                        disabled={isSaving || loadingAI}
                    >
                        ×
                    </button>
                </div>

                <div className="ai-settings-content">
                    <div className="ai-setting-group">
                        <label className="ai-toggle-label">
                            <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={(e) => setIsEnabled(e.target.checked)}
                                disabled={isSaving || loadingAI}
                            />
                            <span className="ai-toggle-text">Enable AI Assistant</span>
                        </label>
                        <p className="ai-setting-description">
                            Allow AI to generate responses in this tutoring session
                        </p>
                    </div>

                    {isEnabled && (
                        <>
                            <div className="ai-setting-group">
                                <label className="ai-setting-label">AI Model</label>
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value as AIModelName)}
                                    disabled={isSaving || loadingAI}
                                    className="ai-setting-select"
                                >
                                    {Object.entries(AI_MODELS).map(([key, model]) => (
                                        <option key={key} value={key}>
                                            {model.name} - {model.description}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="ai-setting-group">
                                <label className="ai-setting-label">
                                    System Prompt
                                    <span className="ai-setting-optional">(Instructions for the AI)</span>
                                </label>
                                <textarea
                                    value={systemPrompt}
                                    onChange={(e) => setSystemPrompt(e.target.value)}
                                    disabled={isSaving || loadingAI}
                                    className="ai-setting-textarea"
                                    placeholder="Enter instructions for how the AI should behave..."
                                    rows={4}
                                />
                            </div>

                            <div className="ai-setting-group">
                                <label className="ai-setting-label">
                                    Temperature: {temperature}
                                    <span className="ai-setting-optional">(Creativity level: 0 = focused, 1 = creative)</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={temperature}
                                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                    disabled={isSaving || loadingAI}
                                    className="ai-setting-slider"
                                />
                            </div>

                            <div className="ai-setting-group">
                                <label className="ai-setting-label">
                                    Max Response Length: {maxTokens} tokens
                                    <span className="ai-setting-optional">(Approximate words: {Math.round(maxTokens * 0.75)})</span>
                                </label>
                                <input
                                    type="range"
                                    min="50"
                                    max="500"
                                    step="25"
                                    value={maxTokens}
                                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                                    disabled={isSaving || loadingAI}
                                    className="ai-setting-slider"
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="ai-settings-actions">
                    <button
                        onClick={handleCancel}
                        disabled={isSaving || loadingAI}
                        className="btn btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || loadingAI}
                        className="btn btn-primary"
                    >
                        {isSaving || loadingAI ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIAssistantSettings; 