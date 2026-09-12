import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Reply, MoreHorizontal } from 'lucide-react';
import { Message, MessageFeedbackStats } from '../types';
import { decodeAgentMessage } from '../services/tutorDecisionContract';
import AvatarDisplay from './AvatarDisplay';
import FeedbackRating from './FeedbackRating';
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
    // New feedback props
    onSubmitFeedback?: (messageId: string, feedbackType: 'like' | 'dislike', rating: number) => void;
    feedbackStats?: MessageFeedbackStats;
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
    className = '',
    onSubmitFeedback,
    feedbackStats
}) => {
    // State for two-step feedback system
    const [showRating, setShowRating] = useState<'like' | 'dislike' | null>(null);
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
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

    const getRoleLabel = (role: string) => role === 'tutor' ? 'AI chatbot' : role;

    const isOwnComment = currentUserId === message.user_id;

    // Feedback handling functions
    const handleFeedbackClick = (feedbackType: 'like' | 'dislike') => {
        if (isOwnComment) return;
        
        // If user already has this feedback type, show rating to modify it
        const existingFeedback = feedbackStats?.user_feedback;
        if (existingFeedback?.feedback_type === feedbackType) {
            setShowRating(feedbackType);
            return;
        }
        
        // Show rating for new feedback
        setShowRating(feedbackType);
    };

    const handleRatingSubmit = async (rating: number) => {
        if (!showRating || !onSubmitFeedback) return;
        
        setIsSubmittingFeedback(true);
        try {
            await onSubmitFeedback(message.id, showRating, rating);
            setShowRating(null);
        } catch (error) {
            console.error('Failed to submit feedback:', error);
            // Could show error message to user here
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    const handleRatingCancel = () => {
        setShowRating(null);
    };

    // Get display values for feedback
    const userFeedback = feedbackStats?.user_feedback;
    const likeCountFromStats = feedbackStats?.like_count || 0;
    const dislikeCountFromStats = feedbackStats?.dislike_count || 0;
    const hasUserLiked = userFeedback?.feedback_type === 'like';
    const hasUserDisliked = userFeedback?.feedback_type === 'dislike';

    const isGuardMessage = message.response_mode === 'guard';
    const agentMessage = isGuardMessage ? null : decodeAgentMessage(message);
    // The avatar keeps the posting identity; only the visible name carries the character.
    const avatarName = isGuardMessage ? 'Security Supervisor' : (message.display_name || message.user_role);
    // Riley posts under her own name; the Tutor message keeps the tutor account name like any tutor row.
    const agentLabel = agentMessage
        ? agentMessage.character === 'riley' ? 'Riley' : avatarName
        : null;
    const displayName = isGuardMessage ? 'Security Supervisor' : agentLabel || avatarName;
    const bodyText = agentMessage ? agentMessage.content : message.content;

    return (
        <div className={`post-comment ${message.is_ai_generated && !agentMessage ? 'post-comment-ai' : ''} ${isGuardMessage ? 'post-comment-guard' : ''} ${agentMessage ? 'post-comment-character' : ''} ${className}`}>
            <div className="comment-main">
                {/* Comment Avatar */}
                <div className="comment-avatar-container">
                    <AvatarDisplay
                        avatarUrl={isGuardMessage ? null : message.avatar_url || null}
                        displayName={avatarName}
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
                                style={{ color: isGuardMessage ? '#b91c1c' : getRoleColor(message.user_role, message.is_ai_generated && !agentMessage) }}
                            >
                                {!isGuardMessage && message.is_ai_generated && !agentMessage && getRoleIcon(message.user_role, message.is_ai_generated)}
                                {agentMessage ? displayName : isGuardMessage ? displayName : message.is_ai_generated ? 'AI Assistant' : displayName}
                            </span>
                            
                            {/* Character rows use the ordinary role badge; the model chip stays on plain assistant rows. */}
                            {(!message.is_ai_generated || agentMessage) && !isGuardMessage && currentUserRole !== 'student' && (
                                <span className={`comment-role-badge ${message.user_role === 'tutor' ? 'comment-role-badge--tutor' : ''}`}>
                                    {getRoleIcon(message.user_role, false)} {getRoleLabel(message.user_role)}
                                </span>
                            )}
                            
                            {message.is_ai_generated && !agentMessage && (
                                <span className="comment-ai-badge">
                                    AI · {message.ai_model_used}
                                </span>
                            )}
                        </div>
                        
                        <div className="comment-meta">
                            <span className="comment-timestamp">
                                {formatTime(message.created_at)}
                            </span>
                            {/* Character rows show the ordinary timestamp only; the stored timing stays in the row. */}
                            {message.is_ai_generated && !agentMessage && message.ai_response_time_ms && (
                                <span className="comment-response-time">
                                    · {message.ai_response_time_ms}ms
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Comment Text */}
                    <div className="comment-text">
                        {bodyText}
                    </div>

                    {/* Comment Actions */}
                    <div className="comment-actions">
                        <div className="comment-actions-left">
                            {/* Like Button - Two-step feedback */}
                            <button
                                onClick={() => handleFeedbackClick('like')}
                                className={`comment-action-btn ${hasUserLiked ? 'comment-action-active' : ''}`}
                                disabled={isOwnComment || isSubmittingFeedback}
                                title={hasUserLiked ? `You rated this ${userFeedback?.rating}/5 stars` : 'Like this comment'}
                            >
                                <ThumbsUp className="comment-action-icon" />
                                {likeCountFromStats > 0 && (
                                    <span>
                                        {likeCountFromStats}
                                        {feedbackStats?.average_like_rating && (
                                            <span className="comment-rating-display">
                                                ({feedbackStats.average_like_rating.toFixed(1)}★)
                                            </span>
                                        )}
                                    </span>
                                )}
                            </button>

                            {/* Dislike Button - Two-step feedback */}
                            <button
                                onClick={() => handleFeedbackClick('dislike')}
                                className={`comment-action-btn ${hasUserDisliked ? 'comment-action-active' : ''}`}
                                disabled={isOwnComment || isSubmittingFeedback}
                                title={hasUserDisliked ? `You rated this ${userFeedback?.rating}/5 stars` : 'Dislike this comment'}
                            >
                                <ThumbsDown className="comment-action-icon" />
                                {dislikeCountFromStats > 0 && (
                                    <span>
                                        {dislikeCountFromStats}
                                        {feedbackStats?.average_dislike_rating && (
                                            <span className="comment-rating-display">
                                                ({feedbackStats.average_dislike_rating.toFixed(1)}★)
                                            </span>
                                        )}
                                    </span>
                                )}
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
                    
                    {/* Two-step Feedback Rating Component */}
                    {showRating && (
                        <div className="comment-feedback-container" style={{ position: 'relative' }}>
                            <FeedbackRating
                                isLike={showRating === 'like'}
                                onSubmit={handleRatingSubmit}
                                onCancel={handleRatingCancel}
                                currentRating={userFeedback?.feedback_type === showRating ? userFeedback.rating : 0}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PostComment;
