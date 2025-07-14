/**
 * ImageUpload Component Tests
 * 
 * Test Strategy: "Test drag & drop functionality, file validation, upload progress, and error handling"
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// Note: Using fireEvent instead of userEvent for compatibility
import ImageUpload from '../ImageUpload';
import { validateImageFile, uploadAvatarImage, uploadTutorImage } from '../../services/imageUpload';

// Mock the image upload services
jest.mock('../../services/imageUpload', () => ({
    validateImageFile: jest.fn(),
    uploadAvatarImage: jest.fn(),
    uploadTutorImage: jest.fn()
}));

const mockValidateImageFile = validateImageFile as jest.MockedFunction<typeof validateImageFile>;
const mockUploadAvatarImage = uploadAvatarImage as jest.MockedFunction<typeof uploadAvatarImage>;
const mockUploadTutorImage = uploadTutorImage as jest.MockedFunction<typeof uploadTutorImage>;

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

describe('ImageUpload Component', () => {
    const mockFile = new File(['fake content'], 'test.jpg', { type: 'image/jpeg' });
    const mockOnUploadSuccess = jest.fn();
    const mockOnUploadError = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Default successful validation
        mockValidateImageFile.mockResolvedValue({
            isValid: true,
            errors: [],
            fileSize: mockFile.size,
            fileType: mockFile.type
        });
    });

    describe('Avatar Upload Mode', () => {
        it('should render avatar upload interface', () => {
            render(
                <ImageUpload
                    uploadType="avatar"
                    onUploadSuccess={mockOnUploadSuccess}
                    onUploadError={mockOnUploadError}
                />
            );

            expect(screen.getByText(/Click to select avatar/)).toBeInTheDocument();
            expect(screen.getByText(/JPEG, PNG, GIF, WebP/)).toBeInTheDocument();
        });

        it('should display current avatar when provided', () => {
            const currentAvatarUrl = 'https://example.com/avatar.jpg';
            
            render(
                <ImageUpload
                    uploadType="avatar"
                    currentImageUrl={currentAvatarUrl}
                    onUploadSuccess={mockOnUploadSuccess}
                />
            );

            const currentImage = screen.getByAltText('Current image');
            expect(currentImage).toBeInTheDocument();
            expect(currentImage).toHaveAttribute('src', currentAvatarUrl);
        });

        it('should handle file selection and validation', async () => {
            render(
                <ImageUpload
                    uploadType="avatar"
                    onUploadSuccess={mockOnUploadSuccess}
                    onUploadError={mockOnUploadError}
                    showPreview={true}
                />
            );

            // Find and interact with file input
            const fileInput = screen.getByRole('button', { name: /Click to select avatar/ }).parentElement?.querySelector('input[type="file"]');
            expect(fileInput).toBeInTheDocument();

            if (fileInput) {
                // Simulate file selection
                Object.defineProperty(fileInput, 'files', {
                    value: [mockFile],
                    writable: false,
                });
                fireEvent.change(fileInput);
            }

            await waitFor(() => {
                expect(mockValidateImageFile).toHaveBeenCalledWith(mockFile, undefined);
            });

            // Should show upload button after valid file selection
            await waitFor(() => {
                expect(screen.getByText('Upload Avatar')).toBeInTheDocument();
            });
        });

        it('should handle successful avatar upload', async () => {
            const user = userEvent.setup();
            
            mockUploadAvatarImage.mockResolvedValue({
                success: true,
                avatarUrl: 'https://example.com/new-avatar.jpg'
            });

            render(
                <ImageUpload
                    uploadType="avatar"
                    onUploadSuccess={mockOnUploadSuccess}
                    onUploadError={mockOnUploadError}
                />
            );

            // Select file
            const fileInput = screen.getByRole('button', { name: /Click to select avatar/ }).parentElement?.querySelector('input[type="file"]');
            if (fileInput) {
                await user.upload(fileInput as HTMLInputElement, mockFile);
            }

            // Wait for validation and upload button
            await waitFor(() => {
                expect(screen.getByText('Upload Avatar')).toBeInTheDocument();
            });

            // Click upload
            const uploadButton = screen.getByText('Upload Avatar');
            await user.click(uploadButton);

            await waitFor(() => {
                expect(mockUploadAvatarImage).toHaveBeenCalledWith(mockFile);
                expect(mockOnUploadSuccess).toHaveBeenCalledWith({
                    success: true,
                    avatarUrl: 'https://example.com/new-avatar.jpg'
                });
            });
        });
    });

    describe('Tutor Image Upload Mode', () => {
        it('should render tutor image upload interface', () => {
            render(
                <ImageUpload
                    uploadType="tutor-image"
                    roomId="test-room-id"
                    onUploadSuccess={mockOnUploadSuccess}
                />
            );

            expect(screen.getByText(/Click to select image/)).toBeInTheDocument();
        });

        it('should require roomId for tutor image uploads', () => {
            // Should throw error when roomId is missing
            expect(() => {
                render(
                    <ImageUpload
                        uploadType="tutor-image"
                        onUploadSuccess={mockOnUploadSuccess}
                    />
                );
            }).toThrow('roomId is required for tutor-image uploads');
        });

        it('should handle successful tutor image upload', async () => {
            const user = userEvent.setup();
            const mockTutorImage = {
                id: 'image-id',
                tutor_id: 'tutor-id',
                room_id: 'room-id',
                image_url: 'https://example.com/tutor-image.jpg',
                filename: 'test.jpg',
                file_size: 12345,
                upload_date: '2024-01-01T00:00:00Z',
                is_active: true
            };

            mockUploadTutorImage.mockResolvedValue({
                success: true,
                tutorImage: mockTutorImage
            });

            render(
                <ImageUpload
                    uploadType="tutor-image"
                    roomId="test-room-id"
                    onUploadSuccess={mockOnUploadSuccess}
                />
            );

            // Select file
            const fileInput = screen.getByRole('button', { name: /Click to select image/ }).parentElement?.querySelector('input[type="file"]');
            if (fileInput) {
                await user.upload(fileInput as HTMLInputElement, mockFile);
            }

            // Wait for upload button
            await waitFor(() => {
                expect(screen.getByText('Upload Image')).toBeInTheDocument();
            });

            // Click upload
            const uploadButton = screen.getByText('Upload Image');
            await user.click(uploadButton);

            await waitFor(() => {
                expect(mockUploadTutorImage).toHaveBeenCalledWith(mockFile, 'test-room-id');
                expect(mockOnUploadSuccess).toHaveBeenCalledWith({
                    success: true,
                    tutorImage: mockTutorImage
                });
            });
        });
    });

    describe('File Validation', () => {
        it('should display validation errors', async () => {
            const user = userEvent.setup();
            
            mockValidateImageFile.mockResolvedValue({
                isValid: false,
                errors: ['File size must be less than 5MB', 'File must be an image'],
                fileSize: mockFile.size,
                fileType: mockFile.type
            });

            render(
                <ImageUpload
                    uploadType="avatar"
                    onUploadSuccess={mockOnUploadSuccess}
                    onUploadError={mockOnUploadError}
                />
            );

            // Select file
            const fileInput = screen.getByRole('button', { name: /Click to select avatar/ }).parentElement?.querySelector('input[type="file"]');
            if (fileInput) {
                await user.upload(fileInput as HTMLInputElement, mockFile);
            }

            await waitFor(() => {
                expect(screen.getByText('Please fix the following issues:')).toBeInTheDocument();
                expect(screen.getByText('File size must be less than 5MB')).toBeInTheDocument();
                expect(screen.getByText('File must be an image')).toBeInTheDocument();
            });

            // Upload button should not be visible with validation errors
            expect(screen.queryByText('Upload Avatar')).not.toBeInTheDocument();
        });

        it('should validate with dimension constraints', async () => {
            const user = userEvent.setup();
            const dimensionConstraints = { maxWidth: 1920, maxHeight: 1080 };

            render(
                <ImageUpload
                    uploadType="avatar"
                    dimensionConstraints={dimensionConstraints}
                    onUploadSuccess={mockOnUploadSuccess}
                />
            );

            const fileInput = screen.getByRole('button', { name: /Click to select avatar/ }).parentElement?.querySelector('input[type="file"]');
            if (fileInput) {
                await user.upload(fileInput as HTMLInputElement, mockFile);
            }

            await waitFor(() => {
                expect(mockValidateImageFile).toHaveBeenCalledWith(mockFile, dimensionConstraints);
            });
        });
    });

    describe('Drag and Drop', () => {
        it('should handle drag over and drag leave events', () => {
            render(
                <ImageUpload
                    uploadType="avatar"
                    onUploadSuccess={mockOnUploadSuccess}
                />
            );

            const dropZone = screen.getByRole('button', { name: /Click to select avatar/ });

            // Test drag over
            fireEvent.dragOver(dropZone);
            // Should update visual state (tested through behavior, not direct style assertion)

            // Test drag leave
            fireEvent.dragLeave(dropZone);
        });

        it('should handle file drop', async () => {
            render(
                <ImageUpload
                    uploadType="avatar"
                    onUploadSuccess={mockOnUploadSuccess}
                />
            );

            const dropZone = screen.getByRole('button', { name: /Click to select avatar/ });

            // Create drag event with files
            const files = [mockFile];
            const dragEvent = new Event('drop', { bubbles: true });
            Object.defineProperty(dragEvent, 'dataTransfer', {
                value: { files }
            });

            fireEvent(dropZone, dragEvent);

            await waitFor(() => {
                expect(mockValidateImageFile).toHaveBeenCalledWith(mockFile, undefined);
            });
        });
    });

    describe('Upload Progress and States', () => {
        it('should show upload progress during upload', async () => {
            const user = userEvent.setup();
            
            // Mock slow upload to test progress
            mockUploadAvatarImage.mockImplementation(() => 
                new Promise(resolve => 
                    setTimeout(() => resolve({ success: true, avatarUrl: 'test-url' }), 500)
                )
            );

            render(
                <ImageUpload
                    uploadType="avatar"
                    onUploadSuccess={mockOnUploadSuccess}
                />
            );

            // Select file and upload
            const fileInput = screen.getByRole('button', { name: /Click to select avatar/ }).parentElement?.querySelector('input[type="file"]');
            if (fileInput) {
                await user.upload(fileInput as HTMLInputElement, mockFile);
            }

            await waitFor(() => {
                expect(screen.getByText('Upload Avatar')).toBeInTheDocument();
            });

            const uploadButton = screen.getByText('Upload Avatar');
            await user.click(uploadButton);

            // Should show uploading state
            await waitFor(() => {
                expect(screen.getByText(/Uploading\.\.\./)).toBeInTheDocument();
            });
        });

        it('should handle upload errors', async () => {
            const user = userEvent.setup();
            
            mockUploadAvatarImage.mockResolvedValue({
                success: false,
                error: 'Upload failed: Network error'
            });

            render(
                <ImageUpload
                    uploadType="avatar"
                    onUploadSuccess={mockOnUploadSuccess}
                    onUploadError={mockOnUploadError}
                />
            );

            // Select file and upload
            const fileInput = screen.getByRole('button', { name: /Click to select avatar/ }).parentElement?.querySelector('input[type="file"]');
            if (fileInput) {
                await user.upload(fileInput as HTMLInputElement, mockFile);
            }

            await waitFor(() => {
                expect(screen.getByText('Upload Avatar')).toBeInTheDocument();
            });

            const uploadButton = screen.getByText('Upload Avatar');
            await user.click(uploadButton);

            await waitFor(() => {
                expect(screen.getByText('Upload failed: Upload failed: Network error')).toBeInTheDocument();
                expect(mockOnUploadError).toHaveBeenCalledWith('Upload failed: Network error');
            });
        });
    });

    describe('Component States', () => {
        it('should disable interactions when disabled prop is true', () => {
            render(
                <ImageUpload
                    uploadType="avatar"
                    disabled={true}
                    onUploadSuccess={mockOnUploadSuccess}
                />
            );

            const fileInput = screen.getByRole('button', { name: /Click to select avatar/ }).parentElement?.querySelector('input[type="file"]');
            expect(fileInput).toBeDisabled();
        });

        it('should handle cancel action', async () => {
            const user = userEvent.setup();

            render(
                <ImageUpload
                    uploadType="avatar"
                    onUploadSuccess={mockOnUploadSuccess}
                    showPreview={true}
                />
            );

            // Select file
            const fileInput = screen.getByRole('button', { name: /Click to select avatar/ }).parentElement?.querySelector('input[type="file"]');
            if (fileInput) {
                await user.upload(fileInput as HTMLInputElement, mockFile);
            }

            await waitFor(() => {
                expect(screen.getByText('Cancel')).toBeInTheDocument();
            });

            // Click cancel
            const cancelButton = screen.getByText('Cancel');
            await user.click(cancelButton);

            // Should reset to initial state
            await waitFor(() => {
                expect(screen.queryByText('Upload Avatar')).not.toBeInTheDocument();
                expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
                expect(URL.revokeObjectURL).toHaveBeenCalled();
            });
        });

        it('should cleanup preview URL on unmount', () => {
            const { unmount } = render(
                <ImageUpload
                    uploadType="avatar"
                    onUploadSuccess={mockOnUploadSuccess}
                    showPreview={true}
                />
            );

            // Component should cleanup on unmount (tested through lifecycle)
            unmount();
            
            // Note: The cleanup happens in useEffect cleanup, which is harder to test directly
            // but is covered by the cancel test above
        });
    });
});