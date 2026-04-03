import React, { useState, useEffect, useCallback } from 'react';
import { useRoom } from '../contexts/RoomContext';
import { useAuth } from '../contexts/AuthContext';
import { AI_MODELS, AIModelName } from '../services/aiService';
import { ScenarioTemplate, SCENARIO_TEMPLATES } from '../services/detectionTemplates';
import { PRESET_CONFIGS, generateSystemPrompt } from '../services/systemPrompts';
import { SystemPromptConfig } from '../services/prompts/types';
import './AIAssistantSettings.css';

interface AIAssistantSettingsProps {
    onClose: () => void;
}

const getPresetFromPromptConfig = (
    promptConfig: SystemPromptConfig
): 'casual_peer' | 'supportive_adult' => {
    return promptConfig.role.role === 'low' ? 'casual_peer' : 'supportive_adult';
};

const getScenarioFromPromptConfig = (
    promptConfig: SystemPromptConfig
): ScenarioTemplate | '' => {
    const matchedScenario = (Object.entries(SCENARIO_TEMPLATES) as Array<[ScenarioTemplate, typeof SCENARIO_TEMPLATES[ScenarioTemplate]]>)
        .find(([, template]) =>
            JSON.stringify(template.detection_areas) === JSON.stringify(promptConfig.detection_areas) &&
            JSON.stringify(template.verification_steps) === JSON.stringify(promptConfig.verification_steps)
        );

    return matchedScenario?.[0] || '';
};

