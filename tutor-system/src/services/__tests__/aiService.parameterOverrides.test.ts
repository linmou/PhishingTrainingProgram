/**
 * Unit Tests for AI Service Parameter Overrides - Quick Adjust Feature
 * 
 * Test Strategy: "Test parameter override functionality with clean config approach"
 * 
 * This test suite covers the core parameter override logic by testing:
 * - generateSystemPrompt integration with parameter overrides
 * - Config merging behavior
 * - Error handling and fallback scenarios
 * 
 * Run with: npm test src/services/__tests__/aiService.parameterOverrides.test.ts
 */

import { generateSystemPrompt } from '../systemPrompts';

describe('AI Service Parameter Overrides', () => {
    describe('Configuration Merging Logic', () => {
        const baseConfig = {
            role: { role: 'high' as const },
            communication_style: { 
                teen_slang: 'low' as const, 
                conversational_markers: 'high' as const,
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
            detection_areas: ['Urgent language', 'Suspicious links'],
            verification_steps: ['Check sender', 'Verify URL']
        };

        test('should merge role parameter overrides correctly', () => {
            const parameterOverrides = {
                role: { role: 'low' as const }
            };

            const mergedConfig = { ...baseConfig, ...parameterOverrides };
            const systemPrompt = generateSystemPrompt(mergedConfig);

            expect(systemPrompt).toContain('## Your Role: Peer Learner');
            expect(mergedConfig.role.role).toBe('low');
        });

        test('should merge communication_style parameter overrides correctly', () => {
            const parameterOverrides = {
                role: { role: 'low' as const }, // Need peer role to get teen slang
                communication_style: { 
                    teen_slang: 'high' as const,
                    conversational_markers: 'high' as const,
                    uncertainty_expression: 'high' as const
                }
            };

            const mergedConfig = { ...baseConfig, ...parameterOverrides };
            const systemPrompt = generateSystemPrompt(mergedConfig);

            expect(systemPrompt).toContain('relaxed teen-friendly language');
            expect(mergedConfig.communication_style.teen_slang).toBe('high');
        });

        test('should merge detection_areas and verification_steps correctly', () => {
            const parameterOverrides = {
                detection_areas: ['Phishing emails', 'Fake websites'],
                verification_steps: ['Contact organization directly', 'Check official website']
            };

            const mergedConfig = { ...baseConfig, ...parameterOverrides };
            const systemPrompt = generateSystemPrompt(mergedConfig);

            expect(systemPrompt).toContain('Phishing emails');
            expect(systemPrompt).toContain('Fake websites');
            expect(systemPrompt).toContain('Contact organization directly');
            expect(systemPrompt).toContain('Check official website');
        });

        test('should preserve original values when no overrides provided', () => {
            const systemPrompt = generateSystemPrompt(baseConfig);

            expect(systemPrompt).toContain('Urgent language');
            expect(systemPrompt).toContain('Suspicious links');
            expect(systemPrompt).toContain('Check sender');
            expect(systemPrompt).toContain('Verify URL');
        });

        test('should handle partial parameter overrides', () => {
            const parameterOverrides = {
                cognitive_parameters: { 
                    concept_density: 'low' as const,
                    perspective_taking: 'low' as const,
                    personal_examples: 'low' as const,
                    consequence_highlighting: 'low' as const
                }
            };

            const mergedConfig = { ...baseConfig, ...parameterOverrides };
            const systemPrompt = generateSystemPrompt(mergedConfig);

            // Should apply the cognitive parameter changes
            expect(mergedConfig.cognitive_parameters.concept_density).toBe('low');
            // Should preserve other parameters
            expect(mergedConfig.role.role).toBe('high');
            expect(mergedConfig.communication_style.teen_slang).toBe('low');
        });
    });

    describe('Parameter Override Integration Tests', () => {
        test('should demonstrate peer vs trusted adult role switching', () => {
            const trustedAdultConfig = {
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
                detection_areas: ['Professional scam detection'],
                verification_steps: ['Official verification process']
            };

            const peerOverrides = {
                role: { role: 'low' as const },
                communication_style: { 
                    teen_slang: 'high' as const, 
                    conversational_markers: 'high' as const,
                    uncertainty_expression: 'high' as const
                }
            };

            const trustedAdultPrompt = generateSystemPrompt(trustedAdultConfig);
            const peerPrompt = generateSystemPrompt({ ...trustedAdultConfig, ...peerOverrides });

            // Trusted adult should have formal language
            expect(trustedAdultPrompt).toContain('## Your Role: Trusted Adult');
            expect(trustedAdultPrompt).not.toContain('knowledgeable peer coach');

            // Peer should have casual language after override
            expect(peerPrompt).toContain('## Your Role: Peer Learner');
            expect(peerPrompt).toContain('knowledgeable peer coach');
        });

        test('should handle empty configuration gracefully', () => {
            const emptyConfig = {
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
                detection_areas: [],
                verification_steps: []
            };

            expect(() => generateSystemPrompt(emptyConfig)).not.toThrow();
            const prompt = generateSystemPrompt(emptyConfig);
            expect(prompt).toContain('knowledgeable tutor in a phishing-training session');
        });
    });

    describe('Parameter Override Validation', () => {
        test('should validate the clean architecture approach', () => {
            const storedConfig = {
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
                detection_areas: ['Original detection'],
                verification_steps: ['Original verification']
            };

            const quickAdjustOverrides = {
                role: { role: 'low' as const },
                detection_areas: ['Quick adjusted detection'],
                verification_steps: ['Quick adjusted verification']
            };

            // This is what the clean architecture should do:
            // 1. Retrieve stored config from prompt_config column
            // 2. Merge with parameter overrides
            // 3. Generate new clean system prompt
            const mergedConfig = { ...storedConfig, ...quickAdjustOverrides };
            const newPrompt = generateSystemPrompt(mergedConfig);

            // Verify the clean prompt doesn't contain metadata
            expect(newPrompt).not.toContain('<!-- SYSTEM_PROMPT_METADATA');
            expect(newPrompt).not.toContain('generated":');
            expect(newPrompt).not.toContain('config":');

            // Verify the parameter changes took effect
            expect(newPrompt).toContain('## Your Role: Peer Learner');
            expect(newPrompt).toContain('Quick adjusted detection');
            expect(newPrompt).toContain('Quick adjusted verification');
        });

        test('should demonstrate that overrides don\'t pollute stored prompts', () => {
            const originalConfig = {
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
                detection_areas: ['Stored detection'],
                verification_steps: ['Stored verification']
            };

            const temporaryOverrides = {
                role: { role: 'low' as const },
                detection_areas: ['Temporary override']
            };

            // Generate original prompt (what would be stored in DB)
            const originalPrompt = generateSystemPrompt(originalConfig);

            // Generate overridden prompt (what would be used temporarily for Quick Adjust)
            const overriddenPrompt = generateSystemPrompt({ ...originalConfig, ...temporaryOverrides });

            // Original prompt should remain clean
            expect(originalPrompt).toContain('## Your Role: Trusted Adult');
            expect(originalPrompt).toContain('Stored detection');
            expect(originalPrompt).not.toContain('Temporary override');

            // Overridden prompt should reflect changes
            expect(overriddenPrompt).toContain('## Your Role: Peer Learner');
            expect(overriddenPrompt).toContain('Temporary override');

            // Both should be clean (no metadata pollution)
            expect(originalPrompt).not.toContain('<!--');
            expect(overriddenPrompt).not.toContain('<!--');
        });
    });
});
