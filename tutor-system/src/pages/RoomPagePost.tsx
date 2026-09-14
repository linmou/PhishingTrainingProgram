import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import RoomPost from '../components/RoomPost';
import PostComment from '../components/PostComment';
import CommentInput from '../components/CommentInput';
import AIAssistantSettings from '../components/AIAssistantSettings';
import StudentAIToneControl from '../components/StudentAIToneControl';
import AISuggestionBox from '../components/AISuggestionBox';
import AssessmentDraftEditor from '../components/AssessmentDraftEditor';
import MultiAgentSuggestionEditor from '../components/MultiAgentSuggestionEditor';
import { classifyAssessmentFailure as classifyReviewFailure } from '../contexts/transferAssessmentUiAdapter';
import ChecklistPanel from '../components/ChecklistPanel';
import { Download, Settings, ArrowLeft, Trash2, CheckSquare } from 'lucide-react';
import { getConfigurationPreset } from '../services/prompts/parameterConfig';
import { isTutorRoleLocked } from '../utils/studentAITone';
import { decodeAgentMessage, MULTI_AGENT_PLAYBACK_DELAY_MS } from '../services/tutorDecisionContract';
import '../components/RoomPagePost.css';

const MULTI_AGENT_PAIR_WINDOW_MS = 5000;

const getAIResponseErrorMessage = (error: unknown): string => {
    if (!(error instanceof Error)) {
        return 'Failed to generate AI response.';
    }

    if (error.message.includes('401')) {
        return 'Failed to generate AI response.\n\nAI backend authentication failed (401). The configured API token or gateway token is invalid.';
    }

    return `Failed to generate AI response.\n\n${error.message}`;
};

const COMPARISON_PAIR_LABELS = {
    lock_icon: 'Lock Icon Myth',
    click_impulse: 'Click Impulse',
    personal_story: 'Personal Story'
} as const;

/** Scheduled reveal time of a stored character message, or null for ordinary messages. */
const agentMessageTime = (message: { content: string; response_mode?: string | null; user_role?: string | null; created_at: string }): number | null =>
    decodeAgentMessage(message) ? new Date(message.created_at).getTime() : null;

/** Two character rows belong to one pair when they share a parent, or when they were written together. */
const isSameMultiAgentPair = (
    message: { parent_message_id?: string | null; created_at: string },
    other: { parent_message_id?: string | null; created_at: string }
): boolean => (message.parent_message_id && other.parent_message_id
    ? message.parent_message_id === other.parent_message_id
    : Math.abs(new Date(other.created_at).getTime() - new Date(message.created_at).getTime()) <= MULTI_AGENT_PAIR_WINDOW_MS);

/** The earlier member of this message's pair, when it is present and already due. */
const earlierPairMember = <T extends { id: string; content: string; response_mode?: string | null; user_role?: string | null; created_at: string; parent_message_id?: string | null }>(
    message: T,
    candidates: T[]
): T | null => {
    const revealAt = agentMessageTime(message);
    if (revealAt === null) return null;
    return candidates.find(candidate => candidate.id !== message.id
        && agentMessageTime(candidate) !== null
        && new Date(candidate.created_at).getTime() < revealAt
        && isSameMultiAgentPair(message, candidate)) || null;
};

