import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createRoom, getRoomsByTutor } from '../services/supabase';
import { Database } from '../types/database';
import ImageUpload from '../components/ImageUpload';
import AvatarDisplay from '../components/AvatarDisplay';
import DialogueCustomizer from '../components/DialogueCustomizer';
import { ImageUploadResult, PrePopulatedMessage } from '../types';

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
                pre_populated_dialogue: prePopulatedDialogue.length > 0 ? prePopulatedDialogue : null
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

    return (
        <div className="container">
            <div className="card">
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem'
                }}>
                    <div>
                        <h1 style={{ margin: 0 }}>Tutor Dashboard</h1>
                        <p style={{ margin: '0.5rem 0 0 0' }}>Welcome! You are logged in as a Tutor.</p>
                    </div>
                    <Link 
                        to="/profile" 
                        className="nav-profile-link"
                        style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
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
                    <div className="success-message" style={{ 
                        color: 'green', 
                        backgroundColor: '#d4edda',
                        border: '1px solid #c3e6cb',
                        borderRadius: '4px',
                        padding: '0.75rem',
                        marginBottom: '1rem'
                    }}>
                        {successMessage}
                    </div>
                )}

                {!showCreateForm && (
                    <button 
                        className="btn btn-primary"
                        onClick={() => {
                            setShowCreateForm(true);
                            setSuccessMessage(null);
                            setError(null);
                        }}
                    >
                        Create a new Room
                    </button>
                )}

                {showCreateForm && (
                    <>
                        <h2>Create New Room</h2>
                        <form aria-label="Create room form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="room-title">Room Title</label>
                        <input 
                            id="room-title"
                            type="text" 
                            placeholder="Enter room title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={isCreating}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="room-description">Description</label>
                        <textarea 
                            id="room-description"
                            placeholder="Enter room description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isCreating}
                        ></textarea>
                    </div>
                    <div className="form-group">
                        <label>Choose Room Image</label>
                        <div className="preset-images-container" data-testid="preset-images-container">
                            {presetImages.map((image) => (
                                <div 
                                    key={image.id}
                                    className={`preset-image-option ${selectedImageId === image.id ? 'selected' : ''}`}
                                    data-testid={`preset-image-${image.id}`}
                                    onClick={() => handleImageSelect(image.id)}
                                    style={{
                                        display: 'inline-block',
                                        margin: '0.5rem',
                                        padding: '0.5rem',
                                        border: selectedImageId === image.id ? '3px solid #007bff' : '1px solid #ddd',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        backgroundColor: selectedImageId === image.id ? '#e3f2fd' : '#f8f9fa'
                                    }}
                                >
                                    <img 
                                        src={image.url} 
                                        alt={image.name}
                                        style={{
                                            width: '100px',
                                            height: '80px',
                                            objectFit: 'cover',
                                            borderRadius: '4px',
                                            marginBottom: '0.5rem'
                                        }}
                                    />
                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                                        {image.name}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Custom Image Upload Section */}
                        <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                            <h4 style={{ 
                                fontSize: '1rem', 
                                marginBottom: '0.75rem', 
                                color: '#333',
                                borderTop: '1px solid #eee',
                                paddingTop: '1rem'
                            }}>
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
                            <div className="selected-image-preview" data-testid="selected-image-preview" style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '8px',
                                textAlign: 'center'
                            }}>
                                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                                    {customImageUrl ? 'Custom Image Selected' : `Selected: ${getSelectedImage()?.name}`}
                                </p>
                                <img 
                                    src={getImageUrl()} 
                                    alt={customImageUrl ? 'Custom room image' : getSelectedImage()?.name}
                                    style={{
                                        maxWidth: '200px',
                                        height: 'auto',
                                        borderRadius: '4px'
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Dialogue Customization Section */}
                    <div className="form-group" style={{ marginTop: '2rem' }}>
                        <DialogueCustomizer
                            dialogue={prePopulatedDialogue}
                            onChange={setPrePopulatedDialogue}
                            disabled={isCreating}
                        />
                    </div>
                    
                    {error && (
                        <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
                            {error}
                        </div>
                    )}
                    
                    <button 
                        type="submit"
                        className="btn btn-primary"
                        disabled={isCreating}
                    >
                        {isCreating ? 'Creating Room...' : 'Create Room'}
                    </button>
                </form>
                    </>
                )}

                <h2>Your Rooms</h2>
                {rooms.length > 0 ? (
                    <div className="rooms-list">
                        {rooms.map((room) => (
                            <div key={room.id} className="room-item" data-testid="room-item">
                                <h3>{room.title}</h3>
                                <p>{room.description}</p>
                                {room.image_url && (
                                    <img 
                                        src={room.image_url} 
                                        alt={room.title}
                                        style={{ maxWidth: '200px', height: 'auto' }}
                                    />
                                )}
                                <p>Status: {room.is_active ? 'Active' : 'Inactive'}</p>
                                <p>Created: {new Date(room.created_at).toLocaleDateString()}</p>
                                <Link 
                                    to={`/room/${room.id}`}
                                    className="btn btn-primary"
                                >
                                    Enter Room
                                </Link>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>No rooms created yet.</p>
                )}

                <Link to="/" className="btn btn-secondary">Back to Home</Link>
            </div>
        </div>
    );
};

export default TutorView; 