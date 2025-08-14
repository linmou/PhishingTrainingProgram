import { AIResponse, ConversationMessage, AIAssistantConfig } from '../types';
import { supabase } from './supabase';
import { generateSystemPrompt, PRESET_CONFIGS } from './systemPrompts';
import { SCENARIO_TEMPLATES, ScenarioTemplate } from './detectionTemplates';
import { buildAIContextFromExistingData } from './simplifiedAIContext';

// Get OpenAI configuration from environment variables
const OAI_API_KEY = process.env.REACT_APP_OAI_API_KEY;
const OAI_BASE_URL = process.env.REACT_APP_OAI_BASE_URL || 'https://api.openai.com/v1';

// Available AI models for the dummy service
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

// Extended AI configuration for modular prompts
export interface ExtendedAIConfig extends AIAssistantConfig {
    role?: 'peer' | 'trusted_adult';
    scenario_template?: ScenarioTemplate;
    communication_style?: any;
    cognitive_parameters?: any;
    emotional_parameters?: any;
    detection_areas?: string[];
    verification_steps?: string[];
}

/**
 * Apply preset configuration to create a complete system prompt
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

// Dummy response templates for different scenarios
const DUMMY_RESPONSES = {
    educational: [
        "That's a great question! Let me break this down for you step by step...",
        "I can help you understand this concept better. Here's how it works...",
        "This is an important topic in your studies. Let me explain the key points...",
        "Good observation! This relates to several fundamental principles...",
        "Let me provide some additional context that might be helpful..."
    ],
    encouragement: [
        "You're making excellent progress! Keep up the good work.",
        "That's exactly the right approach. You're thinking about this correctly.",
        "Great question! Asking questions like this shows you're really engaged.",
        "Your understanding is developing well. Let's build on that...",
        "I can see you're really grasping these concepts. Well done!"
    ],
    clarification: [
        "Let me clarify that point for you...",
        "I think there might be some confusion here. Let me explain...",
        "That's a common misconception. The actual explanation is...",
        "You're close! Let me help you get to the complete understanding...",
        "I see where the confusion might come from. Here's the key difference..."
    ]
};

// Suggested tutor responses for different scenarios
const SUGGESTED_RESPONSES = {
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

/**
 * Real OpenAI API Service - Core AI Response Generation
 */