const AIAssistantSettings: React.FC<AIAssistantSettingsProps> = ({ onClose }) => {
    const { currentRoom, aiConfig, toggleAIAssistant, loadingAI } = useRoom();
    const { user } = useAuth();

    const [isEnabled, setIsEnabled] = useState(false);
    const [selectedModel, setSelectedModel] = useState<AIModelName>('gpt-4o');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [temperature, setTemperature] = useState(0.7);
    const [maxTokens, setMaxTokens] = useState(150);
    const [isSaving, setIsSaving] = useState(false);
    
    // New modular prompt settings
    const [useModularPrompts, setUseModularPrompts] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<'casual_peer' | 'supportive_adult'>('supportive_adult');
    const [selectedScenario, setSelectedScenario] = useState<ScenarioTemplate | ''>('');
    const [customDetectionAreas, setCustomDetectionAreas] = useState<string>('');
    const [customVerificationSteps, setCustomVerificationSteps] = useState<string>('');
    
    // Communication Style Parameters
    const [teenSlang, setTeenSlang] = useState<'low' | 'high'>('low');
    const [conversationalMarkers, setConversationalMarkers] = useState<'low' | 'high'>('low');
    const [uncertaintyExpression, setUncertaintyExpression] = useState<'low' | 'high'>('low');
    
    // Cognitive Load/Content Parameters
    const [conceptDensity, setConceptDensity] = useState<'low' | 'high'>('high');
    const [perspectiveTaking, setPerspectiveTaking] = useState<'low' | 'high'>('high');
    const [personalExamples, setPersonalExamples] = useState<'low' | 'high'>('high');
    const [consequenceHighlighting, setConsequenceHighlighting] = useState<'low' | 'high'>('high');
    
    // Emotional Design Parameters
    const [enthusiasmLevel, setEnthusiasmLevel] = useState<'low' | 'high'>('low');
    const [validationFrequency, setValidationFrequency] = useState<'low' | 'high'>('high');
    const [mistakeNormalization, setMistakeNormalization] = useState<'low' | 'high'>('high');
    const [confidenceBuilding, setConfidenceBuilding] = useState<'low' | 'high'>('high');

    const getEffectiveScenarioContent = useCallback(() => {
        const detectionAreas = customDetectionAreas.split('\n').filter(area => area.trim());
        const verificationSteps = customVerificationSteps.split('\n').filter(step => step.trim());
        const scenarioData = selectedScenario ? SCENARIO_TEMPLATES[selectedScenario] : null;

        return {
            detectionAreas: detectionAreas.length > 0 ? detectionAreas : (scenarioData?.detection_areas || []),
            verificationSteps: verificationSteps.length > 0 ? verificationSteps : (scenarioData?.verification_steps || [])
        };
    }, [customDetectionAreas, customVerificationSteps, selectedScenario]);

    const handleScenarioChange = (scenario: ScenarioTemplate | '') => {
        setSelectedScenario(scenario);

        if (!scenario) {
            setCustomDetectionAreas('');
            setCustomVerificationSteps('');
            return;
        }

        const template = SCENARIO_TEMPLATES[scenario];
        setCustomDetectionAreas(template.detection_areas.join('\n'));
        setCustomVerificationSteps(template.verification_steps.join('\n'));
    };

    // Initialize form with current configuration
    useEffect(() => {
        const applyPromptConfigToForm = (promptConfig: SystemPromptConfig) => {
            setUseModularPrompts(true);
            setSelectedPreset(getPresetFromPromptConfig(promptConfig));
            setTeenSlang(promptConfig.communication_style.teen_slang);
            setConversationalMarkers(promptConfig.communication_style.conversational_markers);
            setUncertaintyExpression(promptConfig.communication_style.uncertainty_expression);
            setConceptDensity(promptConfig.cognitive_parameters.concept_density);
            setPerspectiveTaking(promptConfig.cognitive_parameters.perspective_taking);
            setPersonalExamples(promptConfig.cognitive_parameters.personal_examples);
            setConsequenceHighlighting(promptConfig.cognitive_parameters.consequence_highlighting);
            setEnthusiasmLevel(promptConfig.emotional_parameters.enthusiasm_level);
            setValidationFrequency(promptConfig.emotional_parameters.validation_frequency);
            setMistakeNormalization(promptConfig.emotional_parameters.mistake_normalization);
            setConfidenceBuilding(promptConfig.emotional_parameters.confidence_building);
            setCustomDetectionAreas(promptConfig.detection_areas.join('\n'));
            setCustomVerificationSteps(promptConfig.verification_steps.join('\n'));
            setSelectedScenario(getScenarioFromPromptConfig(promptConfig));
        };

        const applyDefaultFormState = () => {
            setUseModularPrompts(false);
            setSelectedPreset('supportive_adult');
            setSelectedScenario('');
            setCustomDetectionAreas('');
            setCustomVerificationSteps('');

            const defaultPreset = PRESET_CONFIGS.supportive_adult;
            setTeenSlang(defaultPreset.communication_style.teen_slang);
            setConversationalMarkers(defaultPreset.communication_style.conversational_markers);
            setUncertaintyExpression(defaultPreset.communication_style.uncertainty_expression);
            setConceptDensity(defaultPreset.cognitive_parameters.concept_density);
            setPerspectiveTaking(defaultPreset.cognitive_parameters.perspective_taking);
            setPersonalExamples(defaultPreset.cognitive_parameters.personal_examples);
            setConsequenceHighlighting(defaultPreset.cognitive_parameters.consequence_highlighting);
            setEnthusiasmLevel(defaultPreset.emotional_parameters.enthusiasm_level);
            setValidationFrequency(defaultPreset.emotional_parameters.validation_frequency);
            setMistakeNormalization(defaultPreset.emotional_parameters.mistake_normalization);
            setConfidenceBuilding(defaultPreset.emotional_parameters.confidence_building);
        };

        if (currentRoom) {
            setIsEnabled(currentRoom.ai_assistant_enabled);
        }

        if (aiConfig) {
            setSelectedModel(aiConfig.model_name as AIModelName);
            setSystemPrompt(aiConfig.system_prompt || '');
            setTemperature(aiConfig.temperature);
            setMaxTokens(aiConfig.max_tokens);

            if (aiConfig.prompt_config) {
                applyPromptConfigToForm(aiConfig.prompt_config);
            } else {
                applyDefaultFormState();
            }
        } else {
            // Set default values
            setSystemPrompt(
                'You are a helpful AI assistant in an educational tutoring session. ' +
                'Provide clear, educational responses to help students learn. ' +
                'Be encouraging, patient, and focus on building understanding.'
            );
            setTemperature(0.7);
            setMaxTokens(150);
            applyDefaultFormState();
        }
    }, [currentRoom, aiConfig]);

    // Handle preset selection
    const handlePresetChange = (preset: 'casual_peer' | 'supportive_adult') => {
        setSelectedPreset(preset);
        
        // Load preset values into individual parameters
        const presetConfig = PRESET_CONFIGS[preset];
        setTeenSlang(presetConfig.communication_style.teen_slang);
        setConversationalMarkers(presetConfig.communication_style.conversational_markers);
        setUncertaintyExpression(presetConfig.communication_style.uncertainty_expression);
        
        setConceptDensity(presetConfig.cognitive_parameters.concept_density);
        setPerspectiveTaking(presetConfig.cognitive_parameters.perspective_taking);
        setPersonalExamples(presetConfig.cognitive_parameters.personal_examples);
        setConsequenceHighlighting(presetConfig.cognitive_parameters.consequence_highlighting);
        
        setEnthusiasmLevel(presetConfig.emotional_parameters.enthusiasm_level);
        setValidationFrequency(presetConfig.emotional_parameters.validation_frequency);
        setMistakeNormalization(presetConfig.emotional_parameters.mistake_normalization);
        setConfidenceBuilding(presetConfig.emotional_parameters.confidence_building);
    };

    // Handle modular prompt generation
    const handleGenerateModularPrompt = useCallback(() => {
        if (useModularPrompts) {
            const {
                detectionAreas: finalDetectionAreas,
                verificationSteps: finalVerificationSteps
            } = getEffectiveScenarioContent();
            
            // Use individual parameter settings instead of preset
            const config = {
                role: {
                    role: selectedPreset === 'casual_peer' ? 'low' as const : 'high' as const
                },
                communication_style: {
                    teen_slang: teenSlang,
                    conversational_markers: conversationalMarkers,
                    uncertainty_expression: uncertaintyExpression
                },
                cognitive_parameters: {
                    concept_density: conceptDensity,
                    perspective_taking: perspectiveTaking,
                    personal_examples: personalExamples,
                    consequence_highlighting: consequenceHighlighting
                },
                emotional_parameters: {
                    enthusiasm_level: enthusiasmLevel,
                    validation_frequency: validationFrequency,
                    mistake_normalization: mistakeNormalization,
                    confidence_building: confidenceBuilding
                },
                detection_areas: finalDetectionAreas,
                verification_steps: finalVerificationSteps
            };
            
            const generatedPrompt = generateSystemPrompt(config);
            setSystemPrompt(generatedPrompt);
        }
    }, [useModularPrompts, selectedPreset, getEffectiveScenarioContent,
        teenSlang, conversationalMarkers, uncertaintyExpression,
        conceptDensity, perspectiveTaking, personalExamples, consequenceHighlighting,
        enthusiasmLevel, validationFrequency, mistakeNormalization, confidenceBuilding]);

    // Auto-generate when modular settings change
    useEffect(() => {
        if (useModularPrompts) {
            handleGenerateModularPrompt();
        }
    }, [useModularPrompts, handleGenerateModularPrompt]);

    const handleSave = async () => {
        if (!currentRoom || user?.current_role !== 'tutor') return;

        setIsSaving(true);
        try {
            const {
                detectionAreas: finalDetectionAreas,
                verificationSteps: finalVerificationSteps
            } = getEffectiveScenarioContent();

            const promptConfig = useModularPrompts ? {
                role: {
                    role: selectedPreset === 'casual_peer' ? 'low' as const : 'high' as const
                },
                communication_style: {
                    teen_slang: teenSlang,
                    conversational_markers: conversationalMarkers,
                    uncertainty_expression: uncertaintyExpression
                },
                cognitive_parameters: {
                    concept_density: conceptDensity,
                    perspective_taking: perspectiveTaking,
                    personal_examples: personalExamples,
                    consequence_highlighting: consequenceHighlighting
                },
                emotional_parameters: {
                    enthusiasm_level: enthusiasmLevel,
                    validation_frequency: validationFrequency,
                    mistake_normalization: mistakeNormalization,
                    confidence_building: confidenceBuilding
                },
                detection_areas: finalDetectionAreas,
                verification_steps: finalVerificationSteps
            } : null;

            const finalSystemPrompt = promptConfig
                ? generateSystemPrompt(promptConfig)
                : systemPrompt;

            await toggleAIAssistant(isEnabled, {
                model_name: selectedModel,
                system_prompt: finalSystemPrompt,
                prompt_config: promptConfig,
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
                                <label className="ai-toggle-label">
                                    <input
                                        type="checkbox"
                                        checked={useModularPrompts}
                                        onChange={(e) => setUseModularPrompts(e.target.checked)}
                                        disabled={isSaving || loadingAI}
                                    />
                                    <span className="ai-toggle-text">Use Phishing Training Templates</span>
                                </label>
                                <p className="ai-setting-description">
                                    Generate specialized prompts for phishing and privacy education
                                </p>
                            </div>

                            {useModularPrompts && (
                                <>
                                    <div className="ai-setting-group">
                                        <label className="ai-setting-label">AI Personality (Preset)</label>
                                        <select
                                            value={selectedPreset}
                                            onChange={(e) => handlePresetChange(e.target.value as 'casual_peer' | 'supportive_adult')}
                                            disabled={isSaving || loadingAI}
                                            className="ai-setting-select"
                                        >
                                            <option value="supportive_adult">Trusted Adult - Mature and protective guidance</option>
                                            <option value="casual_peer">Casual Peer - Fellow learner, relatable language</option>
                                        </select>
                                        <p className="ai-setting-description">
                                            Selecting a preset will load default values for all parameters below. You can then customize individual settings.
                                        </p>
                                    </div>

                                    <div className="ai-setting-group">
                                        <label className="ai-setting-label">Scenario Template</label>
                                        <select
                                            value={selectedScenario}
                                            onChange={(e) => handleScenarioChange(e.target.value as ScenarioTemplate | '')}
                                            disabled={isSaving || loadingAI}
                                            className="ai-setting-select"
                                        >
                                            <option value="">Custom / General</option>
                                            <optgroup label="Scam Detection">
                                                <option value="Nintendo Switch Deal ($19.99)">Nintendo Switch Deal ($19.99)</option>
                                                <option value="iTunes Gift Card Survey ($500)">iTunes Gift Card Survey ($500)</option>
                                                <option value="Account Security Alert">Account Security Alert</option>
                                                <option value="General Scam Indicators">General Scam Indicators</option>
                                            </optgroup>
                                            <optgroup label="Privacy Protection">
                                                <option value="Location Sharing Risks">Location Sharing Risks</option>
                                                <option value="Contact Information Exposure">Contact Information Exposure</option>
                                                <option value="Personal Details Protection">Personal Details Protection</option>
                                            </optgroup>
                                        </select>
                                    </div>

                                    <div className="ai-setting-group">
                                        <label className="ai-setting-label">
                                            Custom Detection Areas
                                            <span className="ai-setting-optional">(One per line, optional)</span>
                                        </label>
                                        <textarea
                                            value={customDetectionAreas}
                                            onChange={(e) => setCustomDetectionAreas(e.target.value)}
                                            disabled={isSaving || loadingAI}
                                            className="ai-setting-textarea"
                                            placeholder="Red flags to watch for (optional - will use template if empty)"
                                            rows={3}
                                        />
                                    </div>

                                    <div className="ai-setting-group">
                                        <label className="ai-setting-label">
                                            Custom Verification Steps
                                            <span className="ai-setting-optional">(One per line, optional)</span>
                                        </label>
                                        <textarea
                                            value={customVerificationSteps}
                                            onChange={(e) => setCustomVerificationSteps(e.target.value)}
                                            disabled={isSaving || loadingAI}
                                            className="ai-setting-textarea"
                                            placeholder="Steps students should take to verify content (optional)"
                                            rows={3}
                                        />
                                    </div>

                                    {/* Communication Style Parameters */}
                                    <div className="ai-setting-group">
                                        <h4 className="ai-setting-section-header">🗣️ Communication Style Parameters</h4>
                                        
                                        <div className="ai-parameter-row">
                                            <label className="ai-parameter-label">
                                                Teen Slang Integration
                                                <span className="ai-setting-optional">({teenSlang})</span>
                                            </label>
                                            <select
                                                value={teenSlang}
                                                onChange={(e) => setTeenSlang(e.target.value as 'low' | 'high')}
                                                disabled={isSaving || loadingAI}
                                                className="ai-parameter-select"
                                            >
                                                <option value="low">Low - Formal language only</option>
                                                <option value="high">High - Heavy slang usage ("sus", "no cap")</option>
                                            </select>
                                        </div>

                                        <div className="ai-parameter-row">
                                            <label className="ai-parameter-label">
                                                Conversational Markers
                                                <span className="ai-setting-optional">({conversationalMarkers})</span>
                                            </label>
                                            <select
                                                value={conversationalMarkers}
                                                onChange={(e) => setConversationalMarkers(e.target.value as 'low' | 'high')}
                                                disabled={isSaving || loadingAI}
                                                className="ai-parameter-select"
                                            >
                                                <option value="low">Low - Direct, clean speech</option>
                                                <option value="high">High - Natural patterns ("So like...", "you know?")</option>
                                            </select>
                                        </div>

                                        <div className="ai-parameter-row">
                                            <label className="ai-parameter-label">
                                                Uncertainty Expression
                                                <span className="ai-setting-optional">({uncertaintyExpression})</span>
                                            </label>
                                            <select
                                                value={uncertaintyExpression}
                                                onChange={(e) => setUncertaintyExpression(e.target.value as 'low' | 'high')}
                                                disabled={isSaving || loadingAI}
                                                className="ai-parameter-select"
                                            >
                                                <option value="low">Low - Definitive statements</option>
                                                <option value="high">High - Shows uncertainty ("I think...", "let's check")</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Cognitive Load/Content Parameters */}
                                    <div className="ai-setting-group">
                                        <h4 className="ai-setting-section-header">🧠 Cognitive Load/Content Parameters</h4>
                                        
                                        <div className="ai-parameter-row">
                                            <label className="ai-parameter-label">
                                                Concept Density
                                                <span className="ai-setting-optional">({conceptDensity})</span>
                                            </label>
                                            <select
                                                value={conceptDensity}
                                                onChange={(e) => setConceptDensity(e.target.value as 'low' | 'high')}
                                                disabled={isSaving || loadingAI}
                                                className="ai-parameter-select"
                                            >
                                                <option value="low">Low - One idea per response</option>
                                                <option value="high">High - Multiple concepts together</option>
                                            </select>
                                        </div>

                                        <div className="ai-parameter-row">
                                            <label className="ai-parameter-label">
                                                Perspective Taking
                                                <span className="ai-setting-optional">({perspectiveTaking})</span>
                                            </label>
                                            <select
                                                value={perspectiveTaking}
                                                onChange={(e) => setPerspectiveTaking(e.target.value as 'low' | 'high')}
                                                disabled={isSaving || loadingAI}
                                                className="ai-parameter-select"
                                            >
                                                <option value="low">Low - No perspective prompts</option>
                                                <option value="high">High - Frequent perspective shifts ("Imagine you're the scammer...")</option>
                                            </select>
                                        </div>

                                        <div className="ai-parameter-row">
                                            <label className="ai-parameter-label">
                                                Personal Examples
                                                <span className="ai-setting-optional">({personalExamples})</span>
                                            </label>
                                            <select
                                                value={personalExamples}
                                                onChange={(e) => setPersonalExamples(e.target.value as 'low' | 'high')}
                                                disabled={isSaving || loadingAI}
                                                className="ai-parameter-select"
                                            >
                                                <option value="low">Low - Generic scenarios</option>
                                                <option value="high">High - Relatable personal stories</option>
                                            </select>
                                        </div>

                                        <div className="ai-parameter-row">
                                            <label className="ai-parameter-label">
                                                Consequence Highlighting
                                                <span className="ai-setting-optional">({consequenceHighlighting})</span>
                                            </label>
                                            <select
                                                value={consequenceHighlighting}
                                                onChange={(e) => setConsequenceHighlighting(e.target.value as 'low' | 'high')}
                                                disabled={isSaving || loadingAI}
                                                className="ai-parameter-select"
                                            >
                                                <option value="low">Low - Minimal consequence focus</option>
                                                <option value="high">High - Explicit consequence discussion</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Emotional Design Parameters */}
                                    <div className="ai-setting-group">
                                        <h4 className="ai-setting-section-header">❤️ Emotional Design Parameters</h4>
                                        
                                        <div className="ai-parameter-row">
                                            <label className="ai-parameter-label">
                                                Enthusiasm Level
                                                <span className="ai-setting-optional">({enthusiasmLevel})</span>
                                            </label>
                                            <select
                                                value={enthusiasmLevel}
                                                onChange={(e) => setEnthusiasmLevel(e.target.value as 'low' | 'high')}
                                                disabled={isSaving || loadingAI}
                                                className="ai-parameter-select"
                                            >
                                                <option value="low">Low - Neutral, measured tone</option>
                                                <option value="high">High - High energy, excited ("YES! Absolutely nailed it!")</option>
                                            </select>
                                        </div>

                                        <div className="ai-parameter-row">
                                            <label className="ai-parameter-label">
                                                Validation Frequency
                                                <span className="ai-setting-optional">({validationFrequency})</span>
                                            </label>
                                            <select
                                                value={validationFrequency}
                                                onChange={(e) => setValidationFrequency(e.target.value as 'low' | 'high')}
                                                disabled={isSaving || loadingAI}
                                                className="ai-parameter-select"
                                            >
                                                <option value="low">Low - Minimal emotional validation</option>
                                                <option value="high">High - Frequent validation ("I totally get why you'd think that...")</option>
                                            </select>
                                        </div>

                                        <div className="ai-parameter-row">
                                            <label className="ai-parameter-label">
                                                Mistake Normalization
                                                <span className="ai-setting-optional">({mistakeNormalization})</span>
                                            </label>
                                            <select
                                                value={mistakeNormalization}
                                                onChange={(e) => setMistakeNormalization(e.target.value as 'low' | 'high')}
                                                disabled={isSaving || loadingAI}
                                                className="ai-parameter-select"
                                            >
                                                <option value="low">Low - Direct correction</option>
                                                <option value="high">High - Mistakes as learning ("Don't worry - this scam fools tons of people")</option>
                                            </select>
                                        </div>

                                        <div className="ai-parameter-row">
                                            <label className="ai-parameter-label">
                                                Confidence Building
                                                <span className="ai-setting-optional">({confidenceBuilding})</span>
                                            </label>
                                            <select
                                                value={confidenceBuilding}
                                                onChange={(e) => setConfidenceBuilding(e.target.value as 'low' | 'high')}
                                                disabled={isSaving || loadingAI}
                                                className="ai-parameter-select"
                                            >
                                                <option value="low">Low - Task-focused only</option>
                                                <option value="high">High - Explicit confidence building ("You're getting really good at this!")</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="ai-setting-group">
                                <label className="ai-setting-label">
                                    System Prompt
                                    <span className="ai-setting-optional">
                                        {useModularPrompts ? "(Auto-generated from template)" : "(Instructions for the AI)"}
                                    </span>
                                </label>
                                <textarea
                                    value={systemPrompt}
                                    onChange={(e) => setSystemPrompt(e.target.value)}
                                    disabled={isSaving || loadingAI || useModularPrompts}
                                    className="ai-setting-textarea"
                                    placeholder="Enter instructions for how the AI should behave..."
                                    rows={useModularPrompts ? 8 : 4}
                                />
                                {useModularPrompts && (
                                    <p className="ai-setting-description">
                                        This prompt is automatically generated from your template selections above. 
                                        Uncheck "Use Phishing Training Templates" to edit manually.
                                    </p>
                                )}
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
