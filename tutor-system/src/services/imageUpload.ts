/**
 * Image Upload Service
 * 
 * Provides functionality for:
 * - Avatar upload/delete for users
 * - Tutor image upload/management for rooms
 * - File validation and processing
 * - Storage bucket operations with proper permissions
 */

import { supabase } from './supabase';
import { TutorImage, ImageValidationResult, ImageUploadResult, ImageDimensions } from '../types';

// Configuration constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

/**
 * Validates an image file for upload
 */
export async function validateImageFile(
    file: File, 
    dimensionConstraints?: ImageDimensions
): Promise<ImageValidationResult> {
    const errors: string[] = [];
    
    // Check if file exists and is readable
    if (!file || file.size === 0) {
        errors.push('Unable to read file');
        return { isValid: false, errors };
    }

    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push('File must be an image (JPEG, PNG, GIF, or WebP)');
    }

    // Check file extension
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
        errors.push('File must be an image (JPEG, PNG, GIF, or WebP)');
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        errors.push('File size must be less than 5MB');
    }

    const result: ImageValidationResult = {
        isValid: errors.length === 0,
        errors,
        fileSize: file.size,
        fileType: file.type
    };

    // If validation passed and dimension constraints provided, check dimensions
    if (result.isValid && dimensionConstraints) {
        try {
            const dimensions = await getImageDimensions(file);
            result.dimensions = dimensions;

            if (dimensionConstraints.maxWidth && dimensions.width > dimensionConstraints.maxWidth) {
                errors.push(`Image width must be less than ${dimensionConstraints.maxWidth}px`);
            }
            if (dimensionConstraints.maxHeight && dimensions.height > dimensionConstraints.maxHeight) {
                errors.push(`Image height must be less than ${dimensionConstraints.maxHeight}px`);
            }
            if (dimensionConstraints.minWidth && dimensions.width < dimensionConstraints.minWidth) {
                errors.push(`Image width must be at least ${dimensionConstraints.minWidth}px`);
            }
            if (dimensionConstraints.minHeight && dimensions.height < dimensionConstraints.minHeight) {
                errors.push(`Image height must be at least ${dimensionConstraints.minHeight}px`);
            }

            result.isValid = errors.length === 0;
        } catch (error) {
            errors.push('Unable to read image dimensions');
            result.isValid = false;
        }
    }

    return result;
}

/**
 * Gets image dimensions from a file
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.width, height: img.height });
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };
        
        img.src = url;
    });
}

/**
 * Uploads or updates user avatar
 */
export async function uploadAvatarImage(file: File): Promise<ImageUploadResult> {
    try {
        // Check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'User not authenticated' };
        }

        // Validate file
        const validation = await validateImageFile(file);
        if (!validation.isValid) {
            return { success: false, error: validation.errors.join(', ') };
        }

        // Generate file path
        const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
        const filePath = `${user.id}/avatar${fileExtension}`;

        // Check for existing avatar and remove it
        let previousAvatarRemoved = false;
        try {
            await supabase.storage.from('avatars').remove([filePath]);
            previousAvatarRemoved = true;
        } catch (error) {
            // Ignore errors when removing non-existent files
        }

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) {
            return { success: false, error: `Storage upload failed: ${uploadError.message}` };
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        // Update user avatar_url in database
        const { data: userData, error: dbError } = await supabase
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id)
            .select()
            .single();

        if (dbError) {
            // Cleanup uploaded file if database update fails
            await supabase.storage.from('avatars').remove([filePath]);
            return { success: false, error: `Database update failed: ${dbError.message}` };
        }

        return {
            success: true,
            avatarUrl: publicUrl,
            previousAvatarRemoved
        };

    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}

/**
 * Deletes user avatar
 */
export async function deleteAvatarImage(): Promise<ImageUploadResult> {
    try {
        // Check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'User not authenticated' };
        }

        // Get current avatar URL to determine file path
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', user.id)
            .single();

        if (userError || !userData.avatar_url) {
            return { success: false, error: 'No avatar found to delete' };
        }

        // Extract file path from URL
        const urlParts = userData.avatar_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const filePath = `${user.id}/${fileName}`;

        // Remove from storage
        const { error: storageError } = await supabase.storage
            .from('avatars')
            .remove([filePath]);

        if (storageError) {
            return { success: false, error: `Storage removal failed: ${storageError.message}` };
        }

        // Update user record to remove avatar_url
        const { data: updatedUser, error: dbError } = await supabase
            .from('users')
            .update({ avatar_url: null })
            .eq('id', user.id)
            .select()
            .single();

        if (dbError) {
            return { success: false, error: `Database update failed: ${dbError.message}` };
        }

        return { success: true };

    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}

/**
 * Uploads tutor image for a specific room
 */
export async function uploadTutorImage(file: File, roomId: string): Promise<ImageUploadResult> {
    try {
        // Check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'User not authenticated' };
        }

        // Check if user is a tutor
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('current_role')
            .eq('id', user.id)
            .single();

        if (userError || userData.current_role !== 'tutor') {
            return { success: false, error: 'Only tutors can upload images' };
        }

        // Validate room access
        const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .select('tutor_id')
            .eq('id', roomId)
            .eq('tutor_id', user.id)
            .single();

        if (roomError || !roomData) {
            return { success: false, error: 'Room not found or access denied' };
        }

        // Validate file
        const validation = await validateImageFile(file);
        if (!validation.isValid) {
            return { success: false, error: validation.errors.join(', ') };
        }

        // Generate unique file path
        const timestamp = Date.now();
        const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
        const filename = file.name.substring(0, file.name.lastIndexOf('.'));
        const filePath = `${user.id}/${timestamp}-${filename}${fileExtension}`;

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('tutor-images')
            .upload(filePath, file, {
                cacheControl: '3600'
            });

        if (uploadError) {
            return { success: false, error: `Storage upload failed: ${uploadError.message}` };
        }

        // Get public URL
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
            return { success: false, error: `Database insert failed: ${dbError.message}` };
        }

        return {
            success: true,
            tutorImage: tutorImageData as TutorImage
        };

    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}

/**
 * Deletes a tutor image
 */
export async function deleteTutorImage(imageId: string): Promise<ImageUploadResult> {
    try {
        // Check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'User not authenticated' };
        }

        // Get image data and verify ownership
        const { data: imageData, error: imageError } = await supabase
            .from('tutor_images')
            .select('*')
            .eq('id', imageId)
            .eq('tutor_id', user.id)
            .single();

        if (imageError || !imageData) {
            return { success: false, error: 'Image not found or access denied' };
        }

        // Extract file path from URL
        const urlParts = imageData.image_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const filePath = `${user.id}/${fileName}`;

        // Remove from storage
        const { error: storageError } = await supabase.storage
            .from('tutor-images')
            .remove([filePath]);

        if (storageError) {
            return { success: false, error: `Storage removal failed: ${storageError.message}` };
        }

        // Mark as inactive in database (soft delete)
        const { data: updatedImage, error: dbError } = await supabase
            .from('tutor_images')
            .update({ is_active: false })
            .eq('id', imageId)
            .select()
            .single();

        if (dbError) {
            return { success: false, error: `Database update failed: ${dbError.message}` };
        }

        return { success: true };

    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}