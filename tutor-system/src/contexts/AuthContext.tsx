import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContextType, User, UserRole } from '../types';
import { supabase, getCurrentUser, getUserProfile, updateUserProfile } from '../services/supabase';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check environment variables
        console.log('🔧 AuthContext: Environment Check', {
            supabaseUrl: process.env.REACT_APP_SUPABASE_URL ? 'SET' : 'MISSING',
            supabaseKey: process.env.REACT_APP_SUPABASE_ANON_KEY ? 'SET' : 'MISSING'
        });

        // Get initial session
        const initializeAuth = async () => {
            try {
                console.log('🔄 AuthContext: Initializing auth...');
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('❌ AuthContext: Session error:', error);
                    setLoading(false);
                    return;
                }

                console.log('📋 AuthContext: Session data:', {
                    hasSession: !!session,
                    hasUser: !!session?.user,
                    userId: session?.user?.id
                });

                if (session?.user) {
                    await loadUserProfile(session.user.id);
                } else {
                    console.log('ℹ️  AuthContext: No active session found');
                    setLoading(false);
                }
            } catch (error) {
                console.error('💥 AuthContext: Initialization error:', error);
                setLoading(false);
            }
        };

        initializeAuth();

        // Listen for auth changes
        const {
            data: { subscription }
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🔔 AuthContext: Auth state change:', { event, hasSession: !!session });

            if (event === 'SIGNED_IN' && session?.user) {
                await loadUserProfile(session.user.id);
            } else if (event === 'SIGNED_OUT') {
                console.log('👋 AuthContext: User signed out');
                setUser(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const loadUserProfile = async (userId: string) => {
        try {
            console.log('👤 AuthContext: Loading user profile for:', userId);
            const profile = await getUserProfile(userId);
            console.log('✅ AuthContext: Profile loaded:', {
                id: profile.id,
                email: profile.email,
                displayName: profile.display_name,
                role: profile.current_role
            });
            setUser(profile);
        } catch (error) {
            console.error('❌ AuthContext: Error loading user profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const signIn = async (email: string, password: string): Promise<void> => {
        setLoading(true);
        try {
            console.log('🔐 AuthContext: Attempting sign in for:', email);
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            if (error) {
                console.error('❌ AuthContext: Sign in error:', error);
                setLoading(false);
                throw error;
            }
            console.log('✅ AuthContext: Sign in successful');
        } catch (error) {
            console.error('💥 AuthContext: Sign in exception:', error);
            setLoading(false);
            throw error;
        }
    };

    const signUp = async (email: string, password: string, displayName: string): Promise<void> => {
        setLoading(true);
        try {
            console.log('📝 AuthContext: Attempting sign up for:', email);
            const { data, error } = await supabase.auth.signUp({
                email,
                password
            });

            if (error) {
                console.error('❌ AuthContext: Sign up auth error:', error);
                setLoading(false);
                throw error;
            }

            console.log('✅ AuthContext: Auth user created:', {
                hasUser: !!data.user,
                userId: data.user?.id,
                needsConfirmation: !data.session
            });

            if (data.user) {
                // Create user profile
                console.log('👤 AuthContext: Creating user profile...');
                const profileData = {
                    id: data.user.id,
                    email: data.user.email!,
                    display_name: displayName,
                    status: 'active'
                };
                console.log('📋 AuthContext: Profile data:', profileData);

                const { error: profileError } = await supabase
                    .from('users')
                    .insert(profileData);

                if (profileError) {
                    console.error('❌ AuthContext: Profile creation error:', profileError);
                    setLoading(false);
                    throw profileError;
                }

                console.log('✅ AuthContext: User profile created successfully');
            }
        } catch (error) {
            console.error('💥 AuthContext: Sign up exception:', error);
            setLoading(false);
            throw error;
        }
    };

    const signOut = async (): Promise<void> => {
        console.log('👋 AuthContext: Signing out...');
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('❌ AuthContext: Sign out error:', error);
            throw error;
        }
        console.log('✅ AuthContext: Sign out successful');
    };

    const setUserRole = async (role: UserRole): Promise<void> => {
        if (!user) throw new Error('No user logged in');

        console.log('🎭 AuthContext: Setting user role to:', role);

        // Check capacity limits for tutor and student roles only
        // Observer role has unlimited capacity
        if (role === 'tutor' || role === 'student') {
            console.log('📊 AuthContext: Checking role capacity...');
            const { data: currentUsers, error } = await supabase
                .from('users')
                .select('id, current_role')
                .eq('status', 'active')
                .not('current_role', 'is', null);

            if (error) {
                console.error('❌ AuthContext: Error checking capacity:', error);
                throw error;
            }

            // Filter out the current user from the count
            const otherUsers = currentUsers.filter(u => u.id !== user.id);
            const activeTutors = otherUsers.filter(u => u.current_role === 'tutor').length;
            const activeStudents = otherUsers.filter(u => u.current_role === 'student').length;

            console.log('📊 AuthContext: Role capacity check:', {
                activeTutors,
                activeStudents,
                requestedRole: role
            });

            if (role === 'tutor' && activeTutors >= 1) {
                throw new Error('Maximum number of tutors (1) already reached');
            }

            if (role === 'student' && activeStudents >= 1) {
                throw new Error('Maximum number of students (1) already reached');
            }
        }

        // Update user role
        console.log('📝 AuthContext: Updating user role in database...');
        const updatedUser = await updateUserProfile(user.id, {
            current_role: role,
            updated_at: new Date().toISOString()
        });

        console.log('✅ AuthContext: Role updated successfully:', {
            userId: updatedUser.id,
            newRole: updatedUser.current_role
        });
        setUser(updatedUser);
    };

    const value: AuthContextType = {
        user,
        loading,
        signIn,
        signUp,
        signOut,
        setUserRole
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}; 