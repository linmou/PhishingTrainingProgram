# aiService.ts - AI Assistant Functionality

## Purpose
Comprehensive AI integration service providing intelligent tutoring suggestions, configurable AI behavior, and educational scenario management. Production requests use Qwen3.5 Flash through DashScope's OpenAI-compatible API; the debug-only dummy service is retained for local development without a key.

## Architecture Overview

### Modular Design (Lines 17-52)
The service is organized into four main architectural layers:

1. **AI Configuration Management**: Config loading, creation, and upgrades
2. **System Prompt Processing**: Prompt generation and parameter overrides  
3. **AI Response Services**: Qwen API and debug-only dummy service implementations
4. **Public API**: Clean interface for external consumption

### Configuration Types
```typescript
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
```

## AI Configuration Management

### `AIConfigurationManager` Class (Lines 61-152)
**Purpose**: Handles AI configuration lifecycle with upgrade path for legacy configs

#### `loadConfig` (Lines 65-83)
**Process**:
1. **Attempt retrieval**: Load existing configuration from database
2. **Fallback creation**: Generate default config if none exists
3. **Legacy detection**: Identify and upgrade old configuration formats
4. **Modern validation**: Ensure current configuration standards

**Return Type**: `ProcessedAIConfig` with upgrade metadata

#### Configuration Evolution
- **Legacy configs**: Missing `prompt_config` field, simple string prompts
- **Modern configs**: Structured with modular prompt components
- **Upgrade strategy**: Preserves an existing saved room prompt while attaching structured defaults for override support

#### Persistence Model
- **`rooms`**: Stores AI enablement, active model, and rendered system prompt
- **`ai_assistant_configs`**: Stores durable structured fields such as `prompt_config`, `temperature`, and `max_tokens`
- **`ai_assistant_config_logs`**: Stores before/after snapshots, changed fields, actor, and reason for AI configuration changes
- **Merged runtime config**: `getAIConfig()` loads room fields first, then merges persisted extended config values from `ai_assistant_configs`
- **Practical effect**: Quick Adjust changes like switching role from trusted adult to peer survive reloads and can be rehydrated into the UI

### Default Configuration Strategy (Lines 88-117)
**Educational Defaults**:
- **Role**: `supportive_adult` preset (high authority, encouraging tone)
- **Detection areas**: `['Suspicious links', 'Urgent language', 'Unexpected requests']`
- **Verification steps**: `['Check sender authenticity', 'Verify through official channels', 'Think before clicking']`
- **Model**: `qwen3.5-flash` (`DEFAULT_AI_MODEL`, the only selectable model)
- **Transport**: `POST {REACT_APP_OAI_BASE_URL}/chat/completions`, with `enable_thinking: false`
- **Response policy**: prompt-controlled maximum of three sentences and 50 words; runtime output is not clipped or rewritten

## System Prompt Processing

### `SystemPromptProcessor` Class (Lines 158-236)
**Purpose**: Handles dynamic prompt generation with parameter overrides

### Tutor Behavior Quality Gate

Intent: keep production prompt changes tied to reviewed student-behavior requirements instead of relying on ad hoc prompt edits.

The phishing tutor prompt is evaluated through the Promptfoo benchmark in `../evals/promptfoo/`. The active Qwen gate requires at least 80% of applicable assertions for each of eight metrics, independently for ecological and synthetic-holdout suites and for both direct-correction scaffold states.

Latest Qwen run:
- Date: 2026-08-30
- Promptfoo eval id: `eval-SqR-2026-08-30T22:54:55`
- Scope: one current product prompt with product-template ecological cases and synthetic account-alert holdouts
- Result: `DOES_NOT_SATISFY_RUBRICS`; the failed evidence is preserved under `evals/promptfoo/results/qwen3.5-flash/20260830T225452Z/`

The earlier GPT current-versus-improved run remains historical evidence only; it is not an active model or quality-gate input.

The preserved historical GPT comparison covered:
- Repeated question loops: `turn_rhythm` passed 9/9 for the improved prompt.
- Soft or indirect correction: `direct_correction` passed 8/8.
- Fake friend or fake first-person persona: `persona_stability` passed 5/5.
- Boilerplate praise: `low_boilerplate_praise` passed 5/5.
- Vague advice without practical checks: `practical_knowledge` passed 15/15.
- Personal testimonials: `third_person_examples` passed 1/1.
- Over-complex language: `reading_level` passed 7/8, above the 80% metric threshold.

Feedback not solved by prompt-only work:
- UI latency and typing feedback require product/UI changes.
- Multi-bot or richer simulation behavior requires new product design and evaluation fixtures.

