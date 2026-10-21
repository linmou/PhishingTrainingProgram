/**
 * Extract room learning targets from educational prompts through the configured Qwen service.
 */

import { QwenService, DEFAULT_AI_MODEL } from './aiService';
import { AIAssistantConfig } from '../types';

export interface ExtractionResult {
  detection_areas: string[];
}

const EXTRACTION_CONFIG: AIAssistantConfig = {
  id: 'llm-extraction',
  room_id: 'system',
  model_name: DEFAULT_AI_MODEL,
  system_prompt: 'You extract specific learning targets from educational prompts and return only the requested JSON object.',
  temperature: 0.05,
  max_tokens: 800,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export class LLMExtractionService {
  static async extractFromSystemPrompt(systemPrompt: string): Promise<ExtractionResult> {
    if (!systemPrompt.trim()) {
      return { detection_areas: [] };
    }

    const extractionPrompt = `Extract the cybersecurity learning targets present in the supplied educational system prompt.

Use explicit learning-target or detection-area sections when present. Otherwise use the cybersecurity learning content in the prompt. Include safe actions as learning targets in the same list.
Make each target specific, observable, and non-overlapping. Merge repeated goals without dropping concrete facts, examples, URLs, domains, prices, quoted text, or necessary context.
Do not invent targets or include instructions about the tutor's style, persona, or response format.

Return only a JSON object with this exact schema:
{"detection_areas": ["A learning target", "Another learning target"]}
Each element must be a nonempty string with no category labels or prefixes. Use a single list for all targets. If there are no learning targets, return {"detection_areas": []}.

System prompt:
${systemPrompt}`;

    try {
      const response = await QwenService.generateResponse(extractionPrompt, [], EXTRACTION_CONFIG);
      if (!response.success || !response.content) {
        console.warn('Qwen extraction failed:', response.error);
        return { detection_areas: [] };
      }

      const parsed: unknown = JSON.parse(response.content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { detection_areas: [] };
      }

      const value = parsed as Record<string, unknown>;
      if (Object.keys(value).length !== 1 || !Array.isArray(value.detection_areas) ||
          !value.detection_areas.every((item): item is string => typeof item === 'string' && item.trim().length > 0)) {
        return { detection_areas: [] };
      }

      const detection_areas = Array.from(new Set(value.detection_areas.map((item) => item.trim())));
      return { detection_areas };
    } catch (error) {
      console.warn('LLM extraction failed:', error);
      return { detection_areas: [] };
    }
  }
}
