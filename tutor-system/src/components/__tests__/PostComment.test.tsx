#!/usr/bin/env node
/**
 * Test file: src/components/PostComment.tsx
 * Purpose: lock role/mode message presentation to the exact mixed-case "AI chatbot" tutor badge.
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
        ai_model_used: null,
        ai_response_time_ms: null,
        parent_message_id: null,
        created_at: '2026-09-01T12:00:00.000Z',
        display_name: 'Training Tutor',
        avatar_url: null,
        ...overrides
    });

    it('renders the tutor badge as AI chatbot for a non-student viewer', () => {
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

    it('keeps the ordinary observer role badge styling for non-student viewers', () => {
        render(
            <PostComment
                message={buildMessage({ user_role: 'observer', display_name: 'Observer One' })}
                currentUserId="tutor-1"
                currentUserRole="tutor"
            />
        );

        const badge = screen.getByText('👁️ observer', { exact: true });
        expect(badge).toHaveClass('comment-role-badge');
        expect(badge).not.toHaveClass('comment-role-badge--tutor');
    });

    it('does not render stored model diagnostics as a visual chip', () => {
        render(
            <PostComment
                message={buildMessage({
                    ai_model_used: 'gpt-4o-mini'
                })}
                currentUserId="tutor-1"
                currentUserRole="tutor"
            />
        );

        expect(screen.getByText('Training Tutor')).toBeInTheDocument();
        expect(screen.queryByText(/AI · gpt-4o-mini/)).not.toBeInTheDocument();
        expect(screen.getByText('👨‍🏫 AI chatbot', { exact: true })).toBeInTheDocument();
    });

    it('uses the tagged Riley profile only for an explicit Multi-agent tutor message', () => {
        const tutorAvatarUrl = 'https://example.test/tutor-avatar.png';

        render(
            <PostComment
                message={buildMessage({
                    content: '[agent:riley] Trust the logo.',
                    avatar_url: tutorAvatarUrl,
                    response_mode: 'multiagent' as any
                })}
                currentUserId="viewer-1"
                currentUserRole="tutor"
            />
        );

        expect(screen.getByText('Riley')).toBeInTheDocument();
        expect(screen.getByTitle('Riley')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(screen.getByText('Trust the logo.')).toBeInTheDocument();
        expect(screen.queryByText(/\[agent:riley\]/)).not.toBeInTheDocument();
    });

    it('uses the stored tutor profile for a valid Tutor tag and strips the tag from the body', () => {
        const tutorAvatarUrl = 'https://example.test/tutor-avatar.png';

        render(
            <PostComment
                message={buildMessage({
                    content: '[agent:tutor] Check the sender independently.',
                    avatar_url: tutorAvatarUrl,
                    response_mode: 'multiagent' as any
                })}
                currentUserId="viewer-1"
                currentUserRole="tutor"
            />
        );

        expect(screen.getByText('Training Tutor')).toBeInTheDocument();
        expect(screen.queryByText('AI Tutor')).not.toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Training Tutor' })).toHaveAttribute('src', tutorAvatarUrl);
        expect(screen.getByText('Check the sender independently.')).toBeInTheDocument();
        expect(screen.queryByText(/\[agent:tutor\]/)).not.toBeInTheDocument();
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
