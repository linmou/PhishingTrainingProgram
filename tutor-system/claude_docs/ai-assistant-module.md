# AI Assistant Module Documentation

## Overview

The AI Assistant module adds intelligent response generation capabilities to the tutoring system. Tutors can configure and use AI to generate educational responses during tutoring sessions, enhancing the learning experience for students.

## Architecture

### Components

1. **AI Service** (`src/services/aiService.ts`)
   - Core AI functionality and dummy API implementation
   - Configuration management
   - Database integration

2. **AI Settings Component** (`src/components/AIAssistantSettings.tsx`)
   - Configuration interface for tutors
   - Model selection and parameter tuning

3. **Chat Message Component** (`src/components/ChatMessage.tsx`)
   - Enhanced message display with AI indicators
   - AI response generation triggers

4. **Room Context Integration**
   - AI functionality integrated into room management
   - Real-time AI response handling

### Database Schema Extensions

#### New Tables

**ai_conversation_contexts**
```sql
CREATE TABLE ai_conversation_contexts (
    id UUID PRIMARY KEY,
    room_id UUID UNIQUE REFERENCES rooms(id),
    conversation_history JSONB DEFAULT '[]',
    last_updated TIMESTAMPTZ DEFAULT NOW()
);
```

#### Enhanced Tables

**rooms** - Added AI support fields:
- `ai_assistant_enabled`: Boolean flag for AI activation
- `ai_assistant_model`: Default model selection
- `ai_assistant_prompt`: Default system prompt

Runtime source of truth:
- The current application runtime stores AI enablement, model, and prompt on `rooms`
- The tutor UI reads and writes room-level AI fields directly
- Separate `ai_assistant_configs` rows are treated as legacy data, not the active runtime source

**messages** - Added AI metadata:
- `is_ai_generated`: Identifies AI-generated messages
- `ai_model_used`: Model that generated the response
- `ai_response_time_ms`: Generation time metrics
- `parent_message_id`: Reference to responded message

## Features

### 1. Dummy AI Service

Simulates real AI API behavior with:
- **Realistic Response Times**: 500-2000ms delays
- **Contextual Responses**: Different response types based on content
- **Error Simulation**: 5% failure rate for testing
- **Response Categories**:
  - Educational: For questions and explanations
  - Encouragement: For motivation
  - Clarification: For addressing confusion

### 2. AI Configuration

Per-room settings include:
- **Model Selection**: GPT-4, GPT-3.5 Turbo, Claude 3
- **System Prompts**: Custom AI behavior instructions
- **Temperature**: Creativity control (0.0-1.0)
- **Max Tokens**: Response length limits (50-500)

### 3. Conversation Context

Maintains chat history for:
- Better AI context awareness
- Consistent conversation flow
- Educational continuity

## Usage

### For Tutors

1. **Enable AI Assistant**
   - Access AI Settings in room interface
   - Toggle AI Assistant enabled
   - Configure model and parameters

2. **Generate AI Responses**
   - Click "Generate AI Response" button
   - Or click AI button on specific student messages
   - AI responds based on conversation context

3. **Customize AI Behavior**
   - Set system prompts for subject-specific responses
   - Adjust temperature for creativity level
   - Control response length with max tokens

### For Students and Observers

- AI messages appear with special purple styling
- AI responses are clearly marked with model and timing info
- No AI controls available (tutor-only feature)

## API Reference

### Core Functions

```typescript
// Generate and save AI response
generateAndSaveAIResponse(
    roomId: string,
    userId: string,
    userMessage?: string,
    parentMessageId?: string
): Promise<string>

// Initialize AI assistant for room
initializeAIAssistant(
    roomId: string,
    modelName?: string,
    systemPrompt?: string
): Promise<string>

// Get current AI configuration
getAIConfig(roomId: string): Promise<AIAssistantConfig | null>

// Update AI configuration
updateAIConfig(
    roomId: string,
    updates: Partial<AIAssistantConfig>
): Promise<AIAssistantConfig>
```

