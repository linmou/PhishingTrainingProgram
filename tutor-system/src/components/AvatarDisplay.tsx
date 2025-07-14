/**
 * AvatarDisplay Component
 * 
 * Displays user avatars with fallback to initials
 * Supports different sizes and styles
 */

import React from 'react';

interface AvatarDisplayProps {
    /** User's avatar URL */
    avatarUrl?: string | null;
    /** User's display name for fallback initials */
    displayName: string;
    /** Avatar size */
    size?: 'small' | 'medium' | 'large' | number;
    /** Additional CSS class */
    className?: string;
    /** Click handler */
    onClick?: () => void;
    /** Show online status indicator */
    showOnlineStatus?: boolean;
    /** Online status */
    isOnline?: boolean;
}

const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
    avatarUrl,
    displayName,
    size = 'medium',
    className = '',
    onClick,
    showOnlineStatus = false,
    isOnline = false
}) => {
    // Convert size to pixels
    const getSizeInPixels = () => {
        if (typeof size === 'number') return size;
        
        switch (size) {
            case 'small': return 32;
            case 'medium': return 48;
            case 'large': return 64;
            default: return 48;
        }
    };

    const sizeInPixels = getSizeInPixels();

    // Generate initials from display name
    const getInitials = (name: string): string => {
        return name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Generate a consistent background color based on name
    const getBackgroundColor = (name: string): string => {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
        
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        return colors[Math.abs(hash) % colors.length];
    };

    const avatarStyle: React.CSSProperties = {
        width: sizeInPixels,
        height: sizeInPixels,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        border: '2px solid #fff',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        backgroundColor: avatarUrl ? 'transparent' : getBackgroundColor(displayName)
    };

    const initialsStyle: React.CSSProperties = {
        color: 'white',
        fontSize: sizeInPixels * 0.4,
        fontWeight: 600,
        userSelect: 'none'
    };

    const onlineIndicatorStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: '2px',
        right: '2px',
        width: sizeInPixels * 0.25,
        height: sizeInPixels * 0.25,
        borderRadius: '50%',
        backgroundColor: isOnline ? '#28a745' : '#6c757d',
        border: '2px solid white',
        minWidth: '8px',
        minHeight: '8px'
    };

    return (
        <div
            className={`avatar-display ${className}`}
            style={avatarStyle}
            onClick={onClick}
            title={displayName}
        >
            {avatarUrl ? (
                <img
                    src={avatarUrl}
                    alt={displayName}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                    onError={(e) => {
                        // Hide image on error to show initials fallback
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
            ) : (
                <span style={initialsStyle}>
                    {getInitials(displayName)}
                </span>
            )}
            
            {/* Initials fallback (hidden when image loads successfully) */}
            {avatarUrl && (
                <span style={{
                    ...initialsStyle,
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: -1
                }}>
                    {getInitials(displayName)}
                </span>
            )}

            {/* Online status indicator */}
            {showOnlineStatus && (
                <div style={onlineIndicatorStyle} />
            )}
        </div>
    );
};

export default AvatarDisplay;