# Simplified Authentication System

## Overview

The tutor system now uses a simplified authentication approach that eliminates the need for email/password sign-up and sign-in. Users can join sessions by simply entering their name and selecting a role.

## How It Works

### User Flow
1. **Welcome Page**: Users see a simple form asking for their name and role
2. **Name Input**: Users enter their display name (required)
3. **Role Selection**: Users choose from Student, Tutor, or Observer via radio buttons
4. **Join Session**: Single button click creates their session
5. **Role Switching**: Users can change roles after joining (subject to capacity limits)

### Technical Implementation

#### Authentication Context (`AuthContext.tsx`)
- **No Supabase Auth**: Removed dependency on Supabase authentication service
- **Local Storage**: User sessions are maintained in browser localStorage
- **Generated IDs**: Each user gets a unique ID like `user_1234567890_abc123def`
- **Capacity Management**: Still enforces 1 tutor + 1 student limits by checking database

#### Database Changes
- **Migration 003**: Removed foreign key constraint to `auth.users` table
- **Simplified Policies**: Updated RLS policies to work without `auth.uid()`
- **Optional Email**: Email field is now optional since it's not used

#### Components
- **SimpleLogin**: New single-form component combining name input and role selection
- **RoleSelection**: Updated to show current role and allow switching
- **HomePage**: Simplified to use new SimpleLogin component

## Benefits

1. **Faster Onboarding**: No account creation or email verification required
2. **Lower Barrier**: Users can join immediately without providing personal information
3. **Simpler UX**: Single form instead of separate sign-up/sign-in flows
4. **Reduced Complexity**: Less authentication infrastructure to maintain

## Security Considerations

- **No Authentication**: System is open to anyone with access to the URL
- **Session-Based**: User identity persists only in browser session
- **Capacity Limits**: Still enforced through database checks
- **Data Cleanup**: Users are removed from database when they leave session

## Development Notes

### Local Storage Keys
- `tutor_system_user`: Stores current user object

### User Object Structure
```typescript
{
    id: string;              // Generated unique ID
    display_name: string;    // User-provided name
    current_role: UserRole;  // 'student' | 'tutor' | 'observer'
    status: 'active';        // Always active for simplified auth
    created_at: string;      // ISO timestamp
    updated_at: string;      // ISO timestamp
    email?: string;          // Optional, not used
}
```

### API Changes
- `joinWithNameAndRole(name, role)`: Replaces signIn/signUp
- `signOut()`: Clears localStorage and removes from database
- `setUserRole(role)`: Changes role with capacity checking

## Migration Path

Existing projects will need to:
1. Apply migration `003_simplified_auth.sql`
2. Update AuthContext import to use new methods
3. Replace LoginForm/SignupForm with SimpleLogin
4. Test capacity management still works
5. Update any auth-dependent code

## Future Enhancements

- Optional user persistence across browser sessions
- Basic room access codes for privacy
- Admin override for capacity limits
- User activity tracking 