/**
 * File: src/services/llmExtractionService.ts
 * Purpose: verify concrete provider-output values survive JSON transport and checklist packaging unchanged.
 */

import { ChecklistIntegration, generateChecklistFromSystemPrompt } from '../services/checklistIntegration';
import { QwenService } from '../services/aiService';

jest.mock('../services/aiService', () => ({
  DEFAULT_AI_MODEL: 'qwen3.5-flash',
  QwenService: { generateResponse: jest.fn() }
}));

describe('Learning-target transport specificity', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it.each([
    ['$19.99 for a $300+ console', 'http://goo.gl/FreeSwitch', 'Nintendo.com'],
    ['"ACT NOW!"', '"Only 3 left in stock!"', 'expires in 1 hour'],
    ['amaz0n.com vs amazon.com', 'amazon.security-check.malicious-site.com', 'Secure connection ≠ trustworthy site']
  ])('preserves literal strings without categorizing or rewriting them', async (...targets) => {
    (QwenService.generateResponse as jest.Mock).mockResolvedValue({
      success: true, content: JSON.stringify({ detection_areas: targets })
    });
    await expect(ChecklistIntegration.extractFromSystemPromptAsync('Source prompt')).resolves.toEqual({ detection_areas: targets });
    const result = await generateChecklistFromSystemPrompt('room-1', 'Source prompt');
    expect(result.checklist?.detection_areas.map((item) => item.area_text)).toEqual(targets);
    expect(result.checklist?.verification_steps).toEqual([]);
    expect(result.checklist?.total_items).toBe(targets.length);
  });
});
