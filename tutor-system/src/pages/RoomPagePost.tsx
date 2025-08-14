import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import RoomPost from '../components/RoomPost';
import PostComment from '../components/PostComment';
import CommentInput from '../components/CommentInput';
import AIAssistantSettings from '../components/AIAssistantSettings';
import AISuggestionBox from '../components/AISuggestionBox';
import ChecklistPanel from '../components/ChecklistPanel';
import { Download, Settings, ArrowLeft, Trash2, CheckSquare } from 'lucide-react';
import { getConfigurationPreset } from '../services/prompts/parameterConfig';
import '../components/RoomPagePost.css';

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
        clearAISuggestion,
        recordAIFeedback,
        currentSuggestionContext,
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
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [roomPassword, setRoomPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [joinError, setJoinError] = useState('');
    
    // Scroll and notification state
    const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
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
        const currentMessageCount = messages.length;
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
    }, [messages.length, userHasScrolledUp, scrollToBottom]);

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

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!messageText.trim() || sendingMessage) return;

        setSendingMessage(true);
        stopTyping(); // Stop typing when message is sent
        
        try {
            await sendMessage(messageText.trim());
            setMessageText('');
            setReplyingTo(null); // Clear reply state
        } catch (error) {
            console.error('Failed to send message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            setSendingMessage(false);
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
        try {
            await generateAIResponse();
        } catch (error) {
            console.error('Failed to generate AI response:', error);
            alert('Failed to generate AI response. Please try again.');
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
                        {canUseAI && (
                            <button
                                onClick={() => setShowChecklist(true)}
                                className="btn btn-secondary btn-small"
                                title="Learning Progress Checklist"
                            >
                                <CheckSquare size={16} />
                            </button>
                        )}
                        {canUseAI && (
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
                        {canUseAI && (
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


                {/* Comments Section */}
                <div className="comments-section">
                    <div className="comments-header">
                        💬 Discussion ({messages.length} message{messages.length !== 1 ? 's' : ''})
                    </div>
                    
                    <div 
                        className="comments-list" 
                        ref={messagesContainerRef}
                        onScroll={handleScroll}
                    >
                        {messages.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#65676b' }}>
                                <p>No messages yet. Start the conversation!</p>
                            </div>
                        ) : (
                            messages.map((message) => {
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

                {/* AI Suggestion Box for Tutors */}
                {canUseAI && aiSuggestion && (
                    <AISuggestionBox
                        suggestion={aiSuggestion}
                        onCopy={handleCopyAISuggestion}
                        onReject={handleRejectAISuggestion}
                        onRegenerate={regenerateAIResponse}
                        isVisible={true}
                        parentMessage={currentSuggestionContext?.parentMessageContent}
                        isRegenerating={loadingAI}
                        parameterConfig={getConfigurationPreset('standard')}
                    />
                )}

                {/* Comment Input with AI Button */}
                {canSendMessages ? (
                    <div className="comment-input-with-ai">
                        <CommentInput
                            user={user}
                            value={messageText}
                            onChange={handleInputChange}
                            onSubmit={handleSendMessage}
                            onTyping={startTyping}
                            onStopTyping={stopTyping}
                            placeholder="Write a comment..."
                            disabled={sendingMessage}
                            isLoading={sendingMessage}
                            replyingTo={replyingTo}
                            onCancelReply={() => setReplyingTo(null)}
                        />
                        {canUseAI && isAIEnabled && (
                            <button
                                onClick={() => handleGenerateAIResponse()}
                                disabled={loadingAI || messages.length === 0}
                                className="ai-generate-btn"
                                title={loadingAI ? 'Generating AI response...' : `Generate AI Response${aiConfig?.model_name ? ` (${aiConfig.model_name})` : ''}`}
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
                ) : (
                    <div className="comment-input-container">
                        <div className="observer-comment-notice">
                            👁️ You are in observer mode. You can view the conversation but cannot participate.
                        </div>
                    </div>
                )}
            </div>

            {/* Checklist Panel */}
            {roomId && (
                <ChecklistPanel 
                    roomId={roomId} 
                    isVisible={showChecklist}  
                    onToggleVisibility={() => setShowChecklist(!showChecklist)}
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
                        <p>Choose what to download:</p>
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
                                className="btn btn-primary"
                                onClick={() => {
                                    downloadChatHistory('feedback');
                                    setShowDownloadModal(false);
                                }}
                            >
                                Download Feedback Data
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