import { generateSystemPrompt } from '../systemPrompts';

describe('Custom Detection Areas and Verification Steps Test', () => {
    it('should include custom detection areas and verification steps in generated prompt', () => {
        const customDetectionAreas = [
            'Custom red flag: Suspicious email domains',
            'Custom red flag: Grammar mistakes in official messages',
            'Custom red flag: Requests for personal information via DM'
        ];

        const customVerificationSteps = [
            'Custom step: Check the sender\'s email domain carefully',
            'Custom step: Look up the company\'s official contact methods',
            'Custom step: Never provide personal info through social media DMs',
            'Custom step: Ask a parent or teacher if you\'re unsure'
        ];

        const config = {
            role: 'trusted_adult' as const,
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
            detection_areas: customDetectionAreas,
            verification_steps: customVerificationSteps
        };

        const generatedPrompt = generateSystemPrompt(config);

        console.log('\n=== GENERATED PROMPT WITH CUSTOM AREAS ===');
        console.log(generatedPrompt);
        console.log('\n=== END PROMPT ===\n');

        // Test that all custom detection areas are included
        customDetectionAreas.forEach(area => {
            expect(generatedPrompt).toContain(area);
        });

        // Test that all custom verification steps are included
        customVerificationSteps.forEach(step => {
            expect(generatedPrompt).toContain(step);
        });

        // Test that they appear in the correct sections
        expect(generatedPrompt).toContain('## Detection Areas to Focus On:');
        expect(generatedPrompt).toContain('## Verification Steps to Teach:');

        // Test that the content is properly formatted
        expect(generatedPrompt).toContain('- Custom red flag: Suspicious email domains');
        expect(generatedPrompt).toContain('- Custom step: Check the sender\'s email domain carefully');
    });

    it('should handle empty custom areas gracefully', () => {
        const config = {
            role: 'peer' as const,
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
            detection_areas: [],
            verification_steps: []
        };

        const generatedPrompt = generateSystemPrompt(config);

        // Should still have the sections but empty
        expect(generatedPrompt).toContain('## Detection Areas to Focus On:');
        expect(generatedPrompt).toContain('## Verification Steps to Teach:');
        
        // Should not have any bullet points under these sections
        const detectionSectionIndex = generatedPrompt.indexOf('## Detection Areas to Focus On:');
        const verificationSectionIndex = generatedPrompt.indexOf('## Verification Steps to Teach:');
        const nextSectionIndex = generatedPrompt.indexOf('## Learning Process:');
        
        const detectionSection = generatedPrompt.substring(detectionSectionIndex, verificationSectionIndex);
        const verificationSection = generatedPrompt.substring(verificationSectionIndex, nextSectionIndex);
        
        expect(detectionSection).not.toContain('- ');
        expect(verificationSection).not.toContain('- ');
    });
});