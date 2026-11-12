/**
 * File: src/services/detectionTemplates.ts
 * Purpose: verify unified teaching inventories, scenario identities and custom catalog coverage.
 */
import { SCENARIO_TEMPLATES } from '../detectionTemplates';

describe('Detection Templates', () => {
  it.each([
    ['Nintendo Switch Deal ($19.99)', 5],
    ['iTunes Gift Card Survey ($500)', 5],
    ['Account Security Alert', 5],
    ['Location Sharing Risks', 4],
    ['Movie Meetup Social Engineering', 4],
    ['Contact Information Exposure', 5],
    ['General Scam Indicators', 5]
  ] as const)('provides the document-sized inventory for %s', (name, count) => {
    const scenario = SCENARIO_TEMPLATES[name];
    expect(scenario.detection_areas).toHaveLength(count);
    expect(scenario.verification_steps).toEqual([]);
    expect(scenario.detection_areas.every((target) => target.trim().length > 0)).toBe(true);
    expect(new Set(scenario.detection_areas.map((target) => target.trim().toLowerCase())).size).toBe(count);
  });

  it('keeps home-location and future-meetup inventories distinct', () => {
    expect(SCENARIO_TEMPLATES['Movie Meetup Social Engineering'].detection_areas)
      .not.toEqual(SCENARIO_TEMPLATES['Location Sharing Risks'].detection_areas);
  });

  it('exposes the complete catalog: six teaching scenarios plus the generic scam fallback', () => {
    expect(Object.keys(SCENARIO_TEMPLATES)).toHaveLength(7);
    expect(Object.values(SCENARIO_TEMPLATES).filter((scenario) => scenario.type === 'scam')).toHaveLength(4);
    expect(Object.values(SCENARIO_TEMPLATES).filter((scenario) => scenario.type === 'privacy')).toHaveLength(3);
    expect(Object.keys(SCENARIO_TEMPLATES)).not.toContain('Personal Details Protection');
  });
});