### Context Management

```typescript
// Get conversation history
getConversationContext(roomId: string): Promise<ConversationMessage[]>

// Add to conversation context
addToConversationContext(
    roomId: string,
    role: 'user' | 'assistant' | 'system',
    content: string
): Promise<void>
```

## Security

### Access Control
- Only tutors can configure AI settings
- Only tutors can generate AI responses
- AI configurations visible to all room participants
- Row Level Security enforces access controls

### Data Privacy
- Conversation history stored securely in PostgreSQL
- AI responses clearly marked in database
- No external API calls (dummy implementation)

## Integration

### Frontend Integration

The AI assistant integrates seamlessly with existing components:

**RoomContext** - Extended with AI methods:
```typescript
interface RoomContextType {
    // ... existing properties
    generateAIResponse: (prompt?: string) => Promise<void>;
    toggleAIAssistant: (enabled: boolean, config?: Partial<AIAssistantConfig>) => Promise<void>;
    aiConfig: AIAssistantConfig | null;
    loadingAI: boolean;
}
```

**Message Display** - Enhanced with AI indicators:
- Purple gradient background for AI messages
- AI badge showing model and response time
- Generate AI Response buttons on student messages

### Database Integration

All AI functionality integrates with Supabase:
- Real-time message updates include AI messages
- Room-level AI settings stored on `rooms`
- Row Level Security for access control
- JSONB storage for conversation context

## Testing

### Unit Tests

Located in `src/services/test_aiService.py`:

```python
# Test dummy AI response generation
def test_dummy_ai_response_generation()

# Test AI configuration management
def test_ai_config_management()

# Test conversation context handling
def test_conversation_context()

# Test error handling
def test_ai_error_scenarios()
```

Run tests:
```bash
cd tutor-system
python -m unittest src/services/test_aiService.py
```

### Manual Testing

1. **Enable AI Assistant**
   - Create room as tutor
   - Open AI Settings
   - Enable AI and configure settings

2. **Generate Responses**
   - Send student message
   - Click "Generate AI Response"
   - Verify AI message appears with proper styling

3. **Test Different Models**
   - Change AI model in settings
   - Generate responses and verify model name in badge

4. **Test Error Handling**
   - AI service has 5% failure rate
   - Verify error messages display properly

## Future Enhancements

### Real AI Integration

To replace dummy service with real AI:

1. **Add Environment Variables**
   ```env
   REACT_APP_OPENAI_API_KEY=your_api_key
   REACT_APP_AI_SERVICE_URL=https://api.openai.com/v1
   ```

2. **Replace DummyAIService**
   ```typescript
   class OpenAIService {
       static async generateResponse(prompt, context, config) {
           // Real API implementation
       }
   }
   ```

### Advanced Features

- **Response Rating**: Allow tutors to rate AI responses
- **Subject-Specific Models**: Fine-tuned models for different subjects
- **Multi-language Support**: Generate responses in different languages
- **Voice Integration**: Text-to-speech for AI responses
- **Analytics**: Track AI usage and effectiveness

## Performance Considerations

### Optimization
- Conversation context limited to recent messages
- Efficient database queries with proper indexing
- Async operations for non-blocking AI generation
- Response caching for common queries

### Monitoring
- Track AI response times
- Monitor error rates
- Analyze usage patterns
- Performance metrics dashboard

## Troubleshooting

### Common Issues

1. **AI Assistant Not Appearing**
   - Verify user has tutor role
   - Check room permissions
   - Ensure AI migration has been applied

2. **AI Responses Not Generating**
   - Check AI assistant is enabled for room
   - Verify AI configuration exists
   - Check browser console for errors

3. **Styling Issues**
   - Ensure CSS includes AI styles
   - Check for conflicting CSS rules
   - Verify AI message class is applied

### Debug Mode

Enable detailed logging in development:
```typescript
console.log('AI Config:', aiConfig);
console.log('Generating AI response for:', prompt);
console.log('AI Response:', response);
``` 
