/**
 * Unit Tests for Image Upload Functionality
 * 
 * Test Strategy: "Test avatar uploads for users and image uploads for tutors with file validation, storage operations, and RLS policies"
 * 
 * This test suite covers:
 * - Avatar upload/update/delete for users
 * - Tutor image upload/management in rooms
 * - File validation (size, type, dimensions)
 * - Storage bucket operations with proper permissions
 * - Database operations for image metadata
 * - Error handling and edge cases
 * 
 * Red Phase: These tests will fail initially as the implementation doesn't exist yet
 * 
 * Run with: npm test src/services/__tests__/imageUpload.test.ts
 */

import { TutorImage, ImageValidationResult } from '../../types';

// Mock storage operations
const mockStorageOperations = {
    upload: jest.fn(),
    remove: jest.fn(),
    download: jest.fn(),
    getPublicUrl: jest.fn(),
    list: jest.fn()
};

// Mock Supabase client
jest.mock('../supabase', () => ({
    supabase: {
        from: jest.fn(),
        storage: {
            from: jest.fn(() => mockStorageOperations)
        },
        auth: {
            getUser: jest.fn()
        }
    }
}));

import { supabase } from '../supabase';
import { uploadAvatarImage, deleteAvatarImage, uploadTutorImage, deleteTutorImage, validateImageFile } from '../imageUpload';

// Get the mocked supabase client
const mockSupabaseClient = supabase as jest.Mocked<typeof supabase>;

// Mock Image constructor for dimension testing
global.Image = class {
    width = 1024;
    height = 768;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    
    set src(value: string) {
        setTimeout(() => {
            if (this.onload) this.onload();
        }, 0);
    }
} as any;

// Mock URL for createObjectURL/revokeObjectURL
global.URL = {
    createObjectURL: jest.fn(() => 'blob:mock-url'),
    revokeObjectURL: jest.fn()
} as any;

