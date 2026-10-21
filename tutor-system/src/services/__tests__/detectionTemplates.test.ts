/**
 * File: src/services/detectionTemplates.ts
 * Purpose: verify unified teaching inventories, scenario identities and custom catalog coverage.
 */
import { SCENARIO_TEMPLATES } from '../detectionTemplates';

describe('Detection Templates', () => {
  it.each([
    'Nintendo Switch Deal ($19.99)',
    'iTunes Gift Card Survey ($500)',
    'Account Security Alert',
    'Location Sharing Risks',
    'Movie Meetup Social Engineering',
    'Contact Information Exposure'
  ] as const)('provides five unique nonempty learning targets for %s', (name) => {
    const scenario = SCENARIO_TEMPLATES[name];
    expect(scenario.detection_areas).toHaveLength(5);
    expect(scenario.verification_steps).toEqual([]);
    expect(scenario.detection_areas.every((target) => target.trim().length > 0)).toBe(true);
    expect(new Set(scenario.detection_areas.map((target) => target.trim().toLowerCase())).size).toBe(5);
  });

  it('keeps home-location and future-meetup inventories distinct', () => {
    expect(SCENARIO_TEMPLATES['Movie Meetup Social Engineering'].detection_areas)
      .not.toEqual(SCENARIO_TEMPLATES['Location Sharing Risks'].detection_areas);
  });

  it('retains unrestricted generic inventories in the same list', () => {
    for (const name of ['General Scam Indicators', 'Personal Details Protection'] as const) {
      expect(SCENARIO_TEMPLATES[name].detection_areas.length).toBeGreaterThan(5);
      expect(SCENARIO_TEMPLATES[name].verification_steps).toEqual([]);
    }
  });

  it('exposes the complete teaching and custom catalog', () => {
    expect(Object.keys(SCENARIO_TEMPLATES)).toHaveLength(8);
    expect(Object.values(SCENARIO_TEMPLATES).filter((scenario) => scenario.type === 'scam')).toHaveLength(4);
    expect(Object.values(SCENARIO_TEMPLATES).filter((scenario) => scenario.type === 'privacy')).toHaveLength(4);
  });
});
