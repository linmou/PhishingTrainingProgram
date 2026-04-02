/**
 * AI Service - Refactored for Better Organization
 * 
 * Architecture:
 * 1. AI Configuration Management - handles config loading/creation/updates
 * 2. System Prompt Processing - handles prompt generation and parameter overrides
 * 3. AI Response Services - handles actual AI API calls
 * 4. Public API - clean interface for external usage
 */

import { AIConfigChangeLog, AIResponse, ConversationMessage, AIAssistantConfig, AIAssistantConfigSnapshot } from '../types';
import { supabase } from './supabase';
import { generateSystemPrompt, PRESET_CONFIGS } from './systemPrompts';
import { SCENARIO_TEMPLATES, ScenarioTemplate } from './detectionTemplates';
import { buildAIContextFromExistingData } from './simplifiedAIContext';

// ============================================================================
// CONSTANTS AND TYPES
// ============================================================================

const OAI_API_KEY = process.env.REACT_APP_OAI_API_KEY;
const OAI_BASE_URL = process.env.REACT_APP_OAI_BASE_URL || 'https://api.openai.com/v1';
const getRuntimeEnvironment = (): 'debug' | 'production' =>
    process.env.REACT_APP_ENVIRONMENT === 'debug' ? 'debug' : 'production';
const shouldTolerateAuditLogFailure = (): boolean => getRuntimeEnvironment() === 'debug';

export const AI_MODELS = {
    'gpt-4o': {
        name: 'GPT-4o',
        description: 'Most capable multimodal model for complex reasoning',
        maxTokens: 4000,
        temperature: 0.7
    },
    'gpt-4': {
        name: 'GPT-4',
        description: 'Highly capable model for complex reasoning',
        maxTokens: 4000,
        temperature: 0.7
    }
} as const;

export type AIModelName = keyof typeof AI_MODELS;

interface ParameterOverrides {
    role?: { role: 'low' | 'high' };
    communication_style?: any;
    cognitive_parameters?: any;
    emotional_parameters?: any;
    detection_areas?: string[];
    verification_steps?: string[];
    temperature?: number;
    max_tokens?: number;
}

type AppliedConfigSnapshot = AIAssistantConfigSnapshot;

interface ProcessedAIConfig extends AIAssistantConfig {
    isLegacy: boolean;
    needsUpgrade: boolean;
}

const stripWrappedQuotes = (value: string): string => {
    const trimmed = value.trim();

    if (trimmed.length < 2) {
        return value;
    }

    const firstChar = trimmed[0];
    const lastChar = trimmed[trimmed.length - 1];
    const hasWrappingQuotes = (
        (firstChar === '"' && lastChar === '"') ||
        (firstChar === '\'' && lastChar === '\'')
    );

    if (!hasWrappingQuotes) {
        return value;
    }

    const innerContent = trimmed.slice(1, -1);
    if (innerContent.includes('\n')) {
        return value;
    }

    return innerContent.trim();
};

const getExtendedAIConfig = async (roomId: string): Promise<{
    prompt_config?: AIAssistantConfig['prompt_config'];
    temperature?: number;
    max_tokens?: number;
} | null> => {
    try {
        const { data, error } = await (supabase as any)
            .from('ai_assistant_configs')
            .select('prompt_config, temperature, max_tokens')
            .eq('room_id', roomId)
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }

            console.warn('Failed to load extended AI config, falling back to room fields:', error);
            return null;
        }

        return data || null;
    } catch (error) {
        console.warn('Extended AI config lookup failed, falling back to room fields:', error);
        return null;
    }
};

const buildConfigSnapshot = ({
    roomModelName,
    roomPrompt,
    promptConfig,
    temperature,
    maxTokens,
    isActive
}: {
    roomModelName: string | null | undefined;
    roomPrompt: string | null | undefined;
    promptConfig: AIAssistantConfig['prompt_config'] | null | undefined;
    temperature: number | null | undefined;
    maxTokens: number | null | undefined;
    isActive: boolean;
}): AIAssistantConfigSnapshot => ({
    model_name: roomModelName ?? null,
    system_prompt: roomPrompt ?? null,
    prompt_config: promptConfig ?? null,
    temperature: temperature ?? null,
    max_tokens: maxTokens ?? null,
    is_active: isActive
});

