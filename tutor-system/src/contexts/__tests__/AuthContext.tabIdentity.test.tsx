// Test responsibility: an open tab's assessment-api requests carry that tab's signed-in user (issue #109).
// The session is browser-scoped and fails closed: when another tab signs out, clears storage, or stores a
// different user or role, this tab signs itself out, says why and returns to sign-in. It never adopts the
// other tab's user, and a finished await never writes a stale identity back over another tab's change.

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, parseStoredUser, useAuth } from '../AuthContext';
import SessionEndedRedirect from '../../components/SessionEndedRedirect';
import HomePage from '../../pages/HomePage';
import { supabase } from '../../services/supabase';
import { transferAssessmentService } from '../../services/transferAssessmentService';
import { getApplicationUserId, setApplicationUserId } from '../../services/applicationIdentity';

jest.mock('../../services/supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));

const USER_KEY = 'tutor_system_user';
const SIGNED_OUT_ELSEWHERE = 'You signed out or switched account in another tab. Sign in again to continue.';
const tutor = { id: 'tutor-a', display_name: 'Tutor A', current_role: 'tutor', status: 'active' };
const otherTutor = { id: 'tutor-b', display_name: 'Tutor B', current_role: 'tutor', status: 'active' };
const student = { id: 'student-b', display_name: 'B', current_role: 'student', status: 'active' };

let auth: ReturnType<typeof useAuth>;
const Probe: React.FC = () => {
  auth = useAuth();
  const location = useLocation();
  return (
    <>
      <div data-testid="user">{auth.user ? `${auth.user.id}:${auth.user.current_role}:${auth.user.display_name}` : 'no-user'}</div>
      <div data-testid="path">{location.pathname}</div>
    </>
  );
};

/** Simulates the browser notifying this tab that another tab changed shared storage. */
function storageChangedInAnotherTab(key: string | null, newValue: string | null) {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: window.localStorage }));
  });
}

function mountTab() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/room/room-1']}>
        <SessionEndedRedirect />
        <Routes>
          <Route path="/" element={<><HomePage /><Probe /></>} />
          <Route path="/room/:roomId" element={<Probe />} />
          <Route path="/tutor" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

async function signedInTab() {
  localStorage.setItem(USER_KEY, JSON.stringify(tutor));
  mountTab();
  await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent(`${tutor.id}:tutor`));
}

async function sentIdentity(): Promise<Record<string, string>> {
  const invoke = supabase.functions.invoke as jest.Mock;
  invoke.mockClear();
  await transferAssessmentService.initializeChecklist({ roomId: 'room-1', studentId: 'learner-1', items: [] });
  expect(invoke).toHaveBeenCalledTimes(1);
  return invoke.mock.calls[0][1].headers;
}

function expectSignedOutAtSignIn() {
  expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/);
  expect(screen.getByRole('alert')).toHaveTextContent(SIGNED_OUT_ELSEWHERE);
  expect(getApplicationUserId()).toBeNull();
}

beforeEach(() => {
  localStorage.clear();
  // Module state outlives a test's unmounted tab; a real tab starts with no identity.
  setApplicationUserId(null);
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    single: jest.fn(async () => ({ data: tutor, error: null })),
  };
  (supabase.from as jest.Mock).mockReturnValue(query);
  (supabase.functions.invoke as jest.Mock).mockReset();
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { ok: true, data: { checklist_id: 'c-1' } }, error: null });
});

describe('parseStoredUser', () => {
  it('accepts a stored user with an id and a known or empty role', () => {
    expect(parseStoredUser(JSON.stringify(tutor))).toEqual(tutor);
    expect(parseStoredUser(JSON.stringify({ ...tutor, current_role: null }))?.id).toBe(tutor.id);
  });

  it.each([
    ['missing', null],
    ['not JSON', 'not-json'],
    ['not an object', '"tutor-a"'],
    ['without an id', JSON.stringify({ ...tutor, id: '' })],
    ['with an unknown role', JSON.stringify({ ...tutor, current_role: 'admin' })],
  ])('rejects a stored value that is %s', (_label, raw) => {
    expect(parseStoredUser(raw)).toBeNull();
  });
});

