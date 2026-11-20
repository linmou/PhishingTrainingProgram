// Test responsibility: an open tab's assessment-api requests carry that tab's signed-in user (issue #109),
// and changes to the stored identity made in another tab are followed visibly instead of silently.

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../AuthContext';
import { supabase } from '../../services/supabase';
import { transferAssessmentService } from '../../services/transferAssessmentService';

jest.mock('../../services/supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));

const USER_KEY = 'tutor_system_user';
const tutor = { id: 'tutor-a', display_name: 'Tutor A', current_role: 'tutor', status: 'active' };
const otherTutor = { id: 'tutor-b', display_name: 'Tutor B', current_role: 'tutor', status: 'active' };

const Probe: React.FC = () => {
  const { user } = useAuth();
  return <div data-testid="user">{user ? user.id : 'no-user'}</div>;
};

/** Simulates the browser notifying this tab that another tab changed shared storage. */
function storageChangedInAnotherTab(key: string | null, newValue: string | null) {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: window.localStorage }));
  });
}

async function signedInTab() {
  localStorage.setItem(USER_KEY, JSON.stringify(tutor));
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent(tutor.id));
}

async function sentIdentity(): Promise<Record<string, string>> {
  const invoke = supabase.functions.invoke as jest.Mock;
  invoke.mockClear();
  await transferAssessmentService.initializeChecklist({ roomId: 'room-1', studentId: 'learner-1', items: [] });
  expect(invoke).toHaveBeenCalledTimes(1);
  return invoke.mock.calls[0][1].headers;
}

beforeEach(() => {
  localStorage.clear();
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    single: jest.fn(async () => ({ data: tutor, error: null })),
  };
  (supabase.from as jest.Mock).mockReturnValue(query);
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { ok: true, data: { checklist_id: 'c-1' } }, error: null });
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
    ['signs out', USER_KEY],
    ['clears all site storage', null],
  ])('signs this tab out when another tab %s, without touching server data', async (_label, key) => {
    await signedInTab();
    const writes = (supabase.from as jest.Mock).mock.calls.length;
    localStorage.removeItem(USER_KEY);
    storageChangedInAnotherTab(key, null);
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(await sentIdentity()).toEqual({});
    expect((supabase.from as jest.Mock).mock.calls.length).toBe(writes);
  });

  it('adopts the user another tab signed in, as a reload would, and sends requests as that user', async () => {
    await signedInTab();
    localStorage.setItem(USER_KEY, JSON.stringify(otherTutor));
    storageChangedInAnotherTab(USER_KEY, JSON.stringify(otherTutor));
    expect(screen.getByTestId('user')).toHaveTextContent(otherTutor.id);
    expect(await sentIdentity()).toEqual({ 'x-application-user-id': otherTutor.id });
  });

  it('signs out when another tab writes an unreadable identity', async () => {
    await signedInTab();
    storageChangedInAnotherTab(USER_KEY, 'not-json');
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(await sentIdentity()).toEqual({});
  });

  it('ignores storage changes to unrelated keys', async () => {
    await signedInTab();
    storageChangedInAnotherTab('room-learning-target-draft:room-1', null);
    expect(screen.getByTestId('user')).toHaveTextContent(tutor.id);
    expect(await sentIdentity()).toEqual({ 'x-application-user-id': tutor.id });
  });
});
