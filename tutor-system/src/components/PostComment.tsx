import React from 'react';
import { ThumbsUp, ThumbsDown, Reply, MoreHorizontal } from 'lucide-react';
import { Message } from '../types';
import AvatarDisplay from './AvatarDisplay';
import './PostComment.css';

interface PostCommentProps {
    message: Message;
    onLike?: (messageId: string, isLike: boolean) => void;
    onReply?: (messageId: string) => void;
    onGenerateAIResponse?: (messageId: string) => void;
    onFlag?: (messageId: string) => void;
    likeCount?: number;
    dislikeCount?: number;
    isLiked?: boolean;
    isDisliked?: boolean;
    canGenerateAI?: boolean;
    isGeneratingAI?: boolean;
    currentUserId?: string;
    currentUserRole?: string | null;
    className?: string;
}

const PostComment: React.FC<PostCommentProps> = ({
    message,
    onLike,
    onReply,
    onGenerateAIResponse,
    onFlag,
    likeCount = 0,
    dislikeCount = 0,
    isLiked = false,
    isDisliked = false,
    canGenerateAI = false,
    isGeneratingAI = false,
    currentUserId,
    currentUserRole,
    className = ''
}) => {
    const formatTime = (timestamp: string) => {
        const now = new Date();
        const messageTime = new Date(timestamp);
        const diffInHours = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
        
        if (diffInHours < 1) {
            const diffInMinutes = Math.floor(diffInHours * 60);
            return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
        } else if (diffInHours < 24) {
            return `${Math.floor(diffInHours)}h ago`;
        } else {
            return messageTime.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    };

    const getRoleColor = (role: string, isAI: boolean) => {
        if (isAI) return '#8b5cf6'; // Purple for AI
        switch (role) {
            case 'tutor': return '#3b82f6'; // Blue
            case 'student': return '#10b981'; // Green
            case 'observer': return '#6b7280'; // Gray
            default: return '#6b7280';
        }
    };

    const getRoleIcon = (role: string, isAI: boolean) => {
        if (isAI) return '🤖';
        switch (role) {
            case 'tutor': return '👨‍🏫';
            case 'student': return '👨‍🎓';
            case 'observer': return '👁️';
            default: return '👤';
        }
    };

    const isOwnComment = currentUserId === message.user_id;

    return (
        <div className={`post-comment ${message.is_ai_generated ? 'post-comment-ai' : ''} ${className}`}>
            <div className="comment-main">
                {/* Comment Avatar */}
                <div className="comment-avatar-container">
                    <AvatarDisplay
                        avatarUrl={message.avatar_url || null}
                        displayName={message.display_name || message.user_role}
                        size="small"
                        className="comment-avatar"
                    />
                </div>

                {/* Comment Content */}
                <div className="comment-content-container">
                    {/* Comment Header */}
                    <div className="comment-header">
                        <div className="comment-author-info">
                            <span 
                                className="comment-author-name"
                                style={{ color: getRoleColor(message.user_role, message.is_ai_generated) }}
                            >
                                {message.is_ai_generated && getRoleIcon(message.user_role, message.is_ai_generated)}
                                {message.is_ai_generated ? 'AI Assistant' : (message.display_name || message.user_role)}
                            </span>
                            
                            {!message.is_ai_generated && currentUserRole !== 'student' && (
                                <span className="comment-role-badge">
                                    {getRoleIcon(message.user_role, false)} {message.user_role}
                                </span>
                            )}
                            
                            {message.is_ai_generated && (
                                <span className="comment-ai-badge">
                                    AI · {message.ai_model_used}
                                </span>
                            )}
                        </div>
                        
                        <div className="comment-meta">
                            <span className="comment-timestamp">
                                {formatTime(message.created_at)}
                            </span>
                            {message.is_ai_generated && message.ai_response_time_ms && (
                                <span className="comment-response-time">
                                    · {message.ai_response_time_ms}ms
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Comment Text */}
                    <div className="comment-text">
                        {message.content}
                    </div>

                    {/* Comment Actions */}
                    <div className="comment-actions">
                        <div className="comment-actions-left">
                            {/* Like Button */}
                            <button
                                onClick={() => onLike?.(message.id, true)}
                                className={`comment-action-btn ${isLiked ? 'comment-action-active' : ''}`}
                                disabled={isOwnComment}
                                title={isLiked ? 'Remove like' : 'Like this comment'}
                            >
                                <ThumbsUp className="comment-action-icon" />
                                {likeCount > 0 && <span>{likeCount}</span>}
                            </button>

                            {/* Dislike Button */}
                            <button
                                onClick={() => onLike?.(message.id, false)}
                                className={`comment-action-btn ${isDisliked ? 'comment-action-active' : ''}`}
                                disabled={isOwnComment}
                                title={isDisliked ? 'Remove dislike' : 'Dislike this comment'}
                            >
                                <ThumbsDown className="comment-action-icon" />
                                {dislikeCount > 0 && <span>{dislikeCount}</span>}
                            </button>

                            {/* Reply Button */}
                            <button
                                onClick={() => onReply?.(message.id)}
                                className="comment-action-btn"
                                title="Reply to this comment"
                            >
                                <Reply className="comment-action-icon" />
                                <span>Reply</span>
                            </button>

                        </div>

                        {/* More Actions */}
                        <div className="comment-actions-right">
                            <button
                                className="comment-action-btn comment-action-more"
                                title="More options"
                            >
                                <MoreHorizontal className="comment-action-icon" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PostComment;