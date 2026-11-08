# RoomContext.tsx - Real-time Messaging System

<!-- Intent: explain room-message state, restore behavior, and learner assessment presentation. -->
<!-- Updated: 2026-10-30. Rating auto-send baseline commit: a21d94a. -->

## Purpose
Central orchestration layer for real-time room interactions, messaging, AI integration, and educational progress tracking. Manages the complete room lifecycle and user interactions.

## Architecture Overview

### Recovery-aware Real-time Strategy
- **WebSocket subscriptions**: Primary real-time mechanism via Supabase channels
- **Reconciliation**: 100-row ID-keyset pages on join/reconnect, five-second disconnected retries, and a sixty-second healthy audit
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

### Guard Mode Review State
The AI review state contains `rawDecision`, `finalMode`, and `finalResponse` in addition to the legacy `aiSuggestion` display value. Tutors can edit wording and rectify the mode independently. A reviewed send uses one `send_reviewed_tutor_response` RPC, adopts the returned message and room state, and clears the review only after success; a failed send leaves the draft and review state intact.

Room mode updates are received through the room realtime subscription. Historical message identity is derived from each message's persisted `response_mode`, so a prior Guard response remains `Security Supervisor` after the room returns to tutoring. Realtime message insertion is de-duplicated by message ID because an atomic send can be received both from the RPC response and the subscription.

### Feedback after transfer answers

When the selected learner message carries a persisted assessment ID, AI generation reads the tutor-only assessment review before entering the tutor suggestion workflow. Assessment answers have already entered grading and must not be sent to ordinary evidence analysis or assessment preparation, which reject that message scope. This routing also applies after reload and duplicate realtime delivery. Ordinary learner messages continue through evidence analysis and assessment preparation.

The review must provide a verified resolution (`open`, `passed`, or `failed`), message lifecycle (`delivered`, `passed`, `failed`, or `cancelled`), attempt count, and feedback requirement. Missing or unrecognized lifecycle data blocks feedback generation with a retryable error. Cancellation does not imply failure and can retain an open attempt snapshot. The provider receives these facts with the public question; the answer key and safe explanation are included only for terminal results. Private transfer rationale is not included in this feedback input or copied into message state. Deployment requires the matching `read_review` backend contract.

Prepared review drafts carry the selected learning target's label from the loaded checklist so the editor identifies the target being assessed.

### Option submission during an assessment

While a learner has a delivered, unresolved assessment, ordinary chat and generic Reply are disabled. The learner selects the displayed option controls and submits the question. The shared send path requires the current assessment ID, its separate question-message parent ID, and a nonempty valid selection; single-answer questions accept one option. It rejects text-only and mismatched submissions before persistence. The first incorrect answer keeps the gate active for a retry. Passed, failed, cancelled, or incomplete questions release the gate, and another learner's assessment never gates the current learner. Server grading remains authoritative.

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

### Message Reconciliation
`roomMessageSync.ts` reads at most 100 rows per request using the unique message ID as a keyset cursor. It scans the entire persisted history because there is no trusted mutation cursor for finding old-row updates. Creation timestamps are not used as a recovery cursor, so tied timestamps and old edits remain discoverable. The initial join uses these same pages before restoring assessment answer lifecycle state.

Realtime INSERT and UPDATE are the primary path. Reconnection immediately requests a reconciliation; disconnected sessions and failed requests retry five seconds after completion. Healthy sessions audit sixty seconds after the preceding scan completes. A silently missed event can therefore remain absent for sixty seconds plus scan time. Each session permits one active scan and coalesces recovery requests.

Realtime and reconciliation use `projectRoomMessage` and the shared `mergeRoomMessages` path, retaining pre-populated dialogue and assessment lifecycle projections. A realtime event received during a scan supersedes the scan's potentially stale copy. The channel depends on room/user identity rather than participant or room metadata objects. Room switch/unmount aborts requests, clears timers and suppresses late responses; overlapping joins have their own cancellation generation.

Reads retain the existing `messages.select('*')` contract and server authorization. UI projection is only the display boundary, not authorization for private assessment data. No schema, RLS, RPC or Realtime publication change is introduced here.

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

Guard review records also preserve `raw_mode`, `mode_reason`, `final_mode`, and `mode_rectified`. Manual room overrides update only current room state and never rewrite historical messages.

### Transfer Assessment Review and Answer Flow

Transfer assessment delivery uses the reviewed `TransferAssessmentDraft` candidate and the typed service
facade. `RoomContext` keeps the prepared scope until delivery succeeds, sends assessment content
through the reviewed delivery operation, and projects the returned public message before storing it
in room state. On reload, the public question can be rebuilt from the persisted assessment ID,
student ID, selection type, stem, and options columns. Malformed or incomplete rows fail closed;
private answer keys and transfer basis fields are discarded at the UI boundary. Known service error
codes map to fixed review states and safe messages; raw provider details are not surfaced. A stale
learner/message focus is treated as superseded and refreshes persisted room state before another
candidate can be prepared.

Assessment submissions send canonical `selectedOptionIds` with the public question message ID as the
persisted parent and the separate assessment ID for trusted processing. The context validates the
processor's returned answer and assessment IDs before attaching lifecycle state to the answer and
its matching question. If concurrent results arrive in either order, an accepted terminal lifecycle
remains the question state when a later result is rejected or has no accepted attempt; each answer
retains its own processing result. On student reload or reconnect, the context re-reads only stored
answers whose assessment ID matches the targeted question through the idempotent `processMessage`
facade. Previously stored ordinary replies remain discussion messages and are not graded. A failed
re-read leaves the room visible without inventing feedback. Message merges
retain the projected question and server lifecycle when reconciliation replaces a local view with a fresh
database row. Student messages without an assessment identity use evidence analysis directly. The
browser does not grade answers or write progress. Active-assessment selection checks run before both trusted and legacy posting paths, so a missing checklist projection cannot turn a displayed question's text reply into ordinary chat.

