# AuthContext.tsx - Authentication System

## Purpose
Core authentication module that manages user sessions, roles, and identity generation without traditional Supabase Auth integration. Designed for simplified educational environments.

## Key Concepts

### Simplified Authentication Model
- **No traditional auth.uid()**: Uses deterministic user ID generation
- **Role-based access**: Students, tutors, observers with dynamic role switching
- **Offline-first fallback**: Functions without database connectivity
- **Persistent sessions**: localStorage-based session management

### User ID Generation (`generateUserId`)
**Location**: Lines 16-42
```typescript
const generateUserId = (displayName: string, role: UserRole) => {
    // Deterministic hash-based UUID generation
    // Format: 8-4-4-4-12 character segments
    // Ensures same name+role = same ID across sessions
}
```
**Critical Design**: Creates consistent user identities for educational scenarios where traditional signup is impractical.

## Core Functions

### `joinWithNameAndRole` (Lines 90-251)
**Purpose**: Primary authentication method - creates or retrieves users
**Process**:
1. **Connection testing**: Retries Supabase connection with exponential backoff
2. **Offline fallback**: Creates localStorage-only users if database unreachable
3. **User lookup**: Checks for existing users by generated ID
4. **Database sync**: Creates/updates user records in database

**Error Handling**: Comprehensive retry logic and graceful offline degradation

### `signOut` (Lines 253-262)
**Purpose**: Session termination - preserves database records
**Design**: Only clears localStorage, maintaining user data integrity

### `setUserRole` (Lines 264-302)
**Purpose**: Dynamic role switching for educational flexibility
**Flow**: Updates database → localStorage → React state

## Integration Points

### Dependencies
- `supabase.ts`: Database client and operations
- `types/index.ts`: User, UserRole type definitions
- localStorage: Session persistence

### Context Providers
- **AuthProvider**: React Context wrapper with user state
- **useAuth**: Hook for consuming authentication state

## Usage Patterns

### Authentication Flow
```typescript
const { user, joinWithNameAndRole } = useAuth();
await joinWithNameAndRole("Student Name", "student");
// Creates deterministic user ID and session
```

### Role Management
```typescript
const { setUserRole } = useAuth();
await setUserRole("tutor"); // Dynamic role switching
```

## Security Considerations

### Educational Security Model
- **Permissive by design**: Bypasses strict authentication for educational use
- **No capacity limits**: Users can join as any role without restrictions  
- **Data persistence**: User records preserved across sessions
- **Transparent IDs**: Deterministic generation for reproducible scenarios

### Production Considerations
This simplified model is **not suitable for production** systems requiring:
- User verification
- Secure authentication
- Audit trails
- Access control enforcement

## Error Handling

### Connection Resilience
- **3-attempt retry**: With exponential backoff (1s, 2s delays)
- **Offline mode**: Creates functional sessions without database
- **State recovery**: Handles localStorage corruption gracefully

### User Feedback
Comprehensive logging for debugging educational scenarios:
- `🔄` Connection attempts
- `✅` Success states  
- `❌` Error conditions
- `📢` State changes

## Testing Implications

### Simplified Testing
- Predictable user IDs enable consistent test scenarios
- Offline mode allows testing without database dependencies
- Role switching enables rapid test context changes

### Mocking Strategies
Mock `joinWithNameAndRole` for different user states:
```typescript
const mockAuth = {
    user: { id: "test-user", current_role: "student" },
    joinWithNameAndRole: jest.fn()
};
```