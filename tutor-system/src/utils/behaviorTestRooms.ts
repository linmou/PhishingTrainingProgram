/**
 * Purpose: Identify and tag behavior-eval / demo rooms so they stay off the
 * main Tutor "Your Rooms" list and live on /tutor/test-rooms instead.
 *
 * Only *test_only* catalog seeds (Demo: …) are excluded from the normal
 * create-room template picker. Classic teaching templates (Account Security,
 * Nintendo, iTunes, etc.) stay available on the main Tutor dashboard.
 */

import {
  getDemoRoomTemplateSeeds,
  getTestOnlyDemoTemplateSeeds
} from '../services/demoRoomTemplates';

/** Appended to room.description when created as a behavior test room. */
export const BEHAVIOR_TEST_ROOM_MARKER = '[behavior-test-room]';

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
 * True for rooms that belong on the Test Rooms page (not main dashboard).
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

export function markBehaviorTestDescription(description: string | null | undefined): string {
  const base = (description || '').trim();
  if (base.includes(BEHAVIOR_TEST_ROOM_MARKER)) return base;
  return base ? `${base}\n\n${BEHAVIOR_TEST_ROOM_MARKER}` : BEHAVIOR_TEST_ROOM_MARKER;
}

/** All seeded catalog names (for docs / debugging). */
export function getAllSeededTemplateNames(): string[] {
  return getDemoRoomTemplateSeeds().map((s) => s.template_name);
}
