/**
 * DialogueCustomizer Component
 * 
 * Allows tutors to create pre-populated dialogue for training rooms.
 * Features:
 * - Add/remove multiple messages
 * - Set custom user names and roles
 * - Reorder messages
 * - Preview the conversation flow
 */

import React, { useState, useCallback } from 'react';
import { PrePopulatedMessage, UserRole } from '../types';

interface DialogueCustomizerProps {
    /** Current dialogue messages */
    dialogue: PrePopulatedMessage[];
    /** Callback when dialogue is updated */
    onChange: (dialogue: PrePopulatedMessage[]) => void;
    /** Whether the component is disabled */
    disabled?: boolean;
    /** Custom CSS classes */
    className?: string;
}

const DialogueCustomizer: React.FC<DialogueCustomizerProps> = ({
    dialogue,
    onChange,
    disabled = false,
    className = ''
}) => {
    const [expandedMessage, setExpandedMessage] = useState<number | null>(null);

    const addMessage = useCallback(() => {
        const newMessage: PrePopulatedMessage = {
            user_name: '',
            message: '',
            role: 'student'
        };
        onChange([...dialogue, newMessage]);
        setExpandedMessage(dialogue.length); // Expand the new message
    }, [dialogue, onChange]);

    const updateMessage = useCallback((index: number, field: keyof PrePopulatedMessage, value: string | UserRole) => {
        const updatedDialogue = dialogue.map((msg, i) => 
            i === index ? { ...msg, [field]: value } : msg
        );
        onChange(updatedDialogue);
    }, [dialogue, onChange]);

    const removeMessage = useCallback((index: number) => {
        const updatedDialogue = dialogue.filter((_, i) => i !== index);
        onChange(updatedDialogue);
        if (expandedMessage === index) {
            setExpandedMessage(null);
        } else if (expandedMessage !== null && expandedMessage > index) {
            setExpandedMessage(expandedMessage - 1);
        }
    }, [dialogue, onChange, expandedMessage]);

    const moveMessage = useCallback((fromIndex: number, toIndex: number) => {
        const updatedDialogue = [...dialogue];
        const [movedMessage] = updatedDialogue.splice(fromIndex, 1);
        updatedDialogue.splice(toIndex, 0, movedMessage);
        onChange(updatedDialogue);
    }, [dialogue, onChange]);

    const getRoleDisplayName = (role: UserRole) => {
        switch (role) {
            case 'student': return 'Student';
            case 'tutor': return 'Tutor';
            case 'observer': return 'Observer';
            default: return role;
        }
    };

    const getRoleColor = (role: UserRole) => {
        switch (role) {
            case 'student': return '#007bff';
            case 'tutor': return '#28a745';
            case 'observer': return '#6c757d';
            default: return '#6c757d';
        }
    };

    return (
        <div className={`dialogue-customizer ${className}`}>
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                marginBottom: '1rem' 
            }}>
                <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Pre-populate Chat History</h4>
                    <p style={{ 
                        margin: '0.25rem 0 0 0', 
                        fontSize: '0.9rem', 
                        color: '#666' 
                    }}>
                        Add example messages that will appear when the room starts
                    </p>
                </div>
                <button
                    type="button"
                    onClick={addMessage}
                    disabled={disabled}
                    style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem',
                        opacity: disabled ? 0.6 : 1
                    }}
                >
                    + Add Message
                </button>
            </div>

            {dialogue.length === 0 ? (
                <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    border: '2px dashed #ddd',
                    borderRadius: '8px',
                    color: '#666'
                }}>
                    <p style={{ margin: 0 }}>No pre-populated messages yet.</p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                        Click "Add Message" to create example dialogue for your training scenario.
                    </p>
                </div>
            ) : (
                <div style={{ gap: '1rem' }}>
                    {dialogue.map((message, index) => (
                        <div
                            key={index}
                            style={{
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                marginBottom: '0.75rem',
                                backgroundColor: '#fff'
                            }}
                        >
                            {/* Message Header */}
                            <div
                                style={{
                                    padding: '0.75rem 1rem',
                                    borderBottom: expandedMessage === index ? '1px solid #eee' : 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                                onClick={() => setExpandedMessage(expandedMessage === index ? null : index)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span
                                        style={{
                                            padding: '0.25rem 0.5rem',
                                            backgroundColor: getRoleColor(message.role),
                                            color: 'white',
                                            borderRadius: '12px',
                                            fontSize: '0.8rem',
                                            fontWeight: 500
                                        }}
                                    >
                                        {getRoleDisplayName(message.role)}
                                    </span>
                                    <span style={{ fontWeight: 500 }}>
                                        {message.user_name || 'Unnamed User'}
                                    </span>
                                    <span style={{ 
                                        color: '#666', 
                                        fontSize: '0.9rem',
                                        fontStyle: 'italic'
                                    }}>
                                        {message.message ? 
                                            (message.message.length > 50 ? 
                                                `"${message.message.substring(0, 50)}..."` : 
                                                `"${message.message}"`) : 
                                            'No message'
                                        }
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {/* Move buttons */}
                                    {index > 0 && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                moveMessage(index, index - 1);
                                            }}
                                            disabled={disabled}
                                            style={{
                                                padding: '0.25rem',
                                                backgroundColor: 'transparent',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem'
                                            }}
                                            title="Move up"
                                        >
                                            ↑
                                        </button>
                                    )}
                                    {index < dialogue.length - 1 && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                moveMessage(index, index + 1);
                                            }}
                                            disabled={disabled}
                                            style={{
                                                padding: '0.25rem',
                                                backgroundColor: 'transparent',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem'
                                            }}
                                            title="Move down"
                                        >
                                            ↓
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeMessage(index);
                                        }}
                                        disabled={disabled}
                                        style={{
                                            padding: '0.25rem 0.5rem',
                                            backgroundColor: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.8rem'
                                        }}
                                        title="Delete message"
                                    >
                                        ×
                                    </button>
                                    <span style={{ fontSize: '0.8rem', color: '#666' }}>
                                        {expandedMessage === index ? '▼' : '▶'}
                                    </span>
                                </div>
                            </div>

                            {/* Message Edit Form */}
                            {expandedMessage === index && (
                                <div style={{ padding: '1rem' }}>
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: '1fr 150px', 
                                        gap: '1rem',
                                        marginBottom: '1rem'
                                    }}>
                                        <div>
                                            <label style={{ 
                                                display: 'block', 
                                                fontSize: '0.9rem', 
                                                fontWeight: 500, 
                                                marginBottom: '0.25rem' 
                                            }}>
                                                User Name
                                            </label>
                                            <input
                                                type="text"
                                                value={message.user_name}
                                                onChange={(e) => updateMessage(index, 'user_name', e.target.value)}
                                                disabled={disabled}
                                                placeholder="e.g., Alice, John, etc."
                                                style={{
                                                    width: '100%',
                                                    padding: '0.5rem',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '4px',
                                                    fontSize: '0.9rem'
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ 
                                                display: 'block', 
                                                fontSize: '0.9rem', 
                                                fontWeight: 500, 
                                                marginBottom: '0.25rem' 
                                            }}>
                                                Role
                                            </label>
                                            <select
                                                value={message.role}
                                                onChange={(e) => updateMessage(index, 'role', e.target.value as UserRole)}
                                                disabled={disabled}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.5rem',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '4px',
                                                    fontSize: '0.9rem'
                                                }}
                                            >
                                                <option value="student">Student</option>
                                                <option value="tutor">Tutor</option>
                                                <option value="observer">Observer</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ 
                                            display: 'block', 
                                            fontSize: '0.9rem', 
                                            fontWeight: 500, 
                                            marginBottom: '0.25rem' 
                                        }}>
                                            Message
                                        </label>
                                        <textarea
                                            value={message.message}
                                            onChange={(e) => updateMessage(index, 'message', e.target.value)}
                                            disabled={disabled}
                                            placeholder="Enter the message content..."
                                            rows={3}
                                            style={{
                                                width: '100%',
                                                padding: '0.5rem',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                fontSize: '0.9rem',
                                                resize: 'vertical',
                                                fontFamily: 'inherit'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {dialogue.length > 0 && (
                <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    color: '#666'
                }}>
                    <strong>Preview:</strong> {dialogue.length} pre-populated message{dialogue.length !== 1 ? 's' : ''} will appear when the room starts.
                </div>
            )}
        </div>
    );
};

export default DialogueCustomizer;