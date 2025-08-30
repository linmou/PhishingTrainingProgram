# supabase.ts - Database Service Layer

## Purpose
Core database client configuration and service abstraction layer. Provides type-safe database operations, authentication helpers, and comprehensive logging for the educational platform.

## Client Configuration

### Supabase Client Setup (Lines 12-23)
```typescript
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    },
    realtime: {
        params: { eventsPerSecond: 10 }
    }
})
```

**Key Configuration**:
- **Type safety**: Full TypeScript integration with Database schema
- **Authentication**: Standard Supabase auth (though bypassed in app logic)
- **Real-time**: Rate-limited to 10 events/second for stability
- **Session management**: Persistent sessions across browser sessions

## Authentication Helpers (Legacy)

### `getCurrentUser` (Lines 26-35)
**Status**: Present but unused due to simplified auth model
**Purpose**: Standard Supabase user retrieval
**Note**: AuthContext bypasses this for educational scenarios

### `signOut` (Lines 38-46)
**Status**: Available but not actively used
**Design**: Standard Supabase sign-out flow

## Core Database Operations

### User Management (Lines 49-89)
**Functions**:
- `getUserProfile(userId)`: Retrieve user data by ID
- `updateUserProfile(userId, updates)`: Update user information

**Pattern**: Direct table operations bypassing auth.uid() checks
**Security**: Relies on permissive RLS policies for educational use

### Room Management (Lines 92-162)

#### `createRoom` (Lines 92-122)
**Parameters**:
```typescript
{
    title: string;
    description: string;
    tutor_id: string;
    image_url?: string;
    pre_populated_dialogue?: any[];
    op_id?: string;
    password?: string;
}
```

**Features**:
- **Image integration**: File upload support
- **Pre-populated content**: Template dialogue support
- **Observer permissions**: OP (Original Poster) configuration
- **Password protection**: Optional room access control

#### `getRoomsByTutor` (Lines 148-162)
**Purpose**: Retrieve tutor's created rooms
**Sorting**: Chronological order (newest first)

## Security Operations

### Password Validation (Lines 164-191)
```typescript
export const validateRoomPassword = async (roomId: string, password: string)
```

**Logic**:
1. Retrieve room password from database
2. Handle unprotected rooms (null password)
3. Compare provided password with stored value
4. Return structured response with success/failure

**Return Format**:
```typescript
{ success: boolean, message: string }
```

### Room Deletion (Lines 193-237)
**Security Model**: Permissive with optional user verification
**Features**:
- **Ownership checking**: Validates tutor ownership (when user ID provided)
- **Cascade deletion**: Database handles related record cleanup
- **Graceful degradation**: Functions without user verification

## Observer System

### `getRoomsByObserver` (Lines 240-257)
**Purpose**: List all active rooms for observer access
**Join Query**: Includes tutor information for room metadata
**Filtering**: Only active rooms available

### `joinRoomAsObserver` (Lines 259-296)
**Validation Process**:
1. **Room verification**: Confirms existence and active status
2. **Observer validation**: Confirms user role and permissions
3. **Access grant**: Returns room and observer data

## Messaging System

### Message Operations (Lines 298-349)
**Functions**:
- `getMessagesForRoom(roomId)`: Retrieve room message history
- `sendMessage(roomId, content, userId)`: Create new message

**Features**:
- **User enrichment**: Automatic display name resolution
- **Role assignment**: Automatic role detection from user profile
- **Chronological ordering**: Messages sorted by creation time

### Chat History Export (Lines 351-399)
**Export Features**:
- **Structured JSON**: Room metadata + message array
- **Tutor information**: Includes tutor display name
- **Timestamp metadata**: Export generation time
- **Automatic download**: Browser-based file download

## File Management

### Avatar System (Lines 402-467)
**Storage Operations**:
- `uploadAvatar(file)`: User avatar upload with automatic replacement
- `deleteAvatar()`: Remove user avatar and update profile

**Features**:
- **Automatic naming**: User ID-based file paths
- **Duplicate handling**: Replaces existing avatars
- **Profile integration**: Automatic profile URL updates

### Tutor Image Management (Lines 469-602)
**Operations**:
- `uploadTutorImage(file, roomId)`: Room-specific image uploads
- `deleteTutorImage(imageId)`: Soft delete with storage cleanup
- `getTutorImages(roomId?)`: Retrieve tutor's uploaded images

**Security**: Ownership verification for all operations
**Storage Model**: User-scoped directories with timestamp prefixes

## Feedback System

### Message Feedback (Lines 605-793)
**Core Operations**:
```typescript
submitMessageFeedback(messageId, userId, roomId, feedbackType, rating)
getMessageFeedbackStats(messageId)
getUserMessageFeedback(messageId, userId)
getRoomFeedbackSummary(roomId)
```

**Features**:
- **Upsert pattern**: Updates existing feedback seamlessly
- **Statistical aggregation**: Like/dislike counts and rating averages
- **Room-level analytics**: Comprehensive feedback summaries
- **Rating validation**: 1-5 star rating enforcement

### Feedback Analytics
**Statistics Generated**:
- Total feedback count per message
- Like/dislike distribution
- Average ratings by feedback type
- Overall room feedback trends
- Rating distribution histograms

## Administrative Operations

### Chat History Management (Lines 796-867)
```typescript
clearChatHistory(roomId, userId)
```

**Security Flow**:
1. **User authentication**: Verify user exists and is logged in
2. **Role verification**: Ensure user is a tutor
3. **Ownership check**: Confirm user owns the room
4. **Cascade deletion**: Remove messages and related feedback
5. **Preservation**: Keep pre-populated dialogue intact

**Data Cleanup**: Removes messages and feedback while preserving room metadata

### Template System (Lines 870-940)
**Template Operations**:
- `createRoomTemplate()`: Store room configurations as templates
- `getRoomTemplatesByTutor()`: Retrieve global template library
- `deleteRoomTemplate()`: Remove unused templates

**Global Templates**: System-wide templates (tutor_id: 00000000-0000-0000-0000-000000000000)

## Integration Patterns

### Error Handling
**Consistent Pattern**:
```typescript
if (error) {
    console.error('❌ Supabase Service: Operation failed:', error);
    throw error;
}
```

**Logging Strategy**:
- `🔧` Configuration messages
- `✅` Success operations
- `❌` Error conditions
- `📸` File operations
- `🔐` Security operations

### Type Safety
**Database Integration**:
```typescript
const { data, error } = await supabase
    .from('table_name')
    .select('*')
    .returns<TypeName>();
```

**Benefits**: Full TypeScript inference for database operations

## Performance Considerations

### Query Optimization
- **Selective fields**: Only fetch required data
- **Proper indexing**: Relies on database indexes for joins
- **Result limiting**: Implements pagination where appropriate

### Connection Management
- **Singleton pattern**: Single client instance across application
- **Connection pooling**: Handled by Supabase client automatically
- **Rate limiting**: Real-time events capped at 10/second

## Security Model

### Educational Permissions
- **Permissive RLS**: Database policies allow broad access for educational use
- **Role-based operations**: Function-level role checking where critical
- **Owner verification**: Optional ownership checks with graceful degradation

### Production Readiness
**Current limitations for production use**:
- Permissive security model
- Limited audit logging  
- No rate limiting on operations
- Simplified error handling

**Enhancement needs**:
- Strict RLS policy implementation
- Comprehensive audit trails
- Rate limiting middleware
- Enhanced error recovery