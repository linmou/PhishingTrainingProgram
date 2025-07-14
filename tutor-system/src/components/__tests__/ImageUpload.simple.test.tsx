/**
 * Simplified ImageUpload Component Tests
 * 
 * Focus on core functionality with compatible testing approach
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('ImageUpload Component - Core Tests', () => {
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

    describe('Rendering', () => {
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
    });

    describe('Props Validation', () => {
        it('should require roomId for tutor image uploads', () => {
            // Suppress console error for this test
            const originalError = console.error;
            console.error = jest.fn();

            expect(() => {
                render(
                    <ImageUpload
                        uploadType="tutor-image"
                        onUploadSuccess={mockOnUploadSuccess}
                    />
                );
            }).toThrow('roomId is required for tutor-image uploads');

            console.error = originalError;
        });

        it('should accept dimension constraints', () => {
            const dimensionConstraints = { maxWidth: 1920, maxHeight: 1080 };

            expect(() => {
                render(
                    <ImageUpload
                        uploadType="avatar"
                        dimensionConstraints={dimensionConstraints}
                        onUploadSuccess={mockOnUploadSuccess}
                    />
                );
            }).not.toThrow();
        });
    });

    describe('File Selection', () => {
        it('should handle file input change', async () => {
            render(
                <ImageUpload
                    uploadType="avatar"
                    onUploadSuccess={mockOnUploadSuccess}
                    onUploadError={mockOnUploadError}
                />
            );

            // Find file input
            const fileInput = document.querySelector('input[type="file"]');
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
        });
    });

    describe('Validation Errors', () => {
        it('should display validation errors', async () => {
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
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                Object.defineProperty(fileInput, 'files', {
                    value: [mockFile],
                    writable: false,
                });
                fireEvent.change(fileInput);
            }

            await waitFor(() => {
                expect(screen.getByText('Please fix the following issues:')).toBeInTheDocument();
                expect(screen.getByText('File size must be less than 5MB')).toBeInTheDocument();
                expect(screen.getByText('File must be an image')).toBeInTheDocument();
            });

            // Upload button should not be visible with validation errors
            expect(screen.queryByText('Upload Avatar')).not.toBeInTheDocument();
        });
    });

    describe('Upload Process', () => {
        it('should handle successful avatar upload', async () => {
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
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                Object.defineProperty(fileInput, 'files', {
                    value: [mockFile],
                    writable: false,
                });
                fireEvent.change(fileInput);
            }

            // Wait for upload button to appear
            await waitFor(() => {
                expect(screen.getByText('Upload Avatar')).toBeInTheDocument();
            });

            // Click upload
            fireEvent.click(screen.getByText('Upload Avatar'));

            await waitFor(() => {
                expect(mockUploadAvatarImage).toHaveBeenCalledWith(mockFile);
            });

            await waitFor(() => {
                expect(mockOnUploadSuccess).toHaveBeenCalledWith({
                    success: true,
                    avatarUrl: 'https://example.com/new-avatar.jpg'
                });
            });
        });

        it('should handle upload errors', async () => {
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
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                Object.defineProperty(fileInput, 'files', {
                    value: [mockFile],
                    writable: false,
                });
                fireEvent.change(fileInput);
            }

            await waitFor(() => {
                expect(screen.getByText('Upload Avatar')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Upload Avatar'));

            await waitFor(() => {
                expect(screen.getByText('Upload failed: Upload failed: Network error')).toBeInTheDocument();
                expect(mockOnUploadError).toHaveBeenCalledWith('Upload failed: Network error');
            });
        });
    });

    describe('Drag and Drop', () => {
        it('should handle drag over events', () => {
            render(
                <ImageUpload
                    uploadType="avatar"
                    onUploadSuccess={mockOnUploadSuccess}
                />
            );

            const dropZone = screen.getByText(/Click to select avatar/);
            
            fireEvent.dragOver(dropZone);
            fireEvent.dragLeave(dropZone);
            
            // Component should handle these events without errors
            expect(dropZone).toBeInTheDocument();
        });

        it('should handle file drop', async () => {
            render(
                <ImageUpload
                    uploadType="avatar"
                    onUploadSuccess={mockOnUploadSuccess}
                />
            );

            const dropZone = screen.getByText(/Click to select avatar/);

            // Create drop event with files
            const dropEvent = new Event('drop', { bubbles: true });
            Object.defineProperty(dropEvent, 'dataTransfer', {
                value: { files: [mockFile] }
            });

            fireEvent(dropZone, dropEvent);

            await waitFor(() => {
                expect(mockValidateImageFile).toHaveBeenCalledWith(mockFile, undefined);
            });
        });
    });

    describe('Component States', () => {
        it('should disable file input when disabled', () => {
            render(
                <ImageUpload
                    uploadType="avatar"
                    disabled={true}
                    onUploadSuccess={mockOnUploadSuccess}
                />
            );

            const fileInput = document.querySelector('input[type="file"]');
            expect(fileInput).toBeDisabled();
        });

        it('should handle cancel action', async () => {
            render(
                <ImageUpload
                    uploadType="avatar"
                    onUploadSuccess={mockOnUploadSuccess}
                    showPreview={true}
                />
            );

            // Select file
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                Object.defineProperty(fileInput, 'files', {
                    value: [mockFile],
                    writable: false,
                });
                fireEvent.change(fileInput);
            }

            await waitFor(() => {
                expect(screen.getByText('Cancel')).toBeInTheDocument();
            });

            // Click cancel
            fireEvent.click(screen.getByText('Cancel'));

            // Should reset to initial state
            await waitFor(() => {
                expect(screen.queryByText('Upload Avatar')).not.toBeInTheDocument();
                expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
            });
        });
    });
});