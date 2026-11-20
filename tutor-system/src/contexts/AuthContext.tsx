import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthContextType, User, UserRole } from '../types';
import { supabase } from '../services/supabase';
import { setApplicationUserId } from '../services/applicationIdentity';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

/** Read auth when available without making service-only hooks require the provider. */
export const useOptionalAuth = () => useContext(AuthContext);

// Generate a consistent user ID based on display name and role
const generateUserId = (displayName: string, role: UserRole) => {
    // Normalize the display name: lowercase, trim, remove extra spaces
    const normalized = displayName.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Create a deterministic hash from the normalized name and role
    const input = `${normalized}-${role}`;
    
    // Generate multiple hash values to fill UUID segments
    const hashes = [];
    for (let i = 0; i < 5; i++) {
        let hash = i * 31; // Different starting point for each hash
        for (let j = 0; j < input.length; j++) {
            const char = input.charCodeAt(j);
            hash = ((hash << 5) - hash + char + i * 17) & 0xffffffff;
        }
        hashes.push(Math.abs(hash).toString(16).padStart(8, '0'));
    }
    
    // Build UUID segments: 8-4-4-4-12 characters
    const segment1 = hashes[0].substring(0, 8);           // 8 chars
    const segment2 = hashes[1].substring(0, 4);           // 4 chars
    const segment3 = '4' + hashes[2].substring(0, 3);     // 4 chars (starts with 4 for UUID v4)
    const segment4 = 'a' + hashes[3].substring(0, 3);     // 4 chars (starts with a for variant)
    const segment5 = hashes[4].substring(0, 8) + hashes[0].substring(0, 4); // 12 chars
    
    return `${segment1}-${segment2}-${segment3}-${segment4}-${segment5}`;
};

// Local storage keys
const USER_STORAGE_KEY = 'tutor_system_user';

export const SIGNED_OUT_ELSEWHERE_NOTICE = 'You signed out or switched account in another tab. Sign in again to continue.';

const USER_ROLES: ReadonlyArray<UserRole> = ['student', 'tutor', 'observer'];

/** The one reader of the stored identity: a user with an id and a known (or no) role, otherwise null. */
export const parseStoredUser = (raw: string | null | undefined): User | null => {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string' || !parsed.id) return null;
        if (parsed.current_role != null && !USER_ROLES.includes(parsed.current_role)) return null;
        return parsed as User;
    } catch {
        return null;
    }
};

/** Same session: same user id and same role. Display name and avatar may differ. */
const sameIdentity = (left: User | null, right: User | null) =>
    Boolean(left && right && left.id === right.id && (left.current_role ?? null) === (right.current_role ?? null));

const readStoredUser = () => parseStoredUser(localStorage.getItem(USER_STORAGE_KEY));

