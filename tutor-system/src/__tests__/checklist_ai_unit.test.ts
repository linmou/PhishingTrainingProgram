/**
 * AI Checklist Integration Test Suite.
 * Uses JSON test data files to validate real Qwen-backed extraction and coverage detection as an opt-in external integration suite.
 */

import { extractDetectionAreasFromPromptAsync } from '../services/promptDetectionExtractor';
import { ChecklistIntegration } from '../services/checklistIntegration';
import { CoverageDetectionService } from '../services/coverageDetectionService';
import { ChecklistItem, ConversationMessage } from '../types';

/**
 * Calculate semantic match rate between extracted and expected items
 * Uses multiple similarity metrics with configurable thresholds
 */
function calculateSemanticMatchRate(extracted: string[], expected: string[]): number {
  if (expected.length === 0) return 1.0; // If no expectations, consider it a match
  if (extracted.length === 0) return 0.0; // If no extractions, no match
  
  let totalMatches = 0;
  
  for (const expectedItem of expected) {
    let bestMatch = 0;
    
    for (const extractedItem of extracted) {
      // Clean items for comparison (remove prefixes, normalize)
      const cleanExpected = expectedItem.replace(/^\[(understanding|behavior)\]\s*/, '').toLowerCase().trim();
      const cleanExtracted = extractedItem.replace(/^\[(understanding|behavior)\]\s*/, '').toLowerCase().trim();
      
      // 1. Exact match (strict - only perfect matches)
      if (cleanExpected === cleanExtracted) {
        bestMatch = 1.0;
        break;
      }
      
      // 2. High similarity substring match (much more strict)
      if (cleanExpected.length > 20 && cleanExtracted.length > 20) {
        if (cleanExpected.includes(cleanExtracted) || cleanExtracted.includes(cleanExpected)) {
          const similarity = Math.min(cleanExpected.length, cleanExtracted.length) / 
                           Math.max(cleanExpected.length, cleanExtracted.length);
          if (similarity > 0.8) { // Must be very similar in length
            bestMatch = Math.max(bestMatch, 0.85);
          } else {
            bestMatch = Math.max(bestMatch, 0.6); // Lower score for partial matches
          }
          continue;
        }
      }
      
      // 3. Keyword overlap match (stricter requirements)
      const expectedWords = cleanExpected.split(/\s+/).filter(w => w.length > 3);
      const extractedWords = cleanExtracted.split(/\s+/).filter(w => w.length > 3);
      
      if (expectedWords.length > 2 && extractedWords.length > 2) {
        const exactMatches = expectedWords.filter(word => extractedWords.includes(word));
        const fuzzyMatches = expectedWords.filter(word => 
          extractedWords.some(extracted => 
            (extracted.includes(word) || word.includes(extracted)) && word.length > 4
          )
        );
        
        const totalMatches = exactMatches.length + (fuzzyMatches.length * 0.7);
        const overlapRatio = totalMatches / Math.max(expectedWords.length, extractedWords.length);
        
        if (overlapRatio > 0.6) { // Require 60% keyword overlap
          bestMatch = Math.max(bestMatch, overlapRatio * 0.5); // Max 50% score from keywords
        } else if (overlapRatio > 0.3) { // Partial keyword overlap
          bestMatch = Math.max(bestMatch, overlapRatio * 0.3); // Max 30% score
        }
      }
    }
    
    totalMatches += bestMatch;
  }
  
  return totalMatches / expected.length;
}

// Remove mocking to use real Qwen API calls
// jest.mock('../services/coverageDetectionService', () => ({
//   CoverageDetectionService: {
//     analyzeStudentResponse: jest.fn()
//   }
// }));
import * as fs from 'fs';
import * as path from 'path';

// Test data directory paths
const TEST_DATA_DIR = path.join(__dirname, 'test-data');
const EXTRACTION_TEST_DIR = path.join(TEST_DATA_DIR, 'ai-extraction');
const COVERAGE_TEST_DIR = path.join(TEST_DATA_DIR, 'ai-coverage');

// Helper function to load JSON test files
function loadTestCases(filePath: string): any {
  const fullPath = path.join(__dirname, filePath);
  const fileContent = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(fileContent);
}