const getCurrentAIConfigSnapshot = async (roomId: string): Promise<AIAssistantConfigSnapshot | null> => {
    const { data: room, error } = await supabase
        .from('rooms')
        .select('id, ai_assistant_enabled, ai_assistant_model, ai_assistant_prompt')
        .eq('id', roomId)
        .single();

    if (error) {
        throw new Error(`Failed to load current AI room config: ${error.message}`);
    }

    const extendedConfig = await getExtendedAIConfig(roomId);

    return buildConfigSnapshot({
        roomModelName: room.ai_assistant_model,
        roomPrompt: room.ai_assistant_prompt,
        promptConfig: extendedConfig?.prompt_config ?? null,
        temperature: extendedConfig?.temperature ?? (room.ai_assistant_enabled ? 0.7 : null),
        maxTokens: extendedConfig?.max_tokens ?? (room.ai_assistant_enabled ? 150 : null),
        isActive: Boolean(room.ai_assistant_enabled)
    });
};

const getChangedConfigFields = (
    previousConfig: AIAssistantConfigSnapshot,
    nextConfig: AIAssistantConfigSnapshot
): string[] => {
    const fields: Array<keyof AIAssistantConfigSnapshot> = [
        'model_name',
        'system_prompt',
        'prompt_config',
        'temperature',
        'max_tokens',
        'is_active'
    ];

    return fields.filter((field) => JSON.stringify(previousConfig[field]) !== JSON.stringify(nextConfig[field]));
};

const recordAIConfigChange = async ({
    roomId,
    changedByUserId,
    changeReason,
    previousConfig,
    nextConfig
}: {
    roomId: string;
    changedByUserId: string;
    changeReason: string;
    previousConfig: AIAssistantConfigSnapshot;
    nextConfig: AIAssistantConfigSnapshot;
}): Promise<void> => {
    const changedFields = getChangedConfigFields(previousConfig, nextConfig);

    if (!changedFields.length) {
        return;
    }

    const { error } = await (supabase as any)
        .from('ai_assistant_config_logs')
        .insert({
            room_id: roomId,
            changed_by_user_id: changedByUserId,
            change_reason: changeReason,
            changed_fields: changedFields,
            previous_config: previousConfig,
            new_config: nextConfig,
            changed_at: new Date().toISOString()
        });

    if (error) {
        const errorMessage =
            (typeof error?.message === 'string' && error.message.trim()) ||
            (typeof error?.code === 'string' && error.code.trim()) ||
            'Unknown logging error';
        throw new Error(`Failed to record AI config change: ${errorMessage}`);
    }
};

const persistExtendedAIConfig = async (
    roomId: string,
    updates: Partial<Pick<AIAssistantConfig, 'model_name' | 'system_prompt' | 'prompt_config' | 'temperature' | 'max_tokens' | 'is_active'>>
): Promise<void> => {
    const { data: existingConfig, error: existingError } = await (supabase as any)
        .from('ai_assistant_configs')
        .select('id')
        .eq('room_id', roomId)
        .single();

    if (existingError && existingError.code !== 'PGRST116') {
        throw new Error(`Failed to load persisted AI config: ${existingError.message}`);
    }

    const configPayload = {
        room_id: roomId,
        model_name: updates.model_name || 'gpt-4o',
        system_prompt: updates.system_prompt ?? null,
        prompt_config: updates.prompt_config ?? null,
        temperature: updates.temperature ?? 0.7,
        max_tokens: updates.max_tokens ?? 150,
        is_active: updates.is_active ?? true,
        updated_at: new Date().toISOString()
    };

    if (existingConfig?.id) {
        const { error } = await (supabase as any)
            .from('ai_assistant_configs')
            .update(configPayload)
            .eq('id', existingConfig.id);

        if (error) {
            throw new Error(`Failed to persist AI config: ${error.message}`);
        }

        return;
    }

    const { error } = await (supabase as any)
        .from('ai_assistant_configs')
        .insert({
            ...configPayload,
            created_at: new Date().toISOString()
        });

    if (error) {
        throw new Error(`Failed to persist AI config: ${error.message}`);
    }
};

// ============================================================================
// 1. AI CONFIGURATION MANAGEMENT
// ============================================================================