export class OpenAIService {
    static async generateResponse(
        userMessage: string,
        conversationHistory: ConversationMessage[],
        config: AIAssistantConfig
    ): Promise<AIResponse> {
        const startTime = Date.now();

        try {
            // Build messages for OpenAI API
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

            // Make API request
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
            const responseContent = data.choices[0]?.message?.content || '';
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
 * Tutor Suggestion Service - Separate service for generating tutor prompts
 */
export class TutorSuggestionService {
    static async generateSuggestion(
        conversationHistory: ConversationMessage[],
        config: AIAssistantConfig
    ): Promise<{ suggestion: string; success: boolean; error?: string }> {
        const startTime = Date.now();

        try {
            // Build conversation history as a single string
            const conversationText = conversationHistory
                .slice(-10)
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');

            const messages = [
                {
                    role: 'system',
                    content: 'You are helping a tutor engage students in educational conversations. Generate brief, interactive follow-up questions or prompts.'
                },
                {
                    role: 'user',
                    content: `Here is the recent conversation:\n\n${conversationText}\n\nBased on this conversation, suggest a brief follow-up question or prompt that a tutor could use to engage the student further. Keep it under 2 sentences and focus on deepening understanding.`
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
            const suggestion = data.choices[0]?.message?.content || '';

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

    static generateDummySuggestion(
        category: keyof typeof SUGGESTED_RESPONSES
    ): string {
        const responses = SUGGESTED_RESPONSES[category];
        return responses[Math.floor(Math.random() * responses.length)];
    }
}

/**
 * Simulates an AI API call with realistic delay and responses
 */
export class DummyAIService {
    private static getRandomResponse(category: keyof typeof DUMMY_RESPONSES): string {
        const responses = DUMMY_RESPONSES[category];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    static generateSuggestedResponse(category: keyof typeof SUGGESTED_RESPONSES): string {
        const responses = SUGGESTED_RESPONSES[category];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    static determineResponseCategory(userMessage: string): keyof typeof DUMMY_RESPONSES {
        const message = userMessage.toLowerCase();

        if (message.includes('?') || message.includes('how') || message.includes('what') || message.includes('why')) {
            return 'educational';
        }

        if (message.includes('difficult') || message.includes('hard') || message.includes('confused')) {
            return 'clarification';
        }

        return Math.random() > 0.7 ? 'encouragement' : 'educational';
    }

    private static generateContextualResponse(
        userMessage: string,
        conversationHistory: ConversationMessage[],
        systemPrompt?: string
    ): string {
        const category = this.determineResponseCategory(userMessage);
        const baseResponse = this.getRandomResponse(category);

        // Add context-aware details based on the message
        const contextualAdditions = [
            "Based on our previous discussion, this connects to what we covered earlier.",
            "This builds nicely on the foundation we've established.",
            "Consider how this applies to real-world scenarios you might encounter.",
            "Think about the practical implications of this concept.",
            "This is particularly relevant for your upcoming assessments."
        ];

        // Sometimes add contextual information
        if (Math.random() > 0.5) {
            const addition = contextualAdditions[Math.floor(Math.random() * contextualAdditions.length)];
            return `${baseResponse} ${addition}`;
        }

        return baseResponse;
    }

    /**
     * Generate an AI response using dummy data
     */
    static async generateResponse(
        userMessage: string,
        conversationHistory: ConversationMessage[],
        config: AIAssistantConfig
    ): Promise<AIResponse> {
        // Simulate API call delay (500ms to 2000ms)
        const delay = Math.random() * 1500 + 500;
        const startTime = Date.now();

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            // Simulate occasional API failures (5% chance)
            if (Math.random() < 0.05) {
                throw new Error('AI service temporarily unavailable');
            }

            const responseContent = this.generateContextualResponse(
                userMessage,
                conversationHistory,
                config.system_prompt || undefined
            );

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
    
    // If no system prompt provided but config is given, generate one
    if (!finalSystemPrompt && promptConfig) {
        const scenario = promptConfig.scenario ? SCENARIO_TEMPLATES[promptConfig.scenario] : null;
        const detectionAreas = promptConfig.custom_detection_areas || scenario?.detection_areas || [];
        const verificationSteps = promptConfig.custom_verification_steps || scenario?.verification_steps || [];
        
        const config = {
            role: {
                role: (promptConfig.role === 'peer' ? 'low' : 'high') as 'low' | 'high'
            },
            communication_style: promptConfig.communication_style || PRESET_CONFIGS.supportive_adult.communication_style,
            cognitive_parameters: promptConfig.cognitive_parameters || PRESET_CONFIGS.supportive_adult.cognitive_parameters,
            emotional_parameters: promptConfig.emotional_parameters || PRESET_CONFIGS.supportive_adult.emotional_parameters,
            detection_areas: detectionAreas,
            verification_steps: verificationSteps
        };
        
        finalSystemPrompt = generateSystemPrompt(config);
    }
    
    const defaultPrompt = finalSystemPrompt ||
        'You are a helpful AI assistant in an educational tutoring session. ' +
        'Provide clear, educational responses to help students learn. ' +
        'Be encouraging, patient, and focus on building understanding.';

    try {
        // Try to use the database function
        const { data, error } = await supabase.rpc('initialize_ai_assistant', {
            p_room_id: roomId,
            p_model_name: modelName,
            p_system_prompt: defaultPrompt
        });

        if (error) {
            // If function doesn't exist, fall back to direct insert
            if (error.code === '42883' || error.message.includes('function') || error.message.includes('does not exist')) {
                return await initializeAIAssistantFallback(roomId, modelName, defaultPrompt, userId);
            }
            throw new Error(`Failed to initialize AI assistant: ${error.message}`);
        }

        return data;
    } catch (error) {
        // Fall back to direct insert
        return await initializeAIAssistantFallback(roomId, modelName, defaultPrompt, userId);
    }
};

/**
 * Fallback method to initialize AI assistant without database function
 */
const initializeAIAssistantFallback = async (
    roomId: string,
    modelName: string,
    systemPrompt: string,
    userId?: string
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

    // Create or update AI assistant config
    // First try to update existing config
    const { data: existingConfig } = await supabase
        .from('ai_assistant_configs')
        .select('id')
        .eq('room_id', roomId)
        .single();

    let configData;
    let configError;

    if (existingConfig) {
        // Update existing config
        const { data, error } = await supabase
            .from('ai_assistant_configs')
            .update({
                model_name: modelName,
                system_prompt: systemPrompt,
                is_active: true,
                updated_at: new Date().toISOString()
            })
            .eq('room_id', roomId)
            .select()
            .single();
        configData = data;
        configError = error;
    } else {
        // Insert new config
        const { data, error } = await supabase
            .from('ai_assistant_configs')
            .insert({
                room_id: roomId,
                model_name: modelName,
                system_prompt: systemPrompt,
                is_active: true
            })
            .select()
            .single();
        configData = data;
        configError = error;
    }

    if (configError) {
        throw new Error(`Failed to create AI config: ${configError.message}`);
    }

    // No separate conversation context needed - using simplified architecture

    // Enable AI assistant for the room
    await supabase
        .from('rooms')
        .update({ ai_assistant_enabled: true })
        .eq('id', roomId);

    return configData.id;
};

/**
 * Get AI assistant configuration for a room
 */
export const getAIConfig = async (roomId: string): Promise<AIAssistantConfig | null> => {
    const { data, error } = await supabase
        .from('ai_assistant_configs')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null; // No configuration found
        }
        throw new Error(`Failed to get AI config: ${error.message}`);
    }

    return data;
};

/**
 * Update AI assistant configuration
 */
export const updateAIConfig = async (
    roomId: string,
    updates: Partial<Pick<AIAssistantConfig, 'model_name' | 'system_prompt' | 'temperature' | 'max_tokens' | 'is_active'>>
): Promise<AIAssistantConfig> => {
    const { data, error } = await supabase
        .from('ai_assistant_configs')
        .update(updates)
        .eq('room_id', roomId)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to update AI config: ${error.message}`);
    }

    return data;
};

/**
 * Get conversation history for AI context (Simplified: uses existing tables)
 */
export const getConversationContext = async (roomId: string): Promise<ConversationMessage[]> => {
    console.log('🔄 Building AI context from existing room and message data');
    return await buildAIContextFromExistingData(roomId);
};

/**
 * Add message to conversation context (Simplified: no separate storage needed)
 * Messages are automatically stored in the messages table, so no additional action needed
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
 * No fallback needed - simplified architecture uses existing tables
 */

/**
 * Generate tutor suggestion only (no AI response generation)
 */
export const generateTutorSuggestion = async (
    roomId: string,
    userId: string,
    parameterOverrides?: any
): Promise<{ suggestion: string; success: boolean; error?: string; contextMessages: string[] }> => {
    // Get room data to check AI configuration
    const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('ai_assistant_enabled, ai_assistant_model')
        .eq('id', roomId)
        .single();

    if (roomError || !roomData?.ai_assistant_enabled) {
        throw new Error('AI assistant is not enabled for this room');
    }

    // Create AI config from room data for suggestion generation
    const aiConfig: AIAssistantConfig = {
        id: roomId,
        room_id: roomId,
        model_name: roomData.ai_assistant_model || 'gpt-3.5-turbo',
        system_prompt: 'Tutor suggestion system',
        temperature: 0.7,
        max_tokens: 100,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    // Get conversation history from existing room and message data
    const conversationHistory = await buildAIContextFromExistingData(roomId);
    
    console.log(`📚 Conversation history length: ${conversationHistory.length} messages`);

    // Generate tutor suggestion
    let suggestionResult;
    if (OAI_API_KEY) {
        // Use real OpenAI service for tutor suggestions
        suggestionResult = await TutorSuggestionService.generateSuggestion(
            conversationHistory,
            aiConfig
        );
    } else {
        // Use dummy service for tutor suggestions
        const lastMessage = conversationHistory[conversationHistory.length - 1];
        const category = lastMessage ? DummyAIService.determineResponseCategory(lastMessage.content) : 'educational';
        const suggestion = DummyAIService.generateSuggestedResponse(category);
        suggestionResult = { suggestion, success: true };
    }

    console.log('Suggestion Service used:', OAI_API_KEY ? 'OpenAI API' : 'Dummy Service');

    // Get context messages for tracking
    const { data: contextMessagesData } = await supabase
        .from('messages')
        .select('id')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(5);
    
    const contextMessages = contextMessagesData?.map(m => m.id) || [];

    return { 
        ...suggestionResult,
        contextMessages 
    };
};

/**
 * Simplified feedback tracking - can be implemented with existing messages table if needed
 * For now, feedback is implicit through tutor's response actions
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
    // Can be implemented later with analytics on message patterns if needed
}; 