#!/usr/bin/env node
/**
 * Test file: src/components/PostComment.tsx
 * Purpose: lock the non-AI tutor badge to the exact mixed-case "AI chatbot" label.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PostComment from '../PostComment';
import { Message } from '../../types';

describe('PostComment role badges', () => {
    const buildMessage = (overrides: Partial<Message> = {}): Message => ({
        id: 'message-1',
        room_id: 'room-1',
        user_id: 'tutor-1',
        content: 'Please verify the sender before opening the link.',
        user_role: 'tutor',
        is_ai_generated: false,
        ai_model_used: null,
        ai_response_time_ms: null,
        parent_message_id: null,
        created_at: '2026-09-01T12:00:00.000Z',
        display_name: 'Training Tutor',
        avatar_url: null,
        ...overrides
    });

    it('renders the non-AI tutor badge as AI chatbot for a non-student viewer', () => {
        const message = buildMessage({ id: 'message-tutor-1' });

        render(
            <PostComment
                message={message}
                currentUserId="student-1"
                currentUserRole="tutor"
            />
        );

        const badge = screen.getByText('👨‍🏫 AI chatbot', { exact: true });
        expect(badge).toHaveClass('comment-role-badge--tutor');
        expect(badge).toHaveTextContent(/^👨‍🏫 AI chatbot$/);
        expect(badge).not.toHaveTextContent(/tutor/i);
    });

    it('hides ordinary role badges from student viewers', () => {
        render(
            <PostComment
                message={buildMessage()}
                currentUserId="student-1"
                currentUserRole="student"
            />
        );

        expect(screen.queryByText('👨‍🏫 tutor', { exact: true })).not.toBeInTheDocument();
        expect(document.querySelector('.comment-role-badge')).not.toBeInTheDocument();
    });

    it('keeps the AI Assistant and model badge for generated messages', () => {
        render(
            <PostComment
                message={buildMessage({
                    is_ai_generated: true,
                    ai_model_used: 'gpt-4o-mini'
                })}
                currentUserId="tutor-1"
                currentUserRole="tutor"
            />
        );

        expect(screen.getByText(/AI Assistant/)).toBeInTheDocument();
        expect(screen.getByText(/AI · gpt-4o-mini/)).toBeInTheDocument();
        expect(document.querySelector('.comment-role-badge')).not.toBeInTheDocument();
    });

    it.each([
        ['student', '👨‍🎓 student'],
        ['observer', '👁️ observer'],
        ['others', '👤 others']
    ])('keeps the original role label for %s messages', (role, expectedLabel) => {
        render(
            <PostComment
                message={buildMessage({ user_role: role as Message['user_role'] })}
                currentUserId="viewer-1"
                currentUserRole="observer"
            />
        );

        expect(screen.getByText(expectedLabel, { exact: true })).toBeInTheDocument();
    });
});