class AIConfigurationManager {
    /**
     * Load AI configuration for a room, handling various edge cases
     */
    static async loadConfig(roomId: string, roomData: any): Promise<ProcessedAIConfig> {
        const config = await getAIConfig(roomId);
        
        if (!config) {
            console.log('⚠️ No AI config found for room, creating default configuration');
            return this.createDefaultConfig(roomId, roomData);
        }

        if (this.isLegacyConfig(config)) {
            console.log('🔄 Legacy AI config detected, upgrading to modern format');
            return this.upgradeLegacyConfig(config);
        }

        return {
            ...config,
            isLegacy: false,
            needsUpgrade: false
        };
    }

    /**
     * Create a proper default configuration with structured prompt
     */
    static createDefaultConfig(roomId: string, roomData: any): ProcessedAIConfig {
        const defaultConfig = PRESET_CONFIGS.supportive_adult;
        const detectionAreas = ['Suspicious links', 'Urgent language', 'Unexpected requests'];
        const verificationSteps = ['Check sender authenticity', 'Verify through official channels', 'Think before clicking'];

        const systemPrompt = generateSystemPrompt({
            ...defaultConfig,
            detection_areas: detectionAreas,
            verification_steps: verificationSteps
        });

        return {
            id: roomId,
            room_id: roomId,
            model_name: roomData.ai_assistant_model || 'gpt-4o',
            system_prompt: systemPrompt,
            prompt_config: {
                ...defaultConfig,
                detection_areas: detectionAreas,
                verification_steps: verificationSteps
            },
            temperature: 0.7,
            max_tokens: 100,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            isLegacy: false,
            needsUpgrade: false
        };
    }

    /**
     * Upgrade legacy configuration to modern format
     */
    static upgradeLegacyConfig(legacyConfig: AIAssistantConfig): ProcessedAIConfig {
        const defaultConfig = PRESET_CONFIGS.supportive_adult;
        const detectionAreas = ['Suspicious links', 'Urgent language', 'Unexpected requests'];
        const verificationSteps = ['Check sender authenticity', 'Verify through official channels', 'Think before clicking'];

        const fallbackSystemPrompt = generateSystemPrompt({
            ...defaultConfig,
            detection_areas: detectionAreas,
            verification_steps: verificationSteps
        });

        return {
            ...legacyConfig,
            system_prompt: legacyConfig.system_prompt || fallbackSystemPrompt,
            prompt_config: {
                ...defaultConfig,
                detection_areas: detectionAreas,
                verification_steps: verificationSteps
            },
            isLegacy: true,
            needsUpgrade: true
        };
    }

    /**
     * Check if a config is legacy (missing prompt_config)
     */
    static isLegacyConfig(config: AIAssistantConfig): boolean {
        return !config.prompt_config;
    }
}

// ============================================================================
// 2. SYSTEM PROMPT PROCESSING
// ============================================================================

class SystemPromptProcessor {
    /**
     * Process parameter overrides and generate new system prompt if needed
     */
    static processOverrides(config: ProcessedAIConfig, overrides?: ParameterOverrides): ProcessedAIConfig {
        if (!overrides || Object.keys(overrides).length === 0) {
            return config;
        }

        console.log('🔧 Applying parameter overrides:', overrides);

        if (!config.prompt_config) {
            console.log('⚠️ No prompt_config available, applying only direct parameter overrides');
            return this.applyDirectOverrides(config, overrides);
        }

        console.log('📄 Using stored prompt configuration for parameter overrides');
        return this.applyStructuredOverrides(config, overrides);
    }

