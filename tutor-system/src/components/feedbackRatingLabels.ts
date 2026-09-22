#!/usr/bin/env node
// Shared wording for the helpfulness intensity scale used by every message-rating entry point.

const HELPFUL_LABELS: Record<number, string> = {
    0: 'How helpful was this?',
    1: 'Slightly helpful',
    2: 'Somewhat helpful',
    3: 'Moderately helpful',
    4: 'Very helpful',
    5: 'Extremely helpful',
};

const UNHELPFUL_LABELS: Record<number, string> = {
    0: 'How unhelpful was this?',
    1: 'Slightly unhelpful',
    2: 'Somewhat unhelpful',
    3: 'Moderately unhelpful',
    4: 'Very unhelpful',
    5: 'Extremely unhelpful',
};

export const getRatingLabel = (isLike: boolean, rating: number): string => {
    const labels = isLike ? HELPFUL_LABELS : UNHELPFUL_LABELS;
    return labels[rating] || labels[0];
};
