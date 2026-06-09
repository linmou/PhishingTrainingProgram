import { generateSystemPrompt, PRESET_CONFIGS } from '../systemPrompts';
import { SCENARIO_TEMPLATES } from '../detectionTemplates';

describe('Prompt Comparison - Real Usage Examples', () => {
    it('should generate significantly different prompts for casual peer vs supportive adult', () => {
        const casualPeerPrompt = generateSystemPrompt({
            ...PRESET_CONFIGS.casual_peer,
            detection_areas: SCENARIO_TEMPLATES['Nintendo Switch Deal ($19.99)'].detection_areas.slice(0, 3),
            verification_steps: SCENARIO_TEMPLATES['Nintendo Switch Deal ($19.99)'].verification_steps.slice(0, 3)
        });

        const supportiveAdultPrompt = generateSystemPrompt({
            ...PRESET_CONFIGS.supportive_adult,
            detection_areas: SCENARIO_TEMPLATES['Nintendo Switch Deal ($19.99)'].detection_areas.slice(0, 3),
            verification_steps: SCENARIO_TEMPLATES['Nintendo Switch Deal ($19.99)'].verification_steps.slice(0, 3)
        });

        console.log('\n=== CASUAL PEER PROMPT ===');
        console.log(casualPeerPrompt.substring(0, 500) + '...\n');

        console.log('=== SUPPORTIVE ADULT PROMPT ===');
        console.log(supportiveAdultPrompt.substring(0, 500) + '...\n');

        // Verify they're actually different
        expect(casualPeerPrompt).not.toBe(supportiveAdultPrompt);
        
        // Casual peer should have peer-specific language
        expect(casualPeerPrompt).toContain('Peer Learner');
        expect(casualPeerPrompt).toContain('knowledgeable peer coach');
        expect(casualPeerPrompt).toContain('Ask at most one focused question');
        
        // Supportive adult should have adult-specific language
        expect(supportiveAdultPrompt).toContain('Trusted Adult Guide');
        expect(supportiveAdultPrompt).toContain('formal, clear language');
        expect(supportiveAdultPrompt).toContain('multiple related concepts');
    });

    it('should show practical example with Nintendo Switch scenario', () => {
        const nintendoScenario = SCENARIO_TEMPLATES['Nintendo Switch Deal ($19.99)'];
        
        const practicalPrompt = generateSystemPrompt({
            role: { role: 'low' as const },
            communication_style: {
                teen_slang: 'high',
                conversational_markers: 'high', 
                uncertainty_expression: 'high'
            },
            cognitive_parameters: {
                concept_density: 'low',
                perspective_taking: 'high',
                personal_examples: 'high',
                consequence_highlighting: 'low'
            },
            emotional_parameters: {
                enthusiasm_level: 'high',
                validation_frequency: 'high',
                mistake_normalization: 'high',
                confidence_building: 'high'
            },
            detection_areas: nintendoScenario.detection_areas.slice(0, 4),
            verification_steps: nintendoScenario.verification_steps.slice(0, 4)
        });

        console.log('\n=== NINTENDO SWITCH SCENARIO PROMPT ===');
        console.log(practicalPrompt);

        // Verify scenario-specific content is included
        expect(practicalPrompt).toContain('$19.99 for a $300+ gaming console');
        expect(practicalPrompt).toContain('nintendo.com or authorized retailer');
        expect(practicalPrompt).toContain('Official Social Media: Check Nintendo\'s official social media accounts');
        
        // Verify peer role and high settings are reflected
        expect(practicalPrompt).toContain('knowledgeable peer coach');
        expect(practicalPrompt).toContain('relaxed teen-friendly language');
        expect(practicalPrompt).toContain('scammer might hide the real website name');
        expect(practicalPrompt).toContain('Keep energy restrained');
    });

    it('should demonstrate privacy protection scenario with trusted adult role', () => {
        const privacyScenario = SCENARIO_TEMPLATES['Location Sharing Risks'];
        
        const privacyPrompt = generateSystemPrompt({
            role: { role: 'high' as const },
            communication_style: {
                teen_slang: 'low',
                conversational_markers: 'low',
                uncertainty_expression: 'low'
            },
            cognitive_parameters: {
                concept_density: 'high',
                perspective_taking: 'high',
                personal_examples: 'high',
                consequence_highlighting: 'high'
            },
            emotional_parameters: {
                enthusiasm_level: 'low',
                validation_frequency: 'high',
                mistake_normalization: 'high',
                confidence_building: 'high'
            },
            detection_areas: privacyScenario.detection_areas,
            verification_steps: privacyScenario.verification_steps
        });

        console.log('\n=== PRIVACY PROTECTION SCENARIO PROMPT ===');
        console.log(privacyPrompt.substring(0, 800) + '...\n');

        // Verify privacy-specific content
        expect(privacyPrompt).toContain('Real-time location sharing');
        expect(privacyPrompt).toContain('private messages');
        expect(privacyPrompt).toContain('Trusted Adult Guide');
        expect(privacyPrompt).toContain('multiple related concepts');
        expect(privacyPrompt).toContain('Explicitly discuss potential consequences to build awareness');
    });

    it('should show length and complexity differences between configurations', () => {
        const minimalConfig = {
            role: { role: 'high' as const },
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
            detection_areas: ['Simple red flag'],
            verification_steps: ['Simple check']
        };

        const maximalConfig = {
            role: { role: 'low' as const },
            communication_style: {
                teen_slang: 'high' as const,
                conversational_markers: 'high' as const,
                uncertainty_expression: 'high' as const
            },
            cognitive_parameters: {
                concept_density: 'high' as const,
                perspective_taking: 'high' as const,
                personal_examples: 'high' as const,
                consequence_highlighting: 'high' as const
            },
            emotional_parameters: {
                enthusiasm_level: 'high' as const,
                validation_frequency: 'high' as const,
                mistake_normalization: 'high' as const,
                confidence_building: 'high' as const
            },
            detection_areas: SCENARIO_TEMPLATES['Nintendo Switch Deal ($19.99)'].detection_areas,
            verification_steps: SCENARIO_TEMPLATES['Nintendo Switch Deal ($19.99)'].verification_steps
        };

        const minimalPrompt = generateSystemPrompt(minimalConfig);
        const maximalPrompt = generateSystemPrompt(maximalConfig);

        console.log(`\nMINIMAL CONFIG PROMPT LENGTH: ${minimalPrompt.length} characters`);
        console.log(`MAXIMAL CONFIG PROMPT LENGTH: ${maximalPrompt.length} characters`);

        // Maximal should be significantly longer and more detailed
        expect(maximalPrompt.length).toBeGreaterThan(minimalPrompt.length);
        expect(maximalPrompt.length).toBeGreaterThan(2000); // Should be substantial
        
        // Content complexity should be different
        expect(minimalPrompt).toContain('one key concept per response');
        expect(maximalPrompt).toContain('multiple related concepts simultaneously');
        
        expect(minimalPrompt).toContain('minimal emotional validation');
        expect(maximalPrompt).toContain('one brief, specific acknowledgment');
    });
});
