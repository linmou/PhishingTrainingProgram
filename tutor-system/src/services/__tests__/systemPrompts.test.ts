/**
 * File: src/services/prompts/index.ts and aiService.ts
 * Purpose: verify configured target inventory and preset composition in generated prompts.
 */
import { generateSystemPrompt, PRESET_CONFIGS } from '../systemPrompts';
import { applyPresetConfiguration } from '../aiService';
import { SCENARIO_TEMPLATES } from '../detectionTemplates';
import { ROLE_PARAMETERS } from '../prompts/pedagogy/parameters/roleParameters';
import { RESPONSE_POLICY } from '../prompts/responsePolicy';

describe('System Prompts', () => {
    describe('generateSystemPrompt', () => {
        it('should generate a complete system prompt with peer role', () => {
            const config = {
                role: { role: 'low' as const },
                communication_style: {
                    teen_slang: 'high' as const,
                    conversational_markers: 'high' as const,
                    uncertainty_expression: 'high' as const
                },
                cognitive_parameters: {
                    concept_density: 'low' as const,
                    perspective_taking: 'high' as const,
                    personal_examples: 'high' as const,
                    consequence_highlighting: 'low' as const
                },
                emotional_parameters: {
                    enthusiasm_level: 'high' as const,
                    validation_frequency: 'high' as const,
                    mistake_normalization: 'high' as const,
                    confidence_building: 'high' as const
                },
                detection_areas: ['Test detection area'],
                verification_steps: ['Test verification step']
            };

            const prompt = generateSystemPrompt(config);

            expect(prompt).toContain('knowledgeable tutor in a phishing-training session');
            expect(prompt).toContain('## Your Role: Peer Learner');
            expect(prompt).toContain('knowledgeable peer coach');
            expect(prompt).toContain('Test detection area');
            expect(prompt).toContain('Test verification step');
            expect(prompt).toContain('Keep it short: use no more than 3 sentences and 50 words');
        });

        /**
         * File: src/services/prompts/responsePolicy.ts and peer roleParameters.ts
         * Purpose: verify composition of the shared policy, configured inventory and selected role.
         */
        it('should compose the shared policy with the configured inventory and peer role', () => {
            const prompt = generateSystemPrompt({
                ...PRESET_CONFIGS.casual_peer,
                detection_areas: ['Visible source clue: sender name is misspelled'],
                verification_steps: ['Safety-critical check: review recent login activity']
            });

            expect(prompt).toContain('Visible source clue: sender name is misspelled');
            expect(prompt).toContain('Safety-critical check: review recent login activity');
            expect(prompt.split(RESPONSE_POLICY)).toHaveLength(2);
            expect(prompt).toContain(ROLE_PARAMETERS.role.low);
            expect(prompt).not.toContain(ROLE_PARAMETERS.role.high);
        });

        it('should generate a complete system prompt with trusted adult role', () => {
            const config = {
                role: { role: 'high' as const },
                communication_style: {
                    teen_slang: 'low' as const,
                    conversational_markers: 'low' as const,
                    uncertainty_expression: 'low' as const
                },
                cognitive_parameters: {
                    concept_density: 'high' as const,
                    perspective_taking: 'high' as const,
                    personal_examples: 'high' as const,
                    consequence_highlighting: 'high' as const
                },
                emotional_parameters: {
                    enthusiasm_level: 'low' as const,
                    validation_frequency: 'high' as const,
                    mistake_normalization: 'high' as const,
                    confidence_building: 'high' as const
                },
                detection_areas: ['Adult detection area'],
                verification_steps: ['Adult verification step']
            };

            const prompt = generateSystemPrompt(config);

            expect(prompt).toContain('## Your Role: Trusted Adult Guide');
            expect(prompt).toContain('experienced guide offering protective support');
            expect(prompt).toContain('Adult detection area');
            expect(prompt).toContain('Adult verification step');
        });
    });

    describe('applyPresetConfiguration', () => {
        it('should apply casual peer preset with scenario template', () => {
            const prompt = applyPresetConfiguration(
                'casual_peer',
                'Nintendo Switch Deal ($19.99)'
            );

            expect(prompt).toContain('## Your Role: Peer Learner');
            for (const target of SCENARIO_TEMPLATES['Nintendo Switch Deal ($19.99)'].detection_areas) {
                expect(prompt).toContain(target);
            }
        });

        it('should apply supportive adult preset with custom areas', () => {
            const customDetection = ['Custom red flag'];
            const customVerification = ['Custom verification'];
            
            const prompt = applyPresetConfiguration(
                'supportive_adult',
                undefined,
                customDetection,
                customVerification
            );

            expect(prompt).toContain('## Your Role: Trusted Adult Guide');
            expect(prompt).toContain('Custom red flag');
            expect(prompt).toContain('Custom verification');
        });

        it('should handle scenario template override with custom areas', () => {
            const customDetection = ['Override detection'];
            const customVerification = ['Override verification'];
            
            const prompt = applyPresetConfiguration(
                'casual_peer',
                'iTunes Gift Card Survey ($500)',
                customDetection,
                customVerification
            );

            // Should use custom areas instead of scenario template
            expect(prompt).toContain('Override detection');
            expect(prompt).toContain('Override verification');
            expect(prompt).not.toContain('$500 for a "5 minute survey"');
        });
    });

    describe('PRESET_CONFIGS', () => {
        it('should have valid casual_peer configuration', () => {
            const config = PRESET_CONFIGS.casual_peer;
            
            expect(config.role.role).toBe('low');
            expect(config.communication_style.teen_slang).toBe('low');
            expect(config.communication_style.uncertainty_expression).toBe('high');
            expect(config.emotional_parameters.enthusiasm_level).toBe('low');
            expect(config.emotional_parameters.mistake_normalization).toBe('high');
        });

        it('should have valid supportive_adult configuration', () => {
            const config = PRESET_CONFIGS.supportive_adult;
            
            expect(config.role.role).toBe('high');
            expect(config.communication_style.teen_slang).toBe('low');
            expect(config.cognitive_parameters.concept_density).toBe('high');
        });
    });
});
