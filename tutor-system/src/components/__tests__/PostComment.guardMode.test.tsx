#!/usr/bin/env node
/**
 * Test responsible for stable student-visible Guard identity and historical rendering from message-local mode.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PostComment from '../PostComment';
import { Message } from '../../types';

const buildMessage = (overrides: Partial<Message> = {}): Message => ({
    id: 'message-1',
    room_id: 'room-1',
    user_id: 'tutor-1',
    content: 'Stop and verify the destination in the real service.',
    user_role: 'tutor',
    is_ai_generated: false,
    ai_model_used: null,
    ai_response_time_ms: null,
    parent_message_id: null,
    created_at: '2026-04-02T00:00:00Z',
    display_name: 'Original Tutor',
    avatar_url: null,
    response_mode: null,
    ...overrides
});

describe('PostComment Guard Mode identity', () => {
    it('renders a Guard message as Security Supervisor even when room mode later changes', () => {
        render(
            <PostComment
                message={buildMessage({ response_mode: 'guard' })}
                currentUserId="student-1"
                currentUserRole="student"
            />
        );

        expect(screen.getByText('Security Supervisor')).toBeInTheDocument();
        expect(screen.queryByText('Original Tutor')).not.toBeInTheDocument();
    });

    it('keeps ordinary tutor identity for tutoring and legacy null messages', () => {
        const { rerender } = render(
            <PostComment
                message={buildMessage({ response_mode: 'tutoring' })}
                currentUserId="student-1"
                currentUserRole="student"
            />
        );

        expect(screen.getByText('Original Tutor')).toBeInTheDocument();

        rerender(
            <PostComment
                message={buildMessage({ response_mode: null })}
                currentUserId="student-1"
                currentUserRole="student"
            />
        );
        expect(screen.getByText('Original Tutor')).toBeInTheDocument();
    });
});
