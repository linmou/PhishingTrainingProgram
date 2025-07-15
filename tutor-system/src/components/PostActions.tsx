import React from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Flag } from 'lucide-react';

interface PostActionsProps {
    onLike?: () => void;
    onShare?: () => void;
    onBookmark?: () => void;
    onFlag?: () => void;
    isLiked?: boolean;
    isBookmarked?: boolean;
    isFlagged?: boolean;
    likeCount?: number;
    commentCount?: number;
    disabled?: boolean;
}

const PostActions: React.FC<PostActionsProps> = ({
    onLike,
    onShare,
    onBookmark,
    onFlag,
    isLiked = false,
    isBookmarked = false,
    isFlagged = false,
    likeCount = 0,
    commentCount = 0,
    disabled = false
}) => {
    return (
        <div className="post-actions">
            <div className="post-actions-row">
                {/* Like Action */}
                <button
                    onClick={onLike}
                    disabled={disabled}
                    className={`post-action-btn ${isLiked ? 'post-action-liked' : ''}`}
                    title={isLiked ? 'Unlike this session' : 'Like this session'}
                >
                    <Heart className={`post-action-icon ${isLiked ? 'filled' : ''}`} />
                    <span className="post-action-text">
                        {isLiked ? 'Liked' : 'Like'}
                        {likeCount > 0 && ` (${likeCount})`}
                    </span>
                </button>

                {/* Comment Action */}
                <button
                    className="post-action-btn post-action-comment"
                    disabled
                    title="Comments section below"
                >
                    <MessageCircle className="post-action-icon" />
                    <span className="post-action-text">
                        Comment {commentCount > 0 && `(${commentCount})`}
                    </span>
                </button>

                {/* Share Action */}
                <button
                    onClick={onShare}
                    disabled={disabled}
                    className="post-action-btn post-action-share"
                    title="Share room link"
                >
                    <Share2 className="post-action-icon" />
                    <span className="post-action-text">Share</span>
                </button>

                {/* Bookmark Action */}
                <button
                    onClick={onBookmark}
                    disabled={disabled}
                    className={`post-action-btn ${isBookmarked ? 'post-action-bookmarked' : ''}`}
                    title={isBookmarked ? 'Remove bookmark' : 'Bookmark this session'}
                >
                    <Bookmark className={`post-action-icon ${isBookmarked ? 'filled' : ''}`} />
                    <span className="post-action-text">
                        {isBookmarked ? 'Saved' : 'Save'}
                    </span>
                </button>

                {/* Flag Action */}
                <button
                    onClick={onFlag}
                    disabled={disabled}
                    className={`post-action-btn post-action-flag ${isFlagged ? 'post-action-flagged' : ''}`}
                    title={isFlagged ? 'Unflag content' : 'Flag inappropriate content'}
                >
                    <Flag className={`post-action-icon ${isFlagged ? 'filled' : ''}`} />
                    <span className="post-action-text">
                        {isFlagged ? 'Flagged' : 'Flag'}
                    </span>
                </button>
            </div>

            {/* Engagement Summary */}
            {(likeCount > 0 || commentCount > 0) && (
                <div className="post-engagement-summary">
                    {likeCount > 0 && (
                        <span className="engagement-stat">
                            ❤️ {likeCount} like{likeCount !== 1 ? 's' : ''}
                        </span>
                    )}
                    {commentCount > 0 && (
                        <span className="engagement-stat">
                            💬 {commentCount} comment{commentCount !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default PostActions;