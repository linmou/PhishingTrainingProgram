/**
 * LLM-based extraction service for checklist items from system prompts using Qwen.
 */

import { QwenService, DummyAIService, DEFAULT_AI_MODEL } from './aiService';
import { AIAssistantConfig } from '../types';

export interface ExtractionResult {
  understanding: string[];
  behavior: string[];
}

/**
 * Enhanced AI configuration for complex LLM extraction tasks
 */
const EXTRACTION_CONFIG: AIAssistantConfig = {
  id: 'llm-extraction',
  room_id: 'system',
  model_name: DEFAULT_AI_MODEL,
  system_prompt: 'You are a specialized AI for extracting structured learning objectives from educational prompts.',
  temperature: 0.05, // Very low temperature for consistent structured extraction
  max_tokens: 800, // Increased tokens to handle complex extraction results
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export class LLMExtractionService {
  private static hasQwenKey = !!process.env.REACT_APP_OAI_API_KEY;

  /** Single method to extract checklist items from system prompts using Qwen. */
  static async extractFromSystemPrompt(systemPrompt: string): Promise<ExtractionResult> {
    if (!systemPrompt || systemPrompt.trim().length === 0) {
      return { understanding: [], behavior: [] };
    }

    if (!this.hasQwenKey) {
      console.warn('Qwen API key not found, falling back to empty result');
      return { understanding: [], behavior: [] };
    }

    try {
      const extractionPrompt = `
You are a specialized AI for extracting structured learning objectives from educational system prompts.

TASK: Extract cybersecurity learning content from this system prompt, focusing on structured sections.

EXTRACTION STRATEGY:
1. FIRST: Look for structured sections with these headers:
   - "## Detection Areas to Focus On:"
   - "## Verification Steps to Teach:"
   - "## Detection Areas"
   - "## Verification Steps"

2. SECOND: If structured sections exist, extract ONLY from those sections (ignore other content)
3. THIRD: If no structured sections, analyze entire prompt for cybersecurity learning content

STRUCTURED SECTION PARSING:
- Find the section headers (##)
- Extract bullet points (- or *) from those sections ONLY
- Preserve ALL specific details from the bullet points

CATEGORIZATION RULES:
- "understanding" = concepts, patterns, indicators to recognize/identify
- "behavior" = specific actions, steps, procedures to take
- Items starting with verbs (Check, Review, Navigate, etc.) = behavior
- Items describing threats/patterns (URLs, tactics, scams) = understanding

CRITICAL PRESERVATION RULES:
1. PRESERVE EXACT DETAILS: Keep specific URLs, prices, quotes, domain names, technical examples
2. PRESERVE QUOTED TEXT: Maintain all quotes like "ACT NOW!" exactly as written  
3. PRESERVE NUMBERS: Keep specific prices ($19.99), quantities (3 left), times (1 hour)
4. PRESERVE DOMAINS: Keep exact domain examples (amaz0n.com vs amazon.com)
5. PRESERVE TECHNICAL SPECS: Keep specific URLs, file types, error patterns
6. PRESERVE FULL CONTEXT: Keep explanatory text and examples with main concepts

Return ONLY a JSON object with this exact format:
{
  "understanding": ["[understanding] item1", "[understanding] item2"],
  "behavior": ["[behavior] item1", "[behavior] item2"]
}

QUALITY REQUIREMENTS:
- Each item MUST start with [understanding] or [behavior]
- DO NOT generalize - keep specific examples and context
- Extract ALL items from structured sections if they exist
- If no cybersecurity content found, return {"understanding": ["[understanding] None"], "behavior": ["[behavior] None"]}

EXAMPLES:

Good structured section extraction:
From: "## Detection Areas to Focus On:\n- Full name and age: Complete identity information visible"
✅ "[understanding] Full name and age: Complete identity information visible"

From: "## Verification Steps to Teach:\n- Review privacy settings: Regularly check who can see your posts"
✅ "[behavior] Review privacy settings: Regularly check who can see your posts"

Bad extraction (too generic):
❌ "[understanding] Privacy risks" (lost specific context)
❌ "[behavior] Check settings" (lost specific procedure)

System Prompt:
${systemPrompt}
`;

      const aiResponse = await QwenService.generateResponse(
        extractionPrompt,
        [], // No conversation history for extraction
        EXTRACTION_CONFIG
      );

      if (!aiResponse.success || !aiResponse.content) {
        console.warn('Qwen extraction failed:', aiResponse.error);
        return { understanding: [], behavior: [] };
      }

      // Parse JSON response from QwenService
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
        console.warn('Invalid response structure from Qwen:', parsed);
        return { understanding: [], behavior: [] };
      }

      return {
        understanding: Array.isArray(parsed.understanding) ? parsed.understanding : [],
        behavior: Array.isArray(parsed.behavior) ? parsed.behavior : []
      };

    } catch (parseError) {
      console.warn('Failed to parse Qwen JSON response:', content);
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
CRITICAL RETRY: The previous extraction failed. Apply STRICT rules.

MANDATORY STEPS:
1. Look for "## Detection Areas to Focus On:" and "## Verification Steps to Teach:" sections
2. Extract EVERY bullet point from these sections with FULL context
3. Apply prefixes: [understanding] for concepts, [behavior] for actions
4. PRESERVE ALL details - NO generalization allowed

STRUCTURED SECTION PRIORITY:
If you find sections with headers like:
- "## Detection Areas to Focus On:"
- "## Verification Steps to Teach:"

Extract ONLY from those sections. Ignore everything else.

CATEGORIZATION RULES (STRICT):
- Items starting with action verbs (Review, Think, Check, Use, Navigate, etc.) → [behavior]
- Items describing concepts, patterns, threats, information types → [understanding]

PRESERVATION RULES (NO EXCEPTIONS):
1. Keep ALL specific details, quotes, technical examples
2. Maintain exact wording from bullet points
3. Include explanatory context after colons
4. Preserve ALL technical specifications

Return ONLY valid JSON with MANDATORY prefixes:
{
  "understanding": ["[understanding] Full exact text from prompt"],
  "behavior": ["[behavior] Full exact text from prompt"]
}

VALIDATION CHECKLIST:
✅ Every item starts with [understanding] or [behavior]
✅ Full context and details preserved
✅ Valid JSON format
✅ All structured section content extracted

If no structured sections exist, return:
{"understanding": ["[understanding] None"], "behavior": ["[behavior] None"]}

System Prompt to Analyze:
${systemPrompt}
`;

    try {
      const aiResponse = await QwenService.generateResponse(
        stricterPrompt,
        [],
        { ...EXTRACTION_CONFIG, temperature: 0.01, max_tokens: 1000 } // Ultra-low temperature and more tokens for complex extraction
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
   * Categorize template items using QwenService
   */
  static async categorizeTemplateItems(items: string[]): Promise<ExtractionResult> {
    if (!items || items.length === 0) {
      return { understanding: [], behavior: [] };
    }

    if (!this.hasQwenKey) {
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

      // Use Qwen with slightly higher temperature for categorization
      const categorizationConfig = {
        ...EXTRACTION_CONFIG,
        temperature: 0.2
      };

      const aiResponse = await QwenService.generateResponse(
        categorizationPrompt,
        [],
        categorizationConfig
      );

      if (!aiResponse.success || !aiResponse.content) {
        console.warn('Qwen categorization failed:', aiResponse.error);
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
 * Fallback service for when Qwen API is not available
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
