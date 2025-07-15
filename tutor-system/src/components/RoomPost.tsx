import React from 'react';
import { Room, User } from '../types';
import AvatarDisplay from './AvatarDisplay';
import PostActions from './PostActions';

interface RoomPostProps {
    room: Room;
    tutor: User | null;
    messageCount: number;
    participantCount: number;
    onLike?: () => void;
    onShare?: () => void;
    onBookmark?: () => void;
    isLiked?: boolean;
    isBookmarked?: boolean;
    likeCount?: number;
    showOp?: boolean;
}

const RoomPost: React.FC<RoomPostProps> = ({
    room,
    tutor,
    messageCount,
    participantCount,
    onLike,
    onShare,
    onBookmark,
    isLiked = false,
    isBookmarked = false,
    likeCount = 0,
    showOp = false
}) => {
    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="room-post">
            {/* Post Header */}
            <div className="post-header">
                <div className="post-author-info">
                    <AvatarDisplay
                        avatarUrl={showOp ? room.op_avatar_url : tutor?.avatar_url}
                        displayName={showOp ? (room.op_display_name || 'OP') : (tutor?.display_name || 'Tutor')}
                        size="medium"
                        className="post-author-avatar"
                    />
                    <div className="post-author-details">
                        <div className="post-author-name">
                            {showOp ? (room.op_display_name || 'OP') : (tutor?.display_name || 'Tutor')}
                            <span className="post-author-role">
                                {showOp ? '📝 OP' : '👨‍🏫 Tutor'}
                            </span>
                        </div>
                        <div className="post-timestamp">
                            {formatTime(room.created_at)}
                        </div>
                    </div>
                </div>
                
                {/* Room Status Indicators */}
                <div className="post-status-indicators">
                    {room.ai_assistant_enabled && (
                        <span className="status-badge ai-enabled">
                            🤖 AI Enabled
                        </span>
                    )}
                    {room.is_active && (
                        <span className="status-badge room-active">
                            🟢 Active
                        </span>
                    )}
                </div>
            </div>

            {/* Post Content */}
            <div className="post-content">
                <h1 className="post-title">{room.title}</h1>
                {room.description && (
                    <p className="post-description">{room.description}</p>
                )}
                
                {/* Room Image */}
                {room.image_url && (
                    <div className="post-image-container">
                        <img
                            src={room.image_url}
                            alt={room.title}
                            className="post-image"
                        />
                    </div>
                )}
            </div>

            {/* Post Stats */}
            <div className="post-stats">
                <div className="post-stats-item">
                    <span className="stats-icon">👥</span>
                    <span className="stats-text">
                        {participantCount} participant{participantCount !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="post-stats-item">
                    <span className="stats-icon">💬</span>
                    <span className="stats-text">
                        {messageCount} message{messageCount !== 1 ? 's' : ''}
                    </span>
                </div>
                {room.observer_count && room.observer_count > 0 && (
                    <div className="post-stats-item">
                        <span className="stats-icon">👁️</span>
                        <span className="stats-text">
                            {room.observer_count} observer{room.observer_count !== 1 ? 's' : ''}
                        </span>
                    </div>
                )}
                {likeCount > 0 && (
                    <div className="post-stats-item">
                        <span className="stats-icon">❤️</span>
                        <span className="stats-text">
                            {likeCount} like{likeCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                )}
            </div>

            {/* Post Actions */}
            <PostActions
                onLike={onLike}
                onShare={onShare}
                onBookmark={onBookmark}
                isLiked={isLiked}
                isBookmarked={isBookmarked}
                likeCount={likeCount}
                commentCount={messageCount}
            />
        </div>
    );
};

export default RoomPost;