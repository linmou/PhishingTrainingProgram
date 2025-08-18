/**
 * LLM-based extraction service for checklist items from system prompts
 * Refactored to use OpenAIService for consistent API handling
 */

import { OpenAIService, DummyAIService } from './aiService';
import { AIAssistantConfig } from '../types';

export interface ExtractionResult {
  understanding: string[];
  behavior: string[];
}

/**
 * Default AI configuration for LLM extraction tasks
 */
const EXTRACTION_CONFIG: AIAssistantConfig = {
  id: 'llm-extraction',
  room_id: 'system',
  model_name: 'gpt-3.5-turbo',
  system_prompt: 'You are a specialized AI for extracting structured learning objectives from educational prompts.',
  temperature: 0.1, // Low temperature for consistent JSON output
  max_tokens: 300,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export class LLMExtractionService {
  private static hasOpenAIKey = !!process.env.REACT_APP_OAI_API_KEY;

  /**
   * Single method to extract checklist items from system prompts using OpenAIService
   */
  static async extractFromSystemPrompt(systemPrompt: string): Promise<ExtractionResult> {
    if (!systemPrompt || systemPrompt.trim().length === 0) {
      return { understanding: [], behavior: [] };
    }

    if (!this.hasOpenAIKey) {
      console.warn('OpenAI API key not found, falling back to empty result');
      return { understanding: [], behavior: [] };
    }

    try {
      const extractionPrompt = `
Extract cybersecurity learning objectives from the system prompt, preserving ALL specific details.

Return ONLY a JSON object with this exact format:
{
  "understanding": ["[understanding] item1", "[understanding] item2"],
  "behavior": ["[behavior] item1", "[behavior] item2"]
}

CRITICAL PRESERVATION RULES:
1. PRESERVE EXACT DETAILS: Keep specific URLs, prices, quotes, domain names, and technical examples
2. PRESERVE QUOTED TEXT: Maintain all quotes like "ACT NOW!" exactly as written
3. PRESERVE NUMBERS: Keep specific prices ($19.99), quantities (3 left), times (1 hour)
4. PRESERVE DOMAINS: Keep exact domain examples (amaz0n.com vs amazon.com)
5. PRESERVE TECHNICAL SPECS: Keep specific URLs, file types, error patterns

Guidelines:
- "understanding" items = concepts to recognize/identify
- "behavior" items = specific actions to take
- Each item MUST start with [understanding] or [behavior]
- DO NOT generalize - keep specific examples and context
- Extract 3-8 items total focusing on cybersecurity education

Examples of GOOD extraction (preserving specificity):
✅ "[understanding] 'Too Good to Be True' Pricing: $19.99 for a $300+ gaming console"
✅ "[understanding] Suspicious URL: http://goo.gl/FreeSwitch (shortened link, not official Nintendo domain)"
✅ "[behavior] Navigate to Nintendo.com directly to check for real deals"

Examples of BAD extraction (too generic):
❌ "[understanding] Suspicious URLs" (lost specific URL and context)
❌ "[understanding] Urgency language" (lost specific examples)
❌ "[behavior] Check websites" (lost specific site and method)

FALLBACK RULES:
- If prompt is too short (<20 words) or lacks cybersecurity content:
  {
    "understanding": ["[understanding] None"],
    "behavior": ["[behavior] None"]
  }

System Prompt:
${systemPrompt}
`;

      // Use OpenAIService for consistent API handling
      const aiResponse = await OpenAIService.generateResponse(
        extractionPrompt,
        [], // No conversation history for extraction
        EXTRACTION_CONFIG
      );

      if (!aiResponse.success || !aiResponse.content) {
        console.warn('OpenAI extraction failed:', aiResponse.error);
        return { understanding: [], behavior: [] };
      }

      // Parse JSON response from OpenAIService
      let result = this.parseExtractionResponse(aiResponse.content);
      
      // Check if prefixes are missing and retry if needed
      const needsRetry = this.checkIfPrefixesAreMissing(result);
      if (needsRetry) {
        console.log('Prefixes missing in LLM response, retrying with stricter prompt...');
        result = await this.retryWithStricterPrompt(systemPrompt);
      }
      
      return result;

    } catch (error) {
      console.error('LLM extraction failed:', error);
      return { understanding: [], behavior: [] };
    }
  }

  /**
   * Parse and validate JSON extraction response
   */
  private static parseExtractionResponse(content: string): ExtractionResult {
    try {
      // Clean up markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(cleanContent);
      
      // Validate structure
      if (!parsed.understanding || !parsed.behavior) {
        console.warn('Invalid response structure from OpenAI:', parsed);
        return { understanding: [], behavior: [] };
      }

      return {
        understanding: Array.isArray(parsed.understanding) ? parsed.understanding : [],
        behavior: Array.isArray(parsed.behavior) ? parsed.behavior : []
      };

    } catch (parseError) {
      console.warn('Failed to parse OpenAI JSON response:', content);
      return { understanding: [], behavior: [] };
    }
  }

  /**
   * Check if any items are missing the required prefixes
   */
  private static checkIfPrefixesAreMissing(result: ExtractionResult): boolean {
    const missingInUnderstanding = result.understanding.some(
      item => !item.startsWith('[understanding]')
    );
    const missingInBehavior = result.behavior.some(
      item => !item.startsWith('[behavior]')
    );
    
    return missingInUnderstanding || missingInBehavior;
  }

  /**
   * Retry extraction with a stricter prompt emphasizing prefix requirements
   */
  private static async retryWithStricterPrompt(systemPrompt: string): Promise<ExtractionResult> {
    const stricterPrompt = `
CRITICAL: You MUST include the exact prefix [understanding] or [behavior] at the START of each item.
CRITICAL: You MUST preserve ALL specific details, quotes, URLs, prices, and technical examples.

Analyze this prompt and extract cybersecurity learning objectives:
${systemPrompt}

Return JSON with this EXACT format (prefixes are MANDATORY):
{
  "understanding": ["[understanding] Specific concept with exact details"],
  "behavior": ["[behavior] Specific action with exact context"]
}

PRESERVATION REQUIREMENTS:
1. Every item MUST start with [understanding] or [behavior]
2. PRESERVE exact quotes, URLs, prices, domain names, and technical details
3. DO NOT generalize - keep specific examples and context
4. If content is insufficient, return:
   {"understanding": ["[understanding] None"], "behavior": ["[behavior] None"]}
5. NO exceptions - prefixes AND specificity are required!

Examples:
✅ "[understanding] Suspicious URL: http://goo.gl/FreeSwitch (shortened link, not official Nintendo domain)"
❌ "[understanding] Suspicious URLs" (too generic)
`;

    try {
      const aiResponse = await OpenAIService.generateResponse(
        stricterPrompt,
        [],
        { ...EXTRACTION_CONFIG, temperature: 0.05 } // Even lower temperature for consistency
      );

      if (!aiResponse.success || !aiResponse.content) {
        return { understanding: ['[understanding] None'], behavior: ['[behavior] None'] };
      }

      const result = this.parseExtractionResponse(aiResponse.content);
      
      // If still missing prefixes, add them manually
      return {
        understanding: result.understanding.map(item => 
          item.startsWith('[understanding]') ? item : `[understanding] ${item}`
        ),
        behavior: result.behavior.map(item =>
          item.startsWith('[behavior]') ? item : `[behavior] ${item}`
        )
      };
    } catch (error) {
      console.error('Retry extraction failed:', error);
      return { understanding: ['[understanding] None'], behavior: ['[behavior] None'] };
    }
  }

  /**
   * Extract with template fallback when LLM extraction insufficient
   */
  static async extractWithFallback(
    systemPrompt: string,
    templates: Array<{ id: string; items: string[] }>
  ): Promise<{
    used_extraction: boolean;
    used_template: boolean;
    items: string[];
  }> {
    const extracted = await this.extractFromSystemPrompt(systemPrompt);
    
    // Check if extraction returned the 'None' fallback
    const isNoneFallback = (
      extracted.understanding.length === 1 && 
      extracted.understanding[0] === '[understanding] None' &&
      extracted.behavior.length === 1 && 
      extracted.behavior[0] === '[behavior] None'
    );
    
    const totalExtracted = extracted.understanding.length + extracted.behavior.length;

    // Use extraction if we have real content (not None fallback)
    if (totalExtracted >= 2 && !isNoneFallback) {
      return {
        used_extraction: true,
        used_template: false,
        items: [...extracted.understanding, ...extracted.behavior]
      };
    }

    // Fall back to template
    if (templates.length > 0) {
      const template = templates[0];
      
      // Check if template items already have prefixes
      const alreadyPrefixed = template.items.every(item => 
        item.startsWith('[understanding]') || item.startsWith('[behavior]')
      );
      
      if (alreadyPrefixed) {
        // Items already have prefixes, just return them
        return {
          used_extraction: false,
          used_template: true,
          items: template.items
        };
      } else {
        // Need to categorize items
        const categorized = await this.categorizeTemplateItems(template.items);
        return {
          used_extraction: false,
          used_template: true,
          items: [...categorized.understanding, ...categorized.behavior]
        };
      }
    }

    return {
      used_extraction: false,
      used_template: false,
      items: []
    };
  }

  /**
   * Categorize template items using OpenAIService
   */
  static async categorizeTemplateItems(items: string[]): Promise<ExtractionResult> {
    if (!items || items.length === 0) {
      return { understanding: [], behavior: [] };
    }

    if (!this.hasOpenAIKey) {
      // Simple fallback categorization without LLM
      return this.simpleCategorization(items);
    }

    try {
      const categorizationPrompt = `
Categorize these cybersecurity learning items into "understanding" (concepts to recognize) or "behavior" (actions to take).

Return ONLY a JSON object:
{
  "understanding": ["[understanding] item1"],
  "behavior": ["[behavior] item2"]
}

Items to categorize:
${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}
`;

      // Use OpenAIService with slightly higher temperature for categorization
      const categorizationConfig = {
        ...EXTRACTION_CONFIG,
        temperature: 0.2
      };

      const aiResponse = await OpenAIService.generateResponse(
        categorizationPrompt,
        [],
        categorizationConfig
      );

      if (!aiResponse.success || !aiResponse.content) {
        console.warn('OpenAI categorization failed:', aiResponse.error);
        return this.simpleCategorization(items);
      }

      return this.parseExtractionResponse(aiResponse.content);

    } catch (error) {
      console.warn('LLM categorization failed, using simple fallback:', error);
      return this.simpleCategorization(items);
    }
  }

  /**
   * Simple keyword-based categorization fallback
   */
  private static simpleCategorization(items: string[]): ExtractionResult {
    const understanding: string[] = [];
    const behavior: string[] = [];
    
    const behaviorKeywords = ['check', 'hover', 'report', 'verify', 'contact', 'navigate', 'click'];
    
    items.forEach(item => {
      const lower = item.toLowerCase();
      const isBehavior = behaviorKeywords.some(keyword => lower.includes(keyword));
      
      if (isBehavior) {
        behavior.push(item.startsWith('[behavior]') ? item : `[behavior] ${item}`);
      } else {
        understanding.push(item.startsWith('[understanding]') ? item : `[understanding] ${item}`);
      }
    });

    return { understanding, behavior };
  }

  /**
   * Analyze item functionality for consistency checks
   */
  static analyzeItemFunctionality(items: string[]): {
    has_understanding: boolean;
    has_behavior: boolean;
    supports_coverage_detection: boolean;
  } {
    const hasUnderstanding = items.some(item => item.includes('[understanding]'));
    const hasBehavior = items.some(item => item.includes('[behavior]'));

    return {
      has_understanding: hasUnderstanding,
      has_behavior: hasBehavior,
      supports_coverage_detection: hasUnderstanding || hasBehavior
    };
  }

  /**
   * Create fallback dummy response for testing without API key
   */
  static createDummyExtractionResult(systemPrompt: string): ExtractionResult {
    // Simple pattern matching for demo purposes
    const prompt = systemPrompt.toLowerCase();
    const understanding: string[] = [];
    const behavior: string[] = [];

    if (prompt.includes('phishing') || prompt.includes('scam')) {
      understanding.push('[understanding] Phishing email recognition');
      understanding.push('[understanding] Suspicious link identification');
      behavior.push('[behavior] Verify sender authenticity');
      behavior.push('[behavior] Hover over links before clicking');
    }

    if (prompt.includes('urgent') || prompt.includes('pressure')) {
      understanding.push('[understanding] Urgency manipulation techniques');
      behavior.push('[behavior] Take time to validate urgent requests');
    }

    return { understanding, behavior };
  }
}

/**
 * Fallback service for when OpenAI API is not available
 * Uses DummyAIService patterns from aiService
 */
export class DummyLLMExtractionService {
  /**
   * Generate dummy extraction results for testing
   */
  static async extractFromSystemPrompt(systemPrompt: string): Promise<ExtractionResult> {
    // Simulate API delay
    const delay = Math.random() * 1000 + 500;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return LLMExtractionService.createDummyExtractionResult(systemPrompt);
  }
  
  /**
   * Generate dummy categorization results
   */
  static async categorizeTemplateItems(items: string[]): Promise<ExtractionResult> {
    // Simulate API delay
    const delay = Math.random() * 800 + 300;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Use the private method via reflection or call it directly
    const understanding: string[] = [];
    const behavior: string[] = [];
    
    const behaviorKeywords = [
      'check', 'hover', 'report', 'verify', 'contact', 'navigate', 'click',
      'examine', 'inspect', 'validate', 'confirm', 'test', 'ask', 'call'
    ];
    
    items.forEach(item => {
      const lower = item.toLowerCase();
      const isBehavior = behaviorKeywords.some(keyword => lower.includes(keyword));
      
      if (isBehavior) {
        behavior.push(item.startsWith('[behavior]') ? item : `[behavior] ${item}`);
      } else {
        understanding.push(item.startsWith('[understanding]') ? item : `[understanding] ${item}`);
      }
    });

    return { understanding, behavior };
  }
}