Production prompt behavior now emphasizes direct tutoring: teach one concrete point first, ask at most one focused question only when useful, correct unsafe reasoning after a failed scaffold (or immediately when an unsafe action is imminent), provide concrete safe actions, avoid fake personal memories, use third-person examples, keep language simple for confused students, and stay within three sentences and 50 words. Runtime code preserves Qwen output verbatim apart from existing wrapped-quote cleanup.

#### `processOverrides` (Lines 162-176)
**Strategy**:
- **No overrides**: Return original configuration unchanged
- **Legacy configs**: Apply direct parameter changes only
- **Modern configs**: Full structured parameter override support

#### Structured Override System (Lines 181-224)
**Process**:
1. **Validation**: Ensure base prompt configuration exists
2. **Default fallback**: Use `supportive_adult` preset if configuration missing
3. **Parameter merging**: Deep merge overrides with stored configuration
4. **Prompt regeneration**: Generate new system prompt with updated parameters

**Override Categories**:
- **Role intensity**: `low` (peer-level) vs `high` (authority figure)
- **Communication style**: Teen slang usage, uncertainty expression
- **Cognitive parameters**: Concept density, perspective-taking frequency
- **Emotional parameters**: Enthusiasm, validation levels, mistake normalization

## AI Response Services

### `QwenService` Class
**Purpose**: Production Qwen3.5 Flash API integration

#### `generateResponse` (Lines 246-310)
**Process**:
1. **Message preparation**: Format conversation history + system prompt
2. **API request**: Call DashScope's OpenAI-compatible chat completions endpoint
3. **Response processing**: Extract content and measure response time
4. **Error handling**: Graceful failure with detailed error messages

**Configuration**:
- **Context window**: Last 10 messages for conversation context
- **Streaming**: Not implemented (educational use prioritizes simplicity)
- **Model**: Always `qwen3.5-flash`; legacy room model values are normalized before use

### `TutorSuggestionService` Class (Lines 316-406)
**Purpose**: Specialized tutor suggestion generation

#### `generateSuggestion` (Lines 317-375)
**Educational Focus**:
- **Context analysis**: Reviews recent conversation for context
- **Prompt engineering**: Specialized prompt for educational guidance
- **Length optimization**: Under 2 sentences, interaction-focused
- **Response filtering**: Educational, engaging, understanding-focused

#### Dummy Suggestion Categories (Lines 377-404)
**Fallback Categories**:
- **Educational**: Concept exploration, step-by-step guidance
- **Encouragement**: Progress recognition, confidence building
- **Clarification**: Confusion resolution, concept connection

### `DummyAIService` Class (Lines 410-484)
**Purpose**: Local fallback for development/testing

#### Response Logic (Lines 411-423)
**Category Detection**:
- **Questions**: Keywords like "?", "how", "what", "why" → Educational
- **Difficulty expressions**: "difficult", "hard", "confused" → Clarification
- **Default**: 70% educational, 30% encouragement

## Public API Interface

### `generateTutorSuggestion` (Lines 494-536)
**Main Entry Point**: Complete suggestion generation with parameter override support

**Process Flow**:
1. **Room validation**: Verify AI assistant enabled
2. **Config loading**: Load and upgrade configuration as needed
3. **Override application**: Apply real-time parameter changes
4. **Context building**: Gather conversation history
5. **Service selection**: Qwen API or debug-only dummy service
6. **Result packaging**: Include context metadata for tracking

**Return Data**:
```typescript
{
    suggestion: string;
    success: boolean;
    error?: string;
    contextMessages: string[]; // For analytics
    appliedConfig?: {
        model_name: string;
        system_prompt: string | null;
        prompt_config?: SystemPromptConfig | null;
        temperature: number;
        max_tokens: number;
    };
}
```

**Quick Adjust persistence**:
- The service strips only outer wrapper quotes from AI-generated suggestions
- The service returns the fully applied config snapshot used to generate the suggestion
- `RoomContext` persists that snapshot through `updateAIConfig()`, so role changes and parameter overrides are durable instead of session-only
- Config change logging is best-effort. If audit logging fails because the log table is missing or returns a malformed error, the tutor workflow still succeeds and the service only emits a warning.

## Helper Functions

### Room Validation (Lines 545-557)
**Security Check**:
- **Room existence**: Confirms room exists in database
- **AI status**: Verifies AI assistant enabled
- **Error handling**: Clear error messages for common issues

### Service Selection (Lines 562-576)
**Strategy**:
- **Production**: Use Qwen API if `REACT_APP_OAI_API_KEY` is available
- **Development**: Fall back to dummy service for testing
- **Category mapping**: Analyze last message for appropriate dummy response

