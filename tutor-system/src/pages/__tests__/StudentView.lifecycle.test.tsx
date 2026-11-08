#!/usr/bin/env node
/** Tests src/pages/StudentView.tsx: fetch recovery, operation errors, subscription ownership and stale loads. */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import StudentView from '../StudentView';
import { supabase } from '../../services/supabase';

let mockUser = { id: 'learner-a', display_name: 'A', current_role: 'student' };
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../services/supabase', () => ({ supabase: { from: jest.fn(), channel: jest.fn() } }));
jest.mock('../../services/transferAssessmentService', () => ({ transferAssessmentService: { joinRoom: jest.fn() } }));
jest.mock('../../components/AvatarDisplay', () => () => null);
jest.mock('../../components/RoomCard', () => (props: any) => (
  <button onClick={() => props.onJoin(props.room.id)}>{props.room.title}: {props.joinButtonText}</button>
));

const room = { id: 'room-a', title: 'Room A', description: '', tutor_id: 'tutor', is_active: true };
const roomRead = jest.fn();
const sessionRead = jest.fn();
const occupancyRead = jest.fn();
let channels: Array<{ callback: () => void; unsubscribe: jest.Mock }>;
const view = () => <BrowserRouter><StudentView /></BrowserRouter>;
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const tick = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms); }); };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockUser = { id: 'learner-a', display_name: 'A', current_role: 'student' };
  roomRead.mockReset().mockResolvedValue({ data: [room], error: null });
  sessionRead.mockReset().mockResolvedValue({ data: [], error: null });
  occupancyRead.mockReset().mockResolvedValue({ data: null, error: { message: 'offline' } });
  channels = [];
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    const query: any = {
      select: () => query, eq: () => query, not: () => query,
      order: roomRead, maybeSingle: occupancyRead,
      then: (resolve: any, reject: any) => sessionRead().then(resolve, reject),
    };
    if (table !== 'rooms' && table !== 'sessions') throw new Error(`Unexpected table: ${table}`);
    return query;
  });
  (supabase.channel as jest.Mock).mockImplementation(() => {
    const channel = { callback: () => {}, unsubscribe: jest.fn(),
      on: jest.fn((_event, _filter, callback) => { channel.callback = callback; return channel; }),
      subscribe: jest.fn(() => channel),
    };
    channels.push(channel);
    return channel;
  });
});
afterEach(() => { jest.useRealTimers(); });

it('preserves join errors across realtime refreshes without restarting subscriptions', async () => {
  render(view());
  await flush();
  await tick(3000);
  expect(roomRead).toHaveBeenCalledTimes(1);
  expect(channels).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Room A: Join Room' }));
  await flush();
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to check room availability');
  await tick(4000);
  expect(roomRead).toHaveBeenCalledTimes(1);
  await act(async () => { channels[0].callback(); });
  expect(roomRead).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to check room availability');
  await act(async () => { channels[1].callback(); });
  expect(sessionRead).toHaveBeenCalledTimes(3);
  expect(channels).toHaveLength(2);
  expect(channels.every(channel => channel.unsubscribe.mock.calls.length === 0)).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
  await flush();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(roomRead).toHaveBeenCalledTimes(4);
});

it('bounds initial retries and connects only after explicit offline recovery', async () => {
  roomRead.mockResolvedValue({ data: null, error: { message: 'offline' } });
  render(view());
  await flush();
  expect(roomRead).toHaveBeenCalledTimes(1);
  await tick(2000);
  expect(roomRead).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('alert')).toHaveTextContent('Showing offline mode');
  await tick(10000);
  expect(roomRead).toHaveBeenCalledTimes(2);
  expect(channels).toHaveLength(0);
  roomRead.mockResolvedValue({ data: [room], error: null });
  fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
  await flush();
  await tick(3000);
  expect(channels).toHaveLength(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('keeps subscriptions through a refresh failure and recovers on a later event', async () => {
  render(view());
  await flush();
  await tick(3000);
  sessionRead.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
  await act(async () => { channels[0].callback(); });
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to load rooms');
  await act(async () => { channels[1].callback(); });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(channels).toHaveLength(2);
});

it('cleans old identity subscriptions and ignores an old pending result', async () => {
  const rendered = render(view());
  await flush();
  await tick(3000);
  let resolveOld!: (result: any) => void;
  roomRead.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  await act(async () => { channels[0].callback(); });
  mockUser = { ...mockUser, id: 'learner-b' };
  roomRead.mockResolvedValue({ data: [{ ...room, title: 'New identity room' }], error: null });
  rendered.rerender(view());
  await flush();
  expect(channels[0].unsubscribe).toHaveBeenCalledTimes(1);
  expect(channels[1].unsubscribe).toHaveBeenCalledTimes(1);
  await act(async () => { resolveOld({ data: [{ ...room, title: 'Stale room' }], error: null }); });
  expect(screen.queryByText(/Stale room/)).not.toBeInTheDocument();
  expect(screen.getByText(/New identity room/)).toBeInTheDocument();
  await tick(3000);
  expect(channels).toHaveLength(4);
});

it('cancels pending subscription setup and ignores a load completed after unmount', async () => {
  const rendered = render(view());
  await flush();
  rendered.unmount();
  await tick(3000);
  expect(channels).toHaveLength(0);
  let resolveLoad!: (result: any) => void;
  roomRead.mockImplementationOnce(() => new Promise(resolve => { resolveLoad = resolve; }));
  const pending = render(view());
  pending.unmount();
  await act(async () => { resolveLoad({ data: [room], error: null }); });
  expect(sessionRead).toHaveBeenCalledTimes(1);
  await tick(3000);
  expect(channels).toHaveLength(0);
});

it('ignores a slower refresh when a newer refresh has completed', async () => {
  render(view());
  await flush();
  await tick(3000);
  let resolveOld!: (result: any) => void;
  roomRead.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  await act(async () => { channels[0].callback(); });
  roomRead.mockResolvedValueOnce({ data: [{ ...room, title: 'Newest room' }], error: null });
  await act(async () => { channels[1].callback(); });
  await act(async () => { resolveOld({ data: [{ ...room, title: 'Old room' }], error: null }); });
  expect(screen.getByText(/Newest room/)).toBeInTheDocument();
  expect(screen.queryByText(/Old room/)).not.toBeInTheDocument();
});