    /**
     * Apply parameter overrides using structured prompt configuration
     */
    static applyStructuredOverrides(config: ProcessedAIConfig, overrides: ParameterOverrides): ProcessedAIConfig {
        // Ensure we have a valid base config - use default if prompt_config is somehow invalid
        if (!config.prompt_config) {
            console.warn('⚠️ prompt_config is missing, using default configuration');
            config.prompt_config = {
                ...PRESET_CONFIGS.supportive_adult,
                detection_areas: ['Suspicious links', 'Urgent language', 'Unexpected requests'],
                verification_steps: ['Check sender authenticity', 'Verify through official channels', 'Think before clicking']
            };
        }

        // Merge stored config with parameter overrides - ensure all required fields exist
        const mergedConfig = {
            ...config.prompt_config,
            // Ensure required fields have defaults
            role: config.prompt_config.role || { role: 'high' as const },
            communication_style: config.prompt_config.communication_style || PRESET_CONFIGS.supportive_adult.communication_style,
            cognitive_parameters: config.prompt_config.cognitive_parameters || PRESET_CONFIGS.supportive_adult.cognitive_parameters,
            emotional_parameters: config.prompt_config.emotional_parameters || PRESET_CONFIGS.supportive_adult.emotional_parameters,
            detection_areas: config.prompt_config.detection_areas || [],
            verification_steps: config.prompt_config.verification_steps || []
        };

        // Apply individual parameter overrides
        if (overrides.role) mergedConfig.role = overrides.role;
        if (overrides.communication_style) mergedConfig.communication_style = { ...mergedConfig.communication_style, ...overrides.communication_style };
        if (overrides.cognitive_parameters) mergedConfig.cognitive_parameters = { ...mergedConfig.cognitive_parameters, ...overrides.cognitive_parameters };
        if (overrides.emotional_parameters) mergedConfig.emotional_parameters = { ...mergedConfig.emotional_parameters, ...overrides.emotional_parameters };
        if (overrides.detection_areas) mergedConfig.detection_areas = overrides.detection_areas;
        if (overrides.verification_steps) mergedConfig.verification_steps = overrides.verification_steps;

        console.log('🔄 Applied parameter overrides to stored configuration');

        // Generate new system prompt with merged configuration
        const newSystemPrompt = generateSystemPrompt(mergedConfig);
        console.log('✨ Generated new system prompt from clean configuration');

        return {
            ...config,
            prompt_config: mergedConfig,
            system_prompt: newSystemPrompt,
            temperature: overrides.temperature ?? config.temperature,
            max_tokens: overrides.max_tokens ?? config.max_tokens
        };
    }

    /**
     * Apply only direct parameter overrides (fallback for configs without prompt_config)
     */
    static applyDirectOverrides(config: ProcessedAIConfig, overrides: ParameterOverrides): ProcessedAIConfig {
        return {
            ...config,
            temperature: overrides.temperature ?? config.temperature,
            max_tokens: overrides.max_tokens ?? config.max_tokens
        };
    }
}

// ============================================================================
// 3. AI RESPONSE SERVICES
// ============================================================================

/**
 * Real OpenAI API Service
 */
