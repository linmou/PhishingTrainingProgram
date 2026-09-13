# AI Assistant Module Documentation

Intent: describe the implemented AI-assistant runtime, persistence, context, and message-presentation boundaries.

Last updated: 2026-09-13 (multiagent persistence correction; commit 8e27d20)

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

3. **Message Presentation** (`src/components/PostComment.tsx`, `src/utils/messagePresentation.ts`)
   - Resolves display identity from message role, response mode, and Multi-agent tags
   - Renders Guard, assessment, and Multi-agent turns on the active room route

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
- The tutor UI reads room-level AI fields for enablement and rendered prompt text
- Structured controls such as `prompt_config`, `temperature`, and `max_tokens` are persisted in `ai_assistant_configs`
- `getAIConfig()` merges room fields with `ai_assistant_configs` so Quick Adjust and settings screens can be rehydrated after reload

**messages** - Added tutor-turn metadata:
- `user_role`: Establishes student, tutor, or observer conversation identity
- `response_mode`: Establishes `tutoring`, `guard`, `assessment`, or `multiagent` presentation
- `ai_model_used`: Model that generated the response
- `ai_response_time_ms`: Generation time metrics
- `parent_message_id`: Reference to responded message

Model and timing fields are retained for persistence and exports, but are not rendered as message chips. Multi-agent tags are decoded only for tutor rows whose `response_mode` is `multiagent`.

`RoomContext.approveMultiAgentDraft` persists every approved Riley or AI Tutor row with `response_mode='multiagent'`, preserving the character tag for the presentation resolver to decode.

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
- **Structured Prompt Config**: Role, communication style, cognitive parameters, emotional parameters, detection areas, and verification steps

Quick Adjust persistence:
- Regenerating a suggestion returns the effective applied config
- The app persists that config immediately
- Reopening Quick Adjust or AI Assistant Settings reflects the saved role and parameter values instead of default values

Student-selected AI role lock:
- In an AI-enabled room with exactly one student, the student-facing control is
  labelled `AI role` and offers `Peer` or `Adult`.
- Selecting a role persists the corresponding low/high role and a
  `student_tone_lock` marker in the room's structured prompt configuration.
- Once selected, tutor AI Assistant Settings and Quick Adjust rehydrate the
  chosen role, while the Quick Adjust role selector is disabled. Regeneration
  also forces the persisted role so a client-side override cannot change it.
- The student role control is unavailable when AI is disabled or when multiple
  students are present.

### 3. Conversation Context

Maintains chat history for:
- Better AI context awareness
- Consistent conversation flow
- Educational continuity

Tutor rows become assistant turns. Student and observer rows become user turns. Valid Multi-agent tutor tags are stripped and preserved as Riley or AI Tutor labels; tags outside Multi-agent mode remain ordinary text.

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

- Tutor messages use their role profile; Guard and Multi-agent identities come from `response_mode`
- The `AI chatbot` role badge remains hidden from student viewers
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
- Tutor-turn identity stored through `user_role` and `response_mode`
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

**Message Display** - Resolved from persisted message semantics:
- Role profile and badge come from `user_role`
- Guard overrides the profile; assessment keeps the role profile and adds the interactive UI
- Multi-agent tutor rows decode a leading Riley or Tutor tag, strip it from the body, and use the complete Riley or AI Tutor profile for both the author label and avatar; the persisted tutor account avatar is not reused
- Generate AI Response buttons on student messages

### Database Integration

All AI functionality integrates with Supabase:
- Real-time message updates include AI messages
- Room-level AI settings stored on `rooms`
- Extended AI config stored on `ai_assistant_configs`
- Row Level Security for access control
- JSONB storage for structured prompt config

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
   - Verify the tutor message uses the expected role and response-mode presentation

3. **Test Different Models**
   - Change AI model in settings
   - Generate responses and verify model metadata in the tutor export

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
   - Verify the expected role or response-mode class is applied

### Debug Mode

Enable detailed logging in development:
```typescript
console.log('AI Config:', aiConfig);
console.log('Generating AI response for:', prompt);
console.log('AI Response:', response);
``` 
