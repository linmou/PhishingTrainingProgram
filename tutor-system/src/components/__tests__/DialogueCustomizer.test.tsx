/**
 * DialogueCustomizer Component Tests
 * 
 * Tests the dialogue customization functionality for tutors
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DialogueCustomizer from '../DialogueCustomizer';
import { PrePopulatedMessage } from '../../types';

describe('DialogueCustomizer', () => {
    const mockOnChange = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Empty State', () => {
        it('should render empty state when no dialogue exists', () => {
            render(
                <DialogueCustomizer
                    dialogue={[]}
                    onChange={mockOnChange}
                />
            );

            expect(screen.getByText('Pre-populate Chat History')).toBeInTheDocument();
            expect(screen.getByText('No pre-populated messages yet.')).toBeInTheDocument();
            expect(screen.getByText('+ Add Message')).toBeInTheDocument();
        });

        it('should call onChange when adding first message', () => {
            render(
                <DialogueCustomizer
                    dialogue={[]}
                    onChange={mockOnChange}
                />
            );

            fireEvent.click(screen.getByText('+ Add Message'));

            expect(mockOnChange).toHaveBeenCalledWith([{
                user_name: '',
                message: '',
                role: 'others'
            }]);
        });
    });

    describe('With Messages', () => {
        const mockDialogue: PrePopulatedMessage[] = [
            {
                user_name: 'Alice',
                message: 'Hello there!',
                role: 'student'
            },
            {
                user_name: 'Bob',
                message: 'Welcome to the training!',
                role: 'tutor'
            }
        ];

        it('should display existing messages', () => {
            render(
                <DialogueCustomizer
                    dialogue={mockDialogue}
                    onChange={mockOnChange}
                />
            );

            expect(screen.getByText('Alice')).toBeInTheDocument();
            expect(screen.getByText('Bob')).toBeInTheDocument();
            expect(screen.getByText('"Hello there!"')).toBeInTheDocument();
            expect(screen.getByText('"Welcome to the training!"')).toBeInTheDocument();
        });

        it('should show message count in preview', () => {
            render(
                <DialogueCustomizer
                    dialogue={mockDialogue}
                    onChange={mockOnChange}
                />
            );

            expect(screen.getByText(/2 pre-populated messages will appear/)).toBeInTheDocument();
        });

        it('should show expand/collapse indicators', () => {
            render(
                <DialogueCustomizer
                    dialogue={mockDialogue}
                    onChange={mockOnChange}
                />
            );

            // Should show collapse indicators (▶) for unexpanded messages
            expect(screen.getAllByText('▶')).toHaveLength(2);
            
            // Messages should be displayed in header
            expect(screen.getByText('Alice')).toBeInTheDocument();
            expect(screen.getByText('Bob')).toBeInTheDocument();
        });

        it('should call onChange when updating message', () => {
            render(
                <DialogueCustomizer
                    dialogue={mockDialogue}
                    onChange={mockOnChange}
                />
            );

            // Expand first message
            fireEvent.click(screen.getByText('Alice'));
            
            // Update user name
            const nameInput = screen.getByDisplayValue('Alice');
            fireEvent.change(nameInput, { target: { value: 'Alice Smith' } });

            expect(mockOnChange).toHaveBeenCalledWith([
                {
                    user_name: 'Alice Smith',
                    message: 'Hello there!',
                    role: 'student'
                },
                {
                    user_name: 'Bob',
                    message: 'Welcome to the training!',
                    role: 'tutor'
                }
            ]);
        });

        it('should allow removing messages', () => {
            render(
                <DialogueCustomizer
                    dialogue={mockDialogue}
                    onChange={mockOnChange}
                />
            );

            // Find and click delete button for first message
            const deleteButtons = screen.getAllByText('×');
            fireEvent.click(deleteButtons[0]);

            expect(mockOnChange).toHaveBeenCalledWith([
                {
                    user_name: 'Bob',
                    message: 'Welcome to the training!',
                    role: 'tutor'
                }
            ]);
        });

        it('should allow moving messages up and down', () => {
            render(
                <DialogueCustomizer
                    dialogue={mockDialogue}
                    onChange={mockOnChange}
                />
            );

            // Find and click move down button for first message
            const moveDownButtons = screen.getAllByText('↓');
            fireEvent.click(moveDownButtons[0]);

            expect(mockOnChange).toHaveBeenCalledWith([
                {
                    user_name: 'Bob',
                    message: 'Welcome to the training!',
                    role: 'tutor'
                },
                {
                    user_name: 'Alice',
                    message: 'Hello there!',
                    role: 'student'
                }
            ]);
        });
    });

    describe('Role Display', () => {
        it('should display correct role colors and names', () => {
            const dialogueWithRoles: PrePopulatedMessage[] = [
                { user_name: 'Student1', message: 'Hi', role: 'student' },
                { user_name: 'Tutor1', message: 'Hello', role: 'tutor' },
                { user_name: 'Observer1', message: 'Watching', role: 'observer' },
                { user_name: 'Other1', message: 'External message', role: 'others' }
            ];

            render(
                <DialogueCustomizer
                    dialogue={dialogueWithRoles}
                    onChange={mockOnChange}
                />
            );

            expect(screen.getByText('Student')).toBeInTheDocument();
            expect(screen.getByText('Tutor')).toBeInTheDocument();
            expect(screen.getByText('Observer')).toBeInTheDocument();
            expect(screen.getByText('Others')).toBeInTheDocument();
        });
    });

    describe('Disabled State', () => {
        it('should disable all controls when disabled prop is true', () => {
            render(
                <DialogueCustomizer
                    dialogue={[]}
                    onChange={mockOnChange}
                    disabled={true}
                />
            );

            const addButton = screen.getByText('+ Add Message');
            expect(addButton).toBeDisabled();
        });
    });
});