const RoomPagePost: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const { user } = useAuth();
    const {
        currentRoom,
        messages,
        participants,
        loading,
        typingUsers,
        joinRoom,
        leaveRoom,
        sendMessage,
        generateAIResponse,
        regenerateAIResponse,
        startTyping,
        stopTyping,
        aiConfig,
        loadingAI,
        downloadChatHistory,
        clearChatHistory,
        aiSuggestion,
        transferDraft,
        confirmTransferDraft,
        finalMode,
        updateFinalMode,
        setResponseMode,
        clearAISuggestion,
        recordAIFeedback,
        currentSuggestionContext,
        multiAgentDraft,
        approveMultiAgentDraft,
        regenerateMultiAgentDraft,
        rejectMultiAgentDraft,
        submitMessageFeedback,
        messageFeedbackStats
    } = useRoom();

    const [messageText, setMessageText] = useState('');
    const [showAISettings, setShowAISettings] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [showClearChatModal, setShowClearChatModal] = useState(false);
    const [clearingChat, setClearingChat] = useState(false);
    const [showChecklist, setShowChecklist] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string } | null>(null);
    const isGuardComposer = user?.current_role === 'tutor' && currentRoom?.active_response_mode === 'guard';
    const composerIdentity = isGuardComposer
        ? { displayName: 'Security Supervisor', avatarUrl: null, isGuard: true }
        : undefined;
    const [ratingReminder, setRatingReminder] = useState<{ id: string; content: string } | null>(null);
    const [ratingFeedbackType, setRatingFeedbackType] = useState<'like' | 'dislike' | null>(null);
    const [ratingValue, setRatingValue] = useState(0);
    const [submittingRequiredRating, setSubmittingRequiredRating] = useState(false);
    const [completedRatingMessageId, setCompletedRatingMessageId] = useState<string | null>(null);
    const [multiAgentError, setMultiAgentError] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [roomPassword, setRoomPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [joinError, setJoinError] = useState('');
    
    // Scroll and notification state
    const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
    // Local status for the transfer turn: preparing, or the named reason a preparation was refused.
    const [transferTurnStatus, setTransferTurnStatus] = useState<{ status: string; message: string } | null>(null);
    const [newMessageCount, setNewMessageCount] = useState(0);
    const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const previousMessageCountRef = useRef(messages.length);
    
    // Room engagement state (for future implementation)
    const [roomEngagement, setRoomEngagement] = useState({
        isLiked: false,
        isBookmarked: false,
        isFlagged: false,
        likeCount: 0,
        bookmarkCount: 0,
        shareCount: 0
    });

    // Message engagement state (for future implementation)
    const [messageEngagements, setMessageEngagements] = useState<Record<string, {
        likeCount: number;
        dislikeCount: number;
        userLiked: boolean;
        userDisliked: boolean;
    }>>({});

    // Staged Multi-agent playback. Two rules, in order:
    // 1. a character row whose own timestamp is still in the future stays hidden (reload/join case);
    // 2. the later member of a pair waits the playback gap measured from when the earlier member
    //    first appeared here, because the 2s message poll can deliver both rows in one batch after
    //    T+2 has already passed. Pairs approved before this page opened are shown at once.
    const [playbackAnchors, setPlaybackAnchors] = useState<Record<string, number>>({});
    const mountedAtRef = useRef(Date.now());

    const dueMessages = messages.filter(message => {
        const revealAt = agentMessageTime(message);
        return revealAt === null || revealAt <= now;
    });

    useEffect(() => {
        const currentTime = Date.now();
        const due = messages.filter(message => {
            const revealAt = agentMessageTime(message);
            return revealAt !== null && revealAt <= Math.max(now, currentTime);
        });

        // A poll can deliver a character row whose timestamp has already passed; move the reveal
        // clock forward first, otherwise the row stays behind a stale `now` until the next tick.
        if (due.length > 0 && currentTime > now) {
            setNow(currentTime);
            return;
        }

        const missing = due.filter(message => playbackAnchors[message.id] === undefined);
        if (missing.length === 0) return;

        setPlaybackAnchors(previous => {
            const next = { ...previous };
            missing.forEach(message => { next[message.id] = Date.now(); });
            return next;
        });
    }, [messages, now, playbackAnchors]);

    const isHeldByPairStagger = (message: typeof messages[number]): boolean => {
        const revealAt = agentMessageTime(message);
        if (revealAt === null || revealAt < mountedAtRef.current) return false;

        const earlier = earlierPairMember(message, dueMessages);
        const earlierSeenAt = earlier ? playbackAnchors[earlier.id] : undefined;
        return earlierSeenAt !== undefined && Date.now() - earlierSeenAt < MULTI_AGENT_PLAYBACK_DELAY_MS;
    };

    const visibleMessages = dueMessages.filter(message => !isHeldByPairStagger(message));
    const pendingPlayback = visibleMessages.length !== messages.length;

    useEffect(() => {
        const currentTime = Date.now();
        const deadlines = messages
            .map(message => {
                const revealAt = agentMessageTime(message);
                if (revealAt === null) return null;
                if (revealAt > currentTime) return revealAt;

                const earlier = earlierPairMember(message, messages);
                const earlierSeenAt = earlier ? playbackAnchors[earlier.id] : undefined;
                if (earlierSeenAt === undefined || revealAt < mountedAtRef.current) return null;

                const deadline = earlierSeenAt + MULTI_AGENT_PLAYBACK_DELAY_MS;
                return deadline > currentTime ? deadline : null;
            })
            .filter((deadline): deadline is number => deadline !== null);
        if (deadlines.length === 0) return;

        const timer = setTimeout(() => setNow(Date.now()), Math.min(...deadlines) - currentTime + 50);
        return () => clearTimeout(timer);
    }, [messages, now, playbackAnchors]);


    // Join room on component mount
    useEffect(() => {
        if (roomId) {
            attemptJoinRoom();
        }

        // Cleanup: leave room on unmount
        return () => {
            leaveRoom();
        };
    }, [roomId, leaveRoom]);

    // Scroll functions (defined before useEffect that uses them)
    const scrollToBottom = useCallback((smooth: boolean = true) => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ 
                behavior: smooth ? 'smooth' : 'auto',
                block: 'end'
            });
        }
    }, []);

    const handleScroll = useCallback(() => {
        if (!messagesContainerRef.current) return;
        
        const container = messagesContainerRef.current;
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        
        // Check if user has scrolled away from bottom (with 50px tolerance)
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        setUserHasScrolledUp(!isAtBottom);
        
        // Hide new message indicator if user scrolls to bottom
        if (isAtBottom) {
            setShowNewMessageIndicator(false);
            setNewMessageCount(0);
        }
    }, []);

    const handleNewMessageClick = useCallback(() => {
        scrollToBottom();
        setShowNewMessageIndicator(false);
        setNewMessageCount(0);
    }, [scrollToBottom]);

    // Handle automatic scrolling and new message notifications
    useEffect(() => {
        const currentMessageCount = visibleMessages.length;
        const previousMessageCount = previousMessageCountRef.current;
        
        // Update ref with current count
        previousMessageCountRef.current = currentMessageCount;
        
        // If there are new messages
        if (currentMessageCount > previousMessageCount && previousMessageCount > 0) {
            const newMessagesAdded = currentMessageCount - previousMessageCount;
            
            if (!userHasScrolledUp) {
                // User is at bottom, auto-scroll to new messages
                setTimeout(() => scrollToBottom(), 100);
            } else {
                // User has scrolled up, show notification
                setNewMessageCount(prev => prev + newMessagesAdded);
                setShowNewMessageIndicator(true);
            }
        }
        
        // Auto-scroll on first load
        if (currentMessageCount > 0 && previousMessageCount === 0) {
            setTimeout(() => scrollToBottom(false), 100);
        }
    }, [visibleMessages.length, userHasScrolledUp, scrollToBottom]);

    const attemptJoinRoom = async (password?: string) => {
        try {
            setJoinError('');
            setPasswordError('');
            await joinRoom(roomId!, password);
        } catch (error: any) {
            console.error('Failed to join room:', error);
            if (error.message.includes('password protected')) {
                setShowPasswordPrompt(true);
                setJoinError('This room is password protected. Please enter the password.');
            } else if (error.message.includes('Incorrect password')) {
                setPasswordError('Incorrect password. Please try again.');
                setShowPasswordPrompt(true); // Keep the prompt open for retry
            } else {
                setJoinError(error.message || 'Failed to join room');
            }
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!roomPassword.trim()) {
            setPasswordError('Please enter a password');
            return;
        }
        await attemptJoinRoom(roomPassword);
        if (!passwordError) {
            setShowPasswordPrompt(false);
            setRoomPassword('');
        }
    };

    // Find tutor from participants
    const tutor = participants?.find(p => p.current_role === 'tutor') || null;

    const getUnratedResponse = () => {
        if (user?.current_role !== 'student') return null;

        const latest = [...visibleMessages]
            .reverse()
            .find(message => message.user_role === 'tutor'
                && !message.id.startsWith('prepop-'));

        if (!latest) return null;

        // A completed pair is rated on its Tutor message, whichever character came last.
        const response = decodeAgentMessage(latest)?.character === 'riley'
            ? [...visibleMessages].reverse().find(message => decodeAgentMessage(message)?.character === 'tutor') || latest
            : latest;

        if (completedRatingMessageId === response.id) return null;
        if (messageFeedbackStats[response.id]?.user_feedback) return null;

        // The rating reminder shows learner-facing text, not the stored character tag.
        const agentBody = decodeAgentMessage(response)?.content;
        return agentBody ? { ...response, content: agentBody } : response;
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!messageText.trim() || sendingMessage) return;

        // Staged playback blocks submission before any rating reminder can expose a hidden message.
        if (pendingPlayback) return;

        const unratedResponse = getUnratedResponse();
        if (unratedResponse) {
            setRatingReminder(current => current?.id === unratedResponse.id
                ? current
                : { id: unratedResponse.id, content: unratedResponse.content });
            return;
        }

        setSendingMessage(true);
        stopTyping(); // Stop typing when message is sent
        
        try {
            await sendMessage(messageText.trim(), {
                replyToMessageId: replyingTo?.id,
            });
            setMessageText('');
            setReplyingTo(null); // Clear reply state
        } catch (error) {
            console.error('Failed to send message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            setSendingMessage(false);
        }
    };

    const handleRequiredRatingSubmit = async () => {
        if (!ratingReminder || !ratingFeedbackType || ratingValue === 0 || submittingRequiredRating) return;

        setSubmittingRequiredRating(true);
        try {
            await submitMessageFeedback(ratingReminder.id, ratingFeedbackType, ratingValue);
            setCompletedRatingMessageId(ratingReminder.id);
            setRatingReminder(null);
            setRatingFeedbackType(null);
            setRatingValue(0);
        } catch (error) {
            console.error('Failed to submit required response rating:', error);
            alert('Failed to save your rating. Please try again.');
        } finally {
            setSubmittingRequiredRating(false);
        }
    };

    const handleInputChange = (value: string) => {
        setMessageText(value);
        
        // Start typing indicator when user starts typing
        if (value.length > 0 && !sendingMessage) {
            startTyping();
        } else if (value.length === 0) {
            stopTyping();
        }
    };

    const handleGenerateAIResponse = async (parentMessageId?: string) => {
        setTransferTurnStatus(null);
        try {
            await generateAIResponse();
        } catch (error) {
            console.error('Failed to generate AI response:', error);
            // A refused preparation is a named state on the page, not only a transient alert:
            // the capability can be unavailable, the payload invalid, or the learner superseded.
            const classified = classifyReviewFailure(error);
            setTransferTurnStatus(classified);
            alert(getAIResponseErrorMessage(error));
        }
    };

    // Room engagement handlers (for future implementation)
    const handleRoomLike = () => {
        setRoomEngagement(prev => ({
            ...prev,
            isLiked: !prev.isLiked,
            likeCount: prev.isLiked ? prev.likeCount - 1 : prev.likeCount + 1
        }));
        // TODO: Send to backend
    };

    const handleRoomShare = async () => {
        if (navigator.share && roomId) {
            try {
                await navigator.share({
                    title: currentRoom?.title || 'Learning Session',
                    text: currentRoom?.description || 'Join this learning session',
                    url: window.location.href
                });
            } catch (error) {
                // Fallback to clipboard
                navigator.clipboard.writeText(window.location.href);
                alert('Room link copied to clipboard!');
            }
        } else {
            // Fallback to clipboard
            navigator.clipboard.writeText(window.location.href);
            alert('Room link copied to clipboard!');
        }
    };

    const handleRoomBookmark = () => {
        setRoomEngagement(prev => ({
            ...prev,
            isBookmarked: !prev.isBookmarked,
            bookmarkCount: prev.isBookmarked ? prev.bookmarkCount - 1 : prev.bookmarkCount + 1
        }));
        // TODO: Send to backend
    };

    // Message engagement handlers (for future implementation)
    const handleMessageLike = (messageId: string, isLike: boolean) => {
        setMessageEngagements(prev => {
            const current = prev[messageId] || { likeCount: 0, dislikeCount: 0, userLiked: false, userDisliked: false };
            
            if (isLike) {
                return {
                    ...prev,
                    [messageId]: {
                        ...current,
                        userLiked: !current.userLiked,
                        userDisliked: false,
                        likeCount: current.userLiked ? current.likeCount - 1 : current.likeCount + 1,
                        dislikeCount: current.userDisliked ? current.dislikeCount - 1 : current.dislikeCount
                    }
                };
            } else {
                return {
                    ...prev,
                    [messageId]: {
                        ...current,
                        userDisliked: !current.userDisliked,
                        userLiked: false,
                        dislikeCount: current.userDisliked ? current.dislikeCount - 1 : current.dislikeCount + 1,
                        likeCount: current.userLiked ? current.likeCount - 1 : current.likeCount
                    }
                };
            }
        });
        // TODO: Send to backend
    };

    const handleMessageReply = (messageId: string) => {
        const message = messages.find(m => m.id === messageId);
        if (message) {
            setReplyingTo({
                id: messageId,
                authorName: message.display_name || message.user_role
            });
        }
    };

    const handleCopyAISuggestion = async (suggestion: string) => {
        setMessageText(suggestion);
        // Don't clear or record yet - wait for actual send
    };

    const handleRejectAISuggestion = async () => {
        await recordAIFeedback('rejected');
        clearAISuggestion();
    };

    const handleApproveMultiAgent = async (editedMessages: string[]) => {
        setMultiAgentError(null);
        try {
            await approveMultiAgentDraft(editedMessages);
        } catch (error) {
            setMultiAgentError(
                error instanceof Error ? error.message : 'Failed to approve the Multi-agent response.'
            );
        }
    };

    const handleRegenerateMultiAgent = async () => {
        setMultiAgentError(null);
        try {
            await regenerateMultiAgentDraft();
        } catch (error) {
            setMultiAgentError(
                error instanceof Error ? error.message : 'Failed to regenerate the Multi-agent response.'
            );
        }
    };

    const handleRejectMultiAgent = () => {
        setMultiAgentError(null);
        void rejectMultiAgentDraft();
    };

    const handleClearChatHistory = async () => {
        if (!canUseAI) return;
        
        setClearingChat(true);
        try {
            // First, automatically download a JSON backup of the chat history
            console.log('📁 Creating backup before clearing chat history...');
            await downloadChatHistory('json');
            
            // Small delay to ensure download has started
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Then proceed with clearing the chat history
            console.log('🗑️ Proceeding to clear chat history...');
            await clearChatHistory();
            setShowClearChatModal(false);
        } catch (error) {
            console.error('Failed to clear chat history:', error);
            
            // If the error is from downloading, ask user if they want to proceed anyway
            if (error instanceof Error && error.message.includes('download')) {
                const userConfirms = window.confirm(
                    'Failed to create backup download. Do you still want to clear the chat history? This action cannot be undone.'
                );
                if (userConfirms) {
                    try {
                        await clearChatHistory();
                        setShowClearChatModal(false);
                    } catch (clearError) {
                        console.error('Failed to clear chat history after backup failure:', clearError);
                        alert('Failed to clear chat history. Please try again.');
                    }
                }
            } else {
                alert('Failed to clear chat history. Please try again.');
            }
        } finally {
            setClearingChat(false);
        }
    };

    const canSendMessages = user && user.current_role !== 'observer';
    const canUseAI = Boolean(user && user.current_role === 'tutor' && currentRoom);
    const isAIEnabled = Boolean(currentRoom?.ai_assistant_enabled);

    const handleToggleGuardMode = async () => {
        if (!currentRoom) return;

        const nextMode = currentRoom.active_response_mode === 'guard' ? 'tutoring' : 'guard';
        if (!window.confirm(`${nextMode === 'guard' ? 'Activate' : 'Deactivate'} Guard Mode?`)) {
            return;
        }

        try {
            await setResponseMode(nextMode);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to change Guard Mode');
        }
    };

    const handleToggleSuggestionMode = () => {
        updateFinalMode(finalMode === 'guard' ? 'tutoring' : 'guard');
    };


    // Show password prompt if needed
    if (showPasswordPrompt) {
        return (
            <div className="room-post-layout">
                <div className="room-post-container">
                    <div className="card">
                        <div className="modal-content" style={{ maxWidth: '400px', margin: '2rem auto' }}>
                            <h2 style={{ marginBottom: '1rem', color: '#333' }}>🔒 Password Required</h2>
                            <p style={{ marginBottom: '1rem', color: '#666' }}>
                                This room is password protected. Please enter the password to continue.
                            </p>
                            
                            {joinError && (
                                <div className="error-banner" style={{ marginBottom: '1rem' }}>
                                    {joinError}
                                </div>
                            )}
                            
                            <form onSubmit={handlePasswordSubmit}>
                                <div className="form-group">
                                    <label htmlFor="room-password" className="enhanced-label">
                                        Room Password
                                    </label>
                                    <input
                                        id="room-password"
                                        type="password"
                                        className="enhanced-input"
                                        placeholder="Enter password"
                                        value={roomPassword}
                                        onChange={(e) => setRoomPassword(e.target.value)}
                                        autoFocus
                                    />
                                    {passwordError && (
                                        <div style={{ color: '#dc3545', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                            {passwordError}
                                        </div>
                                    )}
                                </div>
                                
                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                    <Link to="/" className="enhanced-button secondary">
                                        Cancel
                                    </Link>
                                    <button type="submit" className="enhanced-button primary">
                                        Join Room
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="room-post-layout">
                <div className="room-post-container">
                    <div className="loading">Loading room...</div>
                </div>
            </div>
        );
    }

    if (!currentRoom) {
        return (
            <div className="room-post-layout">
                <div className="room-post-container">
                    <div className="card">
                        <h1>Room not found</h1>
                        <p>The room you're looking for doesn't exist or is no longer active.</p>
                        {joinError && (
                            <div className="error-banner" style={{ marginBottom: '1rem' }}>
                                {joinError}
                            </div>
                        )}
                        <Link to="/" className="btn btn-primary">Back to Home</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="room-post-layout">
            {/* Navigation Header */}
            <div className="room-post-nav">
                <div className="room-post-nav-content">
                    <Link to="/" className="room-post-nav-back">
                        <ArrowLeft size={20} />
                        <span>Back to Dashboard</span>
                    </Link>
                    
                    <div className="room-post-nav-actions">
                        {/* Learning Progress Button - Only for tutors */}
                        {user?.current_role === 'tutor' && canUseAI && (
                            <button
                                onClick={handleToggleGuardMode}
                                className="btn btn-secondary btn-small"
                                title="Manually change Guard Mode"
                            >
                                {currentRoom.active_response_mode === 'guard' ? 'Deactivate Guard' : 'Activate Guard'}
                            </button>
                        )}
                        {user?.current_role === 'tutor' && canUseAI && (
                            <button
                                onClick={() => setShowChecklist(true)}
                                className="btn btn-secondary btn-small"
                                title="Learning Progress Checklist"
                            >
                                <CheckSquare size={16} />
                            </button>
                        )}
                        {/* AI Settings Button - Only for tutors */}
                        {user?.current_role === 'tutor' && canUseAI && (
                            <button
                                onClick={() => setShowAISettings(true)}
                                className="btn btn-secondary btn-small"
                                title="AI Assistant Settings"
                            >
                                <Settings size={16} />
                            </button>
                        )}
                        <button
                            onClick={() => setShowDownloadModal(true)}
                            className="btn btn-secondary btn-small"
                            title="Download Chat History"
                        >
                            <Download size={16} />
                        </button>
                        {/* Clear Chat Button - Only for tutors */}
                        {user?.current_role === 'tutor' && canUseAI && (
                            <button
                                onClick={() => setShowClearChatModal(true)}
                                className="btn btn-secondary btn-small"
                                title="Clear Chat History"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="room-post-container">
                {/* Main Room Post */}
                <RoomPost
                    room={currentRoom}
                    tutor={tutor}
                    messageCount={messages.length}
                    participantCount={participants?.length || 0}
                    onLike={handleRoomLike}
                    onShare={handleRoomShare}
                    onBookmark={handleRoomBookmark}
                    isLiked={roomEngagement.isLiked}
                    isBookmarked={roomEngagement.isBookmarked}
                    likeCount={roomEngagement.likeCount}
                    showOp={true}
                />

                {aiConfig?.prompt_config?.prompt_comparison && (
                    <div className="prompt-comparison-badge" data-testid="prompt-comparison-badge">
                        <span className="prompt-comparison-version">
                            {aiConfig.prompt_config.prompt_comparison.version === 'phase0'
                                ? 'Phase 0'
                                : 'Refined'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                            {COMPARISON_PAIR_LABELS[
                                aiConfig.prompt_config.prompt_comparison.pair_id
                            ]}
                        </span>
                    </div>
                )}


                {/* Comments Section */}
                <div className="comments-section">
                    <div className="comments-header">
                        💬 Discussion ({visibleMessages.length} message{visibleMessages.length !== 1 ? 's' : ''})
                    </div>
                    
                    <div 
                        className="comments-list" 
                        ref={messagesContainerRef}
                        onScroll={handleScroll}
                    >
                        {visibleMessages.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#65676b' }}>
                                <p>No messages yet. Start the conversation!</p>
                            </div>
                        ) : (
                            visibleMessages.map((message) => {
                                const engagement = messageEngagements[message.id] || {
                                    likeCount: 0,
                                    dislikeCount: 0,
                                    userLiked: false,
                                    userDisliked: false
                                };
                                
                                return (
                                    <PostComment
                                        key={message.id}
                                        message={message}
                                        onLike={handleMessageLike}
                                        onReply={handleMessageReply}
                                        likeCount={engagement.likeCount}
                                        dislikeCount={engagement.dislikeCount}
                                        isLiked={engagement.userLiked}
                                        isDisliked={engagement.userDisliked}
                                        currentUserId={user?.id}
                                        currentUserRole={user?.current_role}
                                        onSubmitFeedback={submitMessageFeedback}
                                        feedbackStats={messageFeedbackStats[message.id]}
                                    />
                                );
                            })
                        )}
                        
                        {/* Typing indicators */}
                        {typingUsers.length > 0 && (
                            <div style={{ padding: '12px 20px', fontSize: '13px', color: '#65676b', fontStyle: 'italic' }}>
                                {typingUsers.map(typingUser => (
                                    <div key={typingUser.userId}>
                                        <strong>{typingUser.displayName}</strong> is typing...
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Invisible div to scroll to */}
                        <div ref={messagesEndRef} />
                    </div>
                    
                    {/* New Message Indicator */}
                    {showNewMessageIndicator && (
                        <div className="new-message-indicator" onClick={handleNewMessageClick}>
                            <span className="new-message-text">
                                {newMessageCount} new message{newMessageCount !== 1 ? 's' : ''}
                            </span>
                            <span className="new-message-arrow">↓</span>
                        </div>
                    )}
                </div>

                {/* Structured transfer-assessment review for tutors */}
                {user?.current_role === 'tutor' && canUseAI && transferDraft && (
                    <AssessmentDraftEditor
                        decision={transferDraft.decision}
                        onSubmit={confirmTransferDraft}
                        // Discarding is UI-local: there is no draft row, so nothing is persisted.
                        onCancel={clearAISuggestion}
                    />
                )}

                {/* Multi-agent one-or-two-character review for tutors */}
                {user?.current_role === 'tutor' && canUseAI && multiAgentDraft && !transferDraft && (
                    <MultiAgentSuggestionEditor
                        messages={multiAgentDraft.generatedMessages}
                        tutorName={user?.display_name}
                        parentMessage={multiAgentDraft.parentMessageContent}
                        isRegenerating={loadingAI}
                        errorMessage={multiAgentError}
                        onApprove={handleApproveMultiAgent}
                        onReject={handleRejectMultiAgent}
                        onRegenerate={handleRegenerateMultiAgent}
                    />
                )}
                {/* Preparing and refused-preparation states for the transfer turn. */}
                {user?.current_role === 'tutor' && canUseAI && loadingAI && !transferDraft && (
                    <p role="status" data-transfer-status="preparing" className="transfer-turn-status">
                        Preparing the transfer turn…
                    </p>
                )}
                {user?.current_role === 'tutor' && canUseAI && !transferDraft && transferTurnStatus && (
                    <p role="status" data-transfer-status={transferTurnStatus.status} className="transfer-turn-status">
                        {transferTurnStatus.message}
                    </p>
                )}

                {/* Legacy AI Suggestion Box for tutors */}
                {user?.current_role === 'tutor' && canUseAI && aiSuggestion && !transferDraft && !multiAgentDraft && (
                        <AISuggestionBox
                        suggestion={aiSuggestion}
                        onCopy={handleCopyAISuggestion}
                        onReject={handleRejectAISuggestion}
                        onRegenerate={regenerateAIResponse}
                        isVisible={true}
                        parentMessage={currentSuggestionContext?.parentMessageContent}
                        isRegenerating={loadingAI}
                        parameterConfig={getConfigurationPreset('standard')}
                        initialParameters={aiConfig?.prompt_config || undefined}
                        isGuardMode={finalMode === 'guard'}
                        onToggleGuard={handleToggleSuggestionMode}
                        lockedRole={
                            isTutorRoleLocked(aiConfig?.prompt_config)
                                ? aiConfig?.prompt_config?.student_tone_lock?.chosen_role
                                : undefined
                        }
                    />
                )}

                {/* Comment Input with AI Button */}
                {canSendMessages ? (
                    <div className="comment-composer">
                        <StudentAIToneControl />
                        <div className="comment-input-with-ai">
                            <CommentInput
                                user={user}
                                composerIdentity={composerIdentity}
                                value={messageText}
                                onChange={handleInputChange}
                                onSubmit={handleSendMessage}
                                onTyping={startTyping}
                                onStopTyping={stopTyping}
                                placeholder="Write a comment..."
                                disabled={sendingMessage}
                                submitBlocked={pendingPlayback}
                                isLoading={sendingMessage}
                                replyingTo={replyingTo}
                                onCancelReply={() => setReplyingTo(null)}
                            />
                            {user?.current_role === 'tutor' && canUseAI && isAIEnabled && (
                                <button
                                    onClick={() => handleGenerateAIResponse()}
                                    disabled={loadingAI || messages.length === 0 || pendingPlayback}
                                    className="ai-generate-btn"
                                    title={pendingPlayback
                                        ? 'Waiting for the second AI message'
                                        : loadingAI ? 'Generating AI response...' : `Generate AI Response${aiConfig?.model_name ? ` (${aiConfig.model_name})` : ''}`}
                                >
                                    {loadingAI ? (
                                        <>
                                            <div className="ai-loading-spinner"></div>
                                            <span className="ai-btn-text">AI</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="ai-btn-icon">✨</span>
                                            <span className="ai-btn-text">AI</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="comment-input-container">
                        <div className="observer-comment-notice">
                            👁️ You are in observer mode. You can view the conversation but cannot participate.
                        </div>
                    </div>
                )}
            </div>

            {ratingReminder && (
                <div
                    className="rating-reminder-backdrop"
                    data-testid="rating-reminder-backdrop"
                >
                    <section
                        className="rating-reminder-dialog rating-reminder-animated"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="rating-reminder-title"
                    >
                        <div className="rating-reminder-icon" aria-hidden="true">⭐</div>
                        <h2 id="rating-reminder-title">Rate the previous response</h2>
                        <p>Please rate the latest AI or Tutor response before sending your reply.</p>
                        <blockquote>{ratingReminder.content}</blockquote>

                        <div className="rating-reminder-choice" aria-label="Response usefulness">
                            <button
                                type="button"
                                className={ratingFeedbackType === 'like' ? 'selected' : ''}
                                aria-pressed={ratingFeedbackType === 'like'}
                                disabled={submittingRequiredRating}
                                onClick={() => setRatingFeedbackType('like')}
                            >
                                Helpful
                            </button>
                            <button
                                type="button"
                                className={ratingFeedbackType === 'dislike' ? 'selected' : ''}
                                aria-pressed={ratingFeedbackType === 'dislike'}
                                disabled={submittingRequiredRating}
                                onClick={() => setRatingFeedbackType('dislike')}
                            >
                                Not helpful
                            </button>
                        </div>

                        {ratingFeedbackType && (
                            <div className="rating-reminder-details">
                                <p>Choose a rating</p>
                                <div className="rating-reminder-stars" aria-label="Rating">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            type="button"
                                            className={ratingValue >= star ? 'selected' : ''}
                                            aria-label={`${star} star${star === 1 ? '' : 's'}`}
                                            disabled={submittingRequiredRating}
                                            onClick={() => setRatingValue(star)}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="rating-reminder-submit"
                                    disabled={ratingValue === 0 || submittingRequiredRating}
                                    onClick={handleRequiredRatingSubmit}
                                >
                                    Submit rating
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            )}

            {/* Checklist Panel - Only for tutors */}
            {roomId && user?.current_role === 'tutor' && (
                <ChecklistPanel 
                    roomId={roomId} 
                    isVisible={showChecklist}  
                    onToggleVisibility={() => setShowChecklist(!showChecklist)}
                    progressLocked={currentRoom.active_response_mode === 'guard'}
                />
            )}

            {/* AI Settings Modal */}
            {showAISettings && (
                <AIAssistantSettings onClose={() => setShowAISettings(false)} />
            )}

            {/* Download Modal */}
            {showDownloadModal && (
                <div className="modal-overlay" onClick={() => setShowDownloadModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Download Room Data</h3>
                        <p>Choose a format to download:</p>
                        <div className="download-options">
                            <button 
                                className="btn btn-primary"
                                onClick={() => {
                                    downloadChatHistory('txt');
                                    setShowDownloadModal(false);
                                }}
                            >
                                Chat History (TXT)
                            </button>
                            <button 
                                className="btn btn-primary"
                                onClick={() => {
                                    downloadChatHistory('json');
                                    setShowDownloadModal(false);
                                }}
                            >
                                Complete Data (JSON)
                            </button>
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setShowDownloadModal(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clear Chat History Confirmation Modal */}
            {showClearChatModal && (
                <div className="modal-overlay" onClick={() => setShowClearChatModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Clear Chat History</h3>
                        <p>Are you sure you want to clear all chat history for this room?</p>
                        <p><strong>📁 Backup Protection:</strong> A complete JSON backup of all chat data will be automatically downloaded before deletion to ensure no data is lost.</p>
                        <p><strong>Warning:</strong> After the backup, all user messages will be permanently deleted from the room. Pre-populated messages will be preserved.</p>
                        <div className="modal-actions">
                            <button 
                                className="btn btn-danger"
                                onClick={handleClearChatHistory}
                                disabled={clearingChat}
                            >
                                {clearingChat ? 'Creating backup & clearing...' : 'Download Backup & Clear History'}
                            </button>
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setShowClearChatModal(false)}
                                disabled={clearingChat}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomPagePost;
