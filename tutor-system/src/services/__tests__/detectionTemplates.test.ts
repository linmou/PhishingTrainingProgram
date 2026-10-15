/**
 * File: src/services/detectionTemplates.ts
 * Purpose: verify teaching inventories, category mappings, and unrestricted generic targets.
 */
import {
    SCAM_DETECTION_AREAS, 
    VERIFICATION_STEPS, 
    SCENARIO_TEMPLATES,
    PRIVACY_DETECTION_AREAS,
    PRIVACY_PROTECTION_STEPS,
    getDetectionAreas,
    getVerificationSteps 
} from '../detectionTemplates';

describe('Detection Templates', () => {
    describe('SCAM_DETECTION_AREAS', () => {
        it('should have Nintendo Switch deal detection areas', () => {
            const areas = SCAM_DETECTION_AREAS.nintendo_switch_deal;
            
            expect(areas).toBe(SCENARIO_TEMPLATES['Nintendo Switch Deal ($19.99)'].detection_areas);
            expect(areas).toHaveLength(4);
        });

        it('should have iTunes gift card detection areas', () => {
            const areas = SCAM_DETECTION_AREAS.itunes_gift_card;
            
            expect(areas).toBe(SCENARIO_TEMPLATES['iTunes Gift Card Survey ($500)'].detection_areas);
            expect(areas).toHaveLength(4);
        });

        it('should have account security alert detection areas', () => {
            const areas = SCAM_DETECTION_AREAS.account_security_alert;
            
            expect(areas).toBe(SCENARIO_TEMPLATES['Account Security Alert'].detection_areas);
            expect(areas).toHaveLength(4);
        });
    });

    describe('VERIFICATION_STEPS', () => {
        it('should have Nintendo Switch verification steps', () => {
            const steps = VERIFICATION_STEPS.nintendo_switch_deal;
            
            expect(steps).toBe(SCENARIO_TEMPLATES['Nintendo Switch Deal ($19.99)'].verification_steps);
            expect(steps).toHaveLength(1);
        });

        it('should have account security verification steps', () => {
            const steps = VERIFICATION_STEPS.account_security_alert;
            
            expect(steps).toBe(SCENARIO_TEMPLATES['Account Security Alert'].verification_steps);
            expect(steps).toHaveLength(1);
        });
    });

    describe('SCENARIO_TEMPLATES', () => {
        it.each([
            'Nintendo Switch Deal ($19.99)',
            'iTunes Gift Card Survey ($500)',
            'Account Security Alert',
            'Location Sharing Risks',
            'Movie Meetup Social Engineering',
            'Contact Information Exposure'
        ] as const)('provides five unique nonempty recognition and action targets for %s', (name) => {
            const scenario = SCENARIO_TEMPLATES[name];
            const targets = [...scenario.detection_areas, ...scenario.verification_steps];
            expect(targets).toHaveLength(5);
            expect(targets.every((target) => target.trim().length > 0)).toBe(true);
            expect(new Set(targets.map((target) => target.trim().toLowerCase())).size).toBe(5);
            expect(scenario.detection_areas).toHaveLength(scenario.type === 'scam' ? 4 : 3);
            expect(scenario.verification_steps).toHaveLength(scenario.type === 'scam' ? 1 : 2);
        });

        it('keeps home-location and future-meetup inventories distinct', () => {
            const meetup = SCENARIO_TEMPLATES['Movie Meetup Social Engineering'];
            expect(meetup.detection_areas).toBe(PRIVACY_DETECTION_AREAS.movie_meetup);
            expect(meetup.verification_steps).toBe(PRIVACY_PROTECTION_STEPS.movie_meetup);
            expect(meetup.detection_areas).not.toEqual(PRIVACY_DETECTION_AREAS.location_sharing);
        });

        it('retains generic inventories above five targets', () => {
            for (const name of ['General Scam Indicators', 'Personal Details Protection'] as const) {
                const scenario = SCENARIO_TEMPLATES[name];
                expect([...scenario.detection_areas, ...scenario.verification_steps].length).toBeGreaterThan(5);
            }
        });

        it('should have complete Nintendo Switch scenario', () => {
            const scenario = SCENARIO_TEMPLATES['Nintendo Switch Deal ($19.99)'];
            
            expect(scenario.type).toBe('scam');
            expect(scenario.detection_areas).toBeDefined();
            expect(scenario.verification_steps).toBeDefined();
            expect(scenario.detection_areas.length).toBeGreaterThan(0);
            expect(scenario.verification_steps.length).toBeGreaterThan(0);
        });

        it('should have privacy scenarios', () => {
            const scenario = SCENARIO_TEMPLATES['Location Sharing Risks'];
            
            expect(scenario.type).toBe('privacy');
            expect(scenario.detection_areas).toBeDefined();
            expect(scenario.verification_steps).toBeDefined();
        });

        it('should have all expected scenario types', () => {
            const scamScenarios = Object.entries(SCENARIO_TEMPLATES)
                .filter(([_, template]) => template.type === 'scam');
            const privacyScenarios = Object.entries(SCENARIO_TEMPLATES)
                .filter(([_, template]) => template.type === 'privacy');
                
            expect(scamScenarios.length).toBeGreaterThan(0);
            expect(privacyScenarios.length).toBeGreaterThan(0);
        });
    });

    describe('Helper Functions', () => {
        it('should get detection areas by category', () => {
            const areas = getDetectionAreas('nintendo_switch_deal');
            expect(areas.length).toBeGreaterThan(0);
            expect(areas).toBe(SCAM_DETECTION_AREAS.nintendo_switch_deal);
            expect(getDetectionAreas('movie_meetup')).toBe(PRIVACY_DETECTION_AREAS.movie_meetup);
        });

        it('should get verification steps by category', () => {
            const steps = getVerificationSteps('nintendo_switch_deal');
            expect(steps.length).toBeGreaterThan(0);
            expect(steps).toBe(VERIFICATION_STEPS.nintendo_switch_deal);
            expect(getVerificationSteps('movie_meetup')).toBe(PRIVACY_PROTECTION_STEPS.movie_meetup);
        });

        it('should return empty array for invalid category', () => {
            const areas = getDetectionAreas('invalid_category' as any);
            expect(areas).toEqual([]);
            
            const steps = getVerificationSteps('invalid_category' as any);
            expect(steps).toEqual([]);
        });
    });
});
