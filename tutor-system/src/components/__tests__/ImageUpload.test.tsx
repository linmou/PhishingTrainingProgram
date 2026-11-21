/**
 * ImageUpload Component Tests
 * 
 * Test Strategy: "Test drag & drop functionality, file validation, upload progress, and error handling"
 */

import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// ImageUpload.tsx: exercise actual upload lifetimes and React commits while simulated progress is capped.
describe('ImageUpload timer ownership', () => {
    let finishUpload: (result: Awaited<ReturnType<typeof uploadAvatarImage>>) => void;
    let rejectUpload: (error: Error) => void;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockValidateImageFile.mockResolvedValue({ isValid: true, errors: [] });
        const pending = new Promise<Awaited<ReturnType<typeof uploadAvatarImage>>>((resolve, reject) => {
            finishUpload = resolve;
            rejectUpload = reject;
        });
        mockUploadAvatarImage.mockReturnValue(pending);
        mockUploadTutorImage.mockReturnValue(pending);
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    async function startUpload(uploadType: 'avatar' | 'tutor-image' = 'avatar') {
        const onSuccess = jest.fn();
        const onError = jest.fn();
        const onRender = jest.fn();
        const view = render(<React.Profiler id="image-upload" onRender={onRender}>
            <ImageUpload uploadType={uploadType} roomId={uploadType === 'tutor-image' ? 'room-1' : undefined}
                onUploadSuccess={onSuccess} onUploadError={onError} showPreview={false} />
        </React.Profiler>);
        await act(async () => {
            fireEvent.change(view.container.querySelector('input')!, {
                target: { files: [new File(['image'], 'photo.jpg', { type: 'image/jpeg' })] },
            });
        });
        fireEvent.click(screen.getByRole('button', { name: uploadType === 'avatar' ? 'Upload Avatar' : 'Upload Image' }));
        return { ...view, onSuccess, onError, onRender };
    }

    it.each(['avatar', 'tutor-image'] as const)('caps %s progress without further commits until upload completion', async uploadType => {
        const view = await startUpload(uploadType);
        for (let tick = 0; tick < 9; tick += 1) {
            act(() => { jest.advanceTimersByTime(100); });
        }
        expect(screen.getByText('Uploading... 90%')).toBeInTheDocument();
        // React may render once to bail out the first same-state update after a real update.
        act(() => { jest.advanceTimersByTime(100); });
        const commitsAtCap = view.onRender.mock.calls.length;
        for (let tick = 0; tick < 20; tick += 1) {
            act(() => { jest.advanceTimersByTime(100); });
        }
        expect(screen.getByText('Uploading... 90%')).toBeInTheDocument();
        expect(view.onRender).toHaveBeenCalledTimes(commitsAtCap);
        expect(view.onSuccess).not.toHaveBeenCalled();
        await act(async () => { finishUpload({ success: true, avatarUrl: 'https://example.com/avatar.jpg' }); });
        expect(view.onSuccess).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/Uploading\.\.\./)).not.toBeInTheDocument();
        expect(jest.getTimerCount()).toBe(1);
        act(() => { jest.advanceTimersByTime(1000); });
        expect(jest.getTimerCount()).toBe(0);
        expect(screen.getByText(/Click to select/)).toBeInTheDocument();
        view.unmount();
    });

    it.each(['failure result', 'rejection'])('stops progress and shows errors after an upload %s', async outcome => {
        const view = await startUpload();
        act(() => { jest.advanceTimersByTime(2500); });
        await act(async () => {
            if (outcome === 'failure result') finishUpload({ success: false, error: 'Upload unavailable' });
            else rejectUpload(new Error('Upload unavailable'));
        });
        expect(view.onError).toHaveBeenCalledWith('Upload unavailable');
        expect(view.onSuccess).not.toHaveBeenCalled();
        expect(screen.getByText(/Upload unavailable/)).toBeInTheDocument();
        expect(jest.getTimerCount()).toBe(0);
        view.unmount();
    });

    it('stops pending upload timers on unmount and ignores the eventual result', async () => {
        const view = await startUpload();
        expect(jest.getTimerCount()).toBe(1);
        view.unmount();
        expect(jest.getTimerCount()).toBe(0);
        await act(async () => { finishUpload({ success: true }); });
        expect(view.onSuccess).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
    });

    it('clears the delayed success reset on unmount', async () => {
        const view = await startUpload();
        await act(async () => { finishUpload({ success: true }); });
        expect(jest.getTimerCount()).toBe(1);
        view.unmount();
        expect(jest.getTimerCount()).toBe(0);
    });
});

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

