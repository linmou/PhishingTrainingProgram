/**
 * Test file: src/__tests__/checklist_specificity.test.ts
 * Purpose: Demonstrates the specificity problem in LLM extraction - this test should FAIL to prove the issue
 */

import { LLMExtractionService } from '../services/llmExtractionService';
import { ChecklistIntegration } from '../services/checklistIntegration';

const describeLiveOpenAI = process.env.RUN_LIVE_OPENAI_TESTS === 'true' ? describe : describe.skip;

describeLiveOpenAI('Checklist Extraction Specificity Problem', () => {
  jest.setTimeout(15000);

  describe('Specificity Preservation Tests (SHOULD NOW PASS)', () => {
    
    it('should preserve specific pricing information', async () => {
      const systemPrompt = `Help students identify the Nintendo Switch scam.

## Detection Areas to Focus On:
- "Too Good to Be True" Pricing: $19.99 for a $300+ gaming console
- Urgency Language: "Hurry up, this offer WILL NOT LAST"
- Suspicious URL: http://goo.gl/FreeSwitch (shortened link, not official Nintendo domain)

## Verification Steps to Teach:
- Navigate to Nintendo.com directly to check for real deals
- Search for the username to verify official accounts`;

      const result = await ChecklistIntegration.extractFromSystemPromptAsync(systemPrompt);
      
      console.log('🔍 SPECIFICITY TEST - Extracted vs Expected:');
      console.log('Understanding items:', result.understanding);
      console.log('Behavior items:', result.behavior);

      // STRICT specificity checks - these should FAIL with current LLM
      const expectedSpecificItems = [
        '$19.99 for a $300+ gaming console',
        'http://goo.gl/FreeSwitch',
        'Nintendo.com directly'
      ];

      let specificityScore = 0;
      const allItems = [...result.understanding, ...result.behavior];
      
      expectedSpecificItems.forEach(expectedSpecific => {
        const hasSpecificMatch = allItems.some(item => 
          item.toLowerCase().includes(expectedSpecific.toLowerCase())
        );
        if (hasSpecificMatch) {
          specificityScore++;
          console.log(`✅ Found specific detail: ${expectedSpecific}`);
        } else {
          console.log(`❌ MISSING specific detail: ${expectedSpecific}`);
        }
      });

      console.log(`📊 Specificity Score: ${specificityScore}/${expectedSpecificItems.length}`);

      // This should now PASS - proving the LLM preserves specificity
      expect(specificityScore).toBeGreaterThanOrEqual(expectedSpecificItems.length);
    });

    it('should preserve exact quoted text', async () => {
      const systemPrompt = `Teach students to recognize urgency manipulation.

## Detection Areas to Focus On:
- Urgent phrases like "ACT NOW!" and "Limited time offer - expires in 1 hour!"
- Pressure tactics such as "Only 3 left in stock!"
- False deadlines: "This offer ends at midnight tonight"`;

      const result = await ChecklistIntegration.extractFromSystemPromptAsync(systemPrompt);
      
      // Look for quoted content preservation (allowing for slight variations)
      const exactQuotes = ['ACT NOW!', 'Limited time offer - expires in 1 hour!', 'Only 3 left in stock!'];
      const allItems = [...result.understanding, ...result.behavior];
      
      console.log('🔍 QUOTE PRESERVATION TEST:');
      console.log('Extracted items:', allItems);

      let quotePreservationScore = 0;
      exactQuotes.forEach(quote => {
        const isPreserved = allItems.some(item => item.includes(quote));
        if (isPreserved) {
          quotePreservationScore++;
          console.log(`✅ Preserved quote: ${quote}`);
        } else {
          console.log(`❌ LOST quote: ${quote}`);
        }
      });

      console.log(`📊 Quote Preservation Score: ${quotePreservationScore}/${exactQuotes.length}`);

      // This should now PASS - LLM preserves specific quotes
      expect(quotePreservationScore).toBeGreaterThanOrEqual(exactQuotes.length);
    });

    it('should preserve technical details and context', async () => {
      const systemPrompt = `Guide students through URL analysis.

## Detection Areas to Focus On:
- Domain spoofing: amaz0n.com vs amazon.com (zero instead of 'o')
- Subdomain tricks: amazon.security-check.malicious-site.com
- URL shorteners: bit.ly, tinyurl.com hiding real destinations
- HTTPS misconception: Secure connection ≠ trustworthy site

## Verification Steps to Teach:
- Hover over links to reveal true destination before clicking
- Check certificate details by clicking the lock icon
- Manually type official website URLs instead of clicking links`;

      const result = await ChecklistIntegration.extractFromSystemPromptAsync(systemPrompt);
      
      const technicalDetails = [
        'amaz0n.com vs amazon.com',
        'zero instead of \'o\'',
        'amazon.security-check.malicious-site.com',
        'bit.ly, tinyurl.com',
        'Secure connection ≠ trustworthy site',
        'clicking the lock icon'
      ];

      const allItems = [...result.understanding, ...result.behavior];
      console.log('🔍 TECHNICAL DETAIL PRESERVATION TEST:');
      console.log('Extracted items:', allItems);

      let technicalScore = 0;
      technicalDetails.forEach(detail => {
        const isPreserved = allItems.some(item => 
          item.toLowerCase().includes(detail.toLowerCase())
        );
        if (isPreserved) {
          technicalScore++;
          console.log(`✅ Preserved technical detail: ${detail}`);
        } else {
          console.log(`❌ LOST technical detail: ${detail}`);
        }
      });

      console.log(`📊 Technical Detail Score: ${technicalScore}/${technicalDetails.length}`);

      // This should now PASS - LLM preserves technical specificity
      expect(technicalScore).toBeGreaterThanOrEqual(Math.ceil(technicalDetails.length * 0.8)); // Allow 20% loss
    });

    it('should show the generalization problem directly', async () => {
      const specific = "Suspicious URL: http://goo.gl/FreeSwitch (shortened link, not official Nintendo domain)";
      const systemPrompt = `## Detection Areas to Focus On:\n- ${specific}`;

      const result = await LLMExtractionService.extractFromSystemPrompt(systemPrompt);
      // Find the item that contains the URL
      const allItems = [...result.understanding, ...result.behavior];
      const extractedItem = allItems.find(item => item.includes('goo.gl')) || allItems[0] || 'No extraction';

      console.log('🔍 GENERALIZATION PROBLEM DEMO:');
      console.log('INPUT (specific):', specific);
      console.log('OUTPUT (generalized):', extractedItem);

      // Calculate specificity loss
      const inputWords = specific.split(' ').length;
      const outputWords = extractedItem.split(' ').length;
      const detailRetention = outputWords / inputWords;

      console.log(`📊 Detail retention: ${(detailRetention * 100).toFixed(1)}% (${outputWords}/${inputWords} words)`);

      // This should now PASS - showing LLM preserves details
      expect(detailRetention).toBeGreaterThanOrEqual(0.7); // Expect at least 70% detail retention
      expect(extractedItem).toContain('http://goo.gl/FreeSwitch'); // Expect specific URL preservation
    });
  });
});
