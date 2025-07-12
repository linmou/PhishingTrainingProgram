import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContextType, User, UserRole } from '../types';
import { supabase } from '../services/supabase';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Generate a consistent user ID based on display name and role
const generateUserId = (displayName: string, role: UserRole) => {
    // Normalize the display name: lowercase, trim, remove extra spaces
    const normalized = displayName.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Create a simple hash from the normalized name and role
    const input = `${normalized}-${role}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to a UUID-like format for consistency
    const hashStr = Math.abs(hash).toString(16).padStart(8, '0');
    return `${hashStr}-${role.substring(0, 4)}-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Local storage keys
const USER_STORAGE_KEY = 'tutor_system_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user exists in local storage
        const initializeAuth = async () => {
            try {
                console.log('🔄 AuthContext: Initializing simple auth...');
                const storedUser = localStorage.getItem(USER_STORAGE_KEY);

                if (storedUser) {
                    const userData = JSON.parse(storedUser);
                    console.log('✅ AuthContext: Found stored user:', {
                        id: userData.id,
                        displayName: userData.display_name,
                        role: userData.current_role
                    });
                    setUser(userData);
                } else {
                    console.log('ℹ️  AuthContext: No stored user found');
                }
            } catch (error) {
                console.error('💥 AuthContext: Error loading stored user:', error);
                localStorage.removeItem(USER_STORAGE_KEY);
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();
    }, []);

    const joinWithNameAndRole = async (displayName: string, role: UserRole): Promise<void> => {
        setLoading(true);
        try {
            console.log('🚀 AuthContext: Starting join process...', { displayName, role });

            // Test Supabase connection first
            console.log('🔗 AuthContext: Testing Supabase connection...');
            const { error: testError } = await supabase
                .from('users')
                .select('count')
                .limit(1);

            if (testError) {
                console.error('❌ AuthContext: Supabase connection failed:', testError);
                throw new Error(`Database connection failed: ${testError.message}`);
            }
            console.log('✅ AuthContext: Supabase connection successful');

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
        if (!user) throw new Error('No user logged in');

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

    const value: AuthContextType = {
        user,
        loading,
        joinWithNameAndRole,
        signOut,
        setUserRole
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}; 