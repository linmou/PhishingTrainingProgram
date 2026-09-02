import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Image, AtSign } from 'lucide-react';
import { User } from '../types';
import AvatarDisplay from './AvatarDisplay';

interface CommentInputProps {
    user: User | null;
    composerIdentity?: {
        displayName: string;
        avatarUrl: string | null;
        isGuard: boolean;
    };
    value: string;
    onChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onTyping?: () => void;
    onStopTyping?: () => void;
    placeholder?: string;
    disabled?: boolean;
    isLoading?: boolean;
    maxLength?: number;
    replyingTo?: {
        id: string;
        authorName: string;
    } | null;
    onCancelReply?: () => void;
}

const CommentInput: React.FC<CommentInputProps> = ({
    user,
    composerIdentity,
    value,
    onChange,
    onSubmit,
    onTyping,
    onStopTyping,
    placeholder = "Write a comment...",
    disabled = false,
    isLoading = false,
    maxLength = 1000,
    replyingTo = null,
    onCancelReply
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        }
    }, [value]);

    // Focus textarea when replying
    useEffect(() => {
        if (replyingTo && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [replyingTo]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        if (newValue.length <= maxLength) {
            onChange(newValue);
            
            // Trigger typing indicators
            if (newValue.length > 0 && !isLoading) {
                onTyping?.();
            } else if (newValue.length === 0) {
                onStopTyping?.();
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Submit on Enter (but not Shift+Enter)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (value.trim() && !disabled && !isLoading) {
                onSubmit(e);
            }
        }
    };

    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
        onStopTyping?.();
    };

    const canSubmit = value.trim().length > 0 && !disabled && !isLoading;
    const displayName = composerIdentity?.displayName || user?.display_name || 'User';
    const avatarUrl = composerIdentity ? composerIdentity.avatarUrl : user?.avatar_url;

    return (
        <div className="comment-input-container">
            {/* Reply indicator */}
            {replyingTo && (
                <div className="reply-indicator">
                    <div className="reply-info">
                        <AtSign className="reply-icon" />
                        <span>Replying to {replyingTo.authorName}</span>
                    </div>
                    <button
                        onClick={onCancelReply}
                        className="reply-cancel-btn"
                        title="Cancel reply"
                    >
                        ×
                    </button>
                </div>
            )}

            <div className={`comment-input-wrapper ${isFocused ? 'comment-input-focused' : ''}`}>
                {/* Composer identity */}
                <div className={`comment-input-profile ${composerIdentity?.isGuard ? 'comment-input-profile-guard' : ''}`}>
                    <AvatarDisplay
                        avatarUrl={avatarUrl}
                        displayName={displayName}
                        size="small"
                    />
                    <span className="comment-input-author-name">{displayName}</span>
                </div>

                {/* Input Area */}
                <form onSubmit={onSubmit} className="comment-input-form">
                    <div className="comment-input-field-container">
                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            placeholder={placeholder}
                            disabled={disabled}
                            className="comment-input-field"
                            rows={1}
                            maxLength={maxLength}
                        />
                        
                        {/* Character Counter */}
                        {isFocused && (
                            <div className="comment-input-counter">
                                {value.length}/{maxLength}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="comment-input-actions">
                        {/* Additional Actions (for future features) */}
                        <div className="comment-input-tools">
                            <button
                                type="button"
                                className="comment-tool-btn"
                                title="Add emoji"
                                disabled={disabled}
                            >
                                <Smile className="comment-tool-icon" />
                            </button>
                            <button
                                type="button"
                                className="comment-tool-btn"
                                title="Attach image"
                                disabled={disabled}
                            >
                                <Image className="comment-tool-icon" />
                            </button>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className={`comment-submit-btn ${canSubmit ? 'comment-submit-active' : ''}`}
                            title={canSubmit ? 'Send comment' : 'Type a message to send'}
                        >
                            {isLoading ? (
                                <div className="comment-loading-spinner"></div>
                            ) : (
                                <Send className="comment-submit-icon" />
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Role Indicator */}
            {user && (
                <div className="comment-input-role">
                    <span className="input-role-text">
                        Commenting as {composerIdentity ? displayName : user.current_role}
                    </span>
                </div>
            )}

            {/* Observer Notice */}
            {user?.current_role === 'observer' && (
                <div className="observer-comment-notice">
                    👁️ You are in observer mode. You can view the conversation but cannot participate.
                </div>
            )}
        </div>
    );
};

export default CommentInput;
