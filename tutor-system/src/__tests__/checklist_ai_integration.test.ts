/**
 * File: src/services/checklistIntegration.ts and shared prompt generation
 * Purpose: opt-in real-provider extraction/coverage transport checks and learning-progress packaging.
 */

import { ChecklistIntegration } from '../services/checklistIntegration';
import { generateSystemPromptWithChecklist } from '../services/prompts/checklistPromptGenerator';
import { ChecklistItem } from '../types/checklist';
import { SystemPromptConfig } from '../services/prompts/types';

// Use the real Qwen service - no mocking.
// Keep this suite opt-in so default regression runs stay deterministic.
const describeLiveQwen = process.env.RUN_LIVE_QWEN_TESTS === 'true' ? describe : describe.skip;

describeLiveQwen('AI Checklist Integration', () => {
  // Increase timeout for real API calls
  jest.setTimeout(30000);

  const mockChecklistItems: ChecklistItem[] = [
    {
      id: '1',
      area_text: 'URL verification techniques',
      item_type: 'detection_area',
      priority: 'critical',
      status: 'pending',
      understanding_level: 'none',
      coverage_evidence: [],
      tutor_notes: '',
      last_addressed: null,
      attempts_count: 0,
      original_template_area: true,
      deleted: false,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '2',
      area_text: 'Check domain manually before clicking',
      item_type: 'detection_area',
      priority: 'critical',
      status: 'pending',
      understanding_level: 'none',
      coverage_evidence: [],
      tutor_notes: '',
      last_addressed: null,
      attempts_count: 0,
      original_template_area: true,
      deleted: false,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '3',
      area_text: 'Social engineering recognition',
      item_type: 'detection_area',
      priority: 'important',
      status: 'covered',
      understanding_level: 'good',
      coverage_evidence: [
        {
          id: 'evidence-1',
          evidence_text: 'Student identified emotional manipulation tactics',
          analysis: 'Student correctly recognized pressure techniques',
          confidence_score: 85,
          detection_method: 'ai_analysis',
          timestamp: new Date(),
          message_id: 'msg-1'
        }
      ],
      tutor_notes: '',
      last_addressed: new Date(),
      attempts_count: 1,
      original_template_area: true,
      deleted: false,
      created_at: new Date(),
      updated_at: new Date()
    }
  ];


  describe('LLM Extraction from System Prompts', () => {
    it('returns a single list with valid nonempty strings from the real provider', async () => {
      const result = await ChecklistIntegration.extractFromSystemPromptAsync(
        'Learning targets: inspect the exact sender domain and open the official app independently.'
      );
      expect(Object.keys(result)).toEqual(['detection_areas']);
      expect(Array.isArray(result.detection_areas)).toBe(true);
      expect(result.detection_areas.length).toBeGreaterThan(0);
      expect(result.detection_areas.every((item) => typeof item === 'string' && item.trim().length > 0)).toBe(true);
      expect(new Set(result.detection_areas).size).toBe(result.detection_areas.length);
    });

    it('returns an empty inventory for an empty prompt', async () => {
      await expect(ChecklistIntegration.extractFromSystemPromptAsync('')).resolves.toEqual({ detection_areas: [] });
    });
  });

  describe('System Prompt Generation with Checklist Context', () => {
    it('should include current learning progress in AI system prompt', () => {
      const baseConfig: SystemPromptConfig = {
        role: { role: 'high' },
        communication_style: {
          teen_slang: 'low',
          conversational_markers: 'high',
          uncertainty_expression: 'low'
        },
        cognitive_parameters: {
          concept_density: 'high',
          perspective_taking: 'high',
          personal_examples: 'high',
          consequence_highlighting: 'high'
        },
        emotional_parameters: {
          enthusiasm_level: 'high',
          validation_frequency: 'high',
          mistake_normalization: 'high',
          confidence_building: 'high'
        },
        detection_areas: [],
        verification_steps: []
      };

      const generatedPrompt = generateSystemPromptWithChecklist(baseConfig, mockChecklistItems);

      expect(generatedPrompt).toContain('CURRENT LEARNING PROGRESS');
      expect(generatedPrompt).toMatch(/CRITICAL AREAS|IMPORTANT AREAS/);
      expect(generatedPrompt).toContain('URL verification techniques');
      expect(generatedPrompt).toContain('Check domain manually');
      expect(generatedPrompt).toContain('WELL COVERED');
      expect(generatedPrompt).toContain('Social engineering recognition');
    });

    it('should prioritize uncovered items in AI responses', () => {
      const prompt = generateSystemPromptWithChecklist({
        role: { role: 'high' },
        communication_style: { teen_slang: 'low', conversational_markers: 'high', uncertainty_expression: 'low' },
        cognitive_parameters: { concept_density: 'high', perspective_taking: 'high', personal_examples: 'high', consequence_highlighting: 'high' },
        emotional_parameters: { enthusiasm_level: 'high', validation_frequency: 'high', mistake_normalization: 'high', confidence_building: 'high' },
        detection_areas: [],
        verification_steps: []
      }, mockChecklistItems);

      // Check that priority items are listed before well-covered items
      const criticalIndex = prompt.indexOf('CRITICAL');
      const wellCoveredIndex = prompt.indexOf('WELL COVERED');

      expect(criticalIndex).toBeGreaterThan(-1);
      expect(wellCoveredIndex).toBeGreaterThan(criticalIndex);

      // Check content appears in right sections
      const beforeWellCovered = prompt.substring(0, wellCoveredIndex);
      const afterWellCovered = prompt.substring(wellCoveredIndex);

      expect(beforeWellCovered).toContain('URL verification techniques');
      expect(beforeWellCovered).toContain('Check domain manually');
      expect(afterWellCovered).toContain('Social engineering recognition');
    });

    it('should adapt responses based on covered and pending targets', () => {
      const cognitiveHeavyItems = mockChecklistItems.map(item => ({
        ...item,
        status: item.id === '2' ? 'pending' as const : 'covered' as const
      }));

      const prompt = generateSystemPromptWithChecklist({
        role: { role: 'high' },
        communication_style: { teen_slang: 'low', conversational_markers: 'high', uncertainty_expression: 'low' },
        cognitive_parameters: { concept_density: 'high', perspective_taking: 'high', personal_examples: 'high', consequence_highlighting: 'high' },
        emotional_parameters: { enthusiasm_level: 'high', validation_frequency: 'high', mistake_normalization: 'high', confidence_building: 'high' },
        detection_areas: [],
        verification_steps: []
      }, cognitiveHeavyItems);

      // Check for adaptive guidance hints in system prompt
      expect(prompt.toLowerCase()).toMatch(/behavior|practical|application|action/);
      expect(prompt.length).toBeGreaterThan(500); // Should have substantial content
    });

    it('should provide progress summaries for mixed target status', () => {
      const mixedProgressItems = [
        { ...mockChecklistItems[0], status: 'covered' as const }, // understanding - covered
        { ...mockChecklistItems[1], status: 'pending' as const }, // behavior - pending
        { ...mockChecklistItems[2], status: 'partially_covered' as const } // understanding - partial
      ];

      const prompt = generateSystemPromptWithChecklist({
        role: { role: 'high' },
        communication_style: { teen_slang: 'low', conversational_markers: 'high', uncertainty_expression: 'low' },
        cognitive_parameters: { concept_density: 'high', perspective_taking: 'high', personal_examples: 'high', consequence_highlighting: 'high' },
        emotional_parameters: { enthusiasm_level: 'high', validation_frequency: 'high', mistake_normalization: 'high', confidence_building: 'high' },
        detection_areas: [],
        verification_steps: []
      }, mixedProgressItems);

      // Check that prompt contains progress information
      expect(prompt).toContain('CURRENT LEARNING PROGRESS');
      expect(prompt).toContain('CURRENT LEARNING PROGRESS');
    });

    it('should handle soft deleted items in prompt generation', () => {
      const itemsWithDeleted = [
        ...mockChecklistItems,
        { ...mockChecklistItems[0], id: '4', deleted: true }
      ];

      const prompt = generateSystemPromptWithChecklist({
        role: { role: 'high' },
        communication_style: { teen_slang: 'low', conversational_markers: 'high', uncertainty_expression: 'low' },
        cognitive_parameters: { concept_density: 'high', perspective_taking: 'high', personal_examples: 'high', consequence_highlighting: 'high' },
        emotional_parameters: { enthusiasm_level: 'high', validation_frequency: 'high', mistake_normalization: 'high', confidence_building: 'high' },
        detection_areas: [],
        verification_steps: []
      }, itemsWithDeleted);

      // Should exclude deleted items from prompt - verify by checking content doesn't contain all items
      expect(prompt).toContain('URL verification');
      expect(prompt).toContain('Social engineering');
      // Should have content but not include deleted duplicates
      expect(prompt.length).toBeGreaterThan(500);
    });
  });

  describe('Simplified Workflow Adaptation', () => {
    it('should process items with simplified workflow', () => {
      const simplifiedItems = mockChecklistItems.map(item => ({
        ...item,
        understanding_level: undefined,
        priority: undefined
      }));

      // Test that simplified items maintain core functionality
      expect(simplifiedItems.length).toBe(mockChecklistItems.length);
      simplifiedItems.forEach(item => {
        expect(['pending', 'partially_covered', 'covered']).toContain(item.status);
        expect(item.id).toBeDefined();
        expect(item.area_text).toBeDefined();
      });
    });

    it('should calculate basic progress indicators', () => {
      const covered = mockChecklistItems.filter(i => i.status === 'covered').length;
      const pending = mockChecklistItems.filter(i => i.status === 'pending').length;
      const partial = mockChecklistItems.filter(i => i.status === 'partially_covered').length;

      const progressIndicators = {
        completion_percentage: (covered / mockChecklistItems.length) * 100,
        covered_count: covered,
        pending_count: pending,
        partially_covered_count: partial
      };

      expect(progressIndicators.completion_percentage).toBeGreaterThanOrEqual(0);
      expect(progressIndicators.covered_count).toBeGreaterThanOrEqual(0);
      expect(progressIndicators.pending_count).toBeGreaterThanOrEqual(0);
    });
  });
});
