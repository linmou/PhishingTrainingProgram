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

// Room management functions
export const createRoom = async (roomData: {
    title: string;
    description: string;
    tutor_id: string;
    image_url?: string;
}) => {
    console.log('🏠 Supabase Service: Creating room:', roomData);
    const { data, error } = await supabase
        .from('rooms')
        .insert([{
            ...roomData,
            is_active: true
        }])
        .select()
        .single()

    if (error) {
        console.error('❌ Supabase Service: Create room error:', error);
        throw error;
    }
    console.log('✅ Supabase Service: Room created:', {
        id: data.id,
        title: data.title
    });
    return data
}

export const uploadImage = async (file: File, path: string) => {
    console.log('📸 Supabase Service: Uploading image:', { fileName: file.name, path });
    const { data, error } = await supabase.storage
        .from('room-images')
        .upload(path, file)

    if (error) {
        console.error('❌ Supabase Service: Upload image error:', error);
        throw error;
    }
    console.log('✅ Supabase Service: Image uploaded:', { path: data.path });
    return data
}

export const getImageUrl = async (path: string) => {
    console.log('🔗 Supabase Service: Getting image URL for:', path);
    const { data } = supabase.storage
        .from('room-images')
        .getPublicUrl(path)

    console.log('✅ Supabase Service: Image URL generated:', { url: data.publicUrl });
    return data.publicUrl
}

export const getRoomsByTutor = async (tutorId: string) => {
    console.log('🏠 Supabase Service: Getting rooms for tutor:', tutorId);
    const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('tutor_id', tutorId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('❌ Supabase Service: Get rooms error:', error);
        throw error;
    }
    console.log('✅ Supabase Service: Rooms retrieved:', { count: data?.length || 0 });
    return data || []
}

// Observer-specific functions
export const getRoomsByObserver = async () => {
    console.log('👁️ Supabase Service: Getting rooms for observer');
    const { data, error } = await supabase
        .from('rooms')
        .select(`
            *,
            tutor:users!tutor_id(*)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('❌ Supabase Service: Get observer rooms error:', error);
        throw error;
    }
    console.log('✅ Supabase Service: Observer rooms retrieved:', { count: data?.length || 0 });
    return data || []
}

export const joinRoomAsObserver = async (roomId: string, observerId: string) => {
    console.log('🔗 Supabase Service: Observer joining room:', { roomId, observerId });
    
    // Get room details first
    const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single()

    if (roomError) {
        console.error('❌ Supabase Service: Room not found:', roomError);
        throw roomError;
    }

    // Create session record for observer
    const { data, error } = await supabase
        .from('sessions')
        .insert({
            room_id: roomId,
            tutor_id: room.tutor_id,
            observer_id: observerId,
            status: 'active'
        })
        .select()
        .single()

    if (error) {
        console.error('❌ Supabase Service: Observer join error:', error);
        throw error;
    }
    
    console.log('✅ Supabase Service: Observer joined room successfully');
    return { success: true, session: data }
}

export const getMessagesForRoom = async (roomId: string) => {
    console.log('💬 Supabase Service: Getting messages for room:', roomId);
    const { data, error } = await supabase
        .from('messages')
        .select(`
            *,
            user:users!user_id(display_name)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('❌ Supabase Service: Get messages error:', error);
        throw error;
    }
    console.log('✅ Supabase Service: Messages retrieved:', { count: data?.length || 0 });
    return data || []
}

export const downloadChatHistory = async (roomId: string, messages: any[]) => {
    console.log('📥 Supabase Service: Downloading chat history for room:', roomId);
    
    // Get room details
    const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select(`
            *,
            tutor:users!tutor_id(display_name)
        `)
        .eq('id', roomId)
        .single()

    if (roomError) {
        console.error('❌ Supabase Service: Room not found for download:', roomError);
        throw roomError;
    }

    // Format chat history
    const chatHistory = {
        room: {
            title: room.title,
            description: room.description,
            tutor: room.tutor?.display_name,
            created_at: room.created_at
        },
        messages: messages.map(msg => ({
            content: msg.content,
            user_role: msg.user_role,
            display_name: msg.display_name || msg.user?.display_name,
            created_at: msg.created_at
        })),
        exported_at: new Date().toISOString()
    }

    // Create and download file
    const blob = new Blob([JSON.stringify(chatHistory, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${roomId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('✅ Supabase Service: Chat history downloaded successfully');
    return { success: true }
} 