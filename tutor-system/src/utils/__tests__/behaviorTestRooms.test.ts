/**
 * File: src/utils/behaviorTestRooms.ts
 * Purpose: unit-test behavior-test room tagging and filtering helpers.
 */

import {
  BEHAVIOR_TEST_ROOM_MARKER,
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

  it('detects demo template names from the seed catalog', () => {
    expect(isBehaviorDemoTemplateName('Demo: Lock Icon Myth (Direct Correction)')).toBe(true);
    expect(isBehaviorDemoTemplateName('Account Security Alert Scam')).toBe(true);
    expect(isBehaviorDemoTemplateName('Random workshop')).toBe(false);
  });

  it('classifies rooms as test rooms by marker, Demo: title, or seed title', () => {
    expect(
      isBehaviorTestRoom({ title: 'Any', description: `x ${BEHAVIOR_TEST_ROOM_MARKER}` })
    ).toBe(true);
    expect(isBehaviorTestRoom({ title: 'Demo: Lock Icon Myth', description: null })).toBe(true);
    expect(isBehaviorTestRoom({ title: 'Account Security Alert Scam', description: '' })).toBe(
      true
    );
    expect(isBehaviorTestRoom({ title: 'Period 3 Algebra', description: 'normal class' })).toBe(
      false
    );
  });
});
