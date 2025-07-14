/**
 * User Profile/Settings Page
 * 
 * Allows users to:
 * - View and edit profile information
 * - Upload and manage avatar
 * - Update display name
 * - Change user role
 */

import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ImageUpload from '../components/ImageUpload';
import AvatarDisplay from '../components/AvatarDisplay';
import { deleteAvatarImage } from '../services/imageUpload';
import { ImageUploadResult } from '../types';

const UserProfile: React.FC = () => {
    const { user, loading, signOut, setUserRole, updateUserProfile } = useAuth();
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [selectedRole, setSelectedRole] = useState(user?.current_role || '');
    const [currentAvatarUrl, setCurrentAvatarUrl] = useState(user?.avatar_url || null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [error, setError] = useState('');
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    // Preset avatars available for selection
    const presetAvatars = [
        { id: 'cute_avatar_0', name: 'Cute Avatar', url: '/images/avatars/cute_avatar_0.jpeg' },
        // Add more preset avatars here as they become available
    ];

    const handlePresetAvatarSelect = useCallback(async (avatarUrl: string) => {
        if (!user) return;

        setError('');
        setIsSaving(true);

        try {
            // Update user's avatar using the context method
            await updateUserProfile({ avatar_url: avatarUrl });

            setCurrentAvatarUrl(avatarUrl);
            setSaveMessage('Avatar updated successfully!');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (err) {
            console.error('Error updating preset avatar:', err);
            setError('Failed to update avatar');
            setTimeout(() => setError(''), 5000);
        } finally {
            setIsSaving(false);
        }
    }, [user, updateUserProfile]);

    const handleAvatarUploadSuccess = useCallback(async (result: ImageUploadResult) => {
        if (result.success && result.avatarUrl) {
            try {
                // Update user's avatar using the context method
                await updateUserProfile({ avatar_url: result.avatarUrl });
                
                setCurrentAvatarUrl(result.avatarUrl);
                setSaveMessage('Avatar updated successfully!');
                setTimeout(() => setSaveMessage(''), 3000);
            } catch (err) {
                console.error('Error updating avatar after upload:', err);
                setError('Avatar uploaded but failed to update profile');
                setTimeout(() => setError(''), 5000);
            }
        }
    }, [updateUserProfile]);

    const handleAvatarUploadError = useCallback((error: string) => {
        setError(`Avatar upload failed: ${error}`);
        setTimeout(() => setError(''), 5000);
    }, []);

    const handleDeleteAvatar = useCallback(async () => {
        if (!currentAvatarUrl) return;

        setIsDeletingAvatar(true);
        setError('');

        try {
            const result = await deleteAvatarImage();
            if (result.success) {
                setCurrentAvatarUrl(null);
                setSaveMessage('Avatar deleted successfully!');
                setTimeout(() => setSaveMessage(''), 3000);
            } else {
                setError(result.error || 'Failed to delete avatar');
                setTimeout(() => setError(''), 5000);
            }
        } catch (err) {
            setError('Failed to delete avatar');
            setTimeout(() => setError(''), 5000);
        } finally {
            setIsDeletingAvatar(false);
        }
    }, [currentAvatarUrl]);

    const handleSaveProfile = useCallback(async () => {
        if (!user) return; // Early return if user is null
        
        setIsSaving(true);
        setError('');

        try {
            // Update display name if changed
            if (displayName !== user.display_name) {
                await updateUserProfile({ display_name: displayName });
            }

            // Update role if changed
            if (selectedRole !== user.current_role && selectedRole) {
                await setUserRole(selectedRole as 'student' | 'tutor' | 'observer');
            }

            setIsEditing(false);
            setSaveMessage('Profile updated successfully!');
            setTimeout(() => setSaveMessage(''), 3000);

        } catch (err) {
            console.error('Error updating profile:', err);
            setError('Failed to update profile');
            setTimeout(() => setError(''), 5000);
        } finally {
            setIsSaving(false);
        }
    }, [displayName, selectedRole, user, setUserRole, updateUserProfile]);

    const handleSignOut = useCallback(async () => {
        try {
            await signOut();
            navigate('/');
        } catch (err) {
            console.error('Error signing out:', err);
        }
    }, [signOut, navigate]);

    // Sync local state with context user changes
    React.useEffect(() => {
        if (user) {
            setDisplayName(user.display_name || '');
            setSelectedRole(user.current_role || '');
            setCurrentAvatarUrl(user.avatar_url || null);
        }
    }, [user]);

    // Handle window resize for responsive design
    React.useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Redirect if not authenticated (only after loading is complete)
    React.useEffect(() => {
        if (!loading && !user) {
            navigate('/');
        }
    }, [loading, user, navigate]);

    // Show loading state while authentication is being checked
    if (loading) {
        return (
            <div className="container">
                <div className="card">
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    // Return null if user is not authenticated after loading
    if (!user) {
        return null;
    }

    const getRoleDisplayName = (role: string) => {
        switch (role) {
            case 'student': return 'Student';
            case 'tutor': return 'Tutor';
            case 'observer': return 'Observer';
            default: return role;
        }
    };

    const getNavigationLink = () => {
        switch (user.current_role) {
            case 'student': return '/student';
            case 'tutor': return '/tutor';
            case 'observer': return '/observer';
            default: return '/';
        }
    };

    return (
        <div className="container">
            <div className="card">
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '2rem',
                    borderBottom: '1px solid #ddd',
                    paddingBottom: '1rem'
                }}>
                    <h1 style={{ margin: 0 }}>User Profile</h1>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link 
                            to={getNavigationLink()}
                            className="btn btn-secondary"
                            style={{ textDecoration: 'none' }}
                        >
                            ← Back to Dashboard
                        </Link>
                        <button 
                            onClick={handleSignOut}
                            className="btn btn-danger"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Success/Error Messages */}
                {saveMessage && (
                    <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#d4edda',
                        border: '1px solid #c3e6cb',
                        borderRadius: '4px',
                        color: '#155724',
                        marginBottom: '1rem'
                    }}>
                        {saveMessage}
                    </div>
                )}

                {error && (
                    <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#f8d7da',
                        border: '1px solid #f5c6cb',
                        borderRadius: '4px',
                        color: '#721c24',
                        marginBottom: '1rem'
                    }}>
                        {error}
                    </div>
                )}

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: windowWidth <= 768 ? '1fr' : '1fr 1fr',
                    gap: '2rem'
                }}>
                    {/* Avatar Section */}
                    <div>
                        <h2>Profile Picture</h2>
                        
                        {/* Current Avatar Display */}
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '1rem', 
                            marginBottom: '1rem' 
                        }}>
                            <AvatarDisplay
                                avatarUrl={currentAvatarUrl}
                                displayName={user.display_name}
                                size="large"
                            />
                            <div>
                                <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                                    {user.display_name}
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                    {getRoleDisplayName(user.current_role || '')}
                                </div>
                                {currentAvatarUrl && (
                                    <button
                                        onClick={handleDeleteAvatar}
                                        disabled={isDeletingAvatar}
                                        style={{
                                            marginTop: '0.5rem',
                                            padding: '0.25rem 0.5rem',
                                            fontSize: '0.8rem',
                                            backgroundColor: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: isDeletingAvatar ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {isDeletingAvatar ? 'Deleting...' : 'Delete Avatar'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Preset Avatar Selection */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: '#333' }}>
                                Choose from Preset Avatars
                            </h3>
                            <div style={{
                                display: 'flex',
                                gap: '0.75rem',
                                flexWrap: 'wrap',
                                marginBottom: '1rem'
                            }}>
                                {presetAvatars.map((avatar) => (
                                    <div
                                        key={avatar.id}
                                        onClick={() => handlePresetAvatarSelect(avatar.url)}
                                        style={{
                                            position: 'relative',
                                            cursor: isSaving ? 'not-allowed' : 'pointer',
                                            opacity: isSaving ? 0.6 : 1,
                                            border: currentAvatarUrl === avatar.url ? '3px solid #007bff' : '2px solid #ddd',
                                            borderRadius: '50%',
                                            padding: '3px',
                                            backgroundColor: currentAvatarUrl === avatar.url ? '#e3f2fd' : '#fff',
                                            transition: 'all 0.2s ease',
                                            boxShadow: currentAvatarUrl === avatar.url 
                                                ? '0 4px 12px rgba(0, 123, 255, 0.3)' 
                                                : '0 2px 4px rgba(0, 0, 0, 0.1)'
                                        }}
                                        title={`Select ${avatar.name}`}
                                    >
                                        <img
                                            src={avatar.url}
                                            alt={avatar.name}
                                            style={{
                                                width: '60px',
                                                height: '60px',
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                                display: 'block'
                                            }}
                                        />
                                        {currentAvatarUrl === avatar.url && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '-5px',
                                                right: '-5px',
                                                width: '20px',
                                                height: '20px',
                                                backgroundColor: '#007bff',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '12px',
                                                color: 'white',
                                                fontWeight: 'bold'
                                            }}>
                                                ✓
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <p style={{ 
                                fontSize: '0.85rem', 
                                color: '#666', 
                                fontStyle: 'italic',
                                margin: 0 
                            }}>
                                Click on any avatar to select it as your profile picture
                            </p>
                        </div>

                        {/* Custom Avatar Upload */}
                        <div style={{ marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: '#333' }}>
                                Or Upload Custom Avatar
                            </h3>
                        </div>
                        <ImageUpload
                            uploadType="avatar"
                            currentImageUrl={currentAvatarUrl}
                            onUploadSuccess={handleAvatarUploadSuccess}
                            onUploadError={handleAvatarUploadError}
                            showPreview={true}
                            dimensionConstraints={{ maxWidth: 512, maxHeight: 512 }}
                        />
                    </div>

                    {/* Profile Information Section */}
                    <div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '1rem'
                        }}>
                            <h2 style={{ margin: 0 }}>Profile Information</h2>
                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="btn btn-primary"
                                    style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                                >
                                    Edit Profile
                                </button>
                            ) : (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={isSaving}
                                        className="btn btn-success"
                                        style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                                    >
                                        {isSaving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditing(false);
                                            setDisplayName(user.display_name);
                                            setSelectedRole(user.current_role || '');
                                        }}
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label style={{ fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>
                                Display Name
                            </label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '1rem'
                                    }}
                                    placeholder="Enter your display name"
                                />
                            ) : (
                                <div style={{
                                    padding: '0.5rem',
                                    backgroundColor: '#f8f9fa',
                                    border: '1px solid #e9ecef',
                                    borderRadius: '4px',
                                    fontSize: '1rem'
                                }}>
                                    {user.display_name || 'No display name set'}
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label style={{ fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>
                                Role
                            </label>
                            {isEditing ? (
                                <select
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '1rem'
                                    }}
                                >
                                    <option value="student">Student</option>
                                    <option value="tutor">Tutor</option>
                                    <option value="observer">Observer</option>
                                </select>
                            ) : (
                                <div style={{
                                    padding: '0.5rem',
                                    backgroundColor: '#f8f9fa',
                                    border: '1px solid #e9ecef',
                                    borderRadius: '4px',
                                    fontSize: '1rem'
                                }}>
                                    {getRoleDisplayName(user.current_role || '')}
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label style={{ fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>
                                User ID
                            </label>
                            <div style={{
                                padding: '0.5rem',
                                backgroundColor: '#f8f9fa',
                                border: '1px solid #e9ecef',
                                borderRadius: '4px',
                                fontSize: '0.9rem',
                                fontFamily: 'monospace',
                                color: '#666'
                            }}>
                                {user.id}
                            </div>
                        </div>

                        <div className="form-group">
                            <label style={{ fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>
                                Member Since
                            </label>
                            <div style={{
                                padding: '0.5rem',
                                backgroundColor: '#f8f9fa',
                                border: '1px solid #e9ecef',
                                borderRadius: '4px',
                                fontSize: '1rem'
                            }}>
                                {new Date(user.created_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;