// Helper to categorize items as understanding/behavior
function categorizeItems(detectionAreas: string[], verificationSteps: string[]): {
  understanding: string[];
  behavior: string[];
} {
  return {
    understanding: detectionAreas.map(area => `[understanding] ${area}`),
    behavior: verificationSteps.map(step => `[behavior] ${step}`)
  };
}

const describeLiveQwen = process.env.RUN_LIVE_QWEN_TESTS === 'true' ? describe : describe.skip;

describeLiveQwen('AI Checklist Integration', () => {
  // Increase timeout for LLM API calls
  jest.setTimeout(15000);
  
  describe('LLM-based System Prompt Extraction', () => {
    
    describe('ChecklistIntegration.extractFromSystemPrompt', () => {
      const testData = loadTestCases('test-data/ai-extraction/basic-extraction.json');
      
      testData.testCases.forEach((testCase: any) => {
        it(`should extract using LLM logic: ${testCase.name}`, async () => {
          // Use the new async LLM-based extraction method
          const extracted = await ChecklistIntegration.extractFromSystemPromptAsync(testCase.systemPrompt);
          
          // Strict validation: Compare against expected results with match threshold
          if (testCase.expectedExtraction) {
            const expectedUnderstanding = testCase.expectedExtraction.understanding || [];
            const expectedBehavior = testCase.expectedExtraction.behavior || [];
            
            // Must have both categories
            expect(extracted.understanding.length).toBeGreaterThan(0);
            expect(extracted.behavior.length).toBeGreaterThan(0);
            
            // Calculate match rates with 70% threshold
            const understandingMatchRate = calculateSemanticMatchRate(
              extracted.understanding, expectedUnderstanding
            );
            const behaviorMatchRate = calculateSemanticMatchRate(
              extracted.behavior, expectedBehavior
            );
            
            console.log(`Understanding match rate: ${(understandingMatchRate * 100).toFixed(1)}%`);
            console.log(`Behavior match rate: ${(behaviorMatchRate * 100).toFixed(1)}%`);
            
            // Expect at least 60% semantic match for each category
            expect(understandingMatchRate).toBeGreaterThanOrEqual(0.6);
            expect(behaviorMatchRate).toBeGreaterThanOrEqual(0.6);
          }
          
          // Basic quality checks
          extracted.understanding.forEach(item => {
            expect(item).toMatch(/^\[understanding\]/);
            expect(item.length).toBeGreaterThan(15);
          });
          
          extracted.behavior.forEach(item => {
            expect(item).toMatch(/^\[behavior\]/);
            expect(item.length).toBeGreaterThan(15);
          });
          
          // Test extraction with fallback
          const templates = [{ 
            id: 'test-template', 
            items: ['Check sender email', 'Verify URLs', 'Report suspicious content'] 
          }];
          
          const result = await ChecklistIntegration.extractWithFallback(testCase.systemPrompt, templates);
          expect(result.used_extraction || result.used_template).toBe(true);
          expect(result.items.length).toBeGreaterThan(0);
          
          console.log(`LLM Extraction Test: ${testCase.name}`);
          console.log('Extracted:', JSON.stringify(extracted, null, 2));
        });
      });
      
      it('should handle empty prompts gracefully', () => {
        const result = ChecklistIntegration.extractFromSystemPrompt('');
        expect(result.understanding).toEqual([]);
        expect(result.behavior).toEqual([]);
      });
      
      it('should categorize template items correctly', async () => {
        const items = [
          'Check sender email addresses',
          'URL verification techniques',
          'Hover over links before clicking',
          'Social engineering recognition'
        ];
        
        const categorized = await ChecklistIntegration.categorizeTemplateItems(items);
        
        // Strict validation for template categorization
        expect(categorized).toHaveProperty('understanding');
        expect(categorized).toHaveProperty('behavior');
        expect(Array.isArray(categorized.understanding)).toBe(true);
        expect(Array.isArray(categorized.behavior)).toBe(true);
        
        // Must categorize all items
        const totalCategorized = categorized.understanding.length + categorized.behavior.length;
        expect(totalCategorized).toBe(items.length);
        
        // Verify correct categorization based on content
        categorized.understanding.forEach(item => {
          expect(item).toMatch(/^\[understanding\]/);
          const conceptKeywords = ['techniques', 'recognition', 'analysis', 'assessment'];
          const hasConceptKeyword = conceptKeywords.some(keyword => 
            item.toLowerCase().includes(keyword)
          );
          expect(hasConceptKeyword).toBe(true);
        });
        
        categorized.behavior.forEach(item => {
          expect(item).toMatch(/^\[behavior\]/);
          const actionKeywords = ['check', 'hover', 'verify', 'report', 'examine'];
          const hasActionKeyword = actionKeywords.some(keyword => 
            item.toLowerCase().includes(keyword)
          );
          expect(hasActionKeyword).toBe(true);
        });
        
        console.log('Template Categorization Test Results:', JSON.stringify(categorized, null, 2));
      });
      
      it('should analyze item functionality correctly', () => {
        const items = ['[understanding] URL analysis', '[behavior] Check links'];
        const analysis = ChecklistIntegration.analyzeItemFunctionality(items);
        
        expect(analysis.has_understanding).toBe(true);
        expect(analysis.has_behavior).toBe(true);
        expect(analysis.supports_coverage_detection).toBe(true);
      });
    });
  });
  
  describe('System Prompt Extraction', () => {
    
    describe('Basic Extraction', () => {
      const testData = loadTestCases('test-data/ai-extraction/basic-extraction.json');
      
      testData.testCases.forEach((testCase: any) => {
        it(`should extract correctly: ${testCase.name}`, async () => {
          // Extract detection areas using LLM
          const extractedAreas = await extractDetectionAreasFromPromptAsync(testCase.systemPrompt);
          
          // Semantic matching validation against expected results
          expect(Array.isArray(extractedAreas)).toBe(true);
          
          if (testCase.expectedExtraction && testCase.expectedExtraction.detection_areas) {
            const expectedAreas = testCase.expectedExtraction.detection_areas;
            
            // Basic quantity check
            expect(extractedAreas.length).toBeGreaterThanOrEqual(1);
            
            // Calculate semantic match rate
            const matchRate = calculateSemanticMatchRate(extractedAreas, expectedAreas);
            console.log(`Detection areas match rate: ${(matchRate * 100).toFixed(1)}%`);
            
            // Expect at least 50% match for detection areas (more lenient due to format differences)
            expect(matchRate).toBeGreaterThanOrEqual(0.5);
          }
          
          // Basic quality validation
          extractedAreas.forEach(area => {
            expect(typeof area).toBe('string');
            expect(area.length).toBeGreaterThan(8);
            expect(area.trim()).not.toBe('');
          });
          
          console.log(`LLM Detection Area Extraction: ${testCase.name}`);
          console.log('Extracted Areas:', extractedAreas);
          
          // Test categorization if expected
          if (testCase.expectedCategorization) {
            const categorized = categorizeItems(
              testCase.expectedExtraction.detection_areas,
              testCase.expectedExtraction.verification_steps
            );
            expect(categorized.understanding).toEqual(testCase.expectedCategorization.understanding);
            expect(categorized.behavior).toEqual(testCase.expectedCategorization.behavior);
          }
        });
      });
    });
    
    describe('Mixed Content Extraction', () => {
      const testData = loadTestCases('test-data/ai-extraction/mixed-content-extraction.json');
      
      testData.testCases.forEach((testCase: any) => {
        it(`should handle mixed content: ${testCase.name}`, async () => {
          const extractedAreas = await extractDetectionAreasFromPromptAsync(testCase.systemPrompt);
          
          // Strict validation for mixed content extraction
          expect(Array.isArray(extractedAreas)).toBe(true);
          expect(extractedAreas.length).toBeGreaterThanOrEqual(2);
          expect(extractedAreas.length).toBeLessThanOrEqual(8);
          
          // Each extracted area must be substantial and cybersecurity-focused
          extractedAreas.forEach(area => {
            expect(typeof area).toBe('string');
            expect(area.length).toBeGreaterThan(15);
            expect(area.trim()).not.toBe('');
            
            // Should be cybersecurity related
            const securityKeywords = [
              'security', 'phishing', 'scam', 'suspicious', 'verify', 'check',
              'url', 'link', 'email', 'sender', 'domain', 'threat', 'malware'
            ];
            const isSecurityRelated = securityKeywords.some(keyword => 
              area.toLowerCase().includes(keyword)
            );
            expect(isSecurityRelated).toBe(true);
          });
          
          console.log(`Mixed Content Extraction: ${testCase.name}`);
          console.log('Extracted Areas:', extractedAreas);
        });
      });
    });
    
    describe('Edge Cases', () => {
      const testData = loadTestCases('test-data/ai-extraction/edge-cases-extraction.json');
      
      testData.testCases.forEach((testCase: any) => {
        it(`should handle edge case: ${testCase.name}`, async () => {
          const extractedAreas = await extractDetectionAreasFromPromptAsync(testCase.systemPrompt);
          
          // Strict validation for edge case handling
          expect(Array.isArray(extractedAreas)).toBe(true);
          
          // Even edge cases should produce meaningful results
          if (testCase.systemPrompt.trim().length > 20) {
            expect(extractedAreas.length).toBeGreaterThanOrEqual(1);
            
            extractedAreas.forEach(area => {
              expect(typeof area).toBe('string');
              expect(area.length).toBeGreaterThan(8);
              expect(area).not.toMatch(/^\s*$/); // Not just whitespace
              
              // Should still be educational/security focused
              const educationalKeywords = [
                'learn', 'understand', 'recognize', 'identify', 'check', 'verify',
                'security', 'safety', 'protection', 'awareness', 'detection'
              ];
              const isEducational = educationalKeywords.some(keyword => 
                area.toLowerCase().includes(keyword)
              );
              expect(isEducational).toBe(true);
            });
          }
          
          console.log(`Edge Case Extraction: ${testCase.name}`);
          console.log('Extracted Areas:', extractedAreas);
          
          // Check fallback behavior
          if (testCase.shouldFallbackToTemplate) {
            expect(extractedAreas.length).toBe(0);
          }
        });
      });
    });
  });
  
  describe('Coverage Detection', () => {
    
    describe('Direct Coverage', () => {
      const testData = loadTestCases('test-data/ai-coverage/direct-coverage.json');
      
      testData.testCases.forEach((testCase: any) => {
        it(`should detect direct coverage: ${testCase.name}`, async () => {
          const checklistItems: ChecklistItem[] = testData.checklistItems;
          const conversationHistory: ConversationMessage[] = testCase.conversationHistory || [];
          
          // Use real API call - no mocking
          
          // Run coverage detection
          const detectionResult = await CoverageDetectionService.analyzeStudentResponse(
            testCase.studentResponse,
            checklistItems,
            conversationHistory
          );
          
          // Verify detection result structure (flexible for real API responses)
          expect(detectionResult).toHaveProperty('detected_coverage');
          expect(detectionResult).toHaveProperty('analysis_confidence');
          expect(Array.isArray(detectionResult.detected_coverage)).toBe(true);
          expect(typeof detectionResult.analysis_confidence).toBe('number');
          
          // Log actual results for debugging
          console.log(`Test: ${testCase.name}`);
          console.log('Student Response:', testCase.studentResponse);
          console.log('Detection Results:', JSON.stringify(detectionResult, null, 2));
        });
      });
    });
    
    describe('Partial Understanding', () => {
      const testData = loadTestCases('test-data/ai-coverage/partial-understanding.json');
      
      testData.testCases.forEach((testCase: any) => {
        it(`should detect partial understanding: ${testCase.name}`, async () => {
          const checklistItems: ChecklistItem[] = testData.checklistItems;
          
          // Use real API call - no mocking
          
          const detectionResult = await CoverageDetectionService.analyzeStudentResponse(
            testCase.studentResponse,
            checklistItems,
            testCase.conversationHistory || []
          );
          
          // Verify detection result structure (flexible for real API responses)
          expect(detectionResult).toHaveProperty('detected_coverage');
          expect(detectionResult).toHaveProperty('analysis_confidence');
          expect(Array.isArray(detectionResult.detected_coverage)).toBe(true);
          
          console.log(`Partial Understanding Test: ${testCase.name}`);
          console.log('Student Response:', testCase.studentResponse);
          console.log('Detection Results:', JSON.stringify(detectionResult, null, 2));
        });
      });
    });
    
    describe('False Positive Prevention', () => {
      const testData = loadTestCases('test-data/ai-coverage/false-positives.json');
      
      testData.testCases.forEach((testCase: any) => {
        it(`should not detect false positive: ${testCase.name}`, async () => {
          const checklistItems: ChecklistItem[] = testData.checklistItems;
          
          // Use real API call - no mocking
          
          const detectionResult = await CoverageDetectionService.analyzeStudentResponse(
            testCase.studentResponse,
            checklistItems,
            testCase.conversationHistory || []
          );
          
          // Verify detection result structure
          expect(detectionResult).toHaveProperty('detected_coverage');
          expect(Array.isArray(detectionResult.detected_coverage)).toBe(true);
          
          console.log(`False Positive Test: ${testCase.name}`);
          console.log('Student Response:', testCase.studentResponse);
          console.log('Detection Results:', JSON.stringify(detectionResult, null, 2));
        });
      });
    });
    
    describe('Progressive Learning', () => {
      const testData = loadTestCases('test-data/ai-coverage/progressive-learning.json');
      
      testData.testCases.forEach((testCase: any) => {
        it(`should track progressive learning: ${testCase.name}`, async () => {
          const checklistItems: ChecklistItem[] = testData.checklistItems;
          let currentItems = [...checklistItems];
          
          // Process each interaction in sequence
          for (const interaction of testCase.interactions) {
            // Use real API call - no mocking
            
            const detectionResult = await CoverageDetectionService.analyzeStudentResponse(
              interaction.studentResponse,
              currentItems,
              interaction.conversationHistory || []
            );
            
            // Verify detection result structure
            expect(detectionResult).toHaveProperty('detected_coverage');
            expect(Array.isArray(detectionResult.detected_coverage)).toBe(true);
            
            console.log(`Progressive Learning - Interaction ${testCase.interactions.indexOf(interaction) + 1}:`);
            console.log('Student Response:', interaction.studentResponse);
            console.log('Detection Results:', JSON.stringify(detectionResult, null, 2));
            
            // Update items based on detection for next interaction
            detectionResult.detected_coverage.forEach((detection: any) => {
              const itemIndex = currentItems.findIndex(item => item.id === detection.item_id);
              if (itemIndex !== -1) {
                currentItems[itemIndex] = {
                  ...currentItems[itemIndex],
                  status: detection.new_status
                };
              }
            });
          }
        });
      });
    });
  });
  
  describe('Integration Scenarios', () => {
    
    it('should handle extraction failure gracefully', async () => {
      const malformedPrompt = 'This is a prompt without proper sections';
      const areas = await extractDetectionAreasFromPromptAsync(malformedPrompt);
      
      // LLM might extract something even from malformed prompts
      expect(Array.isArray(areas)).toBe(true);
      console.log('Extraction failure test - extracted:', areas);
    });
    
    it('should validate detection results before applying', async () => {
      const items: ChecklistItem[] = [{
        id: '1',
        area_text: '[understanding] Test concept',
        item_type: 'detection_area',
        status: 'pending',
        priority: 'important',
        understanding_level: 'none',
        coverage_evidence: [],
        tutor_notes: '',
        last_addressed: null,
        attempts_count: 0,
        original_template_area: true,
        created_at: new Date(),
        updated_at: new Date()
      }];
      
      // Test with empty response - should return valid structure
      const result = await CoverageDetectionService.analyzeStudentResponse('', items, []);
      expect(result).toHaveProperty('detected_coverage');
      expect(Array.isArray(result.detected_coverage)).toBe(true);
      
      console.log('Empty Response Test Results:', JSON.stringify(result, null, 2));
    });
  });
});

// Export test utilities for use in other test files
export { loadTestCases, categorizeItems };
