import React from 'react';
import { render } from '@testing-library/react';
import { setApplicationUserId } from '../services/applicationIdentity';
import { useAuth } from '../contexts/AuthContext';
import { RoomProvider, useRoom } from '../contexts/RoomContext';

function TestIdentity({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  setApplicationUserId(user?.id || null);
  return <RoomProvider>{children}</RoomProvider>;
}

/** Shared provider boundary; individual tests retain their domain-specific ports and fixtures. */
export function renderRoomProvider(children: React.ReactNode) {
  const view = render(<TestIdentity>{children}</TestIdentity>);
  return { ...view, rerenderRoomProvider: (next: React.ReactNode) => view.rerender(<TestIdentity>{next}</TestIdentity>) };
}

export function RoomProbe({ onReady }: { onReady: (room: ReturnType<typeof useRoom>) => void }) {
  const room = useRoom();
  React.useEffect(() => { onReady(room); }, [onReady, room]);
  return null;
}
