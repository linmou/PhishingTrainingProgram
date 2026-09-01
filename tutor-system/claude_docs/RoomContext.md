# RoomContext.tsx - Real-time Messaging System

## Purpose
Central orchestration layer for real-time room interactions, messaging, AI integration, and educational progress tracking. Manages the complete room lifecycle and user interactions.

## Architecture Overview

### Hybrid Real-time Strategy
- **WebSocket subscriptions**: Primary real-time mechanism via Supabase channels
- **Polling fallback**: 2-second interval polling as backup for unreliable replication
- **Optimistic updates**: Immediate UI updates with rollback on errors
- **Message enrichment**: Automatic display name and avatar resolution

## Core State Management

### Primary State Variables (Lines 33-48)
```typescript
const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
const [messages, setMessages] = useState<Message[]>([]);
const [participants, setParticipants] = useState<User[]>([]);
const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
const [aiInteractions, setAIInteractions] = useState<AIInteraction[]>([]);
```

### Message Processing Pipeline

#### `addDisplayNameToMessage` (Lines 54-76)
**Purpose**: Enriches raw database messages with user metadata
**Key Features**:
- Preserves pre-populated message display names (system messages)
- Resolves participant display names and avatars
- Handles role-based fallback naming (Student/Tutor/Observer)

**Critical for**: Consistent UI rendering and user identification

## Real-time Communication System

### WebSocket Subscriptions (Lines 79-131)
**Channel Setup**:
```typescript
const channel = supabase.channel(`room_${currentRoom.id}`);
channel.on('postgres_changes', { event: 'INSERT', table: 'messages' })
```

**Event Handling**:
- **Message insertion**: Real-time message delivery
- **Typing indicators**: Start/stop typing broadcasts
- **Participant updates**: User join/leave events

### Polling Mechanism (Lines 134-183)
**Fallback Strategy**: 2-second interval polling for message synchronization
**Message Preservation**:
- Maintains pre-populated messages (IDs starting with `prepop-`)
- Merges fresh database messages with existing state
- Prevents message duplication and state corruption

**Critical Design**: Ensures reliability when WebSocket replication is unavailable

## AI Integration System

### AI Suggestion Workflow (Lines 491-554)
**Process Flow**:
1. **Context building**: Extracts recent student messages
2. **Suggestion generation**: Calls AI service with room context
3. **Tutor presentation**: Displays suggestion in UI
4. **Feedback tracking**: Records tutor acceptance/modification

### AI Feedback Loop (Lines 924-965)
**Tracks**:
- `accepted`: Tutor uses suggestion verbatim
- `modified`: Tutor edits suggestion before sending
- `rejected`: Tutor dismisses suggestion
- `ignored`: Suggestion times out without action

**Data Collection**: Builds comprehensive AI effectiveness metrics

### Parameter Override System (Lines 556-604)
**Purpose**: Real-time AI behavior modification
**Integration**: Connects to modular prompt system for dynamic personality changes

## Message Lifecycle Management

### Optimistic Updates (Lines 437-489)
**Flow**:
1. **Immediate UI**: Message appears instantly with temp ID
2. **Database insert**: Async database operation
3. **Success handling**: Replace temp message with real message
4. **Error rollback**: Remove optimistic message on failure

**User Experience**: Zero perceived latency for message sending

### Pre-populated Dialogue (Lines 342-368)
**Purpose**: Educational scenario setup with template conversations
**Implementation**:
- Creates messages with `prepop-` ID prefix
- Assigns system user ID with preserved display names
- Chronologically ordered before real messages

## Educational Features

### Chat History Management (Lines 738-887)
**Export Formats**:
- **TXT**: Human-readable format with timestamps
- **JSON**: Structured room export with metadata, feedback summary, and tutor-only AI interaction data

**Role-based Data**:
- **Tutors**: JSON export includes merged chat + feedback data, AI suggestion analytics, and per-interaction `ai_config_snapshot` data
- **Students/Observers**: Export excludes tutor-only AI analytics and config snapshots

**Export Design**:
- JSON export is built through a single export builder so one message shape is used for both feedback and chat data
- Feedback export is no longer a separate download path; feedback summary is part of the room JSON export
- Realtime feedback insert/update events refresh message feedback stats in memory, so TXT and JSON exports include the latest like/dislike summary without requiring a room reload
- AI config change history remains in Supabase for audit/debug use, but is no longer included in the normal JSON download

### Feedback System (Lines 968-1030)
**Message-level feedback**:
- Like/dislike ratings
- 5-star rating system
- Statistical aggregation
- User-specific feedback tracking

**Student reply gate**:
- Before sending, students must rate the latest AI-generated or Tutor response if they have not personally rated it yet.
- The mandatory animated dialog preserves the draft and cannot be dismissed with Escape or the backdrop.
- Sending remains blocked until feedback persistence succeeds; Tutors and rooms without a qualifying response are unaffected.

## Room Management Operations

### Room Creation (Lines 256-301)
**Tutor-only Operation**:
- Image upload integration
- Database record creation
- Automatic room activation

### Room Joining (Lines 303-402)
**Process**:
1. **Room validation**: Checks existence and active status
2. **Password verification**: Validates protected rooms (bypassed for owners)
3. **Message history**: Loads existing messages and pre-populated dialogue
4. **Participant resolution**: Builds user metadata from message history

### Security Model
**Role-based Access**:
- **Students**: Can send messages, view content
- **Tutors**: Full access, AI suggestions, room management
- **Observers**: Read-only access, no message sending

## Integration Points

### Dependencies
- **AuthContext**: User state and role management
- **aiService**: AI suggestion generation and configuration
- **supabase**: Database operations and real-time subscriptions

### Context Consumption
```typescript
const { 
    currentRoom, messages, sendMessage, 
    generateAIResponse, downloadChatHistory 
} = useRoom();
```

## Error Handling Strategy

### Connection Resilience
- **WebSocket failure**: Automatic fallback to polling
- **Database errors**: Rollback optimistic updates
- **AI service errors**: Graceful failure without blocking chat

### User Feedback
- **Loading states**: Visual indicators for AI generation
- **Error messages**: Clear feedback for failed operations
- **Offline indicators**: Status when services unavailable

## Performance Considerations

### Memory Management
- **Message pagination**: Consider implementing for large conversation history
- **Subscription cleanup**: Proper channel unsubscription on unmount
- **Polling optimization**: Only poll when room is active

### Optimization Opportunities
- **Message deduplication**: Prevent duplicate messages from race conditions
- **Selective updates**: Only re-render changed message components
- **Connection pooling**: Reuse WebSocket connections across components

## Testing Strategy

### Mock Dependencies
```typescript
const mockRoomContext = {
    currentRoom: mockRoom,
    messages: mockMessages,
    sendMessage: jest.fn(),
    generateAIResponse: jest.fn()
};
```

### Critical Test Scenarios
- **Offline mode**: Polling-only operation
- **Message ordering**: Correct chronological sequence
- **Role switching**: Dynamic permission updates
- **AI integration**: Suggestion generation and feedback loops