export class OpenAIService {
    static async generateResponse(
        userMessage: string,
        conversationHistory: ConversationMessage[],
        config: AIAssistantConfig
    ): Promise<AIResponse> {
        const startTime = Date.now();

        try {
            const messages = [
                {
                    role: 'system',
                    content: config.system_prompt || 'You are a helpful AI assistant in an educational tutoring session.'
                },
                ...conversationHistory.slice(-10).map(msg => ({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                })),
                {
                    role: 'user',
                    content: userMessage
                }
            ];

            const response = await fetch(`${OAI_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: config.model_name,
                    messages,
                    temperature: config.temperature,
                    max_tokens: config.max_tokens
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenAI API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            const responseContent = stripWrappedQuotes(data.choices[0]?.message?.content || '');
            const responseTime = Date.now() - startTime;

            return {
                content: responseContent,
                model_used: config.model_name,
                response_time_ms: responseTime,
                success: true
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;

            return {
                content: '',
                model_used: config.model_name,
                response_time_ms: responseTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
}

/**
 * Tutor Suggestion Service
 */
export class TutorSuggestionService {
    static async generateSuggestion(
        conversationHistory: ConversationMessage[],
        config: AIAssistantConfig
    ): Promise<{ suggestion: string; success: boolean; error?: string }> {
        try {
            const conversationText = conversationHistory
                .slice(-10)
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');

            const systemPrompt = config.system_prompt ||
                'You are a helpful AI assistant in an educational tutoring session. Provide clear, educational responses to help students learn. Be encouraging, patient, and focus on building understanding.';

            const messages = [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: `Based on the recent conversation below, suggest a brief follow-up question or prompt that a tutor could use to engage the student further. The suggestion should be under 2 sentences, interactive, and focused on deepening the student's understanding.\n\nRecent conversation:\n${conversationText}\n\nTutor suggestion:`
                }
            ];

            const response = await fetch(`${OAI_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: config.model_name,
                    messages,
                    temperature: 0.7,
                    max_tokens: 100
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenAI API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            const suggestion = stripWrappedQuotes(data.choices[0]?.message?.content || '');

            return {
                suggestion,
                success: true
            };

        } catch (error) {
            return {
                suggestion: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    static generateDummySuggestion(category: 'educational' | 'encouragement' | 'clarification'): string {
        const responses = {
            educational: [
                "Let's explore this concept together. Can you tell me what you already know about it?",
                "That's an interesting question. Let me guide you through the key concepts.",
                "I'll help you understand this better. First, let's start with the basics.",
                "Good thinking! Let's work through this step by step.",
                "This is a common challenge. Let me show you a helpful approach."
            ],
            encouragement: [
                "You're doing great! Let's keep building on your understanding.",
                "Excellent progress! What would you like to explore next?",
                "That's the right idea! Can you expand on that thought?",
                "Well done! You're really getting the hang of this.",
                "I'm impressed with your thinking. Let's dive deeper."
            ],
            clarification: [
                "I see where the confusion might be. Let me help clarify.",
                "Let's approach this from a different angle. What if we consider...",
                "That's a common area of confusion. The key difference is...",
                "Almost there! Let me help you connect the final pieces.",
                "Good attempt! Let me guide you to the complete understanding."
            ]
        };

        const categoryResponses = responses[category];
        return categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
    }
}

/**
 * Dummy AI Service for testing/fallback
 */
export class DummyAIService {
    static determineResponseCategory(userMessage: string): 'educational' | 'encouragement' | 'clarification' {
        const message = userMessage.toLowerCase();

        if (message.includes('?') || message.includes('how') || message.includes('what') || message.includes('why')) {
            return 'educational';
        }

        if (message.includes('difficult') || message.includes('hard') || message.includes('confused')) {
            return 'clarification';
        }

        return Math.random() > 0.7 ? 'encouragement' : 'educational';
    }

    static async generateResponse(
        userMessage: string,
        conversationHistory: ConversationMessage[],
        config: AIAssistantConfig
    ): Promise<AIResponse> {
        // Simulate API call delay
        const delay = Math.random() * 1500 + 500;
        const startTime = Date.now();

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            // Simulate occasional failures
            if (Math.random() < 0.05) {
                throw new Error('AI service temporarily unavailable');
            }

            const category = this.determineResponseCategory(userMessage);
            const responses = {
                educational: [
                    "That's a great question! Let me break this down for you step by step...",
                    "I can help you understand this concept better. Here's how it works...",
                    "This is an important topic in your studies. Let me explain the key points..."
                ],
                encouragement: [
                    "You're making excellent progress! Keep up the good work.",
                    "That's exactly the right approach. You're thinking about this correctly.",
                    "Great question! Asking questions like this shows you're really engaged."
                ],
                clarification: [
                    "Let me clarify that point for you...",
                    "I think there might be some confusion here. Let me explain...",
                    "That's a common misconception. The actual explanation is..."
                ]
            };

            const categoryResponses = responses[category];
            const responseContent = categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
            const responseTime = Date.now() - startTime;

            return {
                content: responseContent,
                model_used: config.model_name,
                response_time_ms: responseTime,
                success: true
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;

            return {
                content: '',
                model_used: config.model_name,
                response_time_ms: responseTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
}

// ============================================================================
// 4. PUBLIC API - CLEAN INTERFACE
// ============================================================================

/**
 * Generate tutor suggestion with parameter overrides
 * Main entry point for the Quick Adjust feature
 */
export const generateTutorSuggestion = async (
    roomId: string,
    userId: string,
    parameterOverrides?: ParameterOverrides
): Promise<{
    suggestion: string;
    success: boolean;
    error?: string;
    contextMessages: string[];
    appliedConfig?: AppliedConfigSnapshot;
}> => {
    try {
        // 1. Validate room and get basic data
        const roomData = await validateRoom(roomId);
        
        // 2. Load and process AI configuration
        let aiConfig = await AIConfigurationManager.loadConfig(roomId, roomData);
        
        // 3. Apply parameter overrides if provided
        aiConfig = SystemPromptProcessor.processOverrides(aiConfig, parameterOverrides);
        
        // 4. Log final configuration being used
        console.log('📋 Using AI config with system prompt:', aiConfig.system_prompt?.substring(0, 100) + '...');
        
        // 5. Get conversation history
        const conversationHistory = await buildAIContextFromExistingData(roomId);
        console.log(`📚 Conversation history length: ${conversationHistory.length} messages`);
        
        // 6. Generate suggestion using appropriate service
        const suggestionResult = await generateSuggestionWithService(conversationHistory, aiConfig);
        
        // 7. Get context messages for tracking
        const contextMessages = await getContextMessages(roomId);
        
        return {
            ...suggestionResult,
            suggestion: stripWrappedQuotes(suggestionResult.suggestion),
            appliedConfig: {
                model_name: aiConfig.model_name,
                system_prompt: aiConfig.system_prompt,
                prompt_config: aiConfig.prompt_config ?? null,
                temperature: aiConfig.temperature,
                max_tokens: aiConfig.max_tokens,
                is_active: aiConfig.is_active
            },
            contextMessages
        };

    } catch (error) {
        console.error('Failed to generate tutor suggestion:', error);
        return {
            suggestion: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            contextMessages: []
        };
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate room and check AI assistant status
 */
async function validateRoom(roomId: string) {
    const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('ai_assistant_enabled, ai_assistant_model')
        .eq('id', roomId)
        .single();

    if (roomError || !roomData?.ai_assistant_enabled) {
        throw new Error('AI assistant is not enabled for this room');
    }

    return roomData;
}

/**
 * Generate suggestion using the appropriate service (OpenAI or Dummy)
 */
async function generateSuggestionWithService(
    conversationHistory: ConversationMessage[],
    aiConfig: AIAssistantConfig
) {
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    const category = lastMessage ? DummyAIService.determineResponseCategory(lastMessage.content) : 'educational';

    if (OAI_API_KEY) {
        console.log('Using OpenAI API for tutor suggestions');
        const result = await TutorSuggestionService.generateSuggestion(conversationHistory, aiConfig);

        if (result.success) {
            return result;
        }

        console.warn('OpenAI tutor suggestion failed, falling back to dummy suggestion:', result.error);
    }

    console.log('Using Dummy Service for tutor suggestions');
    const suggestion = TutorSuggestionService.generateDummySuggestion(category);
    return { suggestion, success: true };
}

/**
 * Get context messages for tracking purposes
 */
async function getContextMessages(roomId: string): Promise<string[]> {
    const { data: contextMessagesData } = await supabase
        .from('messages')
        .select('id')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(5);

    return contextMessagesData?.map(m => m.id) || [];
}

// ============================================================================
// LEGACY FUNCTIONS - MAINTAINED FOR BACKWARD COMPATIBILITY
// ============================================================================

/**
 * Get AI assistant configuration for a room
 */
export const getAIConfig = async (roomId: string): Promise<AIAssistantConfig | null> => {
    const { data: room, error } = await supabase
        .from('rooms')
        .select('id, ai_assistant_enabled, ai_assistant_model, ai_assistant_prompt, created_at, updated_at')
        .eq('id', roomId)
        .single();

    if (error) {
        throw new Error(`Failed to get AI config: ${error.message}`);
    }

    if (!room?.ai_assistant_enabled) {
        return null;
    }

    const extendedConfig = await getExtendedAIConfig(roomId);

    return {
        id: room.id,
        room_id: room.id,
        model_name: room.ai_assistant_model || 'gpt-4o',
        system_prompt: room.ai_assistant_prompt,
        prompt_config: extendedConfig?.prompt_config ?? null,
        temperature: extendedConfig?.temperature ?? 0.7,
        max_tokens: extendedConfig?.max_tokens ?? 150,
        is_active: true,
        created_at: room.created_at || new Date().toISOString(),
        updated_at: room.updated_at || new Date().toISOString()
    };
};

/**
 * Initialize AI assistant for a room with modular system prompts
 */
export const initializeAIAssistant = async (
    roomId: string,
    modelName: string = 'gpt-4o',
    systemPrompt?: string,
    userId?: string,
    promptConfig?: {
        role?: 'peer' | 'trusted_adult';
        scenario?: ScenarioTemplate;
        communication_style?: any;
        cognitive_parameters?: any;
        emotional_parameters?: any;
        custom_detection_areas?: string[];
        custom_verification_steps?: string[];
    }
): Promise<string> => {
    let finalSystemPrompt = systemPrompt;
    let finalPromptConfig = null;

    // Generate system prompt from config if needed
    if (!finalSystemPrompt && promptConfig) {
        const scenario = promptConfig.scenario ? SCENARIO_TEMPLATES[promptConfig.scenario] : null;
        const detectionAreas = promptConfig.custom_detection_areas || scenario?.detection_areas || [];
        const verificationSteps = promptConfig.custom_verification_steps || scenario?.verification_steps || [];

        finalPromptConfig = {
            role: {
                role: (promptConfig.role === 'peer' ? 'low' : 'high') as 'low' | 'high'
            },
            communication_style: promptConfig.communication_style || PRESET_CONFIGS.supportive_adult.communication_style,
            cognitive_parameters: promptConfig.cognitive_parameters || PRESET_CONFIGS.supportive_adult.cognitive_parameters,
            emotional_parameters: promptConfig.emotional_parameters || PRESET_CONFIGS.supportive_adult.emotional_parameters,
            detection_areas: detectionAreas,
            verification_steps: verificationSteps
        };

        finalSystemPrompt = generateSystemPrompt(finalPromptConfig);
    }

    const defaultPrompt = finalSystemPrompt ||
        'You are a helpful AI assistant in an educational tutoring session. ' +
        'Provide clear, educational responses to help students learn. ' +
        'Be encouraging, patient, and focus on building understanding.';

    return await initializeAIAssistantFallback(roomId, modelName, defaultPrompt, userId, finalPromptConfig);
};

/**
 * Fallback method to initialize AI assistant without database function
 */
const initializeAIAssistantFallback = async (
    roomId: string,
    modelName: string,
    systemPrompt: string,
    userId?: string,
    promptConfig?: any
): Promise<string> => {
    // Verify room and tutor
    const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('tutor_id')
        .eq('id', roomId)
        .single();

    if (roomError) {
        console.error('Room query error:', roomError);
        throw new Error(`Failed to verify room: ${roomError.message}`);
    }

    // If userId is not provided, use the room's tutor_id
    if (!userId) {
        userId = roomData.tutor_id;
    }

    // Verify the user is the tutor
    if (roomData.tutor_id !== userId) {
        throw new Error('Only room tutors can initialize AI assistant');
    }

    const { data: updatedRoom, error: updateError } = await supabase
        .from('rooms')
        .update({
            ai_assistant_enabled: true,
            ai_assistant_model: modelName,
            ai_assistant_prompt: systemPrompt,
            updated_at: new Date().toISOString()
        })
        .eq('id', roomId)
        .select()
        .single();

    if (updateError || !updatedRoom) {
        throw new Error(`Failed to initialize AI config: ${updateError?.message || 'Room update failed'}`);
    }

    await persistExtendedAIConfig(roomId, {
        model_name: modelName,
        system_prompt: systemPrompt,
        prompt_config: promptConfig ?? null,
        temperature: 0.7,
        max_tokens: 150,
        is_active: true
    });

    return updatedRoom.id;
};

/**
 * Update AI assistant configuration
 */
export const updateAIConfig = async (
    roomId: string,
    updates: Partial<Pick<AIAssistantConfig, 'model_name' | 'system_prompt' | 'prompt_config' | 'temperature' | 'max_tokens' | 'is_active'>>,
    changedByUserId?: string,
    changeReason: string = 'settings_update'
): Promise<AIAssistantConfig> => {
    const previousConfig = changedByUserId ? await getCurrentAIConfigSnapshot(roomId) : null;
    const roomUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString()
    };

    if (typeof updates.model_name !== 'undefined') {
        roomUpdates.ai_assistant_model = updates.model_name;
    }
    if (typeof updates.system_prompt !== 'undefined') {
        roomUpdates.ai_assistant_prompt = updates.system_prompt;
    }
    if (typeof updates.is_active !== 'undefined') {
        roomUpdates.ai_assistant_enabled = updates.is_active;
    }

    const { data, error } = await supabase
        .from('rooms')
        .update(roomUpdates)
        .eq('id', roomId)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to update AI config: ${error.message}`);
    }

