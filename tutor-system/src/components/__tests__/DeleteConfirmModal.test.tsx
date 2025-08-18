import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeleteConfirmModal from '../DeleteConfirmModal';

describe('DeleteConfirmModal', () => {
    const mockRoom = {
        id: 'room-1',
        title: 'Test Room',
        description: 'Test Description',
        tutor_id: 'tutor-1',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        password: null,
        image_url: '/images/test.png',
        student_id: null,
        observer_id: null,
        op_id: null,
        op_display_name: null,
        op_avatar_url: null,
        pre_populated_dialogue: null
    };

    const mockOnConfirm = jest.fn();
    const mockOnCancel = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.style.overflow = '';
    });

    afterEach(() => {
        document.body.style.overflow = '';
    });

    test('should not render when isOpen is false', () => {
        render(
            <DeleteConfirmModal
                isOpen={false}
                room={mockRoom}
                isDeleting={false}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        expect(screen.queryByText('Confirm Room Deletion')).not.toBeInTheDocument();
    });

    test('should render when isOpen is true', () => {
        render(
            <DeleteConfirmModal
                isOpen={true}
                room={mockRoom}
                isDeleting={false}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        expect(screen.getByText(/Confirm Room Deletion/)).toBeInTheDocument();
        expect(screen.getByText('Test Room')).toBeInTheDocument();
    });

    test('should call onCancel when Cancel button is clicked', () => {
        render(
            <DeleteConfirmModal
                isOpen={true}
                room={mockRoom}
                isDeleting={false}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        fireEvent.click(screen.getByText('Cancel'));
        expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    test('should call onConfirm when Delete Room button is clicked', () => {
        render(
            <DeleteConfirmModal
                isOpen={true}
                room={mockRoom}
                isDeleting={false}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        fireEvent.click(screen.getByText('Delete Room'));
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    test('should disable buttons when isDeleting is true', () => {
        render(
            <DeleteConfirmModal
                isOpen={true}
                room={mockRoom}
                isDeleting={true}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        expect(screen.getByText('Cancel')).toBeDisabled();
        expect(screen.getByText('Deleting...')).toBeDisabled();
    });

    test('should call onCancel when Escape key is pressed', () => {
        render(
            <DeleteConfirmModal
                isOpen={true}
                room={mockRoom}
                isDeleting={false}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    test('should call onCancel when clicking on backdrop', () => {
        render(
            <DeleteConfirmModal
                isOpen={true}
                room={mockRoom}
                isDeleting={false}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        const backdrop = document.querySelector('.delete-modal-backdrop');
        expect(backdrop).toBeInTheDocument();
        
        fireEvent.click(backdrop!);
        expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    test('should not call onCancel when clicking on modal content', () => {
        render(
            <DeleteConfirmModal
                isOpen={true}
                room={mockRoom}
                isDeleting={false}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        const content = document.querySelector('.delete-modal-content');
        expect(content).toBeInTheDocument();
        
        fireEvent.click(content!);
        expect(mockOnCancel).not.toHaveBeenCalled();
    });

    test('should set body overflow to hidden when open', () => {
        render(
            <DeleteConfirmModal
                isOpen={true}
                room={mockRoom}
                isDeleting={false}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        expect(document.body.style.overflow).toBe('hidden');
    });

    test('should restore body overflow when closed', () => {
        const { rerender } = render(
            <DeleteConfirmModal
                isOpen={true}
                room={mockRoom}
                isDeleting={false}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        expect(document.body.style.overflow).toBe('hidden');

        rerender(
            <DeleteConfirmModal
                isOpen={false}
                room={mockRoom}
                isDeleting={false}
                onConfirm={mockOnConfirm}
                onCancel={mockOnCancel}
            />
        );

        expect(document.body.style.overflow).toBe('');
    });
});