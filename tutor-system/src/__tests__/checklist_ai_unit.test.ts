/**
 * File: src/services/llmExtractionService.ts and checklistIntegration.ts
 * Purpose: validate the single-list extraction schema, provider failures, and generated checklist metadata.
 */

import { ChecklistIntegration, generateChecklistFromSystemPrompt } from '../services/checklistIntegration';
import { extractDetectionAreasFromPromptAsync } from '../services/promptDetectionExtractor';
import { LLMExtractionService } from '../services/llmExtractionService';
import { QwenService } from '../services/aiService';
import { ChecklistItem } from '../types/checklist';
import { ConversationMessage } from '../types';
import { OAI_MODEL } from '../services/aiModels';
import * as fs from 'fs';
import * as path from 'path';

function loadTestCases(filePath: string): any {
  return JSON.parse(fs.readFileSync(path.join(__dirname, filePath), 'utf-8'));
}

let generateResponse: jest.SpyInstance;

describe('Single-list LLM extraction', () => {
  beforeEach(() => { generateResponse = jest.spyOn(QwenService, 'generateResponse'); });
  afterEach(() => { jest.restoreAllMocks(); });

  it('returns one list unchanged through the extraction and integration services', async () => {
    const targets = ['Inspect https://example.test/a?b=1', 'Compare $19.99 with $300+', 'Open the official app'];
    generateResponse.mockResolvedValue({ success: true, content: JSON.stringify({ detection_areas: targets }) });
    await expect(ChecklistIntegration.extractFromSystemPromptAsync('Source learning content')).resolves.toEqual({ detection_areas: targets });
    expect(generateResponse).toHaveBeenCalledTimes(1);
    const [prompt, history, config] = generateResponse.mock.calls[0];
    expect(prompt).toContain('Source learning content');
    expect(history).toEqual([]);
    expect(config.model_name).toBe(OAI_MODEL);
  });

  it('accepts a custom target inventory larger than five', async () => {
    const targets = Array.from({ length: 8 }, (_, index) => `Target ${index + 1}`);
    generateResponse.mockResolvedValue({ success: true, content: JSON.stringify({ detection_areas: targets }) });
    await expect(LLMExtractionService.extractFromSystemPrompt('Custom prompt')).resolves.toEqual({ detection_areas: targets });
  });

  it('accepts an explicit empty inventory', async () => {
    generateResponse.mockResolvedValue({ success: true, content: '{"detection_areas":[]}' });
    await expect(LLMExtractionService.extractFromSystemPrompt('No learning content')).resolves.toEqual({ detection_areas: [] });
    expect(generateResponse).toHaveBeenCalledTimes(1);
  });

  it.each(['', '  ', '\n\t'])('returns empty without calling the provider for a blank prompt', async (prompt) => {
    await expect(LLMExtractionService.extractFromSystemPrompt(prompt)).resolves.toEqual({ detection_areas: [] });
    expect(generateResponse).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid JSON', 'not JSON'],
    ['fenced JSON', '```json\n{"detection_areas":["Target"]}\n```'],
    ['null', 'null'],
    ['array root', '["Target"]'],
    ['missing list', '{}'],
    ['wrong list type', '{"detection_areas":"Target"}'],
    ['nonstring element', '{"detection_areas":["Target",42]}'],
    ['null element', '{"detection_areas":[null]}'],
    ['blank element', '{"detection_areas":[" "]}'],
    ['extra field', '{"detection_areas":["Target"],"other":[]}'],
    ['old category shape', '{"understanding":["Target"],"behavior":[]}']
  ])('rejects %s consistently without retrying or inventing targets', async (_name, content) => {
    generateResponse.mockResolvedValue({ success: true, content });
    await expect(LLMExtractionService.extractFromSystemPrompt('Input with learning content')).resolves.toEqual({ detection_areas: [] });
    expect(generateResponse).toHaveBeenCalledTimes(1);
  });

  it.each([
    { success: false, error: 'Provider unavailable', content: '{"detection_areas":["Target"]}' },
    { success: true, content: '' }
  ])('returns empty for failed or empty provider responses', async (response) => {
    generateResponse.mockResolvedValue(response);
    await expect(LLMExtractionService.extractFromSystemPrompt('Input')).resolves.toEqual({ detection_areas: [] });
    expect(generateResponse).toHaveBeenCalledTimes(1);
  });

  it('keeps valid targets once when the provider repeats an entry', async () => {
    generateResponse.mockResolvedValue({ success: true,
      content: '{"detection_areas":["Target one"," Target one ","Target two"]}' });
    await expect(LLMExtractionService.extractFromSystemPrompt('Input')).resolves.toEqual({
      detection_areas: ['Target one', 'Target two']
    });
    expect(generateResponse).toHaveBeenCalledTimes(1);
  });

  it('returns empty for a thrown provider error', async () => {
    generateResponse.mockRejectedValue(new Error('Transport failed'));
    await expect(LLMExtractionService.extractFromSystemPrompt('Input')).resolves.toEqual({ detection_areas: [] });
  });

  it('creates only detection_area items from actual extraction output', async () => {
    const targets = ['Target one', 'Target two'];
    generateResponse.mockResolvedValue({ success: true, content: JSON.stringify({ detection_areas: targets }) });
    const result = await generateChecklistFromSystemPrompt('room-1', 'Input');
    expect(result.success).toBe(true);
    expect(result.checklist?.detection_areas.map((item) => item.area_text)).toEqual(targets);
    expect(result.checklist?.detection_areas.every((item) => item.item_type === 'detection_area' && item.status === 'pending')).toBe(true);
    expect(result.checklist?.verification_steps).toEqual([]);
    expect(result.checklist?.total_items).toBe(2);
  });

  it('does not create a checklist when extraction fails', async () => {
    generateResponse.mockResolvedValue({ success: false, error: 'Offline' });
    const result = await generateChecklistFromSystemPrompt('room-1', 'Input');
    expect(result.success).toBe(false);
    expect(result.checklist).toBeNull();
    expect(typeof result.userPrompt).toBe('string');
  });
});
