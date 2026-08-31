import { generateSystemPrompt } from '../systemPrompts';

describe('Parameter Effectiveness Tests', () => {
    describe('Communication Style Parameters', () => {
        it('should include different language patterns based on teen slang setting', () => {
            const lowSlangConfig = {
                role: { role: 'low' as const },
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
            expect(highSlangPrompt).toContain('relaxed teen-friendly language');
            expect(highSlangPrompt).toContain('without forced slang');
        });

        it('should include different uncertainty patterns', () => {
            const lowUncertaintyConfig = {
                role: { role: 'high' as const },
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
            expect(highUncertaintyPrompt).toContain('Be confident when the student\'s reasoning is unsafe');
            expect(highUncertaintyPrompt).toContain('Open the real app instead');
        });
    });

    describe('Cognitive Parameters', () => {
        it('should handle concept density differences', () => {
            const lowDensityConfig = {
                role: { role: 'high' as const },
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
                role: { role: 'low' as const },
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
            expect(highPerspectivePrompt).toContain('A scammer might hide the real website name');
        });
    });

    describe('Emotional Parameters', () => {
        it('should include different enthusiasm levels', () => {
            const lowEnthusiasmConfig = {
                role: { role: 'high' as const },
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
            expect(highEnthusiasmPrompt).toContain('restrained and focused on the lesson');
        });

        it('should include mistake normalization approaches', () => {
            const lowNormalizationConfig = {
                role: { role: 'low' as const },
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
            expect(highNormalizationPrompt).toContain('After a failed question scaffold');
        });
    });

    describe('Role-Specific Instructions', () => {
        it('should include different role-based language patterns', () => {
            const peerConfig = {
                role: { role: 'low' as const },
                communication_style: { teen_slang: 'high' as const, conversational_markers: 'high' as const, uncertainty_expression: 'high' as const },
                cognitive_parameters: { concept_density: 'low' as const, perspective_taking: 'high' as const, personal_examples: 'high' as const, consequence_highlighting: 'low' as const },
                emotional_parameters: { enthusiasm_level: 'high' as const, validation_frequency: 'high' as const, mistake_normalization: 'high' as const, confidence_building: 'high' as const },
                detection_areas: [], verification_steps: []
            };

            const adultConfig = {
                ...peerConfig,
                role: { role: 'high' as const }
            };

            const peerPrompt = generateSystemPrompt(peerConfig);
            const adultPrompt = generateSystemPrompt(adultConfig);

            // Peer role should include casual language
            expect(peerPrompt).toContain('Peer Learner');
            expect(peerPrompt).toContain('knowledgeable peer coach');
            expect(peerPrompt).toContain('Do not claim personal memories');

            // Adult role should include protective language
            expect(adultPrompt).toContain('Trusted Adult Guide');
            expect(adultPrompt).toContain('experienced guide offering protective support');
            expect(adultPrompt).toContain('I want to make sure you stay safe online');
        });

        it('should generate a casual peer prompt that matches reviewed tutor behavior requirements', () => {
            const prompt = generateSystemPrompt({
                role: { role: 'low' as const },
                communication_style: {
                    teen_slang: 'low' as const,
                    conversational_markers: 'low' as const,
                    uncertainty_expression: 'low' as const
                },
                cognitive_parameters: {
                    concept_density: 'low' as const,
                    perspective_taking: 'low' as const,
                    personal_examples: 'low' as const,
                    consequence_highlighting: 'low' as const
                },
                emotional_parameters: {
                    enthusiasm_level: 'low' as const,
                    validation_frequency: 'low' as const,
                    mistake_normalization: 'low' as const,
                    confidence_building: 'low' as const
                },
                detection_areas: ['Fear-Based Urgency: "YOUR ACCOUNT IS AT RISK"'],
                verification_steps: ['Do NOT Click: Never click security alert links directly']
            });

            expect(prompt).toContain('Ask at most one focused question');
            expect(prompt).toContain('After a failed question scaffold');
            expect(prompt).toContain('one concrete safe action');
            expect(prompt).toContain('Do not claim personal memories');
            expect(prompt).toContain('A person who clicked');
            expect(prompt).toMatch(/lock does not prove the site is real/i);
            expect(prompt).toMatch(/open the real app/i);
            expect(prompt).not.toContain('Honestly, I fall for stuff like this too sometimes');
            expect(prompt).not.toContain('YES! Absolutely nailed it!');
        });
    });

    describe('Detection Areas and Verification Steps', () => {
        it('should include custom detection areas and verification steps', () => {
            const config = {
                role: { role: 'high' as const },
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
                role: { role: 'low' as const },
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

            // Should include the current tutoring rhythm
            expect(prompt).toContain('Keep it short: use no more than 3 sentences and 50 words');
            expect(prompt).toContain('Teach one concrete point first');
            expect(prompt).toContain('Ask at most one focused question');
            expect(prompt).toContain('one concrete safe action');
        });
    });
});
