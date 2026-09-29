import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ThumbsUp, ThumbsDown, Reply, MoreHorizontal } from 'lucide-react';
import { Message, MessageFeedbackStats } from '../types';
import AvatarDisplay from './AvatarDisplay';
import FeedbackRating from './FeedbackRating';
import PublicAssessmentQuestion from './PublicAssessmentQuestion';
import type { AssessmentAnswerAttempt } from './PublicAssessmentQuestion';
import { readAnswerLifecycle, readPublicQuestion } from '../contexts/transferAssessmentUiAdapter';
import { resolveMessagePresentation } from '../utils/messagePresentation';
import type { AssessmentOptionId } from '../types/assessment';
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
    onSubmitAssessment?: (
        messageId: string,
        assessmentId: string,
        selectedOptionIds: AssessmentOptionId[]
    ) => Promise<void> | void;
    assessmentAttempts?: AssessmentAnswerAttempt[];
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
    feedbackStats,
    onSubmitAssessment,
    assessmentAttempts = []
}) => {
    // A delivered assessment message renders its public question; every other message renders
    // its plain content.
    const publicQuestion = readPublicQuestion(message);
    // Answer lifecycle and disclosure belong only to the target learner's view.
    const persistedLifecycle = readAnswerLifecycle(message);
    const lifecycleOwnerId = publicQuestion?.studentId ?? message.user_id;
    const answerLifecycle = currentUserRole === 'student' && currentUserId === lifecycleOwnerId
        ? persistedLifecycle
        : null;
    const hasTransferAssessment = Boolean(publicQuestion || answerLifecycle);
    const [assessmentExpanded, setAssessmentExpanded] = useState(true);
    const assessmentContentId = `assessment-content-${message.id}`;
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
    const isAIGenerated = message.is_ai_generated === true;

    const presentation = resolveMessagePresentation(message, currentUserRole);

    return (
        <div className={`post-comment ${isAIGenerated ? 'post-comment-ai' : ''} ${presentation.isGuard ? 'post-comment-guard' : ''} ${presentation.isMultiagent ? 'post-comment-character' : ''} ${className}`}>
            <div className="comment-main">
                {/* Comment Avatar */}
                <div className="comment-avatar-container">
                    <AvatarDisplay
                        avatarUrl={presentation.avatarUrl}
                        displayName={presentation.avatarName}
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
                                style={{ color: presentation.roleColor }}
                            >
                                {presentation.displayName}
                            </span>
                            
                            {presentation.roleBadge && (
                                <span className={`comment-role-badge${message.user_role === 'tutor' ? ' comment-role-badge--tutor' : ''}`}>
                                    {presentation.roleBadge}
                                </span>
                            )}
                        </div>
                        
                        <div className="comment-meta">
                            <span className="comment-timestamp">
                                {formatTime(message.created_at)}
                            </span>
                            {isAIGenerated && message.ai_response_time_ms && (
                                <span className="comment-response-time">
                                    · {message.ai_response_time_ms}ms
                                </span>
                            )}
                            {hasTransferAssessment && (
                                <button
                                    type="button"
                                    className="assessment-disclosure-button"
                                    aria-label={`${assessmentExpanded ? 'Collapse' : 'Expand'} assessment ${publicQuestion ? 'question' : 'message'}`}
                                    aria-expanded={assessmentExpanded}
                                    aria-controls={assessmentContentId}
                                    title={`${assessmentExpanded ? 'Collapse' : 'Expand'} assessment ${publicQuestion ? 'question' : 'message'}`}
                                    onClick={() => setAssessmentExpanded((expanded) => !expanded)}
                                >
                                    {assessmentExpanded
                                        ? <ChevronDown aria-hidden="true" className="assessment-disclosure-icon" />
                                        : <ChevronRight aria-hidden="true" className="assessment-disclosure-icon" />}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Comment Text */}
                    <div className="comment-text">
                        {hasTransferAssessment ? (
                            <div id={assessmentContentId} hidden={!assessmentExpanded}>
                                {publicQuestion
                                    ? <PublicAssessmentQuestion
                                        question={publicQuestion}
                                        answerLifecycle={answerLifecycle}
                                        attempts={currentUserRole === 'student' && currentUserId === publicQuestion.studentId
                                            ? assessmentAttempts
                                            : []}
                                        canAnswer={currentUserRole === 'student' && currentUserId === publicQuestion.studentId}
                                        onSubmit={onSubmitAssessment
                                            ? (ids) => onSubmitAssessment(message.id, publicQuestion.id, ids)
                                            : undefined}
                                      />
                                    : presentation.body}
                                {answerLifecycle?.state === 'rejected' && answerLifecycle.code === 'ANSWER_FORMAT_UNRESOLVED' && (
                                    <p className="answer-clarification" role="status">
                                        Choose one of the displayed options and submit again.
                                    </p>
                                )}
                            </div>
                        ) : presentation.body}
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
