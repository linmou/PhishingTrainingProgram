import { AIResponse, ConversationMessage, AIAssistantConfig } from '../types';
import { supabase } from './supabase';

// Available AI models for the dummy service
export const AI_MODELS = {
    'gpt-4': {
        name: 'GPT-4',
        description: 'Most capable model for complex reasoning',
        maxTokens: 4000,
        temperature: 0.7
    },
    'gpt-3.5-turbo': {
        name: 'GPT-3.5 Turbo',
        description: 'Fast and efficient for most tasks',
        maxTokens: 2000,
        temperature: 0.7
    },
    'claude-3': {
        name: 'Claude 3',
        description: 'Excellent for educational content',
        maxTokens: 3000,
        temperature: 0.6
    }
} as const;

export type AIModelName = keyof typeof AI_MODELS;

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

/**
 * Simulates an AI API call with realistic delay and responses
 */
export class DummyAIService {
    private static getRandomResponse(category: keyof typeof DUMMY_RESPONSES): string {
        const responses = DUMMY_RESPONSES[category];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    private static determineResponseCategory(userMessage: string): keyof typeof DUMMY_RESPONSES {
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
 * Initialize AI assistant for a room
 */
export const initializeAIAssistant = async (
    roomId: string,
    modelName: string = 'gpt-3.5-turbo',
    systemPrompt?: string
): Promise<string> => {
    const defaultPrompt = systemPrompt ||
        'You are a helpful AI assistant in an educational tutoring session. ' +
        'Provide clear, educational responses to help students learn. ' +
        'Be encouraging, patient, and focus on building understanding.';

    const { data, error } = await supabase.rpc('initialize_ai_assistant', {
        p_room_id: roomId,
        p_model_name: modelName,
        p_system_prompt: defaultPrompt
    });

    if (error) {
        throw new Error(`Failed to initialize AI assistant: ${error.message}`);
    }

    return data;
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
 * Get conversation history for AI context
 */
export const getConversationContext = async (roomId: string): Promise<ConversationMessage[]> => {
    const { data, error } = await supabase
        .from('ai_conversation_contexts')
        .select('conversation_history')
        .eq('room_id', roomId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return []; // No context found
        }
        throw new Error(`Failed to get conversation context: ${error.message}`);
    }

    return data.conversation_history as ConversationMessage[];
};

/**
 * Add message to conversation context
 */
export const addToConversationContext = async (
    roomId: string,
    role: 'user' | 'assistant' | 'system',
    content: string
): Promise<void> => {
    const { error } = await supabase.rpc('add_conversation_context', {
        p_room_id: roomId,
        p_role: role,
        p_content: content
    });

    if (error) {
        throw new Error(`Failed to add conversation context: ${error.message}`);
    }
};

/**
 * Generate AI response and save to database
 */
export const generateAndSaveAIResponse = async (
    roomId: string,
    userId: string,
    userMessage?: string,
    parentMessageId?: string
): Promise<string> => {
    // Get AI configuration
    const aiConfig = await getAIConfig(roomId);
    if (!aiConfig || !aiConfig.is_active) {
        throw new Error('AI assistant is not enabled for this room');
    }

    // Get conversation history
    const conversationHistory = await getConversationContext(roomId);

    // Use provided message or get the latest message from the room
    let prompt = userMessage;
    if (!prompt && parentMessageId) {
        const { data: parentMessage, error } = await supabase
            .from('messages')
            .select('content')
            .eq('id', parentMessageId)
            .single();

        if (!error && parentMessage) {
            prompt = parentMessage.content;
        }
    }

    if (!prompt) {
        prompt = "Please provide a helpful response to continue our conversation.";
    }

    // Generate AI response
    const aiResponse = await DummyAIService.generateResponse(
        prompt,
        conversationHistory,
        aiConfig
    );

    if (!aiResponse.success) {
        throw new Error(aiResponse.error || 'Failed to generate AI response');
    }

    // Save the AI response as a message
    const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
            room_id: roomId,
            user_id: userId, // Use the tutor's ID
            content: aiResponse.content,
            user_role: 'tutor', // AI responses are sent as tutor
            is_ai_generated: true,
            ai_model_used: aiResponse.model_used,
            ai_response_time_ms: aiResponse.response_time_ms,
            parent_message_id: parentMessageId
        })
        .select()
        .single();

    if (messageError) {
        throw new Error(`Failed to save AI response: ${messageError.message}`);
    }

    // Add to conversation context
    await addToConversationContext(roomId, 'user', prompt);
    await addToConversationContext(roomId, 'assistant', aiResponse.content);

    return messageData.id;
}; 