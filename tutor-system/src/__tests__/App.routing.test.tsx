/**
 * Test target: src/App.tsx
 * Purpose: verify app bootstrap routing survives deep-link refreshes for room URLs.
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import App from '../App';

jest.mock('../contexts/AuthContext', () => ({
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../contexts/RoomContext', () => ({
    RoomProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../pages/HomePage', () => () => <div>home-page</div>);
jest.mock('../pages/StudentView', () => () => <div>student-view</div>);
jest.mock('../pages/TutorView', () => () => <div>tutor-view</div>);
jest.mock('../pages/ObserverView', () => () => <div>observer-view</div>);
jest.mock('../pages/RoomPagePost', () => () => <div>room-page</div>);
jest.mock('../pages/UserProfile', () => () => <div>user-profile</div>);

describe('App routing', () => {
    afterEach(() => {
        cleanup();
        window.location.hash = '';
        window.history.replaceState({}, '', '/');
    });

    it('boots the room route from a deep-link refresh URL', () => {
        window.location.hash = '#/room/test-room';

        render(<App />);

        expect(screen.getByText('room-page')).toBeInTheDocument();
        expect(screen.queryByText('home-page')).not.toBeInTheDocument();
    });

    it('boots the home route when no hash route is present', () => {
        render(<App />);

        expect(screen.getByText('home-page')).toBeInTheDocument();
    });
});
