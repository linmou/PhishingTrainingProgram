import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import ChatMessage from '../components/ChatMessage';
import AvatarDisplay from '../components/AvatarDisplay';
import AIAssistantSettings from '../components/AIAssistantSettings';
import jsPDF from 'jspdf';
import { supabase } from '../services/supabase';

const RoomPage: React.FC = () => {
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
        startTyping,
        stopTyping,
        aiConfig,
        loadingAI,
        downloadChatHistory
    } = useRoom();

    const [messageText, setMessageText] = useState('');
    const [showAISettings, setShowAISettings] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [roomPassword, setRoomPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [joinError, setJoinError] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!messageText.trim() || sendingMessage) return;

        setSendingMessage(true);
        stopTyping(); // Stop typing when message is sent
        
        try {
            await sendMessage(messageText.trim());
            setMessageText('');
        } catch (error) {
            console.error('Failed to send message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            setSendingMessage(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setMessageText(value);
        
        // Start typing indicator when user starts typing
        if (value.length > 0 && !sendingMessage) {
            startTyping();
        } else if (value.length === 0) {
            stopTyping();
        }
    };

    const handleInputBlur = () => {
        stopTyping();
    };

    const handleGenerateAIResponse = async (parentMessageId?: string) => {
        try {
            await generateAIResponse();
        } catch (error) {
            console.error('Failed to generate AI response:', error);
            alert('Failed to generate AI response. Please try again.');
        }
    };

    const handleGenerateAIResponseToMessage = async (messageId: string) => {
        try {
            const targetMessage = messages.find(m => m.id === messageId);
            if (targetMessage) {
                await generateAIResponse(targetMessage.content);
            }
        } catch (error) {
            console.error('Failed to generate AI response:', error);
            alert('Failed to generate AI response. Please try again.');
        }
    };

    const downloadAsText = async () => {
        if (!currentRoom) return;

        const roomTitle = currentRoom.title.replace(/\s+/g, '_');
        const content = [
            `Room: ${currentRoom.title}`,
            `Created: ${new Date(currentRoom.created_at).toISOString()}`,
            '',
            'Messages:',
            '=========',
            ...messages.map(message => 
                `[${message.created_at}] ${message.display_name} (${message.user_role}): ${message.content}`
            )
        ].join('\n');

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${roomTitle}_chat_history.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const downloadAsJson = async () => {
        if (!currentRoom) return;

        const uniqueUserIds = Array.from(new Set(messages.map(m => m.user_id)));
        const { data: allParticipants } = await supabase
            .from('users')
            .select('id, display_name, current_role')
            .in('id', uniqueUserIds);

        const roomTitle = currentRoom.title.replace(/\s+/g, '_');
        const jsonData = {
            room: {
                title: currentRoom.title,
                created_at: currentRoom.created_at
            },
            participants: allParticipants?.map(p => ({
                id: p.id,
                display_name: p.display_name,
                role: p.current_role
            })) || [],
            messages: messages.map(message => ({
                id: message.id,
                content: message.content,
                display_name: message.display_name,
                user_role: message.user_role,
                created_at: message.created_at
            }))
        };

        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${roomTitle}_chat_history.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const downloadAsPdf = async () => {
        if (!currentRoom) return;

        const pdf = new jsPDF();
        const roomTitle = currentRoom.title.replace(/\s+/g, '_');
        
        pdf.setFontSize(16);
        pdf.text(`Room: ${currentRoom.title}`, 20, 20);
        
        pdf.setFontSize(12);
        pdf.text(`Created: ${new Date(currentRoom.created_at).toLocaleString()}`, 20, 30);
        
        let yPosition = 50;
        
        pdf.setFontSize(14);
        pdf.text('Messages:', 20, yPosition);
        yPosition += 10;
        
        pdf.setFontSize(10);
        messages.forEach(message => {
            const messageText = `[${new Date(message.created_at).toLocaleString()}] ${message.display_name} (${message.user_role}): ${message.content}`;
            const lines = pdf.splitTextToSize(messageText, 170);
            
            if (yPosition + (lines.length * 5) > 280) {
                pdf.addPage();
                yPosition = 20;
            }
            
            lines.forEach((line: string) => {
                pdf.text(line, 20, yPosition);
                yPosition += 5;
            });
            yPosition += 2;
        });

        pdf.save(`${roomTitle}_chat_history.pdf`);
    };

    const canSendMessages = user && user.current_role !== 'observer';
    const canUseAI = Boolean(user && user.current_role === 'tutor' && currentRoom);
    const isAIEnabled = Boolean(currentRoom?.ai_assistant_enabled);

    // Show password prompt if needed
    if (showPasswordPrompt) {
        return (
            <div className="container">
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
        );
    }

    if (loading) {
        return (
            <div className="container">
                <div className="card">
                    <p>Loading room...</p>
                </div>
            </div>
        );
    }

    if (!currentRoom) {
        return (
            <div className="container">
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
        );
    }

    return (
        <div className="room-layout">
            {/* Header with room info and controls */}
            <div className="room-header-bar">
                <div className="room-title-section">
                    <h1>{currentRoom.title}</h1>
                    {user?.current_role === 'observer' && (
                        <div className="observer-mode-indicator" data-testid="observer-mode-indicator">
                            <span className="observer-mode-badge">Observer Mode</span>
                        </div>
                    )}
                    {currentRoom.description && (
                        <p className="room-description">{currentRoom.description}</p>
                    )}
                    {currentRoom.observer_count && currentRoom.observer_count > 0 && (
                        <span className="observer-count">
                            👁️ {currentRoom.observer_count} observer{currentRoom.observer_count !== 1 ? 's' : ''}
                        </span>
                    )}
                    
                    {/* Participant List */}
                    {participants && participants.length > 0 && (
                        <div className="participants-section">
                            <p className="participants-title">Participants:</p>
                            <div className="participants-list">
                                {participants.map(participant => (
                                    <div key={participant.id} className="participant-item">
                                        <AvatarDisplay
                                            avatarUrl={participant.avatar_url}
                                            displayName={participant.display_name}
                                            size="small"
                                            className="participant-avatar"
                                        />
                                        <span className="participant-info">
                                            {participant.display_name}
                                            {participant.current_role && (
                                                <span className="participant-role"> ({participant.current_role})</span>
                                            )}
                                        </span>
                                    </div>
                                ))}
                                {/* Always show current user if they're an observer */}
                                {user?.current_role === 'observer' && !participants.find(p => p.id === user.id) && (
                                    <div className="participant-item">
                                        <AvatarDisplay
                                            avatarUrl={user.avatar_url}
                                            displayName={user.display_name}
                                            size="small"
                                            className="participant-avatar"
                                        />
                                        <span className="participant-info">
                                            {user.display_name}
                                            <span className="participant-role"> (observer)</span>
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="room-controls">
                    {/* AI Status and Controls */}
                    {canUseAI && (
                        <div className="ai-controls">
                            <div className={`ai-status ${isAIEnabled ? 'ai-status-enabled' : 'ai-status-disabled'}`}>
                                🤖 AI: {isAIEnabled ? 'On' : 'Off'}
                                {isAIEnabled && aiConfig && (
                                    <span className="ai-model-info">({aiConfig.model_name})</span>
                                )}
                            </div>
                            <button
                                onClick={() => setShowAISettings(true)}
                                className="btn btn-secondary btn-small"
                                disabled={loadingAI}
                            >
                                AI Settings
                            </button>
                            {isAIEnabled && (
                                <button
                                    onClick={() => handleGenerateAIResponse()}
                                    disabled={loadingAI || messages.length === 0}
                                    className="btn btn-ai btn-small"
                                >
                                    {loadingAI ? 'Generating...' : '🤖 Generate'}
                                </button>
                            )}
                        </div>
                    )}
                    
                    <div className="room-actions">
                        <button 
                            className="btn btn-secondary btn-small"
                            onClick={downloadChatHistory}
                        >
                            Download History
                        </button>
                        <Link to="/" className="btn btn-secondary btn-small">
                            Leave Room
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main content area with image and chat side by side */}
            <div className="room-main-content">
                {/* Left side - Room Image */}
                {currentRoom.image_url && (
                    <div className="room-image-section">
                        <img 
                            src={currentRoom.image_url} 
                            alt={currentRoom.title}
                            className="room-image-fullsize"
                        />
                    </div>
                )}

                {/* Right side - Chat */}
                <div className={`chat-section ${!currentRoom.image_url ? 'chat-section-full' : ''}`}>
                    <div className="chat-messages-container">
                        {messages.length === 0 ? (
                            <div className="waiting-message">
                                <p>No messages yet. Start the conversation!</p>
                            </div>
                        ) : (
                            messages.map((message) => {
                                // Find the participant's avatar for this message
                                const messageAuthor = participants?.find(p => p.id === message.user_id);
                                
                                return (
                                    <ChatMessage
                                        key={message.id}
                                        message={message}
                                        displayName={message.display_name}
                                        avatarUrl={messageAuthor?.avatar_url}
                                        onGenerateAIResponse={canUseAI && isAIEnabled ? handleGenerateAIResponseToMessage : undefined}
                                        canGenerateAI={canUseAI && isAIEnabled}
                                        isGeneratingAI={loadingAI}
                                    />
                                )
                            })
                        )}
                        {/* Typing indicators */}
                        {typingUsers.length > 0 && (
                            <div className="typing-indicators">
                                {typingUsers.map(typingUser => (
                                    <div key={typingUser.userId} className="typing-indicator">
                                        <span className="typing-user">{typingUser.displayName}</span> is typing...
                                        <div className="typing-dots">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                    </div>

                    {canSendMessages && (
                        <form onSubmit={handleSendMessage} className="chat-input-form">
                            <input
                                type="text"
                                value={messageText}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                placeholder="Type a message..."
                                disabled={sendingMessage}
                                className="chat-input-field"
                            />
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={sendingMessage || !messageText.trim()}
                            >
                                {sendingMessage ? 'Sending...' : 'Send'}
                            </button>
                        </form>
                    )}

                    {!canSendMessages && user?.current_role === 'observer' && (
                        <div className="observer-notice">
                            <p><strong>Read-Only Mode</strong></p>
                            <p>👁️ You are observing this session. You cannot send messages.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Settings Modal */}
            {showAISettings && (
                <AIAssistantSettings onClose={() => setShowAISettings(false)} />
            )}

            {/* Download Modal */}
            {showDownloadModal && (
                <div className="modal-overlay" onClick={() => setShowDownloadModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Download Chat History</h3>
                        <p>Choose a format to download the chat history:</p>
                        <div className="download-options">
                            <button 
                                className="btn btn-primary"
                                onClick={() => {
                                    downloadAsText();
                                    setShowDownloadModal(false);
                                }}
                            >
                                TXT
                            </button>
                            <button 
                                className="btn btn-primary"
                                onClick={() => {
                                    downloadAsJson();
                                    setShowDownloadModal(false);
                                }}
                            >
                                JSON
                            </button>
                            <button 
                                className="btn btn-primary"
                                onClick={() => {
                                    downloadAsPdf();
                                    setShowDownloadModal(false);
                                }}
                            >
                                PDF
                            </button>
                        </div>
                        <button 
                            className="btn btn-secondary"
                            onClick={() => setShowDownloadModal(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomPage; 