The learner's assessment submissions appear in answer history within the question, including
pending submissions and their later server feedback. Other room participants retain the normal
discussion view.

Message ingress uses one stable-ID merge for the initial room fetch, realtime inserts, reconciliation,
reviewed sends, optimistic replacement, and catch-up. The page refreshes persisted room state after a
stale transfer conflict; if that refresh fails, it keeps a retry action available. The active
transfer checklist remains owner-scoped, so refresh uses the same selected learner and prepared
focus identity.

Checklist loading uses the owner-scoped transfer projection for a signed-in student and the
server-selected active projection for a tutor. The returned transfer owner is checked on both the
scoped lookup and the legacy read fallback before progress reaches the UI; a missing or mismatched
owner clears the view. Transfer lifecycle and progress controls stay limited to their authorized
learner/tutor views, while ordinary legacy checklist reads and room text exports remain available.

Tutor target setup resolves the sole active learner session when the checklist is opened, so a
learner may join before posting a message. Enabling transfer assessment keeps the active legacy
checklist visible as previous progress while new transfer targets are being prepared; transfer
initialization still requires an identified learner owner.

After transfer targets are initialized, `ChecklistService` rechecks the owner's saved ordinary
student messages in the same room, oldest first with message ID as the tie-breaker. It pages
through the full history, excludes assessment answers, and awaits the existing trusted analysis
API for each message before rereading progress. Saving targets before a learner joins uses the
same path when the local draft is promoted. Inventory, analysis, and final-read failures retain
the local target draft and expose Retry sync. The server's completed-message deduplication makes
retries safe after partial analysis, and its Guard policy remains authoritative.

Ordinary learner sends and tutor AI focus requests use that same ordered prefix through the
selected message. This prevents a new message from overtaking older pending evidence while target
setup is replaying history, including across browser clients. Missing focus IDs fail explicitly
before analysis. If targets appear while an ordinary learner insert is in flight, the send path
rechecks the owner-scoped checklist after persistence and includes that stored message in the prefix.

Each room/learner pair keeps a session cache of IDs explicitly confirmed complete by the server's
`already_processed: true` response. Initial goal replay confirms new completions once to prime that
cache; subsequent live messages normally require one or two analysis requests regardless of earlier
history length. Deferred evidence remains retryable. Cache corruption or unavailable browser storage
falls back to the actual server analysis, and partial failures retain already-confirmed IDs.

Room participation remains `tutoring` or `guard`; assessment is only a turn decision. Manual Guard
changes use the room-mode service directly. Recovering from a Guard suggestion requires the tutor to
review and send a tutoring response, and the room adopts tutoring only after that send succeeds.
Assessment candidates stay outside the legacy suggestion mode toggle.

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
- Transfer exports include the public question for room participants, but include answer lifecycle and terminal explanation only for the signed-in target learner. Teacher progress remains sourced from the trusted checklist projection.

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
- The inline comment popup and mandatory reply dialog keep their question above the stars until a star is clicked, including while hovering. Reopening an existing comment rating still displays the saved level and allows editing it.

**Student reply gate**:
- Before sending, students must rate the latest persisted AI-generated or Tutor response if they have not personally rated it yet.
- Submitting the required rating also sends the drafted post, including its reply target, once the rating is saved. A failed rating keeps the dialog and draft for retry; a failed send keeps the draft and saved rating so the student can retry sending.
- Automatic posting rechecks the current room state after the rating saves. A newer unrated response opens a fresh rating dialog; an assessment arriving during the save keeps the draft unsent until the assessment is completed.
- Leaving or switching rooms while the rating saves cancels the automatic post. A room switch clears the old rating dialog; late rating failures and completion callbacks cannot change the new room's rating state.
- Pre-populated dialogue is materialized in memory as `prepop-<roomId>-<index>` and has no `messages` row, so the gate skips those ids: a student can answer when the only tutor-role turn in the room is a pre-populated line, and when a pre-populated line sits beside a persisted unrated turn the gate still fires on the persisted turn.
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
- **WebSocket failure**: Paginated reconciliation retries five seconds after each completed scan
- **Reconnect recovery**: A successful subscription immediately reconciles missed inserts and old-row edits
- **Database errors**: Rollback optimistic updates
- **AI service errors**: Graceful failure without blocking chat
- **Reviewed-send errors**: The RPC is atomic; no message, feedback row, or room-mode update is adopted locally when it fails

### User Feedback
- **Loading states**: Visual indicators for AI generation
- **Error messages**: Clear feedback for failed operations
- **Offline status and local message queue UI**: Not currently implemented

## Performance Considerations

### Memory Management
- **Message pagination**: Consider implementing for large conversation history
- **Subscription cleanup**: Proper channel unsubscription on unmount
- **Recovery reads**: One bounded-page scan at a time while the room is active; healthy audits run every sixty seconds

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
- **Reconnect sync**: Polling displays persisted messages after database access returns
- **Failed message persistence**: Remove the optimistic message and keep the draft available for retry
- **Message ordering**: Correct chronological sequence
- **Role switching**: Dynamic permission updates
- **AI integration**: Suggestion generation and feedback loops