describe('assessment-api identity follows the tab session, not send-time storage', () => {
  it.each([
    ['removed', () => localStorage.removeItem(USER_KEY)],
    ['cleared', () => localStorage.clear()],
    ['replaced by another user', () => localStorage.setItem(USER_KEY, JSON.stringify(otherTutor))],
  ])('keeps sending the signed-in tutor after the stored user is %s before this tab is notified', async (_label, change) => {
    await signedInTab();
    change();
    expect(await sentIdentity()).toEqual({ 'x-application-user-id': tutor.id });
    expect(screen.getByTestId('user')).toHaveTextContent(tutor.id);
  });
});

describe('storage event from another tab', () => {
  it.each([
    ['signs out', USER_KEY, null, () => localStorage.removeItem(USER_KEY)],
    ['clears all site storage', null, null, () => localStorage.clear()],
    ['writes an unreadable identity', USER_KEY, 'not-json', () => localStorage.setItem(USER_KEY, 'not-json')],
    ['signs in as a different user', USER_KEY, JSON.stringify(otherTutor), () => localStorage.setItem(USER_KEY, JSON.stringify(otherTutor))],
    ['changes this user\'s role', USER_KEY, JSON.stringify({ ...tutor, current_role: 'student' }),
      () => localStorage.setItem(USER_KEY, JSON.stringify({ ...tutor, current_role: 'student' }))],
  ])('signs this tab out and returns to sign-in when another tab %s', async (_label, key, newValue, change) => {
    await signedInTab();
    const reads = (supabase.from as jest.Mock).mock.calls.length;
    change();
    storageChangedInAnotherTab(key, newValue);
    await waitFor(expectSignedOutAtSignIn);
    // Never adopts the other tab's user: requests carry no identity until this tab signs in again.
    expect(await sentIdentity()).toEqual({});
    // Signing out is local: no user, room or progress record is read or written.
    expect((supabase.from as jest.Mock).mock.calls.length).toBe(reads);
  });

  it('updates a display name changed in another tab in place, keeping the session', async () => {
    await signedInTab();
    const renamed = { ...tutor, display_name: 'Tutor Renamed' };
    localStorage.setItem(USER_KEY, JSON.stringify(renamed));
    storageChangedInAnotherTab(USER_KEY, JSON.stringify(renamed));
    expect(screen.getByTestId('user')).toHaveTextContent('tutor-a:tutor:Tutor Renamed');
    expect(screen.getByTestId('path')).toHaveTextContent('/room/room-1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(await sentIdentity()).toEqual({ 'x-application-user-id': tutor.id });
  });

  it('ignores storage changes to unrelated keys', async () => {
    await signedInTab();
    storageChangedInAnotherTab('room-learning-target-draft:room-1', null);
    expect(screen.getByTestId('user')).toHaveTextContent(tutor.id);
    expect(await sentIdentity()).toEqual({ 'x-application-user-id': tutor.id });
  });

  it('a signed-out tab does not adopt a user another tab signs in', async () => {
    mountTab();
    await waitFor(() => expect(auth.loading).toBe(false));
    localStorage.setItem(USER_KEY, JSON.stringify(otherTutor));
    storageChangedInAnotherTab(USER_KEY, JSON.stringify(otherTutor));
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(await sentIdentity()).toEqual({});
  });

  it('clears the notice once this tab signs in again', async () => {
    await signedInTab();
    localStorage.removeItem(USER_KEY);
    storageChangedInAnotherTab(USER_KEY, null);
    await waitFor(expectSignedOutAtSignIn);
    const query: any = {
      select: jest.fn(() => query), eq: jest.fn(() => query), limit: jest.fn(async () => ({ error: null })),
      update: jest.fn(() => query), single: jest.fn(async () => ({ data: tutor, error: null })),
    };
    (supabase.from as jest.Mock).mockReturnValue(query);
    await act(async () => { await auth.joinWithNameAndRole('Tutor A', 'tutor'); });
    expect(screen.getByTestId('user')).toHaveTextContent(tutor.id);
    expect(screen.queryByText(SIGNED_OUT_ELSEWHERE)).not.toBeInTheDocument();
  });
});

describe('no stale write-back after an await', () => {
  it('a restore that finishes after another tab signed out does not undo the sign-out', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify(tutor));
    let resolveRestore!: (value: unknown) => void;
    const query: any = { select: () => query, eq: () => query, single: () => new Promise(resolve => { resolveRestore = resolve; }) };
    (supabase.from as jest.Mock).mockReturnValue(query);
    mountTab();
    localStorage.removeItem(USER_KEY);
    storageChangedInAnotherTab(USER_KEY, null);
    await act(async () => { resolveRestore({ data: { ...tutor, updated_at: 'later' }, error: null }); });
    await waitFor(() => expect(auth.loading).toBe(false));
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(getApplicationUserId()).toBeNull();
  });

  it('a restore that finishes after storage changed without an event yet does not overwrite it', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify(tutor));
    let resolveRestore!: (value: unknown) => void;
    const query: any = { select: () => query, eq: () => query, single: () => new Promise(resolve => { resolveRestore = resolve; }) };
    (supabase.from as jest.Mock).mockReturnValue(query);
    mountTab();
    localStorage.setItem(USER_KEY, JSON.stringify(otherTutor));
    await act(async () => { resolveRestore({ data: tutor, error: null }); });
    await waitFor(() => expect(auth.loading).toBe(false));
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(JSON.parse(localStorage.getItem(USER_KEY)!).id).toBe(otherTutor.id);
  });

  it.each([
    ['role change', () => auth.setUserRole('observer')],
    ['profile change', () => auth.updateUserProfile({ display_name: 'Tutor A2' })],
  ])('a %s that finishes after another tab signed in another user writes nothing back', async (_label, start) => {
    localStorage.setItem(USER_KEY, JSON.stringify(tutor));
    let resolveUpdate!: (value: unknown) => void;
    let calls = 0;
    const query: any = {
      select: () => query, eq: () => query, update: () => query,
      single: () => (++calls === 1 ? Promise.resolve({ data: tutor, error: null }) : new Promise(resolve => { resolveUpdate = resolve; })),
    };
    (supabase.from as jest.Mock).mockReturnValue(query);
    mountTab();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent(tutor.id));
    let pending!: Promise<void>;
    act(() => { pending = start(); });
    localStorage.setItem(USER_KEY, JSON.stringify(student));
    storageChangedInAnotherTab(USER_KEY, JSON.stringify(student));
    await act(async () => { resolveUpdate({ data: {}, error: null }); await pending.catch(() => undefined); });
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(getApplicationUserId()).toBeNull();
    expect(JSON.parse(localStorage.getItem(USER_KEY)!).id).toBe(student.id);
  });

  it('a profile change started before this tab changed role does not restore the old role', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify(tutor));
    const pendingUpdates: Array<(value: unknown) => void> = [];
    let calls = 0;
    const query: any = {
      select: () => query, eq: () => query, update: () => query,
      single: () => (++calls === 1 ? Promise.resolve({ data: tutor, error: null }) : new Promise(resolve => { pendingUpdates.push(resolve); })),
    };
    (supabase.from as jest.Mock).mockReturnValue(query);
    mountTab();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent(tutor.id));
    let profile!: Promise<void>;
    let role!: Promise<void>;
    act(() => { profile = auth.updateUserProfile({ display_name: 'Tutor A2' }); });
    act(() => { role = auth.setUserRole('observer'); });
    await act(async () => { pendingUpdates[1]({ data: {}, error: null }); await role; });
    await act(async () => { pendingUpdates[0]({ data: {}, error: null }); await profile.catch(() => undefined); });
    expect(screen.getByTestId('user')).toHaveTextContent('tutor-a:observer');
    expect(JSON.parse(localStorage.getItem(USER_KEY)!).current_role).toBe('observer');
  });
});
