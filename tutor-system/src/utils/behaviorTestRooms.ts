/**
 * Purpose: Identify and tag behavior-eval / demo rooms so they stay off the
 * main Tutor "Your Rooms" list and the Student available-rooms list, and live
 * on /tutor/test-rooms instead.
 *
 * Only *test_only* catalog seeds (Demo: …) are excluded from the normal
 * create-room template picker. Classic teaching templates (Account Security,
 * Nintendo, iTunes, etc.) stay available on the main Tutor dashboard for
 * real tutors. Student list also hides browser-demo harness tutors (DemoTutor_*).
 */

import {
  getDemoRoomTemplateSeeds,
  getTestOnlyDemoTemplateSeeds
} from '../services/demoRoomTemplates';

/** Appended to room.description when created as a behavior test room. */
export const BEHAVIOR_TEST_ROOM_MARKER = '[behavior-test-room]';

/**
 * Browser demo script logins: `DemoTutor_${Date.now().slice(-6)}`.
 * Rooms owned by these tutors are harness residue, not class sessions.
 */
export const DEMO_HARNESS_TUTOR_NAME_RE = /^DemoTutor[_-]/i;

/** Names of templates that only belong on the Test Rooms page. */
export function getTestOnlyTemplateNames(): string[] {
  return getTestOnlyDemoTemplateSeeds().map((s) => s.template_name);
}

export function getTestOnlyTitleTemplates(): string[] {
  return getTestOnlyDemoTemplateSeeds().map((s) => s.title_template);
}

/**
 * True when this template should only be offered on /tutor/test-rooms
 * (not on the main Tutor create form).
 */
export function isBehaviorDemoTemplateName(templateName: string | null | undefined): boolean {
  if (!templateName) return false;
  if (templateName.startsWith('Demo:')) return true;
  return getTestOnlyTemplateNames().includes(templateName);
}

/**
 * True for rooms that belong on the Test Rooms page (not main Tutor dashboard).
 * Classics created for normal teaching (no marker) stay on /tutor.
 */
export function isBehaviorTestRoom(room: {
  title?: string | null;
  description?: string | null;
}): boolean {
  const desc = room.description || '';
  if (desc.includes(BEHAVIOR_TEST_ROOM_MARKER)) return true;

  const title = room.title || '';
  if (title.startsWith('Demo:')) return true;
  if (getTestOnlyTitleTemplates().includes(title)) return true;
  if (getTestOnlyTemplateNames().includes(title)) return true;
  return false;
}

/** Browser-demo harness account names (scripts/browser-demo-tutor-behavior.js). */
export function isDemoHarnessTutorName(displayName: string | null | undefined): boolean {
  if (!displayName) return false;
  return DEMO_HARNESS_TUTOR_NAME_RE.test(displayName.trim());
}

export type StudentRoomListItem = {
  title?: string | null;
  description?: string | null;
  tutor?: { display_name?: string | null } | null;
};

/**
 * True when a room must not appear on the Student Available Rooms list.
 * - Behavior-test classification (marker / Demo: title / test-only titles)
 * - Rooms owned by DemoTutor_* browser-demo harness accounts
 *
 * Real teaching rooms (classic titles, real tutor names, no marker) stay visible.
 */
export function isHiddenFromStudentRoomList(room: StudentRoomListItem): boolean {
  if (isBehaviorTestRoom(room)) return true;
  if (isDemoHarnessTutorName(room.tutor?.display_name)) return true;
  return false;
}

/**
 * Pipeline used by StudentView after fetch: drop hidden rooms, keep order.
 * Exposed for integrated tests of the list-filter boundary (real classifier).
 */
export function filterRoomsForStudentList<T extends StudentRoomListItem>(rooms: T[]): T[] {
  return rooms.filter((room) => !isHiddenFromStudentRoomList(room));
}

export function markBehaviorTestDescription(description: string | null | undefined): string {
  const base = (description || '').trim();
  if (base.includes(BEHAVIOR_TEST_ROOM_MARKER)) return base;
  return base ? `${base}\n\n${BEHAVIOR_TEST_ROOM_MARKER}` : BEHAVIOR_TEST_ROOM_MARKER;
}

/** All seeded catalog names (for docs / debugging). */
export function getAllSeededTemplateNames(): string[] {
  return getDemoRoomTemplateSeeds().map((s) => s.template_name);
}
