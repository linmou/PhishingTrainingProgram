/**
 * Purpose: Identify and tag behavior-eval / demo rooms so they stay off the
 * main Tutor "Your Rooms" list and live on /tutor/test-rooms instead.
 */

import { getDemoRoomTemplateSeeds } from '../services/demoRoomTemplates';

/** Appended to room.description when created as a behavior test room. */
export const BEHAVIOR_TEST_ROOM_MARKER = '[behavior-test-room]';

export function getBehaviorDemoTemplateNames(): string[] {
  return getDemoRoomTemplateSeeds().map((s) => s.template_name);
}

export function getBehaviorDemoTitleTemplates(): string[] {
  return getDemoRoomTemplateSeeds().map((s) => s.title_template);
}

export function isBehaviorDemoTemplateName(templateName: string | null | undefined): boolean {
  if (!templateName) return false;
  return getBehaviorDemoTemplateNames().includes(templateName);
}

/**
 * True for rooms that belong on the Test Rooms page (not main dashboard).
 */
export function isBehaviorTestRoom(room: {
  title?: string | null;
  description?: string | null;
}): boolean {
  const desc = room.description || '';
  if (desc.includes(BEHAVIOR_TEST_ROOM_MARKER)) return true;

  const title = room.title || '';
  if (title.startsWith('Demo:')) return true;
  if (getBehaviorDemoTitleTemplates().includes(title)) return true;
  if (getBehaviorDemoTemplateNames().includes(title)) return true;
  return false;
}

export function markBehaviorTestDescription(description: string | null | undefined): string {
  const base = (description || '').trim();
  if (base.includes(BEHAVIOR_TEST_ROOM_MARKER)) return base;
  return base ? `${base}\n\n${BEHAVIOR_TEST_ROOM_MARKER}` : BEHAVIOR_TEST_ROOM_MARKER;
}