    await persistExtendedAIConfig(roomId, {
        model_name: data.ai_assistant_model || updates.model_name || 'gpt-4o',
        system_prompt: data.ai_assistant_prompt,
        prompt_config: updates.prompt_config ?? null,
        temperature: updates.temperature ?? 0.7,
        max_tokens: updates.max_tokens ?? 150,
        is_active: typeof updates.is_active === 'boolean' ? updates.is_active : Boolean(data.ai_assistant_enabled)
    });

    const savedConfig = {
        id: data.id,
        room_id: data.id,
        model_name: data.ai_assistant_model || updates.model_name || 'gpt-4o',
        system_prompt: data.ai_assistant_prompt,
        prompt_config: updates.prompt_config ?? null,
        temperature: updates.temperature ?? 0.7,
        max_tokens: updates.max_tokens ?? 150,
        is_active: Boolean(data.ai_assistant_enabled),
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString()
    };

    if (changedByUserId && previousConfig) {
        try {
            await recordAIConfigChange({
                roomId,
                changedByUserId,
                changeReason,
                previousConfig,
                nextConfig: buildConfigSnapshot({
                    roomModelName: savedConfig.model_name,
                    roomPrompt: savedConfig.system_prompt,
                    promptConfig: savedConfig.prompt_config ?? null,
                    temperature: savedConfig.temperature,
                    maxTokens: savedConfig.max_tokens,
                    isActive: savedConfig.is_active
                })
            });
        } catch (loggingError) {
            if (shouldTolerateAuditLogFailure()) {
                console.warn('AI config change logging failed in debug environment.', loggingError);
            } else {
                throw loggingError;
            }
        }
    }

