import React from 'react';
import { render, screen } from '@testing-library/react';
import RoomLearningStatus from '../RoomLearningStatus';

const learner = { learnerId: 'student', learnerName: 'Sam', joinedAt: '2026-11-21T12:00:00Z', targetsSaved: false, hasMessages: false };
it('distinguishes no learner and unavailable state', () => {
  const view = render(<RoomLearningStatus error={false} status={{ ...learner, learnerId: null }} />);
  expect(screen.getByText('No learner yet')).toBeTruthy();
  view.rerender(<RoomLearningStatus error />);
  expect(screen.getByText('Learner and target status unavailable.')).toBeTruthy();
});
it('shows server saved state and warning independently from local drafts', () => {
  const view = render(<RoomLearningStatus error={false} status={learner} />);
  expect(screen.getByText(/Learner: Sam/)).toBeTruthy();
  expect(screen.getByText(/progress is not being recorded/)).toBeTruthy();
  view.rerender(<RoomLearningStatus error={false} status={{ ...learner, targetsSaved: true }} />);
  expect(screen.getByText('Targets saved')).toBeTruthy();
});
it('dashboard warns only after learner messages', () => {
  const view = render(<RoomLearningStatus dashboard error={false} status={learner} />);
  expect(screen.queryByText(/progress is not being recorded/)).toBeNull();
  view.rerender(<RoomLearningStatus dashboard error={false} status={{ ...learner, hasMessages: true }} />);
  expect(screen.getByText(/progress is not being recorded/)).toBeTruthy();
});