describe('Image Upload Functionality Tests', () => {
    let mockUser: { id: string; current_role: string };
    let mockTutorImage: TutorImage;
    let mockImageFile: File;
    let mockInvalidImageFile: File;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup test user
        mockUser = {
            id: 'test-user-id',
            current_role: 'tutor'
        };

        // Setup test tutor image data
        mockTutorImage = {
            id: 'test-image-id',
            tutor_id: 'test-user-id',
            room_id: 'test-room-id',
            image_url: 'https://test-bucket.supabase.co/storage/v1/object/public/tutor-images/test-user-id/image.jpg',
            filename: 'test-image.jpg',
            file_size: 1024000, // 1MB
            upload_date: '2024-01-01T00:00:00Z',
            is_active: true
        };

        // Create mock image files
        mockImageFile = new File(['fake image content'], 'test-image.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now()
        });

        mockInvalidImageFile = new File(['fake large content'.repeat(1000000)], 'large-image.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now()
        });

        // Mock user authentication
        mockSupabaseClient.auth.getUser.mockResolvedValue({
            data: { user: { id: mockUser.id } },
            error: null
        });
    });

    describe('File Validation', () => {
        it('should validate correct image file successfully', async () => {
            const result = await validateImageFile(mockImageFile);
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.fileSize).toBe(mockImageFile.size);
            expect(result.fileType).toBe('image/jpeg');
        });

        it('should reject non-image files', async () => {
            const textFile = new File(['text content'], 'document.txt', {
                type: 'text/plain'
            });

            const result = await validateImageFile(textFile);
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('File must be an image (JPEG, PNG, GIF, or WebP)');
        });

        it('should reject files that are too large', async () => {
            // Mock a file larger than 5MB
            const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', {
                type: 'image/jpeg'
            });

            const result = await validateImageFile(largeFile);
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('File size must be less than 5MB');
        });

        it('should reject files with invalid extensions', async () => {
            const invalidFile = new File(['fake content'], 'image.bmp', {
                type: 'image/bmp'
            });

            const result = await validateImageFile(invalidFile);
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('File must be an image (JPEG, PNG, GIF, or WebP)');
        });

        it('should validate image dimensions when provided', async () => {
            // This would require reading actual image data in real implementation
            const result = await validateImageFile(mockImageFile, { maxWidth: 1920, maxHeight: 1080 });
            
            expect(result.isValid).toBe(true);
            expect(result.dimensions).toBeDefined();
        });
    });

    describe('Avatar Upload Operations', () => {
        beforeEach(() => {
            // Mock successful storage operations
            mockStorageOperations.upload.mockResolvedValue({
                data: { path: 'avatars/test-user-id/avatar.jpg' },
                error: null
            });

            mockStorageOperations.getPublicUrl.mockReturnValue({
                data: { publicUrl: 'https://test-bucket.supabase.co/storage/v1/object/public/avatars/test-user-id/avatar.jpg' }
            });

            // Mock database update for avatar_url
            const mockChain = {
                update: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        select: jest.fn().mockResolvedValue({
                            data: [{ id: mockUser.id, avatar_url: 'https://test-bucket.supabase.co/storage/v1/object/public/avatars/test-user-id/avatar.jpg' }],
                            error: null
                        })
                    }))
                }))
            };

            mockSupabaseClient.from.mockReturnValue(mockChain);
        });

        it('should upload avatar successfully for authenticated user', async () => {
            const result = await uploadAvatarImage(mockImageFile);

            expect(result.success).toBe(true);
            expect(result.avatarUrl).toContain('avatars/test-user-id');
            expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('avatars');
            expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
        });

        it('should replace existing avatar when uploading new one', async () => {
            // Mock existing avatar removal
            mockStorageOperations.remove.mockResolvedValue({
                data: null,
                error: null
            });

            const result = await uploadAvatarImage(mockImageFile);

            expect(result.success).toBe(true);
            expect(result.previousAvatarRemoved).toBe(true);
        });

        it('should fail avatar upload for unauthenticated user', async () => {
            mockSupabaseClient.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: null
            });

            const result = await uploadAvatarImage(mockImageFile);

            expect(result.success).toBe(false);
            expect(result.error).toBe('User not authenticated');
        });

        it('should handle storage upload errors gracefully', async () => {
            mockStorageOperations.upload.mockResolvedValue({
                data: null,
                error: { message: 'Storage upload failed' }
            });

            const result = await uploadAvatarImage(mockImageFile);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Storage upload failed');
        });

        it('should delete avatar successfully', async () => {
            mockStorageOperations.remove.mockResolvedValue({
                data: null,
                error: null
            });

            // Mock database update to remove avatar_url
            const mockChain = {
                update: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        select: jest.fn().mockResolvedValue({
                            data: [{ id: mockUser.id, avatar_url: null }],
                            error: null
                        })
                    }))
                }))
            };

            mockSupabaseClient.from.mockReturnValue(mockChain);

            const result = await deleteAvatarImage();

            expect(result.success).toBe(true);
            expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('avatars');
        });
    });

    describe('Tutor Image Upload Operations', () => {
        beforeEach(() => {
            // Mock successful storage operations
            mockStorageOperations.upload.mockResolvedValue({
                data: { path: 'tutor-images/test-user-id/room-image.jpg' },
                error: null
            });

            mockStorageOperations.getPublicUrl.mockReturnValue({
                data: { publicUrl: 'https://test-bucket.supabase.co/storage/v1/object/public/tutor-images/test-user-id/room-image.jpg' }
            });

            // Mock database insert for tutor_images table
            const mockChain = {
                insert: jest.fn(() => ({
                    select: jest.fn().mockResolvedValue({
                        data: [mockTutorImage],
                        error: null
                    })
                }))
            };

            mockSupabaseClient.from.mockReturnValue(mockChain);
        });

        it('should upload tutor image successfully', async () => {
            const result = await uploadTutorImage(mockImageFile, 'test-room-id');

            expect(result.success).toBe(true);
            expect(result.tutorImage).toEqual(mockTutorImage);
            expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('tutor-images');
            expect(mockSupabaseClient.from).toHaveBeenCalledWith('tutor_images');
        });

        it('should fail tutor image upload for non-tutor user', async () => {
            mockSupabaseClient.auth.getUser.mockResolvedValue({
                data: { user: { id: 'student-id' } },
                error: null
            });

            // Mock user query to return student role
            const mockChain = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: { current_role: 'student' },
                            error: null
                        })
                    }))
                }))
            };

            mockSupabaseClient.from.mockReturnValue(mockChain);

            const result = await uploadTutorImage(mockImageFile, 'test-room-id');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Only tutors can upload images');
        });

        it('should generate unique filename for tutor images', async () => {
            await uploadTutorImage(mockImageFile, 'test-room-id');

            const uploadCall = mockStorageOperations.upload.mock.calls[0];
            const filePath = uploadCall[0];
            
            expect(filePath).toMatch(/^test-user-id\/\d{13}-test-image\.jpg$/);
        });

        it('should store image metadata in database', async () => {
            await uploadTutorImage(mockImageFile, 'test-room-id');

            const insertCall = mockSupabaseClient.from().insert.mock.calls[0];
            const imageData = insertCall[0];

            expect(imageData).toMatchObject({
                tutor_id: mockUser.id,
                room_id: 'test-room-id',
                filename: 'test-image.jpg',
                file_size: mockImageFile.size,
                is_active: true
            });
        });

        it('should delete tutor image successfully', async () => {
            // Mock database operations for deletion
            const mockSelectChain = {
                select: jest.fn(() => ({
                    eq: jest.fn().mockResolvedValue({
                        data: [mockTutorImage],
                        error: null
                    })
                }))
            };

            const mockUpdateChain = {
                update: jest.fn(() => ({
                    eq: jest.fn().mockResolvedValue({
                        data: [{ ...mockTutorImage, is_active: false }],
                        error: null
                    })
                }))
            };

            mockSupabaseClient.from
                .mockReturnValueOnce(mockSelectChain)
                .mockReturnValueOnce(mockUpdateChain);

            mockStorageOperations.remove.mockResolvedValue({
                data: null,
                error: null
            });

            const result = await deleteTutorImage('test-image-id');

            expect(result.success).toBe(true);
            expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('tutor-images');
        });

        it('should handle tutor image not found during deletion', async () => {
            const mockChain = {
                select: jest.fn(() => ({
                    eq: jest.fn().mockResolvedValue({
                        data: [],
                        error: null
                    })
                }))
            };

            mockSupabaseClient.from.mockReturnValue(mockChain);

            const result = await deleteTutorImage('non-existent-id');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Image not found or access denied');
        });
    });

    describe('Storage Bucket Operations', () => {
        it('should list user avatars with proper path filtering', async () => {
            mockStorageOperations.list.mockResolvedValue({
                data: [
                    { name: 'avatar.jpg', metadata: { size: 1024 } },
                    { name: 'profile.png', metadata: { size: 2048 } }
                ],
                error: null
            });

            // This would be part of a service function to list user images
            const mockListAvatars = async (userId: string) => {
                return mockStorageOperations.list(userId);
            };

            const result = await mockListAvatars(mockUser.id);

            expect(result.data).toHaveLength(2);
            expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('avatars');
        });

        it('should handle storage bucket permissions correctly', async () => {
            // Test that storage operations respect RLS policies
            mockStorageOperations.upload.mockResolvedValue({
                data: null,
                error: { message: 'Access denied: insufficient permissions' }
            });

            const result = await uploadAvatarImage(mockImageFile);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Access denied');
        });

        it('should generate correct public URLs for images', async () => {
            const mockUrl = 'https://test-bucket.supabase.co/storage/v1/object/public/avatars/test-user-id/avatar.jpg';
            
            mockStorageOperations.getPublicUrl.mockReturnValue({
                data: { publicUrl: mockUrl }
            });

            await uploadAvatarImage(mockImageFile);

            expect(mockStorageOperations.getPublicUrl).toHaveBeenCalledWith(
                expect.stringContaining('test-user-id/avatar.jpg')
            );
        });
    });

    describe('Database Integration', () => {
        it('should update user avatar_url field correctly', async () => {
            const mockChain = {
                update: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        select: jest.fn().mockResolvedValue({
                            data: [{ 
                                id: mockUser.id, 
                                avatar_url: 'https://test-bucket.supabase.co/storage/v1/object/public/avatars/test-user-id/avatar.jpg' 
                            }],
                            error: null
                        })
                    }))
                }))
            };

            mockSupabaseClient.from.mockReturnValue(mockChain);

            await uploadAvatarImage(mockImageFile);

            expect(mockChain.update).toHaveBeenCalledWith({
                avatar_url: expect.stringContaining('avatars/test-user-id')
            });
            expect(mockChain.eq).toHaveBeenCalledWith('id', mockUser.id);
        });

        it('should create tutor_images record with all required fields', async () => {
            const mockChain = {
                insert: jest.fn(() => ({
                    select: jest.fn().mockResolvedValue({
                        data: [mockTutorImage],
                        error: null
                    })
                }))
            };

            mockSupabaseClient.from.mockReturnValue(mockChain);

            await uploadTutorImage(mockImageFile, 'test-room-id');

            expect(mockChain.insert).toHaveBeenCalledWith({
                tutor_id: mockUser.id,
                room_id: 'test-room-id',
                image_url: expect.any(String),
                filename: 'test-image.jpg',
                file_size: mockImageFile.size,
                is_active: true
            });
        });

        it('should handle database constraint violations', async () => {
            const mockChain = {
                insert: jest.fn(() => ({
                    select: jest.fn().mockResolvedValue({
                        data: null,
                        error: { message: 'Foreign key constraint violation', code: '23503' }
                    })
                }))
            };

            mockSupabaseClient.from.mockReturnValue(mockChain);

            const result = await uploadTutorImage(mockImageFile, 'invalid-room-id');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Foreign key constraint violation');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle network errors gracefully', async () => {
            mockStorageOperations.upload.mockRejectedValue(
                new Error('Network error')
            );

            const result = await uploadAvatarImage(mockImageFile);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Network error');
        });

        it('should handle file reading errors', async () => {
            const corruptedFile = new File([''], 'corrupted.jpg', {
                type: 'image/jpeg'
            });

            const result = await validateImageFile(corruptedFile);
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Unable to read file');
        });

        it('should cleanup failed uploads', async () => {
            // Mock upload success but database failure
            mockStorageOperations.upload.mockResolvedValue({
                data: { path: 'avatars/test-user-id/avatar.jpg' },
                error: null
            });

            const mockChain = {
                update: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        select: jest.fn().mockResolvedValue({
                            data: null,
                            error: { message: 'Database error' }
                        })
                    }))
                }))
            };

            mockSupabaseClient.from.mockReturnValue(mockChain);

            // Mock cleanup removal
            mockStorageOperations.remove.mockResolvedValue({
                data: null,
                error: null
            });

            const result = await uploadAvatarImage(mockImageFile);

            expect(result.success).toBe(false);
            expect(mockStorageOperations.remove).toHaveBeenCalled();
        });

        it('should validate room access for tutor images', async () => {
            // Mock room access check
            const mockChain = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { message: 'Room not found or access denied' }
                        })
                    }))
                }))
            };

            mockSupabaseClient.from.mockReturnValue(mockChain);

            const result = await uploadTutorImage(mockImageFile, 'unauthorized-room-id');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Room not found or access denied');
        });
    });
});