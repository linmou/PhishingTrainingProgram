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
    pre_populated_dialogue?: any[] | null;
    op_id?: string | null;
    op_display_name?: string | null;
    op_avatar_url?: string | null;
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
    
    // Get room details first to verify it exists and is active
    const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .eq('is_active', true)
        .single()

    if (roomError) {
        console.error('❌ Supabase Service: Room not found or inactive:', roomError);
        throw roomError;
    }

    // Verify the observer user exists
    const { data: observer, error: observerError } = await supabase
        .from('users')
        .select('id, display_name, current_role')
        .eq('id', observerId)
        .eq('current_role', 'observer')
        .single()

    if (observerError) {
        console.error('❌ Supabase Service: Observer user not found:', observerError);
        throw new Error('Observer user not found or invalid role');
    }

    // Observers don't need session records - they can join directly
    // Just return success since the room exists and observer is valid
    console.log('✅ Supabase Service: Observer can join room successfully');
    return { 
        success: true, 
        room: room,
        observer: observer
    }
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

// Avatar and Image Management Functions
export const uploadAvatar = async (file: File) => {
    console.log('🎭 Supabase Service: Uploading avatar:', { fileName: file.name, size: file.size });
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    const filePath = `${user.id}/avatar${fileExtension}`;

    // Remove existing avatar if any
    try {
        await supabase.storage.from('avatars').remove([filePath]);
    } catch (error) {
        // Ignore errors for non-existent files
    }

    const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
        });

    if (error) {
        console.error('❌ Supabase Service: Avatar upload error:', error);
        throw error;
    }

    const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

    // Update user profile with new avatar URL
    await updateUserProfile(user.id, { avatar_url: publicUrl });

    console.log('✅ Supabase Service: Avatar uploaded successfully');
    return { path: data.path, url: publicUrl };
}

export const deleteAvatar = async () => {
    console.log('🗑️ Supabase Service: Deleting avatar');
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const profile = await getUserProfile(user.id);
    if (!profile.avatar_url) throw new Error('No avatar to delete');

    // Extract file path from URL
    const urlParts = profile.avatar_url.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const filePath = `${user.id}/${fileName}`;

    const { error } = await supabase.storage
        .from('avatars')
        .remove([filePath]);

    if (error) {
        console.error('❌ Supabase Service: Avatar delete error:', error);
        throw error;
    }

    // Update user profile to remove avatar URL
    await updateUserProfile(user.id, { avatar_url: null });

    console.log('✅ Supabase Service: Avatar deleted successfully');
    return { success: true };
}

export const uploadTutorImage = async (file: File, roomId: string) => {
    console.log('🖼️ Supabase Service: Uploading tutor image:', { fileName: file.name, roomId });
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Verify tutor owns the room
    const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('tutor_id')
        .eq('id', roomId)
        .eq('tutor_id', user.id)
        .single();

    if (roomError || !room) {
        throw new Error('Room not found or access denied');
    }

    const timestamp = Date.now();
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    const filename = file.name.substring(0, file.name.lastIndexOf('.'));
    const filePath = `${user.id}/${timestamp}-${filename}${fileExtension}`;

    const { data, error } = await supabase.storage
        .from('tutor-images')
        .upload(filePath, file, {
            cacheControl: '3600'
        });

    if (error) {
        console.error('❌ Supabase Service: Tutor image upload error:', error);
        throw error;
    }

    const { data: { publicUrl } } = supabase.storage
        .from('tutor-images')
        .getPublicUrl(filePath);

    // Create database record
    const { data: tutorImageData, error: dbError } = await supabase
        .from('tutor_images')
        .insert({
            tutor_id: user.id,
            room_id: roomId,
            image_url: publicUrl,
            filename: file.name,
            file_size: file.size,
            is_active: true
        })
        .select()
        .single();

    if (dbError) {
        // Cleanup uploaded file if database insert fails
        await supabase.storage.from('tutor-images').remove([filePath]);
        console.error('❌ Supabase Service: Tutor image database error:', dbError);
        throw dbError;
    }

    console.log('✅ Supabase Service: Tutor image uploaded successfully');
    return { ...data, url: publicUrl, dbRecord: tutorImageData };
}

export const deleteTutorImage = async (imageId: string) => {
    console.log('🗑️ Supabase Service: Deleting tutor image:', imageId);
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Get image data and verify ownership
    const { data: imageData, error: imageError } = await supabase
        .from('tutor_images')
        .select('*')
        .eq('id', imageId)
        .eq('tutor_id', user.id)
        .single();

    if (imageError || !imageData) {
        throw new Error('Image not found or access denied');
    }

    // Extract file path from URL
    const urlParts = imageData.image_url.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const filePath = `${user.id}/${fileName}`;

    const { error: storageError } = await supabase.storage
        .from('tutor-images')
        .remove([filePath]);

    if (storageError) {
        console.error('❌ Supabase Service: Tutor image storage delete error:', storageError);
        throw storageError;
    }

    // Mark as inactive in database (soft delete)
    const { error: dbError } = await supabase
        .from('tutor_images')
        .update({ is_active: false })
        .eq('id', imageId);

    if (dbError) {
        console.error('❌ Supabase Service: Tutor image database update error:', dbError);
        throw dbError;
    }

    console.log('✅ Supabase Service: Tutor image deleted successfully');
    return { success: true };
}

export const getTutorImages = async (roomId?: string) => {
    console.log('🖼️ Supabase Service: Getting tutor images:', { roomId });
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    let query = supabase
        .from('tutor_images')
        .select('*')
        .eq('tutor_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (roomId) {
        query = query.eq('room_id', roomId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('❌ Supabase Service: Get tutor images error:', error);
        throw error;
    }

    console.log('✅ Supabase Service: Tutor images retrieved:', { count: data?.length || 0 });
    return data || [];
} 