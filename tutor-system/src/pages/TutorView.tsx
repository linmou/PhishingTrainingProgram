import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createRoom, getRoomsByTutor, deleteRoom } from '../services/supabase';
import { Database } from '../types/database';
import ImageUpload from '../components/ImageUpload';
import AvatarDisplay from '../components/AvatarDisplay';
import DialogueCustomizer from '../components/DialogueCustomizer';
import { ImageUploadResult, PrePopulatedMessage } from '../types';
import '../components/TutorView.css';

type Room = Database['public']['Tables']['rooms']['Row'];

interface PresetImage {
    id: string;
    name: string;
    url: string;
}

const TutorView: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
    const [prePopulatedDialogue, setPrePopulatedDialogue] = useState<PrePopulatedMessage[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [customOpName, setCustomOpName] = useState('');
    const [useCustomOp, setUseCustomOp] = useState(false);
    const [roomPassword, setRoomPassword] = useState('');
    const [usePassword, setUsePassword] = useState(false);
    const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
    
    // Preset images data
    const presetImages: PresetImage[] = [
        { id: 'phishing-1', name: 'Phishing Training 1', url: '/images/room-presets/phishing_1.png' },
        { id: 'phishing-2', name: 'Phishing Training 2', url: '/images/room-presets/phishing_2.png' },
        { id: 'phishing-3', name: 'Phishing Training 3', url: '/images/room-presets/phishing_3.png' },
        { id: 'privacy-1', name: 'Privacy Training 1', url: '/images/room-presets/privacy_1.png' },
        { id: 'privacy-2', name: 'Privacy Training 2', url: '/images/room-presets/privacy_2.png' },
        { id: 'default', name: 'Default Room', url: '/images/room-presets/privacy_3.png' }
    ];

    const loadRooms = useCallback(async () => {
        try {
            if (user?.id) {
                const userRooms = await getRoomsByTutor(user.id);
                setRooms(userRooms);
            }
        } catch (err) {
            console.error('Error loading rooms:', err);
        }
    }, [user?.id]);

    useEffect(() => {
        if (user?.id) {
            loadRooms();
        }
    }, [user, loadRooms]);

    const handleImageSelect = (imageId: string) => {
        setSelectedImageId(imageId);
        setCustomImageUrl(null); // Clear custom image when preset is selected
        setError(null);
    };

    const handleCustomImageUpload = useCallback(async (result: ImageUploadResult) => {
        if (result.success && result.tutorImage) {
            setCustomImageUrl(result.tutorImage.image_url);
            setSelectedImageId(null); // Clear preset selection when custom image is uploaded
            setError(null);
        }
    }, []);

    const handleCustomImageError = useCallback((error: string) => {
        setError(`Image upload failed: ${error}`);
    }, []);

    const getSelectedImage = (): PresetImage | null => {
        return presetImages.find(img => img.id === selectedImageId) || null;
    };

    const getImageUrl = (): string => {
        // Priority: custom uploaded image > preset image > default
        if (customImageUrl) {
            return customImageUrl;
        }
        const selected = getSelectedImage();
        return selected ? selected.url : presetImages.find(img => img.id === 'default')?.url || '/images/room-presets/privacy_3.png';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!title.trim()) {
            setError('Room title is required');
            return;
        }

        if (useCustomOp && !customOpName.trim()) {
            setError('Custom OP name is required when using custom OP');
            return;
        }

        if (usePassword && !roomPassword.trim()) {
            setError('Password is required when password protection is enabled');
            return;
        }

        if (!user?.id) {
            setError('User not authenticated');
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            const imageUrl = getImageUrl();

            const roomData = {
                title: title.trim(),
                description: description.trim(),
                tutor_id: user.id,
                image_url: imageUrl,
                pre_populated_dialogue: prePopulatedDialogue.length > 0 ? prePopulatedDialogue : null,
                op_id: useCustomOp ? null : user.id,
                op_display_name: useCustomOp ? customOpName.trim() : user.display_name,
                op_avatar_url: useCustomOp ? null : user.avatar_url,
                password: usePassword ? roomPassword.trim() : null
            };

            const newRoom = await createRoom(roomData);

            // Show success message
            setSuccessMessage('Room created successfully');
            
            // Reset form
            setTitle('');
            setDescription('');
            setSelectedImageId(null);
            setCustomImageUrl(null);
            setPrePopulatedDialogue([]);
            setCustomOpName('');
            setUseCustomOp(false);
            setRoomPassword('');
            setUsePassword(false);
            setShowCreateForm(false);

            // Reload rooms list
            await loadRooms();

            // Navigate to the new room after a short delay to show success message
            setTimeout(() => {
                navigate(`/room/${newRoom.id}`);
            }, 1500);
        } catch (err: any) {
            setError(err.message || 'Failed to create room');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteRoom = (room: Room) => {
        setRoomToDelete(room);
        setShowDeleteConfirm(true);
    };

    const confirmDeleteRoom = async () => {
        if (!roomToDelete) return;

        setDeletingRoomId(roomToDelete.id);
        setError(null);

        try {
            const result = await deleteRoom(roomToDelete.id);
            if (result.success) {
                setSuccessMessage(`Room "${result.title}" has been deleted successfully`);
                await loadRooms(); // Refresh the rooms list
            }
        } catch (err: any) {
            setError(err.message || 'Failed to delete room');
        } finally {
            setDeletingRoomId(null);
            setShowDeleteConfirm(false);
            setRoomToDelete(null);
        }
    };

    const cancelDeleteRoom = () => {
        setShowDeleteConfirm(false);
        setRoomToDelete(null);
    };

    return (
        <div className="container">
            <div className="card">
                <div className="dashboard-header">
                    <div>
                        <h1 className="dashboard-title">Tutor Dashboard</h1>
                        <p className="dashboard-subtitle">Welcome! You are logged in as a Tutor.</p>
                    </div>
                    <Link 
                        to="/profile" 
                        className="dashboard-profile-link"
                    >
                        <AvatarDisplay
                            avatarUrl={user?.avatar_url}
                            displayName={user?.display_name || 'User'}
                            size="small"
                            className="nav-avatar"
                        />
                        <span>Profile</span>
                    </Link>
                </div>

                {successMessage && (
                    <div className="success-banner">
                        {successMessage}
                    </div>
                )}

                {error && (
                    <div className="error-banner">
                        {error}
                    </div>
                )}

                {!showCreateForm && (
                    <button 
                        className="enhanced-button primary"
                        onClick={() => {
                            setShowCreateForm(true);
                            setSuccessMessage(null);
                            setError(null);
                        }}
                    >
                        ➕ Create a new Room
                    </button>
                )}

                {showCreateForm && (
                    <div className="form-section">
                        <h2 className="form-section-title">Create New Room</h2>
                        <form aria-label="Create room form" onSubmit={handleSubmit}>
                            <div className="form-row two-columns">
                                <div className="form-group">
                                    <label htmlFor="room-title" className="enhanced-label">Room Title</label>
                                    <input 
                                        id="room-title"
                                        type="text" 
                                        className="enhanced-input"
                                        placeholder="Enter room title"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        disabled={isCreating}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="room-description" className="enhanced-label">Description</label>
                                    <textarea 
                                        id="room-description"
                                        className="enhanced-input enhanced-textarea"
                                        placeholder="Enter room description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        disabled={isCreating}
                                    ></textarea>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="enhanced-label">Choose Room Image</label>
                                <div className="preset-images-container" data-testid="preset-images-container">
                                    {presetImages.map((image) => (
                                        <div 
                                            key={image.id}
                                            className={`preset-image-option ${selectedImageId === image.id ? 'selected' : ''}`}
                                            data-testid={`preset-image-${image.id}`}
                                            onClick={() => handleImageSelect(image.id)}
                                        >
                                            <img 
                                                src={image.url} 
                                                alt={image.name}
                                            />
                                            <div>
                                                {image.name}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Custom Image Upload Section */}
                                <div className="custom-upload-section">
                                    <h4 className="custom-upload-title">
                                        Or Upload Custom Image
                                    </h4>
                                    <ImageUpload
                                        uploadType="tutor-image"
                                        currentImageUrl={customImageUrl}
                                        onUploadSuccess={handleCustomImageUpload}
                                        onUploadError={handleCustomImageError}
                                        showPreview={true}
                                        dimensionConstraints={{ maxWidth: 800, maxHeight: 600 }}
                                        roomId="temp-room-id" // This will be updated after room creation
                                    />
                                </div>

                                {/* Preview Section */}
                                {(selectedImageId || customImageUrl) && (
                                    <div className="selected-image-preview" data-testid="selected-image-preview">
                                        <p>
                                            {customImageUrl ? 'Custom Image Selected' : `Selected: ${getSelectedImage()?.name}`}
                                        </p>
                                        <img 
                                            src={getImageUrl()} 
                                            alt={customImageUrl ? 'Custom room image' : getSelectedImage()?.name}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* OP Configuration Section */}
                            <div className="form-group op-configuration-section">
                                <label className="enhanced-label">Original Poster (OP) Settings</label>
                                <div className="configuration-section">
                                    <div className="radio-group">
                                        <div 
                                            className={`radio-option ${!useCustomOp ? 'selected' : ''}`}
                                            onClick={() => setUseCustomOp(false)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <input
                                                type="radio"
                                                name="opType"
                                                checked={!useCustomOp}
                                                onChange={() => setUseCustomOp(false)}
                                                disabled={isCreating}
                                            />
                                            <div className="radio-option-content">
                                                <div className="radio-option-label">Use my profile as OP</div>
                                                <div className="radio-option-description">
                                                    OP will be: <strong>{user?.display_name || 'Your Name'}</strong>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div 
                                            className={`radio-option ${useCustomOp ? 'selected' : ''}`}
                                            onClick={() => setUseCustomOp(true)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <input
                                                type="radio"
                                                name="opType"
                                                checked={useCustomOp}
                                                onChange={() => setUseCustomOp(true)}
                                                disabled={isCreating}
                                            />
                                            <div className="radio-option-content">
                                                <div className="radio-option-label">Use custom OP name</div>
                                                <div className="radio-option-description">
                                                    Create a custom name for the original poster
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {useCustomOp && (
                                        <div className="custom-input-section">
                                            <input
                                                type="text"
                                                className="enhanced-input"
                                                placeholder="Enter custom OP name"
                                                value={customOpName}
                                                onChange={(e) => setCustomOpName(e.target.value)}
                                                disabled={isCreating}
                                            />
                                            <div className="custom-input-helper">
                                                Custom OP names won't have profile pictures or user accounts
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Password Protection Section */}
                            <div className="form-group password-protection-section">
                                <label className="enhanced-label">Password Protection</label>
                                <div className="configuration-section">
                                    <div className="radio-group">
                                        <div 
                                            className={`radio-option ${usePassword ? 'selected' : ''}`}
                                            onClick={() => setUsePassword(!usePassword)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={usePassword}
                                                onChange={(e) => setUsePassword(e.target.checked)}
                                                disabled={isCreating}
                                            />
                                            <div className="radio-option-content">
                                                <div className="radio-option-label">Enable password protection for this room</div>
                                                <div className="radio-option-description">
                                                    {!usePassword ? 'Room will be accessible to anyone with the link' : 'Students and observers will need a password to join'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {usePassword && (
                                        <div className="custom-input-section">
                                            <label htmlFor="room-password" className="enhanced-label">
                                                Room Password
                                            </label>
                                            <input
                                                id="room-password"
                                                type="password"
                                                className="enhanced-input"
                                                placeholder="Enter room password"
                                                value={roomPassword}
                                                onChange={(e) => setRoomPassword(e.target.value)}
                                                disabled={isCreating}
                                            />
                                            <div className="custom-input-helper">
                                                Students and observers will need this password to join the room
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Dialogue Customization Section */}
                            <div className="form-group dialogue-customization-section">
                                <label className="enhanced-label">💬 Pre-populated Messages</label>
                                <DialogueCustomizer
                                    dialogue={prePopulatedDialogue}
                                    onChange={setPrePopulatedDialogue}
                                    disabled={isCreating}
                                />
                            </div>
                            
                            {error && (
                                <div className="error-banner">
                                    {error}
                                </div>
                            )}
                            
                            <div className="form-row">
                                <button 
                                    type="submit"
                                    className={`enhanced-button success ${isCreating ? 'loading' : ''}`}
                                    disabled={isCreating}
                                >
                                    {isCreating ? 'Creating Room...' : '🚀 Create Room'}
                                </button>
                                <button 
                                    type="button"
                                    className="enhanced-button secondary"
                                    onClick={() => {
                                        setShowCreateForm(false);
                                        setError(null);
                                    }}
                                    disabled={isCreating}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="form-section">
                    <h2 className="form-section-title">📚 Your Rooms</h2>
                    {rooms.length > 0 ? (
                        <div className="rooms-grid">
                            {rooms.map((room) => (
                                <div key={room.id} className="room-card" data-testid="room-item">
                                    {room.image_url && (
                                        <img 
                                            src={room.image_url} 
                                            alt={room.title}
                                            className="room-card-image"
                                        />
                                    )}
                                    <div className="room-card-content">
                                        <h3 className="room-card-title">{room.title}</h3>
                                        
                                        {room.description && (
                                            <p className="room-card-description">{room.description}</p>
                                        )}
                                        
                                        <div className="room-card-meta">
                                            <span className="room-card-meta-label">Status:</span>
                                            <div className={`room-card-status ${room.is_active ? 'available' : 'full'}`}>
                                                {room.is_active ? '🟢 Active' : '🔴 Inactive'}
                                            </div>
                                        </div>
                                        
                                        <div className="room-card-meta">
                                            <span className="room-card-meta-label">Created:</span>
                                            <span className="room-card-meta-name">
                                                {new Date(room.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        
                                        <div className="room-card-meta">
                                            <span className="room-card-meta-label">Password:</span>
                                            <span className="room-card-meta-name">
                                                {room.password ? (
                                                    <span className="password-display">
                                                        {room.password}
                                                    </span>
                                                ) : (
                                                    <span className="no-password">
                                                        No password
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        
                                        <div className="room-card-actions">
                                            <Link 
                                                to={`/room/${room.id}`}
                                                className="room-card-button"
                                            >
                                                🚪 Enter Room
                                            </Link>
                                            <button
                                                className="enhanced-button danger"
                                                onClick={() => handleDeleteRoom(room)}
                                                disabled={deletingRoomId === room.id}
                                            >
                                                {deletingRoomId === room.id ? 'Deleting...' : '🗑️ Delete Room'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rooms-empty-state">
                            <div className="rooms-empty-state-icon">📝</div>
                            <h3 className="rooms-empty-state-title">No rooms created yet</h3>
                            <p className="rooms-empty-state-description">
                                Click "Create a new Room" to get started with your first tutoring session.
                            </p>
                        </div>
                    )}
                </div>

                <Link to="/" className="enhanced-button secondary">← Back to Home</Link>

                {/* Delete Confirmation Dialog */}
                {showDeleteConfirm && roomToDelete && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3 className="modal-title-danger">
                                ⚠️ Confirm Room Deletion
                            </h3>
                            <p>
                                Are you sure you want to delete the room "<strong>{roomToDelete.title}</strong>"?
                            </p>
                            <div className="modal-warning">
                                <p>
                                    <strong>Warning:</strong> This room will be permanently deleted and the chat history cannot be recovered.
                                </p>
                            </div>
                            <div className="modal-actions">
                                <button
                                    className="enhanced-button secondary"
                                    onClick={cancelDeleteRoom}
                                    disabled={deletingRoomId === roomToDelete.id}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="enhanced-button danger"
                                    onClick={confirmDeleteRoom}
                                    disabled={deletingRoomId === roomToDelete.id}
                                >
                                    {deletingRoomId === roomToDelete.id ? 'Deleting...' : 'Delete Room'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TutorView;