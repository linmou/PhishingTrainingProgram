/**
 * File: src/utils/behaviorTestRooms.ts
 * Purpose: unit-test behavior-test room tagging and filtering helpers.
 */

import {
  BEHAVIOR_TEST_ROOM_MARKER,
  getAllSeededTemplateNames,
  isBehaviorDemoTemplateName,
  isBehaviorTestRoom,
  markBehaviorTestDescription
} from '../behaviorTestRooms';

describe('behaviorTestRooms', () => {
  it('marks descriptions with a stable test-room token', () => {
    expect(markBehaviorTestDescription('hello')).toContain(BEHAVIOR_TEST_ROOM_MARKER);
    expect(markBehaviorTestDescription('hello')).toContain('hello');
    expect(markBehaviorTestDescription(BEHAVIOR_TEST_ROOM_MARKER)).toBe(BEHAVIOR_TEST_ROOM_MARKER);
  });

  it('treats only Demo: / test_only templates as Test Rooms picker exclusives', () => {
    expect(isBehaviorDemoTemplateName('Demo: Lock Icon Myth (Direct Correction)')).toBe(true);
    expect(isBehaviorDemoTemplateName('Demo: Click Impulse (Practical Action)')).toBe(true);
    // Classics remain available on the main Tutor create form
    expect(isBehaviorDemoTemplateName('Account Security Alert Scam')).toBe(false);
    expect(isBehaviorDemoTemplateName('Nintendo Switch Deal Scam')).toBe(false);
    expect(isBehaviorDemoTemplateName('iTunes Gift Card Survey Scam')).toBe(false);
    expect(isBehaviorDemoTemplateName('Random workshop')).toBe(false);
  });

  it('classifies rooms as test rooms by marker or Demo: title, not by classic titles alone', () => {
    expect(
      isBehaviorTestRoom({ title: 'Any', description: `x ${BEHAVIOR_TEST_ROOM_MARKER}` })
    ).toBe(true);
    expect(isBehaviorTestRoom({ title: 'Demo: Lock Icon Myth', description: null })).toBe(true);
    // Classic teaching room without marker stays on main dashboard
    expect(
      isBehaviorTestRoom({ title: 'Account Security Alert Scam', description: 'class period 3' })
    ).toBe(false);
    expect(isBehaviorTestRoom({ title: 'Period 3 Algebra', description: 'normal class' })).toBe(
      false
    );
  });

  it('lists all seeded catalog names including classics and demos', () => {
    const names = getAllSeededTemplateNames();
    expect(names).toEqual(
      expect.arrayContaining([
        'Account Security Alert Scam',
        'Demo: Lock Icon Myth (Direct Correction)'
      ])
    );
  });
});
