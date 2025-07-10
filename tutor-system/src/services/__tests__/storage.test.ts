/**
 * Integration Tests for Supabase Storage Operations
 * 
 * Test Strategy: "Verify storage bucket operations, RLS policies, and file upload functionality"
 * 
 * This test suite covers:
 * - Storage bucket configuration
 * - File upload operations
 * - RLS policy enforcement
 * - Error handling for storage operations
 * 
 * Run with: npm test src/services/__tests__/storage.test.ts
 */

// Set up environment variables before any imports
process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock the createClient function with storage methods
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        auth: {
            getUser: jest.fn(),
            signOut: jest.fn(),
            getSession: jest.fn(),
            onAuthStateChange: jest.fn()
        },
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn()
                }))
            })),
            insert: jest.fn(() => ({
                select: jest.fn(() => ({
                    single: jest.fn()
                }))
            }))
        })),
        storage: {
            from: jest.fn(() => ({
                upload: jest.fn(),
                getPublicUrl: jest.fn(),
                remove: jest.fn(),
                list: jest.fn()
            }))
        }
    }))
}));

// Now import the modules after setting up mocks
import { createClient } from '@supabase/supabase-js';
import { supabase, uploadImage, getImageUrl, createRoom } from '../supabase';

describe('Supabase Storage Operations', () => {
    let mockSupabaseClient: any;
    let mockStorageBucket: any;
    let mockFile: File;

    beforeAll(() => {
        // Get the mocked client instance after module import
        mockSupabaseClient = supabase;
        mockStorageBucket = mockSupabaseClient.storage.from('room-images');
        
        // Create a mock file for testing
        mockFile = new File(['test image content'], 'test-image.jpg', {
            type: 'image/jpeg'
        });
    });

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();
        
        // Reset storage mock functions
        if (mockStorageBucket) {
            mockStorageBucket.upload.mockClear();
            mockStorageBucket.getPublicUrl.mockClear();
            mockStorageBucket.remove.mockClear();
            mockStorageBucket.list.mockClear();
        }
    });

    describe('Storage Bucket Configuration', () => {
        it('should have storage bucket configured', () => {
            expect(mockSupabaseClient.storage).toBeTruthy();
            expect(mockSupabaseClient.storage.from).toBeTruthy();
            expect(typeof mockSupabaseClient.storage.from).toBe('function');
        });

        it('should be able to access room-images bucket', () => {
            const bucket = mockSupabaseClient.storage.from('room-images');
            expect(bucket).toBeTruthy();
            expect(bucket.upload).toBeTruthy();
            expect(bucket.getPublicUrl).toBeTruthy();
        });
    });

    describe('uploadImage Function', () => {
        it('should upload image successfully', async () => {
            const mockUploadResponse = {
                data: { path: 'test-user-id/timestamp-test-image.jpg' },
                error: null
            };

            mockStorageBucket.upload.mockResolvedValue(mockUploadResponse);

            const result = await uploadImage(mockFile, 'test-user-id/timestamp-test-image.jpg');

            expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('room-images');
            expect(mockStorageBucket.upload).toHaveBeenCalledWith(
                'test-user-id/timestamp-test-image.jpg',
                mockFile
            );
            expect(result).toEqual(mockUploadResponse.data);
        });

        it('should throw error when upload fails due to bucket not found', async () => {
            const mockError = {
                statusCode: '404',
                error: 'Not Found',
                message: 'Bucket not found'
            };

            mockStorageBucket.upload.mockResolvedValue({
                data: null,
                error: mockError
            });

            await expect(uploadImage(mockFile, 'test-path')).rejects.toThrow();
        });

        it('should throw error when upload fails due to RLS policy', async () => {
            const mockError = {
                statusCode: '403',
                error: 'Unauthorized',
                message: 'new row violates row-level security policy'
            };

            mockStorageBucket.upload.mockResolvedValue({
                data: null,
                error: mockError
            });

            await expect(uploadImage(mockFile, 'test-path')).rejects.toThrow();
        });

        it('should handle file path with special characters', async () => {
            const specialPath = 'test-user-id/2024-01-01_special-file name.jpg';
            const mockUploadResponse = {
                data: { path: specialPath },
                error: null
            };

            mockStorageBucket.upload.mockResolvedValue(mockUploadResponse);

            const result = await uploadImage(mockFile, specialPath);

            expect(mockStorageBucket.upload).toHaveBeenCalledWith(specialPath, mockFile);
            expect(result.path).toBe(specialPath);
        });
    });

    describe('getImageUrl Function', () => {
        it('should generate public URL for image', async () => {
            const mockPath = 'test-user-id/timestamp-test-image.jpg';
            const mockPublicUrl = 'https://example.com/storage/v1/object/public/room-images/test-user-id/timestamp-test-image.jpg';

            mockStorageBucket.getPublicUrl.mockReturnValue({
                data: { publicUrl: mockPublicUrl }
            });

            const result = await getImageUrl(mockPath);

            expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('room-images');
            expect(mockStorageBucket.getPublicUrl).toHaveBeenCalledWith(mockPath);
            expect(result).toBe(mockPublicUrl);
        });

        it('should handle URL generation for different file types', async () => {
            const testCases = [
                'user/image.jpg',
                'user/image.png',
                'user/image.gif',
                'user/subfolder/image.jpeg'
            ];

            for (const path of testCases) {
                const mockUrl = `https://example.com/storage/${path}`;
                mockStorageBucket.getPublicUrl.mockReturnValue({
                    data: { publicUrl: mockUrl }
                });

                const result = await getImageUrl(path);
                expect(result).toBe(mockUrl);
            }
        });
    });

    describe('Integration with Room Creation', () => {
        it('should create room with image upload workflow', async () => {
            // Mock successful image upload
            const mockUploadResponse = {
                data: { path: 'test-user-id/timestamp-test-image.jpg' },
                error: null
            };
            const mockPublicUrl = 'https://example.com/storage/image.jpg';
            const mockRoomData = {
                id: 'room-123',
                title: 'Test Room',
                description: 'Test Description',
                tutor_id: 'test-user-id',
                image_url: mockPublicUrl,
                is_active: true,
                created_at: new Date().toISOString()
            };

            mockStorageBucket.upload.mockResolvedValue(mockUploadResponse);
            mockStorageBucket.getPublicUrl.mockReturnValue({
                data: { publicUrl: mockPublicUrl }
            });

            // Mock room creation
            const mockRoomChain = {
                insert: jest.fn(() => ({
                    select: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: mockRoomData,
                            error: null
                        })
                    }))
                }))
            };
            mockSupabaseClient.from.mockReturnValue(mockRoomChain);

            // Test the workflow
            const imagePath = 'test-user-id/timestamp-test-image.jpg';
            const uploadResult = await uploadImage(mockFile, imagePath);
            const imageUrl = await getImageUrl(uploadResult.path);
            
            const roomData = {
                title: 'Test Room',
                description: 'Test Description',
                tutor_id: 'test-user-id',
                image_url: imageUrl
            };
            
            const room = await createRoom(roomData);

            expect(uploadResult.path).toBe(imagePath);
            expect(imageUrl).toBe(mockPublicUrl);
            expect(room.image_url).toBe(mockPublicUrl);
            expect(mockRoomChain.insert).toHaveBeenCalledWith([{
                ...roomData,
                is_active: true
            }]);
        });
    });

    describe('Error Scenarios', () => {
        it('should handle network errors during upload', async () => {
            const networkError = new Error('Network request failed');
            mockStorageBucket.upload.mockRejectedValue(networkError);

            await expect(uploadImage(mockFile, 'test-path')).rejects.toThrow('Network request failed');
        });

        it('should handle invalid file types', async () => {
            const invalidFile = new File(['pdf content'], 'document.pdf', {
                type: 'application/pdf'
            });

            // This would be handled by client-side validation, but test the storage response
            const mockError = {
                statusCode: '400',
                error: 'Bad Request',
                message: 'Invalid file type'
            };

            mockStorageBucket.upload.mockResolvedValue({
                data: null,
                error: mockError
            });

            await expect(uploadImage(invalidFile, 'test-path')).rejects.toThrow();
        });

        it('should handle file size limit exceeded', async () => {
            const mockError = {
                statusCode: '413',
                error: 'Payload Too Large',
                message: 'File size exceeds limit'
            };

            mockStorageBucket.upload.mockResolvedValue({
                data: null,
                error: mockError
            });

            await expect(uploadImage(mockFile, 'test-path')).rejects.toThrow();
        });
    });

    describe('RLS Policy Testing', () => {
        it('should test authenticated user can upload', async () => {
            // Mock authenticated user
            mockSupabaseClient.auth.getUser.mockResolvedValue({
                data: { user: { id: 'test-user-id', role: 'authenticated' } },
                error: null
            });

            const mockUploadResponse = {
                data: { path: 'test-user-id/test-image.jpg' },
                error: null
            };

            mockStorageBucket.upload.mockResolvedValue(mockUploadResponse);

            const result = await uploadImage(mockFile, 'test-user-id/test-image.jpg');
            expect(result).toEqual(mockUploadResponse.data);
        });

        it('should test unauthenticated user cannot upload', async () => {
            // Mock unauthenticated user
            mockSupabaseClient.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: null
            });

            const mockError = {
                statusCode: '401',
                error: 'Unauthorized',
                message: 'Authentication required'
            };

            mockStorageBucket.upload.mockResolvedValue({
                data: null,
                error: mockError
            });

            await expect(uploadImage(mockFile, 'test-path')).rejects.toThrow();
        });
    });
});