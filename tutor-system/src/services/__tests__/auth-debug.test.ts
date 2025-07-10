/**
 * Authentication Debug Test
 * 
 * This test helps debug why storage uploads are failing despite having the correct policy
 */

import { supabase } from '../supabase';

describe('Authentication Debug', () => {
    it('should check current authentication state', async () => {
        console.log('🔍 === AUTHENTICATION DEBUG ===');
        
        // Check current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('📊 Session check:', {
            hasSession: !!session,
            sessionError: sessionError?.message,
            userId: session?.user?.id,
            userEmail: session?.user?.email,
            userRole: session?.user?.role,
            accessToken: session?.access_token ? 'Present' : 'Missing',
            refreshToken: session?.refresh_token ? 'Present' : 'Missing'
        });

        // Check current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('👤 User check:', {
            hasUser: !!user,
            userError: userError?.message,
            userId: user?.id,
            userEmail: user?.email,
            userMetadata: user?.user_metadata,
            appMetadata: user?.app_metadata
        });

        // Test if we can query the users table (this requires authentication)
        try {
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('id, email, current_role')
                .limit(1);
            
            console.log('🗄️  Database query test:', {
                canQueryUsers: !usersError,
                usersError: usersError?.message,
                userCount: users?.length || 0
            });
        } catch (err) {
            console.log('❌ Database query failed:', err.message);
        }

        // Test storage bucket access
        try {
            const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
            console.log('🪣 Storage bucket access:', {
                canListBuckets: !bucketsError,
                bucketsError: bucketsError?.message,
                bucketNames: buckets?.map(b => b.name) || []
            });

            // Check if room-images bucket exists
            const roomImagesBucket = buckets?.find(b => b.name === 'room-images');
            console.log('📸 Room images bucket:', {
                exists: !!roomImagesBucket,
                details: roomImagesBucket
            });
        } catch (err) {
            console.log('❌ Storage access failed:', err.message);
        }

        // Test creating a very simple auth session for testing
        console.log('💡 To fix authentication, you can:');
        console.log('1. Log in through your app UI first');
        console.log('2. Or create a test user in Supabase Auth dashboard');
        console.log('3. Or use signInAnonymously if enabled');
        
        // This test always passes - it's just for debugging
        expect(true).toBe(true);
    });

    it('should test anonymous authentication if enabled', async () => {
        try {
            // Try anonymous sign in (might not be enabled)
            const { data, error } = await supabase.auth.signInAnonymously();
            
            if (error) {
                console.log('🔒 Anonymous auth not available:', error.message);
            } else {
                console.log('✅ Anonymous auth successful:', {
                    userId: data.user?.id,
                    hasSession: !!data.session
                });
                
                // Test storage access with anonymous auth
                const testFile = new File(['test'], 'auth-test.jpg', { type: 'image/jpeg' });
                const testPath = `auth-test/${Date.now()}-test.jpg`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('room-images')
                    .upload(testPath, testFile);
                
                console.log('📤 Upload test with anonymous auth:', {
                    success: !uploadError,
                    error: uploadError?.message,
                    path: uploadData?.path
                });
                
                // Clean up
                if (uploadData) {
                    await supabase.storage.from('room-images').remove([testPath]);
                }
                
                // Sign out
                await supabase.auth.signOut();
            }
        } catch (err) {
            console.log('⚠️  Anonymous auth test failed:', err.message);
        }
        
        expect(true).toBe(true);
    });
});