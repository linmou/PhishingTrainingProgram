import { 
    SCAM_DETECTION_AREAS, 
    VERIFICATION_STEPS, 
    SCENARIO_TEMPLATES,
    getDetectionAreas,
    getVerificationSteps 
} from '../detectionTemplates';

describe('Detection Templates', () => {
    describe('SCAM_DETECTION_AREAS', () => {
        it('should have Nintendo Switch deal detection areas', () => {
            const areas = SCAM_DETECTION_AREAS.nintendo_switch_deal;
            
            expect(areas).toContain('"Too Good to Be True" Pricing: $19.99 for a $300+ gaming console');
            expect(areas).toContain('Urgency Language: "Hurry up, this offer WILL NOT LAST"');
            expect(areas).toContain('Suspicious URL: http://goo.gl/FreeSwitch (shortened link, not official Nintendo domain)');
        });

        it('should have iTunes gift card detection areas', () => {
            const areas = SCAM_DETECTION_AREAS.itunes_gift_card;
            
            expect(areas).toContain('Excessive Value Promise: $500 for a "5 minute survey"');
            expect(areas).toContain('Professional Photo Quality: Uses actual iTunes gift card photo to appear legitimate');
        });

        it('should have account security alert detection areas', () => {
            const areas = SCAM_DETECTION_AREAS.account_security_alert;
            
            expect(areas).toContain('Fear-Based Urgency: "YOUR ACCOUNT IS AT RISK" in large, alarming text');
            expect(areas).toContain('Spelling Error: "Socail" instead of "Social" in account name');
        });
    });

    describe('VERIFICATION_STEPS', () => {
        it('should have Nintendo Switch verification steps', () => {
            const steps = VERIFICATION_STEPS.nintendo_switch_deal;
            
            expect(steps).toContain('URL Analysis: Don\'t click the shortened link - check if it redirects to nintendo.com or authorized retailer');
            expect(steps).toContain('Business Logic: Ask "Why would Nintendo sell at 93% loss?"');
        });

        it('should have account security verification steps', () => {
            const steps = VERIFICATION_STEPS.account_security_alert;
            
            expect(steps).toContain('Do NOT Click: Never click security alert links directly');
            expect(steps).toContain('Manual Login: Type the actual platform\'s URL manually into browser');
        });
    });

    describe('SCENARIO_TEMPLATES', () => {
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
            expect(areas[0]).toContain('$19.99 for a $300+');
        });

        it('should get verification steps by category', () => {
            const steps = getVerificationSteps('nintendo_switch_deal');
            expect(steps.length).toBeGreaterThan(0);
            expect(steps[0]).toContain("Don't click the shortened link");
        });

        it('should return empty array for invalid category', () => {
            const areas = getDetectionAreas('invalid_category' as any);
            expect(areas).toEqual([]);
            
            const steps = getVerificationSteps('invalid_category' as any);
            expect(steps).toEqual([]);
        });
    });
});