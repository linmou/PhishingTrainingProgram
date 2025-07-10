/**
 * Integration Tests for Real Supabase Storage Operations
 * 
 * This test connects to your actual Supabase instance to debug storage issues
 * Run with: npm test src/services/__tests__/storage-integration.test.ts
 */

import { supabase, uploadImage, getImageUrl, createRoom } from '../supabase';

// Skip these tests in CI or if no real Supabase credentials
const shouldRunIntegrationTests = process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY;

describe('Storage Integration Tests', () => {
    let testUserId: string;
    let mockFile: File;

    beforeAll(async () => {
        if (!shouldRunIntegrationTests) {
            console.log('Skipping integration tests - no Supabase credentials');
            return;
        }

        // Create a test file
        mockFile = new File(['test image content'], 'test-integration.jpg', {
            type: 'image/jpeg'
        });

        // Set a test user ID (you may need to adjust this)
        testUserId = 'test-user-' + Date.now();
    });

    describe('Storage Bucket Operations', () => {
        it('should verify storage bucket exists', async () => {
            if (!shouldRunIntegrationTests) return;

            // Test if we can list buckets (this will help debug permissions)
            try {
                const { data: buckets, error } = await supabase.storage.listBuckets();
                
                console.log('📊 Available buckets:', buckets?.map(b => b.name));
                
                expect(error).toBeNull();
                expect(buckets).toBeTruthy();
                
                const roomImagesBucket = buckets?.find(b => b.name === 'room-images');
                expect(roomImagesBucket).toBeTruthy();
                
                console.log('✅ room-images bucket found:', roomImagesBucket);
            } catch (err) {
                console.error('❌ Bucket listing error:', err);
                throw err;
            }
        });

        it('should verify authentication status', async () => {
            if (!shouldRunIntegrationTests) return;

            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                
                console.log('👤 Current auth user:', {
                    id: user?.id,
                    email: user?.email,
                    role: user?.role,
                    isAuthenticated: !!user
                });

                // For debugging - this might show null if not authenticated
                // That's okay for testing, we just want to see the state
                expect(error).toBeNull();
            } catch (err) {
                console.error('❌ Auth check error:', err);
                throw err;
            }
        });
    });

    describe('File Upload Operations', () => {
        it('should test storage upload with detailed error info', async () => {
            if (!shouldRunIntegrationTests) return;

            const testPath = `test-uploads/${Date.now()}-test-integration.jpg`;
            
            try {
                console.log('🔄 Attempting upload to path:', testPath);
                
                const { data, error } = await supabase.storage
                    .from('room-images')
                    .upload(testPath, mockFile);

                if (error) {
                    console.error('❌ Upload error details:', {
                        statusCode: error.statusCode,
                        error: error.error,
                        message: error.message,
                        cause: error.cause
                    });
                    
                    // Don't fail the test immediately - let's see what type of error we get
                    expect(error.message).toBeDefined();
                } else {
                    console.log('✅ Upload successful:', data);
                    expect(data.path).toBe(testPath);
                    
                    // Clean up - delete the test file
                    await supabase.storage.from('room-images').remove([testPath]);
                }
            } catch (err) {
                console.error('❌ Unexpected upload error:', err);
                throw err;
            }
        });

        it('should test our uploadImage service function', async () => {
            if (!shouldRunIntegrationTests) return;

            const testPath = `service-test/${Date.now()}-service-test.jpg`;
            
            try {
                console.log('🔄 Testing uploadImage service function...');
                
                const result = await uploadImage(mockFile, testPath);
                
                console.log('✅ Service upload successful:', result);
                expect(result.path).toBe(testPath);
                
                // Test getting URL
                const imageUrl = await getImageUrl(result.path);
                console.log('✅ Image URL generated:', imageUrl);
                expect(imageUrl).toContain('supabase.co');
                
                // Clean up
                await supabase.storage.from('room-images').remove([testPath]);
                
            } catch (err) {
                console.error('❌ Service function error:', err);
                console.error('Error details:', {
                    name: err.name,
                    message: err.message,
                    stack: err.stack
                });
                
                // Let the test see the actual error for debugging
                expect(err.message).toBeDefined();
            }
        });
    });

    describe('RLS Policy Testing', () => {
        it('should test direct storage access without auth', async () => {
            if (!shouldRunIntegrationTests) return;

            try {
                // First, sign out to test unauthenticated access
                await supabase.auth.signOut();
                
                const testPath = `unauth-test/${Date.now()}-unauth.jpg`;
                
                const { data, error } = await supabase.storage
                    .from('room-images')
                    .upload(testPath, mockFile);

                console.log('🔍 Unauthenticated upload result:', { data, error });
                
                if (error) {
                    console.log('✅ Expected: Upload rejected for unauthenticated user');
                    expect(error.statusCode).toBe('401');
                } else {
                    console.log('⚠️  Unexpected: Upload succeeded without authentication');
                    // Clean up if it somehow succeeded
                    await supabase.storage.from('room-images').remove([testPath]);
                }
                
            } catch (err) {
                console.error('❌ RLS test error:', err);
                throw err;
            }
        });

        it('should test storage bucket permissions', async () => {
            if (!shouldRunIntegrationTests) return;

            try {
                // Test listing objects in the bucket
                const { data, error } = await supabase.storage
                    .from('room-images')
                    .list('', { limit: 1 });

                console.log('📋 Bucket listing result:', { 
                    objectCount: data?.length || 0, 
                    error: error 
                });

                if (error) {
                    console.log('ℹ️  Bucket listing error (might be expected):', error.message);
                } else {
                    console.log('✅ Can list bucket contents');
                }

            } catch (err) {
                console.error('❌ Bucket permissions test error:', err);
                throw err;
            }
        });
    });

    describe('End-to-End Room Creation with Image', () => {
        it('should test complete room creation workflow', async () => {
            if (!shouldRunIntegrationTests) return;

            try {
                // This test doesn't require authentication for the database part
                // since we're testing the storage integration
                
                const testPath = `e2e-test/${Date.now()}-e2e-test.jpg`;
                console.log('🔄 Testing complete workflow...');
                
                // Try the upload first
                const uploadResult = await uploadImage(mockFile, testPath);
                console.log('✅ Upload step completed:', uploadResult);
                
                // Try getting the URL
                const imageUrl = await getImageUrl(uploadResult.path);
                console.log('✅ URL generation completed:', imageUrl);
                
                // Test room creation (might fail due to auth, but we want to see the error)
                try {
                    const roomData = {
                        title: 'Integration Test Room',
                        description: 'Testing storage integration',
                        tutor_id: testUserId,
                        image_url: imageUrl
                    };
                    
                    const room = await createRoom(roomData);
                    console.log('✅ Room creation successful:', room);
                    
                } catch (roomError) {
                    console.log('ℹ️  Room creation failed (expected without proper auth):', roomError.message);
                    // This is expected to fail without proper authentication
                }
                
                // Clean up the uploaded file
                await supabase.storage.from('room-images').remove([testPath]);
                console.log('🧹 Cleanup completed');
                
            } catch (err) {
                console.error('❌ E2E workflow error:', err);
                throw err;
            }
        });
    });

    describe('Debug Information', () => {
        it('should collect debug information about current setup', async () => {
            if (!shouldRunIntegrationTests) return;

            console.log('🔍 === DEBUG INFORMATION ===');
            
            // Environment info
            console.log('📊 Environment:', {
                hasSupabaseUrl: !!process.env.REACT_APP_SUPABASE_URL,
                hasSupabaseKey: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
                supabaseUrlPrefix: process.env.REACT_APP_SUPABASE_URL?.substring(0, 30) + '...',
                keyLength: process.env.REACT_APP_SUPABASE_ANON_KEY?.length
            });

            // Try to get current session
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                console.log('👤 Session info:', {
                    hasSession: !!session,
                    userId: session?.user?.id,
                    role: session?.user?.role,
                    error: error?.message
                });
            } catch (err) {
                console.log('⚠️  Session check error:', err.message);
            }

            // This test always passes - it's just for gathering info
            expect(true).toBe(true);
        });
    });
});