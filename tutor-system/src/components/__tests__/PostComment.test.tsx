#!/usr/bin/env node
/**
 * Test file: src/components/PostComment.tsx
 * Purpose: verify role/mode presentation and the student's unselected, selected, and stored rating states.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PostComment from '../PostComment';
import { Message, MessageFeedbackStats } from '../../types';

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

    it.each([
        ['like', 'Like this comment', 'How helpful was this?', 'Slightly helpful', 1],
        ['dislike', 'Dislike this comment', 'How unhelpful was this?', 'Extremely unhelpful', 5],
    ] as const)('keeps a new %s rating neutral through hover until a star is clicked', async (feedbackType, actionTitle, prompt, level, rating) => {
        const onSubmitFeedback = jest.fn().mockResolvedValue(undefined);
        render(
            <PostComment
                message={buildMessage()}
                currentUserId="student-1"
                currentUserRole="student"
                onSubmitFeedback={onSubmitFeedback}
            />
        );

        fireEvent.click(screen.getByTitle(actionTitle));
        const star = screen.getByTitle(`Rate ${rating} star${rating === 1 ? '' : 's'}`);
        const submit = screen.getByRole('button', { name: 'Submit Rating' });
        expect(screen.getByText(prompt)).toBeInTheDocument();
        expect(submit).toBeDisabled();
        fireEvent.mouseEnter(star);
        expect(screen.getByText(prompt)).toBeInTheDocument();
        expect(screen.queryByText(level)).not.toBeInTheDocument();
        fireEvent.click(submit);
        expect(onSubmitFeedback).not.toHaveBeenCalled();

        fireEvent.click(star);
        fireEvent.mouseLeave(star);
        expect(screen.getByText(level)).toBeInTheDocument();
        expect(submit).toBeEnabled();
        fireEvent.click(submit);
        await waitFor(() => expect(onSubmitFeedback).toHaveBeenCalledWith('message-1', feedbackType, rating));
    });

    it.each([
        ['like', 'Very helpful', 'Somewhat helpful'],
        ['dislike', 'Very unhelpful', 'Somewhat unhelpful'],
    ] as const)('preserves the saved %s rating and allows editing it', async (feedbackType, label, editedLabel) => {
        const onSubmitFeedback = jest.fn().mockResolvedValue(undefined);
        const feedbackStats: MessageFeedbackStats = {
            message_id: 'message-1',
            total_feedback_count: 1,
            like_count: feedbackType === 'like' ? 1 : 0,
            dislike_count: feedbackType === 'dislike' ? 1 : 0,
            average_like_rating: feedbackType === 'like' ? 4 : null,
            average_dislike_rating: feedbackType === 'dislike' ? 4 : null,
            overall_average_rating: 4,
            user_feedback: { feedback_type: feedbackType, rating: 4 },
        };
        render(
            <PostComment
                message={buildMessage()}
                currentUserId="student-1"
                currentUserRole="student"
                feedbackStats={feedbackStats}
                onSubmitFeedback={onSubmitFeedback}
            />
        );

        fireEvent.click(screen.getByTitle('You rated this 4/5 stars'));
        expect(screen.getByText(label)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Submit Rating' })).toBeEnabled();
        fireEvent.click(screen.getByTitle('Rate 2 stars'));
        expect(screen.getByText(editedLabel)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Submit Rating' }));
        await waitFor(() => expect(onSubmitFeedback).toHaveBeenCalledWith('message-1', feedbackType, 2));
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

    it('preserves generated-message styling and response-time display', () => {
        render(
            <PostComment
                message={buildMessage({
                    is_ai_generated: true,
                    ai_response_time_ms: 1250,
                })}
                currentUserId="tutor-1"
                currentUserRole="tutor"
            />
        );

        expect(document.querySelector('.post-comment')).toHaveClass('post-comment-ai');
        expect(screen.getByText('· 1250ms')).toHaveClass('comment-response-time');
    });

    it('uses the stored character profile for an approved role reply', () => {
        const tutorAvatarUrl = 'https://example.test/tutor-avatar.png';

        render(
            <PostComment
                message={buildMessage({
                    content: 'Character reply.',
                    character: 'victim', persona_id: 'copilot:dylan', persona_name: 'Dylan', persona_avatar: '/images/victim_profile.jpeg',
                    avatar_url: tutorAvatarUrl,
                    response_mode: 'tutoring'
                })}
                currentUserId="viewer-1"
                currentUserRole="tutor"
            />
        );

        expect(screen.getByText('Dylan')).toBeInTheDocument();
        expect(screen.getByTitle('Dylan')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Dylan' })).toHaveAttribute('src', '/images/victim_profile.jpeg');
        expect(screen.getByText('Character reply.')).toBeInTheDocument();
        expect(screen.queryByText(/\[agent:riley\]/)).not.toBeInTheDocument();
    });

    it('keeps literal learner-supplied tags in ordinary transcript text', () => {
        const tutorAvatarUrl = 'https://example.test/tutor-avatar.png';

        render(
            <PostComment
                message={buildMessage({
                    content: '[agent:tutor] Check the sender independently.',
                    avatar_url: tutorAvatarUrl,
                    response_mode: 'tutoring'
                })}
                currentUserId="viewer-1"
                currentUserRole="tutor"
            />
        );

        expect(screen.getByText('Training Tutor')).toBeInTheDocument();
        expect(screen.queryByText('AI Tutor')).not.toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Training Tutor' })).toHaveAttribute('src', tutorAvatarUrl);
        expect(screen.getByText('[agent:tutor] Check the sender independently.')).toBeInTheDocument();
        expect(screen.queryByText(/\[agent:tutor\]/)).toBeInTheDocument();
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
