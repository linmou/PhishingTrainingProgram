/**
 * File: src/utils/behaviorTestRooms.ts
 * Purpose: unit + pipeline tests for test-room tagging and student list visibility.
 * Spec: features/student_view.feature, features/room_discovery.feature (hide rules).
 * Covers the real failure modes (Demo: titles, markers, DemoTutor harness classics)
 * without mocking the classifier.
 */

import {
  BEHAVIOR_TEST_ROOM_MARKER,
  filterRoomsForStudentList,
  getAllSeededTemplateNames,
  isBehaviorDemoTemplateName,
  isBehaviorTestRoom,
  isDemoHarnessTutorName,
  isHiddenFromStudentRoomList,
  markBehaviorTestDescription
} from '../behaviorTestRooms';

describe('behaviorTestRooms', () => {
  describe('markBehaviorTestDescription', () => {
    it('appends a stable marker once', () => {
      expect(markBehaviorTestDescription('hello')).toContain(BEHAVIOR_TEST_ROOM_MARKER);
      expect(markBehaviorTestDescription('hello')).toContain('hello');
      expect(markBehaviorTestDescription(BEHAVIOR_TEST_ROOM_MARKER)).toBe(BEHAVIOR_TEST_ROOM_MARKER);
      expect(markBehaviorTestDescription(null)).toBe(BEHAVIOR_TEST_ROOM_MARKER);
      expect(markBehaviorTestDescription('')).toBe(BEHAVIOR_TEST_ROOM_MARKER);
    });
  });

  describe('isBehaviorDemoTemplateName', () => {
    it('treats only Demo: / test_only templates as Test Rooms picker exclusives', () => {
      expect(isBehaviorDemoTemplateName('Demo: Lock Icon Myth (Direct Correction)')).toBe(true);
      expect(isBehaviorDemoTemplateName('Demo: Click Impulse (Practical Action)')).toBe(true);
      expect(isBehaviorDemoTemplateName('Account Security Alert Scam')).toBe(false);
      expect(isBehaviorDemoTemplateName('Nintendo Switch Deal Scam')).toBe(false);
      expect(isBehaviorDemoTemplateName('iTunes Gift Card Survey Scam')).toBe(false);
      expect(isBehaviorDemoTemplateName('Random workshop')).toBe(false);
      expect(isBehaviorDemoTemplateName(null)).toBe(false);
      expect(isBehaviorDemoTemplateName('')).toBe(false);
    });
  });

  describe('isBehaviorTestRoom', () => {
    it('classifies by marker or Demo: title, not by classic titles alone', () => {
      expect(
        isBehaviorTestRoom({ title: 'Any', description: `x ${BEHAVIOR_TEST_ROOM_MARKER}` })
      ).toBe(true);
      expect(isBehaviorTestRoom({ title: 'Demo: Lock Icon Myth', description: null })).toBe(true);
      expect(
        isBehaviorTestRoom({ title: 'Account Security Alert Scam', description: 'class period 3' })
      ).toBe(false);
      expect(isBehaviorTestRoom({ title: 'Period 3 Algebra', description: 'normal class' })).toBe(
        false
      );
    });

    it('treats classic description that went through Test Rooms mark() as a test room', () => {
      // TestRoomsView always markBehaviorTestDescription — even if title is a classic seed
      const desc = markBehaviorTestDescription(
        'YOUR ACCOUNT IS AT RISK — verify at http://testdrive.info/youraccount'
      );
      expect(
        isBehaviorTestRoom({ title: 'Account Security Alert Scam', description: desc })
      ).toBe(true);
    });
  });

  describe('isDemoHarnessTutorName', () => {
    it('matches browser-demo login names only', () => {
      expect(isDemoHarnessTutorName('DemoTutor_615166')).toBe(true);
      expect(isDemoHarnessTutorName('DemoTutor_962226')).toBe(true);
      expect(isDemoHarnessTutorName('demotutor_092545')).toBe(true);
      expect(isDemoHarnessTutorName('DemoTutor-123456')).toBe(true);
      expect(isDemoHarnessTutorName('Grace')).toBe(false);
      expect(isDemoHarnessTutorName('Demo Tutor')).toBe(false);
      expect(isDemoHarnessTutorName(null)).toBe(false);
    });
  });

  describe('isHiddenFromStudentRoomList / filterRoomsForStudentList', () => {
    /**
     * Integrated pipeline: same decision StudentView applies after fetch.
     * Uses real classifier + DemoTutor rule — no mocks of those helpers.
     */
    it('hides marker, Demo: titles, marked classics, and DemoTutor harness rooms', () => {
      const teaching = {
        id: 't1',
        title: 'Phishing 101',
        description: 'Period 3',
        tutor: { display_name: 'Grace' }
      };
      const marked = {
        id: 'm1',
        title: 'Internal Eval',
        description: `harness\n\n${BEHAVIOR_TEST_ROOM_MARKER}`,
        tutor: { display_name: 'Grace' }
      };
      const demoTitle = {
        id: 'd1',
        title: 'Demo: Lock Icon Myth',
        description: 'no marker needed',
        tutor: { display_name: 'Grace' }
      };
      // Real product leak shape: classic title, no marker, DemoTutor owner
      const heritageClassic = {
        id: 'h1',
        title: 'Account Security Alert Scam',
        description:
          'YOUR ACCOUNT IS AT RISK — Your account has been accessed by an unknown device.',
        tutor: { display_name: 'DemoTutor_615166' }
      };
      const heritageNintendo = {
        id: 'h2',
        title: 'Nintendo Switch Deal Scam',
        description: 'Get a BRAND new Nintendo Switch only $19.99!!',
        tutor: { display_name: 'DemoTutor_962226' }
      };
      // New Test Rooms create path: classic-looking body but always marked
      const testRoomCreatePath = {
        id: 'c1',
        title: 'Account Security Alert Scam',
        description: markBehaviorTestDescription(
          'YOUR ACCOUNT IS AT RISK — verify at http://testdrive.info/youraccount'
        ),
        tutor: { display_name: 'Real Tutor' }
      };
      // Real teaching classic stays visible
      const realClassic = {
        id: 'r1',
        title: 'Account Security Alert Scam',
        description: 'YOUR ACCOUNT IS AT RISK — class period 4',
        tutor: { display_name: 'Adele' }
      };

      const rows = [
        teaching,
        marked,
        demoTitle,
        heritageClassic,
        heritageNintendo,
        testRoomCreatePath,
        realClassic
      ];

      expect(isHiddenFromStudentRoomList(teaching)).toBe(false);
      expect(isHiddenFromStudentRoomList(realClassic)).toBe(false);
      expect(isHiddenFromStudentRoomList(marked)).toBe(true);
      expect(isHiddenFromStudentRoomList(demoTitle)).toBe(true);
      expect(isHiddenFromStudentRoomList(heritageClassic)).toBe(true);
      expect(isHiddenFromStudentRoomList(heritageNintendo)).toBe(true);
      expect(isHiddenFromStudentRoomList(testRoomCreatePath)).toBe(true);

      const visible = filterRoomsForStudentList(rows);
      expect(visible.map((r) => r.id).sort()).toEqual(['r1', 't1']);
      expect(visible.find((r) => r.title === 'Phishing 101')).toBeTruthy();
      expect(visible.find((r) => r.tutor?.display_name === 'Adele')).toBeTruthy();
      expect(visible.find((r) => r.tutor?.display_name?.startsWith('DemoTutor'))).toBeUndefined();
      expect(visible.find((r) => (r.title || '').startsWith('Demo:'))).toBeUndefined();
    });

    it('returns empty when every active room is harness or test-classified', () => {
      const onlyHarness = filterRoomsForStudentList([
        {
          title: 'Nintendo Switch Deal Scam',
          description: 'deal',
          tutor: { display_name: 'DemoTutor_111111' }
        },
        {
          title: 'Demo: Click Impulse',
          description: 'x',
          tutor: { display_name: 'Anyone' }
        }
      ]);
      expect(onlyHarness).toEqual([]);
    });
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