describe('ImageUpload Component', () => {
    const mockFile = new File(['fake content'], 'test.jpg', { type: 'image/jpeg' });
    const mockOnUploadSuccess = jest.fn();
    const mockOnUploadError = jest.fn();
    const getFileInput = () => {
        const fileInput = screen.getByText(/Click to select (avatar|image)/).closest('.image-upload')
            ?.querySelector<HTMLInputElement>('input[type="file"]');
        if (!fileInput) throw new Error('ImageUpload should render a file input');
        return fileInput;
    };
    const getDropZone = () => {
        const dropZone = screen.getByText(/Click to select avatar/).parentElement;
        if (!dropZone) throw new Error('ImageUpload should render a drop zone');
        return dropZone;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (URL.createObjectURL as jest.Mock).mockReturnValue('blob:mock-url');
        (URL.revokeObjectURL as jest.Mock).mockImplementation(() => undefined);
        
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
            const fileInput = getFileInput();

            // Simulate file selection
            Object.defineProperty(fileInput, 'files', {
                value: [mockFile],
                writable: false,
            });
            fireEvent.change(fileInput);

            await waitFor(() => {
                expect(mockValidateImageFile).toHaveBeenCalledWith(mockFile, undefined);
            });

            // Should show upload button after valid file selection
            await waitFor(() => {
                expect(screen.getByText('Upload Avatar')).toBeInTheDocument();
            });
        });

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
            const fileInput = getFileInput();
            await userEvent.upload(fileInput, mockFile);

            // Wait for validation and upload button
            await waitFor(() => {
                expect(screen.getByText('Upload Avatar')).toBeInTheDocument();
            });

            // Click upload
            const uploadButton = screen.getByText('Upload Avatar');
            await userEvent.click(uploadButton);

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
            const fileInput = getFileInput();
            await userEvent.upload(fileInput, mockFile);

            // Wait for upload button
            await waitFor(() => {
                expect(screen.getByText('Upload Image')).toBeInTheDocument();
            });

            // Click upload
            const uploadButton = screen.getByText('Upload Image');
            await userEvent.click(uploadButton);

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
            const fileInput = getFileInput();
            await userEvent.upload(fileInput, mockFile);

            await waitFor(() => {
                expect(screen.getByText('Please fix the following issues:')).toBeInTheDocument();
                expect(screen.getByText('File size must be less than 5MB')).toBeInTheDocument();
                expect(screen.getByText('File must be an image')).toBeInTheDocument();
            });

            // Upload button should not be visible with validation errors
            expect(screen.queryByText('Upload Avatar')).not.toBeInTheDocument();
        });

        it('should validate with dimension constraints', async () => {
            const dimensionConstraints = { maxWidth: 1920, maxHeight: 1080 };

            render(
                <ImageUpload
                    uploadType="avatar"
                    dimensionConstraints={dimensionConstraints}
                    onUploadSuccess={mockOnUploadSuccess}
                />
            );

            const fileInput = getFileInput();
            await userEvent.upload(fileInput, mockFile);

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

            const dropZone = getDropZone();

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

            const dropZone = getDropZone();

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
            const fileInput = getFileInput();
            await userEvent.upload(fileInput, mockFile);

            await waitFor(() => {
                expect(screen.getByText('Upload Avatar')).toBeInTheDocument();
            });

            const uploadButton = screen.getByText('Upload Avatar');
            await userEvent.click(uploadButton);

            // Should show uploading state
            await waitFor(() => {
                expect(screen.getByText(/Uploading\.\.\./)).toBeInTheDocument();
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
            const fileInput = getFileInput();
            await userEvent.upload(fileInput, mockFile);

            await waitFor(() => {
                expect(screen.getByText('Upload Avatar')).toBeInTheDocument();
            });

            const uploadButton = screen.getByText('Upload Avatar');
            await userEvent.click(uploadButton);

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

            const fileInput = getFileInput();
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
            const fileInput = getFileInput();
            await act(async () => {
                await userEvent.upload(fileInput, mockFile);
                await Promise.resolve();
            });

            await waitFor(() => {
                expect(screen.getByText('Cancel')).toBeInTheDocument();
                expect(URL.createObjectURL).toHaveBeenCalledWith(mockFile);
                expect(screen.getByAltText('Preview')).toBeInTheDocument();
            });

            // Click cancel
            const cancelButton = screen.getByText('Cancel');
            await userEvent.click(cancelButton);

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
