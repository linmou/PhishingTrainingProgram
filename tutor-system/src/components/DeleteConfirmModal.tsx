import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Database } from '../types/database';
import './DeleteConfirmModal.css';

type Room = Database['public']['Tables']['rooms']['Row'];

interface DeleteConfirmModalProps {
    isOpen: boolean;
    room: Room | null;
    isDeleting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
    isOpen,
    room,
    isDeleting,
    onConfirm,
    onCancel
}) => {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isDeleting) {
                onCancel();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, isDeleting, onCancel]);

    if (!isOpen || !room) return null;

    const modalContent = (
        <div 
            className="delete-modal-backdrop"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isDeleting) {
                    onCancel();
                }
            }}
        >
            <div className="delete-modal-content">
                <h3 className="delete-modal-title">
                    ⚠️ Confirm Room Deletion
                </h3>
                <p className="delete-modal-message">
                    Are you sure you want to delete the room "<strong>{room.title}</strong>"?
                </p>
                <div className="delete-modal-warning">
                    <p>
                        <strong>Warning:</strong> This room will be permanently deleted and the chat history cannot be recovered.
                    </p>
                </div>
                <div className="delete-modal-actions">
                    <button
                        className="delete-modal-btn delete-modal-btn-cancel"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancel();
                        }}
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>
                    <button
                        className="delete-modal-btn delete-modal-btn-danger"
                        onClick={(e) => {
                            e.stopPropagation();
                            onConfirm();
                        }}
                        disabled={isDeleting}
                    >
                        {isDeleting ? 'Deleting...' : 'Delete Room'}
                    </button>
                </div>
            </div>
        </div>
    );

    // Use React Portal to render modal at the root level
    return ReactDOM.createPortal(
        modalContent,
        document.body
    );
};

export default DeleteConfirmModal;