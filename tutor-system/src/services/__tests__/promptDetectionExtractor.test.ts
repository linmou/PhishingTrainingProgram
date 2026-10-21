/**
 * File: src/services/promptDetectionExtractor.ts
 * Purpose: verify async extraction forwards the LLM list and reports empty/failing extraction.
 */

import { extractDetectionAreasFromPromptAsync, promptUserForDetectionAreas } from '../promptDetectionExtractor';
import { LLMExtractionService } from '../llmExtractionService';

jest.mock('../llmExtractionService', () => ({
  LLMExtractionService: { extractFromSystemPrompt: jest.fn() }
}));

describe('PromptDetectionExtractor', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns the provider extraction even when it differs from source bullet text', async () => {
    const targets = ['Provider target one', 'Provider target two'];
    (LLMExtractionService.extractFromSystemPrompt as jest.Mock).mockResolvedValue({ detection_areas: targets });
    await expect(extractDetectionAreasFromPromptAsync('## Detection Areas to Focus On:\n- Source bullet')).resolves.toEqual(targets);
    expect(LLMExtractionService.extractFromSystemPrompt).toHaveBeenCalledWith('## Detection Areas to Focus On:\n- Source bullet');
  });

  it('returns empty without extracting a blank prompt', async () => {
    await expect(extractDetectionAreasFromPromptAsync(' ')).resolves.toEqual([]);
    expect(LLMExtractionService.extractFromSystemPrompt).not.toHaveBeenCalled();
  });

  it('returns an explicit empty extraction unchanged', async () => {
    (LLMExtractionService.extractFromSystemPrompt as jest.Mock).mockResolvedValue({ detection_areas: [] });
    await expect(extractDetectionAreasFromPromptAsync('Input')).resolves.toEqual([]);
  });

  it('returns empty on an exception even when the prompt contains structured bullets', async () => {
    (LLMExtractionService.extractFromSystemPrompt as jest.Mock).mockRejectedValue(new Error('Provider unavailable'));
    await expect(extractDetectionAreasFromPromptAsync('## Detection Areas to Focus On:\n- Source bullet')).resolves.toEqual([]);
  });

  it('requests manual targets only for an empty inventory', () => {
    expect(typeof promptUserForDetectionAreas([])).toBe('string');
    expect(promptUserForDetectionAreas(['Target'])).toBeNull();
  });
});
