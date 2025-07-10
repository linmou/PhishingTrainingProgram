import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import ChatMessage from '../components/ChatMessage';
import AIAssistantSettings from '../components/AIAssistantSettings';

const RoomPage: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const { user } = useAuth();
    const {
        currentRoom,
        messages,
        loading,
        joinRoom,
        leaveRoom,
        sendMessage,
        generateAIResponse,
        aiConfig,
        loadingAI
    } = useRoom();

    const [messageText, setMessageText] = useState('');
    const [showAISettings, setShowAISettings] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Join room on component mount
    useEffect(() => {
        if (roomId) {
            joinRoom(roomId).catch(error => {
                console.error('Failed to join room:', error);
            });
        }

        // Cleanup: leave room on unmount
        return () => {
            leaveRoom();
        };
    }, [roomId]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!messageText.trim() || sendingMessage) return;

        setSendingMessage(true);
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

    const canSendMessages = user && user.current_role !== 'observer';
    const canUseAI = Boolean(user && user.current_role === 'tutor' && currentRoom);
    const isAIEnabled = Boolean(currentRoom?.ai_assistant_enabled);

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
                    <Link to="/" className="btn btn-primary">Back to Home</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className="card">
                <div className="room-header">
                    <h1>{currentRoom.title}</h1>
                    {currentRoom.description && (
                        <p className="room-description">{currentRoom.description}</p>
                    )}

                    {/* Room Info */}
                    {currentRoom.observer_count && currentRoom.observer_count > 0 && (
                        <div className="room-info">
                            <span className="observer-count">
                                👁️ {currentRoom.observer_count} observer{currentRoom.observer_count !== 1 ? 's' : ''}
                            </span>
                        </div>
                    )}

                    {/* AI Status and Controls */}
                    {canUseAI && (
                        <div className="ai-controls">
                            <div className={`ai-status ${isAIEnabled ? 'ai-status-enabled' : 'ai-status-disabled'}`}>
                                🤖 AI Assistant: {isAIEnabled ? 'Enabled' : 'Disabled'}
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
                                    {loadingAI ? 'Generating...' : '🤖 Generate Response'}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="chat-container">
                    <div className="chat-messages">
                        {messages.length === 0 ? (
                            <div className="waiting-message">
                                <p>No messages yet. Start the conversation!</p>
                            </div>
                        ) : (
                            messages.map((message) => (
                                <ChatMessage
                                    key={message.id}
                                    message={message}
                                    onGenerateAIResponse={canUseAI && isAIEnabled ? handleGenerateAIResponseToMessage : undefined}
                                    canGenerateAI={canUseAI && isAIEnabled}
                                    isGeneratingAI={loadingAI}
                                />
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {canSendMessages && (
                        <form onSubmit={handleSendMessage} className="chat-input">
                            <input
                                type="text"
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                placeholder="Type your message..."
                                disabled={sendingMessage}
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
                            <p>👁️ You are observing this session. You cannot send messages.</p>
                        </div>
                    )}
                </div>

                <div className="room-actions">
                    <button className="btn btn-secondary" disabled>
                        Download Chat History [Task 8]
                    </button>
                    <Link to="/" className="btn btn-secondary">
                        Leave Room
                    </Link>
                </div>
            </div>

            {/* AI Settings Modal */}
            {showAISettings && (
                <AIAssistantSettings onClose={() => setShowAISettings(false)} />
            )}
        </div>
    );
};

export default RoomPage; 