### Context Message Tracking (Lines 581-590)
**Analytics Support**:
- **Recent messages**: Last 5 message IDs for tracking
- **Usage analysis**: Enables suggestion effectiveness measurement
- **Context preservation**: Maintains conversation flow understanding

## Legacy Function Support

### Backward Compatibility (Lines 596-857)
**Maintained Functions**:
- `getAIConfig`: Direct configuration retrieval
- `initializeAIAssistant`: Full initialization with prompt config
- `updateAIConfig`: Configuration updates
- `recordAISuggestionFeedback`: Simplified feedback tracking

### Durable Role Persistence
- Changing role to peer is represented as `prompt_config.role.role = 'low'`
- `updateAIConfig()` persists that structured role into `ai_assistant_configs.prompt_config`
- `getAIConfig()` reloads the structured role on the next page load and rehydrates both Quick Adjust and AI Assistant Settings from that saved value
- When a tutor changes AI settings or Quick Adjust parameters, `updateAIConfig()` also attempts to append an audit entry to `ai_assistant_config_logs`

### Migration Strategy
- **Deprecated functions**: Marked with `@deprecated` annotations
- **Functionality preservation**: Old interfaces still work
- **Gradual migration**: New features use modern interfaces
- **Clean removal**: Eventually remove deprecated functions

## Integration Points

### System Prompt Integration
```typescript
import { generateSystemPrompt, PRESET_CONFIGS } from './systemPrompts';
```
**Benefits**:
- **Modular prompts**: Educational framework integration
- **Parameter validation**: Consistent configuration structure
- **Template library**: Pre-built educational scenarios

### Database Integration
```typescript
import { buildAIContextFromExistingData } from './simplifiedAIContext';
```
**Features**:
- **Context building**: Automatic conversation history extraction
- **Performance optimization**: Efficient database queries
- **Real-time updates**: Fresh context for each suggestion

## Educational Scenarios

### Scenario Templates
```typescript
import { SCENARIO_TEMPLATES, ScenarioTemplate } from './detectionTemplates';
```

**Available Scenarios**:
- **Phishing detection**: Email scam identification
- **Privacy protection**: Data sharing awareness
- **Social engineering**: Manipulation technique recognition
- **Verification procedures**: Authentication best practices

### Configuration Presets
**Educational Roles**:
- **Peer mentor** (`low` role): Casual, supportive, uncertainty expression
- **Trusted adult** (`high` role): Authoritative, comprehensive, confident guidance

## Performance Considerations

### Response Time Optimization
- **Context limiting**: Last 10 messages only to manage token usage
- **Prompt efficiency**: Optimized system prompts for quick processing
- **Caching strategy**: Configuration caching for repeated requests
- **Fallback speed**: Dummy service provides sub-second responses

### Cost Management
- **Token limits**: Conservative max_tokens settings (100-150)
- **Model selection**: Balance capability vs. cost (GPT-4o vs GPT-4)
- **Context pruning**: Intelligent conversation history management
- **Failure handling**: Graceful degradation to dummy service

## Error Handling Strategy

### Resilient Architecture
- **API failures**: Returned as visible errors; no production dummy fallback
- **Configuration errors**: Default to working configuration
- **Network issues**: Timeout handling with meaningful error messages
- **Invalid parameters**: Validation with helpful error descriptions

### User Experience
- **Transparent failures**: Users see the Qwen error when the provider rejects a request
- **Performance feedback**: Response time tracking for optimization
- **Error logging**: Comprehensive debugging information for development

## Security Considerations

### API Key Management
- **Environment variables**: `REACT_APP_OAI_API_KEY` and `REACT_APP_OAI_BASE_URL` retain compatibility names for the Qwen OpenAI-shaped protocol
- **Conditional logic**: Graceful operation without API access
- **No key exposure**: Client-side code never exposes sensitive keys

### Content Safety
- **Educational context**: System prompts emphasize educational purposes
- **Response filtering**: AI responses focused on learning objectives
- **Appropriate tone**: Age-appropriate language and concepts

## Testing Strategy

### Service Layer Testing
```typescript
// Mock AI service for consistent testing
class MockAIService {
    generateResponse: jest.fn();
    generateSuggestion: jest.fn();
}
```

### Configuration Testing
- **Legacy upgrade**: Test configuration migration paths
- **Parameter override**: Verify override application logic
- **Default handling**: Test fallback configuration creation

### Integration Testing  
- **End-to-end flows**: Complete suggestion generation cycles
- **Error scenarios**: API failures, invalid configurations
- **Performance validation**: Response time and token usage measurement

This AI service provides a robust foundation for educational AI integration with sophisticated configuration management, flexible parameter control, and reliable fallback mechanisms.
