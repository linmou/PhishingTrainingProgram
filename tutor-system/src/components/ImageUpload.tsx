/**
 * Reusable ImageUpload Component
 * 
 * Features:
 * - Drag & drop support
 * - File validation with preview
 * - Progress indication
 * - Error handling
 * - Support for both avatar and tutor image uploads
 */

import React, { useState, useRef, useCallback } from 'react';
import { validateImageFile, uploadAvatarImage, uploadTutorImage } from '../services/imageUpload';
import { ImageValidationResult, ImageUploadResult, ImageDimensions } from '../types';

interface ImageUploadProps {
    /** Upload type determines the upload behavior */
    uploadType: 'avatar' | 'tutor-image';
    /** Room ID required for tutor image uploads */
    roomId?: string;
    /** Current image URL to display */
    currentImageUrl?: string | null;
    /** Callback when upload completes successfully */
    onUploadSuccess?: (result: ImageUploadResult) => void;
    /** Callback when upload fails */
    onUploadError?: (error: string) => void;
    /** Optional dimension constraints */
    dimensionConstraints?: ImageDimensions;
    /** Custom styling */
    className?: string;
    /** Disabled state */
    disabled?: boolean;
    /** Show preview of selected image */
    showPreview?: boolean;
}

interface UploadState {
    isUploading: boolean;
    uploadProgress: number;
    selectedFile: File | null;
    previewUrl: string | null;
    validationErrors: string[];
    uploadError: string | null;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
    uploadType,
    roomId,
    currentImageUrl,
    onUploadSuccess,
    onUploadError,
    dimensionConstraints,
    className = '',
    disabled = false,
    showPreview = true
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);
    const [uploadState, setUploadState] = useState<UploadState>({
        isUploading: false,
        uploadProgress: 0,
        selectedFile: null,
        previewUrl: null,
        validationErrors: [],
        uploadError: null
    });

    // Validate tutor image uploads have roomId
    React.useEffect(() => {
        if (uploadType === 'tutor-image' && !roomId) {
            throw new Error('roomId is required for tutor-image uploads');
        }
    }, [uploadType, roomId]);

    const resetUploadState = useCallback(() => {
        setUploadState({
            isUploading: false,
            uploadProgress: 0,
            selectedFile: null,
            previewUrl: null,
            validationErrors: [],
            uploadError: null
        });
    }, []);

    const validateAndSetFile = useCallback(async (file: File) => {
        // Reset previous state
        setUploadState(prev => ({
            ...prev,
            selectedFile: file,
            validationErrors: [],
            uploadError: null,
            previewUrl: null
        }));

        // Validate file
        const validation: ImageValidationResult = await validateImageFile(file, dimensionConstraints);
        
        if (!validation.isValid) {
            setUploadState(prev => ({
                ...prev,
                validationErrors: validation.errors,
                selectedFile: null
            }));
            return;
        }

        // Create preview URL
        if (showPreview) {
            const previewUrl = URL.createObjectURL(file);
            setUploadState(prev => ({
                ...prev,
                previewUrl
            }));
        }
    }, [dimensionConstraints, showPreview]);

    const handleFileSelect = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return;
        
        const file = files[0];
        validateAndSetFile(file);
    }, [validateAndSetFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
            setDragActive(true);
        }
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (disabled) return;
        
        const files = e.dataTransfer.files;
        handleFileSelect(files);
    }, [disabled, handleFileSelect]);

    const handleClick = useCallback(() => {
        if (disabled || uploadState.isUploading) return;
        fileInputRef.current?.click();
    }, [disabled, uploadState.isUploading]);

    const handleUpload = useCallback(async () => {
        if (!uploadState.selectedFile || uploadState.isUploading) return;

        setUploadState(prev => ({
            ...prev,
            isUploading: true,
            uploadProgress: 0,
            uploadError: null
        }));

        try {
            // Simulate progress
            const progressInterval = setInterval(() => {
                setUploadState(prev => ({
                    ...prev,
                    uploadProgress: Math.min(prev.uploadProgress + 10, 90)
                }));
            }, 100);

            let result: ImageUploadResult;
            
            if (uploadType === 'avatar') {
                result = await uploadAvatarImage(uploadState.selectedFile);
            } else {
                result = await uploadTutorImage(uploadState.selectedFile, roomId!);
            }

            clearInterval(progressInterval);

            if (result.success) {
                setUploadState(prev => ({
                    ...prev,
                    uploadProgress: 100,
                    isUploading: false
                }));

                onUploadSuccess?.(result);
                
                // Reset after success
                setTimeout(resetUploadState, 1000);
            } else {
                setUploadState(prev => ({
                    ...prev,
                    isUploading: false,
                    uploadProgress: 0,
                    uploadError: result.error || 'Upload failed'
                }));

                onUploadError?.(result.error || 'Upload failed');
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';
            
            setUploadState(prev => ({
                ...prev,
                isUploading: false,
                uploadProgress: 0,
                uploadError: errorMessage
            }));

            onUploadError?.(errorMessage);
        }
    }, [uploadState.selectedFile, uploadState.isUploading, uploadType, roomId, onUploadSuccess, onUploadError, resetUploadState]);

    const handleCancel = useCallback(() => {
        if (uploadState.previewUrl) {
            URL.revokeObjectURL(uploadState.previewUrl);
        }
        resetUploadState();
    }, [uploadState.previewUrl, resetUploadState]);

    // Cleanup preview URL on unmount
    React.useEffect(() => {
        return () => {
            if (uploadState.previewUrl) {
                URL.revokeObjectURL(uploadState.previewUrl);
            }
        };
    }, [uploadState.previewUrl]);

    const dropZoneStyle: React.CSSProperties = {
        border: `2px dashed ${dragActive ? '#007bff' : '#ddd'}`,
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
        backgroundColor: dragActive ? '#f8f9fa' : disabled ? '#f5f5f5' : '#fff',
        cursor: disabled || uploadState.isUploading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative'
    };

    const getUploadText = () => {
        if (uploadState.isUploading) return 'Uploading...';
        if (uploadState.selectedFile) return 'Click to upload or drag new file';
        return `Click to select ${uploadType === 'avatar' ? 'avatar' : 'image'} or drag and drop`;
    };

    const getFileRequirements = () => {
        const requirements = ['JPEG, PNG, GIF, WebP', 'Max 5MB'];
        if (dimensionConstraints?.maxWidth && dimensionConstraints?.maxHeight) {
            requirements.push(`Max ${dimensionConstraints.maxWidth}x${dimensionConstraints.maxHeight}px`);
        }
        return requirements.join(' • ');
    };

    return (
        <div className={`image-upload ${className}`}>
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e.target.files)}
                style={{ display: 'none' }}
                disabled={disabled}
            />

            {/* Current image display */}
            {currentImageUrl && !uploadState.selectedFile && (
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                        Current {uploadType === 'avatar' ? 'Avatar' : 'Image'}:
                    </div>
                    <img
                        src={currentImageUrl}
                        alt="Current image"
                        style={{
                            width: uploadType === 'avatar' ? '100px' : '200px',
                            height: uploadType === 'avatar' ? '100px' : '150px',
                            objectFit: 'cover',
                            borderRadius: uploadType === 'avatar' ? '50%' : '8px',
                            border: '2px solid #ddd'
                        }}
                    />
                </div>
            )}

            {/* Drop zone */}
            <div
                style={dropZoneStyle}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleClick}
            >
                {/* Upload progress overlay */}
                {uploadState.isUploading && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px'
                    }}>
                        <div style={{
                            width: '80%',
                            height: '4px',
                            backgroundColor: '#f0f0f0',
                            borderRadius: '2px',
                            marginBottom: '1rem'
                        }}>
                            <div style={{
                                width: `${uploadState.uploadProgress}%`,
                                height: '100%',
                                backgroundColor: '#007bff',
                                borderRadius: '2px',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#666' }}>
                            Uploading... {uploadState.uploadProgress}%
                        </div>
                    </div>
                )}

                {/* Preview image */}
                {uploadState.previewUrl && !uploadState.isUploading && (
                    <div style={{ marginBottom: '1rem' }}>
                        <img
                            src={uploadState.previewUrl}
                            alt="Preview"
                            style={{
                                maxWidth: '200px',
                                maxHeight: '150px',
                                objectFit: 'cover',
                                borderRadius: '4px',
                                border: '2px solid #007bff'
                            }}
                        />
                    </div>
                )}

                {/* Upload icon and text */}
                {!uploadState.isUploading && (
                    <>
                        <div style={{
                            fontSize: '2rem',
                            color: uploadState.selectedFile ? '#007bff' : '#ccc',
                            marginBottom: '1rem'
                        }}>
                            📸
                        </div>
                        <div style={{
                            fontSize: '1.1rem',
                            color: '#333',
                            marginBottom: '0.5rem',
                            fontWeight: 500
                        }}>
                            {getUploadText()}
                        </div>
                        <div style={{
                            fontSize: '0.85rem',
                            color: '#666'
                        }}>
                            {getFileRequirements()}
                        </div>
                    </>
                )}
            </div>

            {/* Validation errors */}
            {uploadState.validationErrors.length > 0 && (
                <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    backgroundColor: '#f8d7da',
                    border: '1px solid #f5c6cb',
                    borderRadius: '4px',
                    color: '#721c24'
                }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>
                        Please fix the following issues:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                        {uploadState.validationErrors.map((error, index) => (
                            <li key={index}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Upload error */}
            {uploadState.uploadError && (
                <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    backgroundColor: '#f8d7da',
                    border: '1px solid #f5c6cb',
                    borderRadius: '4px',
                    color: '#721c24'
                }}>
                    Upload failed: {uploadState.uploadError}
                </div>
            )}

            {/* Action buttons */}
            {uploadState.selectedFile && !uploadState.isUploading && uploadState.validationErrors.length === 0 && (
                <div style={{
                    marginTop: '1rem',
                    display: 'flex',
                    gap: '0.5rem',
                    justifyContent: 'center'
                }}>
                    <button
                        onClick={handleUpload}
                        style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 500
                        }}
                    >
                        Upload {uploadType === 'avatar' ? 'Avatar' : 'Image'}
                    </button>
                    <button
                        onClick={handleCancel}
                        style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
};

export default ImageUpload;