import { generateSystemPrompt } from '../systemPrompts';

describe('Parameter Effectiveness Tests', () => {
    describe('Communication Style Parameters', () => {
        it('should include different language patterns based on teen slang setting', () => {
            const lowSlangConfig = {
                role: 'peer' as const,
                communication_style: { teen_slang: 'low' as const, conversational_markers: 'low' as const, uncertainty_expression: 'low' as const },
                cognitive_parameters: { concept_density: 'low' as const, perspective_taking: 'low' as const, personal_examples: 'low' as const, consequence_highlighting: 'low' as const },
                emotional_parameters: { enthusiasm_level: 'low' as const, validation_frequency: 'low' as const, mistake_normalization: 'low' as const, confidence_building: 'low' as const },
                detection_areas: [], verification_steps: []
            };

            const highSlangConfig = {
                ...lowSlangConfig,
                communication_style: { ...lowSlangConfig.communication_style, teen_slang: 'high' as const }
            };

            const lowSlangPrompt = generateSystemPrompt(lowSlangConfig);
            const highSlangPrompt = generateSystemPrompt(highSlangConfig);

            // Low slang should mention formal language
            expect(lowSlangPrompt).toContain('formal, clear language');
            // High slang should mention specific slang terms
            expect(highSlangPrompt).toContain('sus');
            expect(highSlangPrompt).toContain('no cap');
        });

        it('should include different uncertainty patterns', () => {
            const lowUncertaintyConfig = {
                role: 'trusted_adult' as const,
                communication_style: { teen_slang: 'low' as const, conversational_markers: 'low' as const, uncertainty_expression: 'low' as const },
                cognitive_parameters: { concept_density: 'low' as const, perspective_taking: 'low' as const, personal_examples: 'low' as const, consequence_highlighting: 'low' as const },
                emotional_parameters: { enthusiasm_level: 'low' as const, validation_frequency: 'low' as const, mistake_normalization: 'low' as const, confidence_building: 'low' as const },
                detection_areas: [], verification_steps: []
            };

            const highUncertaintyConfig = {
                ...lowUncertaintyConfig,
                communication_style: { ...lowUncertaintyConfig.communication_style, uncertainty_expression: 'high' as const }
            };

            const lowUncertaintyPrompt = generateSystemPrompt(lowUncertaintyConfig);
            const highUncertaintyPrompt = generateSystemPrompt(highUncertaintyConfig);

            expect(lowUncertaintyPrompt).toContain('definitive statements');
            expect(highUncertaintyPrompt).toContain('I think this might be');
            expect(highUncertaintyPrompt).toContain('let\'s check together');
        });
    });

    describe('Cognitive Parameters', () => {
        it('should handle concept density differences', () => {
            const lowDensityConfig = {
                role: 'trusted_adult' as const,
                communication_style: { teen_slang: 'low' as const, conversational_markers: 'low' as const, uncertainty_expression: 'low' as const },
                cognitive_parameters: { concept_density: 'low' as const, perspective_taking: 'low' as const, personal_examples: 'low' as const, consequence_highlighting: 'low' as const },
                emotional_parameters: { enthusiasm_level: 'low' as const, validation_frequency: 'low' as const, mistake_normalization: 'low' as const, confidence_building: 'low' as const },
                detection_areas: [], verification_steps: []
            };

            const highDensityConfig = {
                ...lowDensityConfig,
                cognitive_parameters: { ...lowDensityConfig.cognitive_parameters, concept_density: 'high' as const }
            };

            const lowDensityPrompt = generateSystemPrompt(lowDensityConfig);
            const highDensityPrompt = generateSystemPrompt(highDensityConfig);

            expect(lowDensityPrompt).toContain('one key concept per response');
            expect(highDensityPrompt).toContain('multiple related concepts simultaneously');
        });

        it('should include perspective taking instructions', () => {
            const lowPerspectiveConfig = {
                role: 'peer' as const,
                communication_style: { teen_slang: 'low' as const, conversational_markers: 'low' as const, uncertainty_expression: 'low' as const },
                cognitive_parameters: { concept_density: 'low' as const, perspective_taking: 'low' as const, personal_examples: 'low' as const, consequence_highlighting: 'low' as const },
                emotional_parameters: { enthusiasm_level: 'low' as const, validation_frequency: 'low' as const, mistake_normalization: 'low' as const, confidence_building: 'low' as const },
                detection_areas: [], verification_steps: []
            };

            const highPerspectiveConfig = {
                ...lowPerspectiveConfig,
                cognitive_parameters: { ...lowPerspectiveConfig.cognitive_parameters, perspective_taking: 'high' as const }
            };

            const lowPerspectivePrompt = generateSystemPrompt(lowPerspectiveConfig);
            const highPerspectivePrompt = generateSystemPrompt(highPerspectiveConfig);

            expect(lowPerspectivePrompt).toContain('direct analysis without perspective shifts');
            expect(highPerspectivePrompt).toContain('Imagine you\'re the scammer');
        });
    });

    describe('Emotional Parameters', () => {
        it('should include different enthusiasm levels', () => {
            const lowEnthusiasmConfig = {
                role: 'trusted_adult' as const,
                communication_style: { teen_slang: 'low' as const, conversational_markers: 'low' as const, uncertainty_expression: 'low' as const },
                cognitive_parameters: { concept_density: 'low' as const, perspective_taking: 'low' as const, personal_examples: 'low' as const, consequence_highlighting: 'low' as const },
                emotional_parameters: { enthusiasm_level: 'low' as const, validation_frequency: 'low' as const, mistake_normalization: 'low' as const, confidence_building: 'low' as const },
                detection_areas: [], verification_steps: []
            };

            const highEnthusiasmConfig = {
                ...lowEnthusiasmConfig,
                emotional_parameters: { ...lowEnthusiasmConfig.emotional_parameters, enthusiasm_level: 'high' as const }
            };

            const lowEnthusiasmPrompt = generateSystemPrompt(lowEnthusiasmConfig);
            const highEnthusiasmPrompt = generateSystemPrompt(highEnthusiasmConfig);

            expect(lowEnthusiasmPrompt).toContain('neutral, measured tone');
            expect(highEnthusiasmPrompt).toContain('YES! Absolutely nailed it!');
        });

        it('should include mistake normalization approaches', () => {
            const lowNormalizationConfig = {
                role: 'peer' as const,
                communication_style: { teen_slang: 'low' as const, conversational_markers: 'low' as const, uncertainty_expression: 'low' as const },
                cognitive_parameters: { concept_density: 'low' as const, perspective_taking: 'low' as const, personal_examples: 'low' as const, consequence_highlighting: 'low' as const },
                emotional_parameters: { enthusiasm_level: 'low' as const, validation_frequency: 'low' as const, mistake_normalization: 'low' as const, confidence_building: 'low' as const },
                detection_areas: [], verification_steps: []
            };

            const highNormalizationConfig = {
                ...lowNormalizationConfig,
                emotional_parameters: { ...lowNormalizationConfig.emotional_parameters, mistake_normalization: 'high' as const }
            };

            const lowNormalizationPrompt = generateSystemPrompt(lowNormalizationConfig);
            const highNormalizationPrompt = generateSystemPrompt(highNormalizationConfig);

            expect(lowNormalizationPrompt).toContain('direct correction');
            expect(highNormalizationPrompt).toContain('This one got you! Don\'t worry');
        });
    });

    describe('Role-Specific Instructions', () => {
        it('should include different role-based language patterns', () => {
            const peerConfig = {
                role: 'peer' as const,
                communication_style: { teen_slang: 'high' as const, conversational_markers: 'high' as const, uncertainty_expression: 'high' as const },
                cognitive_parameters: { concept_density: 'low' as const, perspective_taking: 'high' as const, personal_examples: 'high' as const, consequence_highlighting: 'low' as const },
                emotional_parameters: { enthusiasm_level: 'high' as const, validation_frequency: 'high' as const, mistake_normalization: 'high' as const, confidence_building: 'high' as const },
                detection_areas: [], verification_steps: []
            };

            const adultConfig = {
                ...peerConfig,
                role: 'trusted_adult' as const
            };

            const peerPrompt = generateSystemPrompt(peerConfig);
            const adultPrompt = generateSystemPrompt(adultConfig);

            // Peer role should include casual language
            expect(peerPrompt).toContain('Peer Learner');
            expect(peerPrompt).toContain('Dude, this is so sketchy');
            expect(peerPrompt).toContain('we\'re figuring this out together');

            // Adult role should include protective language
            expect(adultPrompt).toContain('Trusted Adult Guide');
            expect(adultPrompt).toContain('experienced guide offering protective support');
            expect(adultPrompt).toContain('I want to make sure you stay safe online');
        });
    });

    describe('Detection Areas and Verification Steps', () => {
        it('should include custom detection areas and verification steps', () => {
            const config = {
                role: 'trusted_adult' as const,
                communication_style: { teen_slang: 'low' as const, conversational_markers: 'low' as const, uncertainty_expression: 'low' as const },
                cognitive_parameters: { concept_density: 'high' as const, perspective_taking: 'high' as const, personal_examples: 'high' as const, consequence_highlighting: 'high' as const },
                emotional_parameters: { enthusiasm_level: 'low' as const, validation_frequency: 'high' as const, mistake_normalization: 'high' as const, confidence_building: 'high' as const },
                detection_areas: [
                    'Custom red flag: Suspicious pricing',
                    'Custom red flag: Urgent language patterns'
                ],
                verification_steps: [
                    'Custom step: Check official website',
                    'Custom step: Ask a trusted adult'
                ]
            };

            const prompt = generateSystemPrompt(config);

            expect(prompt).toContain('Custom red flag: Suspicious pricing');
            expect(prompt).toContain('Custom red flag: Urgent language patterns');
            expect(prompt).toContain('Custom step: Check official website');
            expect(prompt).toContain('Custom step: Ask a trusted adult');
        });
    });

    describe('Scaffolding Techniques', () => {
        it('should always include scaffolding techniques in the prompt', () => {
            const config = {
                role: 'peer' as const,
                communication_style: { teen_slang: 'low' as const, conversational_markers: 'low' as const, uncertainty_expression: 'low' as const },
                cognitive_parameters: { concept_density: 'low' as const, perspective_taking: 'low' as const, personal_examples: 'low' as const, consequence_highlighting: 'low' as const },
                emotional_parameters: { enthusiasm_level: 'low' as const, validation_frequency: 'low' as const, mistake_normalization: 'low' as const, confidence_building: 'low' as const },
                detection_areas: [], verification_steps: []
            };

            const prompt = generateSystemPrompt(config);

            // Should include all scaffolding techniques
            expect(prompt).toContain('Questioning');
            expect(prompt).toContain('Explaining');
            expect(prompt).toContain('Modeling');
            expect(prompt).toContain('Feeding_back');
            expect(prompt).toContain('Hinting');
            expect(prompt).toContain('Instructing');

            // Should include the 3-stage learning process
            expect(prompt).toContain('3-stage learning process');
            expect(prompt).toContain('Get their first reaction');
            expect(prompt).toContain('Ask why they think that');
            expect(prompt).toContain('Fill knowledge gaps');
        });
    });
});