    return savedConfig;
};

export const getAIConfigChangeHistory = async (roomId: string): Promise<AIConfigChangeLog[]> => {
    const { data, error } = await (supabase as any)
        .from('ai_assistant_config_logs')
        .select('*')
        .eq('room_id', roomId)
        .order('changed_at', { ascending: true });

    if (error) {
        throw new Error(`Failed to load AI config change history: ${error.message}`);
    }

    return data || [];
};

/**
 * Get conversation history for AI context
 */
export const getConversationContext = async (roomId: string): Promise<ConversationMessage[]> => {
    console.log('🔄 Building AI context from existing room and message data');
    return await buildAIContextFromExistingData(roomId);
};

/**
 * Add message to conversation context (simplified architecture)
 */
export const addToConversationContext = async (
    roomId: string,
    role: 'user' | 'assistant' | 'system',
    content: string
): Promise<void> => {
    console.log('✅ No separate context storage needed - messages already in messages table');
    // No action needed - conversation is built dynamically from existing data
};

/**
 * Record AI suggestion feedback (simplified)
 */
export const recordAISuggestionFeedback = async (
    roomId: string,
    tutorId: string,
    parentMessageId: string,
    aiSuggestion: string,
    tutorAction: 'accepted' | 'rejected' | 'modified' | 'ignored',
    tutorFinalResponse?: string,
    tutorMessageId?: string,
    responseTimeMs?: number,
    contextMessages?: string[]
): Promise<void> => {
    console.log('📝 AI feedback tracking simplified - using existing message patterns');
    // Feedback is tracked implicitly through whether tutors use AI suggestions or not
};

// ============================================================================
// DEPRECATED LEGACY FUNCTIONS
// ============================================================================

/**
 * @deprecated Use generateSystemPrompt from systemPrompts instead
 */
export const applyPresetConfiguration = (
    preset: 'casual_peer' | 'supportive_adult',
    scenario?: ScenarioTemplate,
    customDetectionAreas?: string[],
    customVerificationSteps?: string[]
): string => {
    const scenarioData = scenario ? SCENARIO_TEMPLATES[scenario] : null;
    const detectionAreas = customDetectionAreas || scenarioData?.detection_areas || [];
    const verificationSteps = customVerificationSteps || scenarioData?.verification_steps || [];

    const config = {
        ...PRESET_CONFIGS[preset],
        detection_areas: detectionAreas,
        verification_steps: verificationSteps
    };

    return generateSystemPrompt(config);
};

/**
 * @deprecated Legacy interface for backward compatibility
 */
export interface ExtendedAIConfig extends AIAssistantConfig {
    role?: 'peer' | 'trusted_adult';
    scenario_template?: ScenarioTemplate;
    communication_style?: any;
    cognitive_parameters?: any;
    emotional_parameters?: any;
    detection_areas?: string[];
    verification_steps?: string[];
}
