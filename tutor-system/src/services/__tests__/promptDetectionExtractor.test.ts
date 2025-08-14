/**
 * Test for extracting detection areas from system prompts
 * TDD Red Phase: Writing failing tests first
 */

import { extractDetectionAreasFromPrompt, promptUserForDetectionAreas } from '../promptDetectionExtractor';

describe('PromptDetectionExtractor', () => {
  describe('extractDetectionAreasFromPrompt', () => {
    it('should extract detection areas from system prompt', () => {
      // Red Phase: This test will fail initially
      const systemPrompt = `
        You are a cybersecurity tutor.
        
        ## Detection Areas to Focus On:
        - Too good to be true pricing or offers
        - Urgent language designed to pressure quick action  
        - Suspicious or shortened URLs that hide real destinations
        - Lack of official branding or verification
        
        ## Verification Steps to Teach:
        - Check sender authenticity
        - Verify website legitimacy
      `;

      const expectedDetectionAreas = [
        'Too good to be true pricing or offers',
        'Urgent language designed to pressure quick action',
        'Suspicious or shortened URLs that hide real destinations',
        'Lack of official branding or verification'
      ];

      const result = extractDetectionAreasFromPrompt(systemPrompt);
      expect(result).toEqual(expectedDetectionAreas);
    });

    it('should return empty array when no detection areas section found', () => {
      const systemPrompt = `
        You are a cybersecurity tutor.
        Help students learn online safety.
      `;

      const result = extractDetectionAreasFromPrompt(systemPrompt);
      expect(result).toEqual([]);
    });

    it('should handle mixed formatting in detection areas', () => {
      const systemPrompt = `
        ## Detection Areas to Focus On:
        - First area with hyphen
        * Second area with asterisk
        - Third area
        
        Some other content
      `;

      const expected = [
        'First area with hyphen',
        'Second area with asterisk', 
        'Third area'
      ];

      const result = extractDetectionAreasFromPrompt(systemPrompt);
      expect(result).toEqual(expected);
    });
  });

  describe('promptUserForDetectionAreas', () => {
    it('should return user prompt when no detection areas provided', () => {
      // Red Phase: This test will fail initially
      const result = promptUserForDetectionAreas([]);
      
      expect(result).toContain('No detection areas found');
      expect(result).toContain('Please add a checklist');
      expect(result).toContain('detection areas');
    });

    it('should return null when detection areas are provided', () => {
      const detectionAreas = ['Area 1', 'Area 2'];
      const result = promptUserForDetectionAreas(detectionAreas);
      
      expect(result).toBeNull();
    });
  });
});