import React from 'react';
import { Message } from '../types';
import AvatarDisplay from './AvatarDisplay';
import PublicAssessmentQuestion from './PublicAssessmentQuestion';
import { readPublicQuestion } from '../contexts/transferAssessmentUiAdapter';

interface ChatMessageProps {
    message: Message;
    displayName?: string;
    avatarUrl?: string | null;
    onGenerateAIResponse?: (parentMessageId: string) => void;
    canGenerateAI?: boolean;
    isGeneratingAI?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
    message,
    displayName,
    avatarUrl,
    onGenerateAIResponse,
    canGenerateAI = false,
    isGeneratingAI = false
}) => {
    // A delivered assessment message renders its public question; every other message renders
    // its plain content.
    const publicQuestion = readPublicQuestion(message);

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
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

    const handleGenerateAI = () => {
        if (onGenerateAIResponse && message.user_role === 'student' && !message.is_ai_generated) {
            onGenerateAIResponse(message.id);
        }
    };

    return (
        <div className={`message ${message.is_ai_generated ? 'message-ai' : ''}`}>
            <div className="message-header">
                <div className="message-author">
                    {!message.is_ai_generated && (
                        <AvatarDisplay
                            avatarUrl={avatarUrl}
                            displayName={displayName || message.user_role}
                            size="small"
                            className="message-avatar"
                        />
                    )}
                    <span
                        className="message-role"
                        style={{ color: getRoleColor(message.user_role, message.is_ai_generated) }}
                    >
                        {message.is_ai_generated && getRoleIcon(message.user_role, message.is_ai_generated)}
                        {message.is_ai_generated ? 'AI Assistant' : (displayName || message.user_role)}
                    </span>
                </div>
                <div className="message-meta">
                    <span className="message-time">
                        {formatTime(message.created_at)}
                    </span>
                    {message.is_ai_generated && (
                        <span className="ai-badge">
                            AI · {message.ai_model_used} · {message.ai_response_time_ms}ms
                        </span>
                    )}
                </div>
            </div>
            <div className="message-content">
                {publicQuestion
                    ? <PublicAssessmentQuestion question={publicQuestion} />
                    : message.content}
            </div>

            {/* AI Generation Button for Student Messages */}
            {canGenerateAI &&
                message.user_role === 'student' &&
                !message.is_ai_generated &&
                onGenerateAIResponse && (
                    <div className="message-actions">
                        <button
                            onClick={handleGenerateAI}
                            disabled={isGeneratingAI}
                            className="btn btn-ai btn-small"
                            title="Generate AI response to this message"
                        >
                            {isGeneratingAI ? (
                                <>
                                    <span className="ai-loading-spinner"></span>
                                    Generating...
                                </>
                            ) : (
                                <>
                                    🤖 Generate AI Response
                                </>
                            )}
                        </button>
                    </div>
                )}
        </div>
    );
};

export default ChatMessage; 