const ensureStoredUserProfile = async (storedUser: User): Promise<User> => {
    const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('id', storedUser.id)
        .single();

    if (checkError && checkError.code !== 'PGRST116') {
        throw new Error(`Failed to validate stored user: ${checkError.message}`);
    }

    if (existingUser) {
        return existingUser;
    }

    const { data: insertedUser, error: insertError } = await supabase
        .from('users')
        .insert({
            id: storedUser.id,
            display_name: storedUser.display_name,
            current_role: storedUser.current_role,
            status: storedUser.status,
            avatar_url: storedUser.avatar_url ?? null
        })
        .select()
        .single();

    if (insertError) {
        throw new Error(`Failed to restore stored user profile: ${insertError.message}`);
    }

    return insertedUser;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUserState] = useState<User | null>(null);
    const [sessionNotice, setSessionNotice] = useState<string | null>(null);
    // The user this tab acts as, read synchronously by the storage listener and after awaits.
    const userRef = useRef<User | null>(null);
    // The stored user being restored on load, before it becomes this tab's user.
    const restoringRef = useRef<User | null>(null);
    // Bumped whenever this tab's identity (id or role) changes. Work awaited under an older generation
    // must not write the identity back to storage or state.
    const generationRef = useRef(0);
    // Requests read this tab's identity at send time, so update it together with the state, not after render.
    const setUser = useCallback((nextUser: User | null) => {
        if (!sameIdentity(userRef.current, nextUser)) generationRef.current += 1;
        userRef.current = nextUser;
        setApplicationUserId(nextUser?.id ?? null);
        setUserState(nextUser);
    }, []);
    /** True when this tab's identity has not changed since `generation` and storage still holds `expected`. */
    const stillCurrent = (generation: number, expected: User) =>
        generation === generationRef.current && sameIdentity(readStoredUser(), expected);
    const [loading, setLoading] = useState(true);

    // Debug user state changes
    useEffect(() => {
        console.log('🔄 AuthContext: User state changed:', {
            hasUser: !!user,
            userId: user?.id,
            role: user?.current_role,
            displayName: user?.display_name
        });
    }, [user]);

    useEffect(() => {
        // Check if user exists in local storage
        const initializeAuth = async () => {
            try {
                console.log('🔄 AuthContext: Initializing simple auth...');
                const rawStoredUser = localStorage.getItem(USER_STORAGE_KEY);
                const userData = parseStoredUser(rawStoredUser);

                if (userData) {
                    console.log('✅ AuthContext: Found stored user:', {
                        id: userData.id,
                        displayName: userData.display_name,
                        role: userData.current_role
                    });
                    restoringRef.current = userData;
                    const generation = generationRef.current;

                    let restoredUser = userData;
                    try {
                        restoredUser = await ensureStoredUserProfile(userData);
                    } catch (syncError) {
                        console.warn('⚠️ AuthContext: Failed to sync stored user with database, keeping local session:', syncError);
                    }
                    const unchanged = restoringRef.current === userData && stillCurrent(generation, userData);
                    restoringRef.current = null;
                    // Another tab may have signed out or switched account while the profile was read.
                    if (!unchanged) {
                        console.log('ℹ️  AuthContext: Stored identity changed during restore; not restoring it');
                        return;
                    }
                    if (restoredUser !== userData) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(restoredUser));
                    setUser(restoredUser);
                } else if (rawStoredUser) {
                    console.error('💥 AuthContext: Stored user is unreadable; removing it');
                    localStorage.removeItem(USER_STORAGE_KEY);
                } else {
                    console.log('ℹ️  AuthContext: No stored user found');
                }
            } catch (error) {
                console.error('💥 AuthContext: Error loading stored user:', error);
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();
        // stillCurrent reads only refs and storage.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setUser]);

    // localStorage is shared by every tab of this site, so the session is browser-scoped and fails closed.
    // If another tab signs out, clears or corrupts the stored user, or stores another user or role, this tab
    // signs itself out and returns to sign-in (SessionEndedRedirect). It never adopts the other tab's user.
    // Only a change to the same user and role (display name, avatar) is taken over in place.
    useEffect(() => {
        const followStoredIdentity = (event: StorageEvent) => {
            if (event.key !== USER_STORAGE_KEY && event.key !== null) return;
            const current = userRef.current ?? restoringRef.current;
            if (!current) return;
            const stored = event.key === null ? null : parseStoredUser(event.newValue);
            if (stored && sameIdentity(stored, current)) {
                if (userRef.current) setUser(stored);
                return;
            }
            console.log('🔄 AuthContext: Signed out because another tab changed the stored identity');
            restoringRef.current = null;
            generationRef.current += 1;
            setUser(null);
            setSessionNotice(SIGNED_OUT_ELSEWHERE_NOTICE);
        };
        window.addEventListener('storage', followStoredIdentity);
        return () => window.removeEventListener('storage', followStoredIdentity);
    }, [setUser]);

    const joinWithNameAndRole = async (displayName: string, role: UserRole): Promise<void> => {
        setLoading(true);
        try {
            console.log('🚀 AuthContext: Starting join process...', { displayName, role });

            // Test Supabase connection with retry logic
            console.log('🔗 AuthContext: Testing Supabase connection...');
            let connectionSuccess = false;
            let lastError = null;
            
            // Try connection up to 3 times with increasing delays
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    console.log(`🔗 AuthContext: Connection attempt ${attempt}/3...`);
                    
                    const { error: testError } = await supabase
                        .from('users')
                        .select('count')
                        .limit(1);

                    if (testError) {
                        lastError = testError;
                        console.warn(`⚠️ AuthContext: Connection attempt ${attempt} failed:`, testError);
                    } else {
                        connectionSuccess = true;
                        console.log('✅ AuthContext: Supabase connection successful');
                        break;
                    }
                } catch (error) {
                    lastError = error;
                    console.warn(`⚠️ AuthContext: Connection attempt ${attempt} failed:`, error);
                }
                
                // Wait before retry (exponential backoff)
                if (attempt < 3) {
                    const delay = attempt * 1000; // 1s, 2s
                    console.log(`⏳ AuthContext: Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            if (!connectionSuccess) {
                console.error('❌ AuthContext: All connection attempts failed, using offline mode:', lastError);
                console.log('🔄 AuthContext: Falling back to offline mode...');
                
                // Create user in offline mode (localStorage only)
                const userId = generateUserId(displayName, role);
                const offlineUser: User = {
                    id: userId,
                    display_name: displayName,
                    current_role: role,
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                // Store user locally
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(offlineUser));
                setUser(offlineUser);
                setSessionNotice(null);
                
                console.log('✅ AuthContext: Offline mode activated, user created locally');
                return; // Skip database operations
            }

            // No capacity limits - users can join with any role

            // Generate consistent user ID based on name and role
            const userId = generateUserId(displayName, role);

            // Check if user already exists in database
            console.log('🔍 AuthContext: Checking if user exists...');
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error('❌ AuthContext: Error checking existing user:', checkError);
                throw new Error(`Failed to check existing user: ${checkError.message}`);
            }

            let newUser: User;
            
            if (existingUser) {
                console.log('✅ AuthContext: Found existing user:', existingUser);
                // Update the existing user's last login time
                const { data: updatedUser, error: updateError } = await supabase
                    .from('users')
                    .update({
                        current_role: role,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userId)
                    .select()
                    .single();

                if (updateError) {
                    console.error('❌ AuthContext: Error updating user:', updateError);
                    throw new Error(`Failed to update user: ${updateError.message}`);
                }
                
                newUser = updatedUser;
            } else {
                // Create new user object
                newUser = {
                    id: userId,
                    display_name: displayName,
                    current_role: role,
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                console.log('👤 AuthContext: Creating user object:', newUser);

                // Store user in the database (without Supabase Auth)
                console.log('💾 AuthContext: Inserting user into database...');
                const { data: insertData, error: profileError } = await supabase
                    .from('users')
                    .insert({
                        id: newUser.id,
                        display_name: newUser.display_name,
                        current_role: newUser.current_role,
                        status: newUser.status
                    })
                    .select()
                    .single();

                if (profileError) {
                    console.error('❌ AuthContext: Profile creation error:', profileError);
                    throw new Error(`Failed to create profile: ${profileError.message}`);
                }

                console.log('✅ AuthContext: User created in database:', insertData);
                newUser = insertData;
            }

            // Store user locally
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
            console.log('💾 AuthContext: User saved to localStorage');

            // Set user state - this should trigger re-render
            setUser(newUser);
            setSessionNotice(null);
            console.log('📢 AuthContext: User state updated');

            // Small delay to ensure state propagates
            await new Promise(resolve => setTimeout(resolve, 100));

            console.log('🎉 AuthContext: User joined successfully!', {
                id: newUser.id,
                displayName: newUser.display_name,
                role: newUser.current_role
            });
        } catch (error) {
            console.error('💥 AuthContext: Join failed:', error);
            throw error;
        } finally {
            // Always set loading to false in finally block
            setLoading(false);
        }
    };

    const signOut = async (): Promise<void> => {
        console.log('👋 AuthContext: Signing out...');
        // Don't delete user from database - just clear local session
        // This preserves user data and room associations
        
        // Clear local storage
        localStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
        console.log('✅ AuthContext: Sign out complete');
    };

    const setUserRole = async (role: UserRole): Promise<void> => {
        const user = userRef.current;
        if (!user) throw new Error('No user logged in');
        const generation = generationRef.current;

        console.log('🎭 AuthContext: Setting user role to:', role);

        // No capacity limits - users can switch to any role

        // Update user role in database
        console.log('📝 AuthContext: Updating user role in database...');
        const { error } = await supabase
            .from('users')
            .update({
                current_role: role,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
            .select()
            .single();

        if (error) {
            console.error('❌ AuthContext: Error updating role:', error);
            throw error;
        }
        // This tab signed out or changed identity while the update was in flight; write nothing back.
        if (!stillCurrent(generation, user)) {
            console.log('ℹ️  AuthContext: Identity changed during role update; not writing it back');
            return;
        }

        // Update local user
        const updatedUser = {
            ...user,
            current_role: role,
            updated_at: new Date().toISOString()
        };

        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
        setUser(updatedUser);

        console.log('✅ AuthContext: Role updated successfully:', {
            userId: updatedUser.id,
            newRole: updatedUser.current_role
        });
    };

    const updateUserProfile = async (updates: Partial<Pick<User, 'display_name' | 'avatar_url'>>): Promise<void> => {
        const user = userRef.current;
        if (!user) throw new Error('No user logged in');
        const generation = generationRef.current;

        console.log('👤 AuthContext: Updating user profile:', updates);

        // Update user profile in database
        console.log('📝 AuthContext: Updating user profile in database...');
        const { error } = await supabase
            .from('users')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
            .select()
            .single();

        if (error) {
            console.error('❌ AuthContext: Error updating profile:', error);
            throw error;
        }
        if (!stillCurrent(generation, user)) {
            console.log('ℹ️  AuthContext: Identity changed during profile update; not writing it back');
            return;
        }

        // Update local user, keeping any same-identity change (such as a new avatar) made meanwhile
        const updatedUser = {
            ...userRef.current!,
            ...updates,
            updated_at: new Date().toISOString()
        };

        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
        setUser(updatedUser);

        console.log('✅ AuthContext: Profile updated successfully:', {
            userId: updatedUser.id,
            updates
        });
    };

    const value: AuthContextType = {
        user,
        loading,
        sessionNotice,
        joinWithNameAndRole,
        signOut,
        setUserRole,
        updateUserProfile
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}; 
