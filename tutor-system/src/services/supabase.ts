import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/database'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!

console.log('🔧 Supabase Service: Initializing client', {
    url: supabaseUrl ? 'SET' : 'MISSING',
    key: supabaseAnonKey ? 'SET (length: ' + supabaseAnonKey.length + ')' : 'MISSING'
});

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
})

// Helper function to get current user
export const getCurrentUser = async () => {
    console.log('👤 Supabase Service: Getting current user...');
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
        console.error('❌ Supabase Service: Get user error:', error);
        throw error;
    }
    console.log('✅ Supabase Service: Current user retrieved:', { hasUser: !!user, userId: user?.id });
    return user
}

// Helper function to sign out
export const signOut = async () => {
    console.log('👋 Supabase Service: Signing out...');
    const { error } = await supabase.auth.signOut()
    if (error) {
        console.error('❌ Supabase Service: Sign out error:', error);
        throw error;
    }
    console.log('✅ Supabase Service: Sign out successful');
}

// Helper function to get user profile
export const getUserProfile = async (userId: string) => {
    console.log('👤 Supabase Service: Getting user profile for:', userId);
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

    if (error) {
        console.error('❌ Supabase Service: Get user profile error:', error);
        throw error;
    }
    console.log('✅ Supabase Service: User profile retrieved:', {
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        role: data.current_role
    });
    return data
}

// Helper function to update user profile
export const updateUserProfile = async (userId: string, updates: any) => {
    console.log('📝 Supabase Service: Updating user profile:', { userId, updates });
    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

    if (error) {
        console.error('❌ Supabase Service: Update user profile error:', error);
        throw error;
    }
    console.log('✅ Supabase Service: User profile updated:', {
        id: data.id,
        updatedFields: Object.keys(updates)
    });
    return data
} 