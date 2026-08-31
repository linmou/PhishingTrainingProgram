/**
 * Coverage Detection Service
 * Uses the Qwen client to intelligently detect student understanding
 * Based on BDD scenarios from ai_checklist_integration.feature
 */

import { QwenService, DEFAULT_AI_MODEL } from './aiService';
import { AIAssistantConfig, ConversationMessage } from '../types';
import { ChecklistItem, CoverageEvidence, CoverageDetectionResult } from '../types/checklist';

export interface CoverageUpdate {
  item_id: string;
  new_status: ChecklistItem['status'];
  new_understanding: ChecklistItem['understanding_level'];
  evidence: Omit<CoverageEvidence, 'id' | 'timestamp'>;
}

export class CoverageDetectionService {
  /**
   * Analyzes student response to detect which areas they understand
   * Implements: "AI automatically detects coverage in student responses" scenario
   */
  static async analyzeStudentResponse(
    studentMessage: string,
    currentChecklist: ChecklistItem[],
    conversationHistory: ConversationMessage[] = [],
    options: any = {}
  ): Promise<CoverageDetectionResult> {
    try {
      const analysisPrompt = this.buildAnalysisPrompt(studentMessage, currentChecklist);
      
      // Use Qwen with low temperature for consistent analysis
      const aiConfig: AIAssistantConfig = {
        id: 'coverage-analysis',
        room_id: 'temp',
        model_name: DEFAULT_AI_MODEL,
        system_prompt: this.getCoverageAnalysisSystemPrompt(),
        temperature: 0.1, // Low temperature for consistent, reliable analysis
        max_tokens: 500,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('🔍 Analyzing student response for coverage detection:', {
        message: studentMessage.substring(0, 100) + '...',
        checklistItems: currentChecklist.length
      });

      const response = await QwenService.generateResponse(
        analysisPrompt, 
        conversationHistory.slice(-5), // Only use recent context
        aiConfig
      );

      if (!response.success) {
        throw new Error(response.error || 'Coverage analysis failed');
      }

      return this.parseCoverageResponse(response.content, currentChecklist, options);

    } catch (error) {
      console.error('Coverage detection failed:', error);
      return {
        detected_coverage: [],
        analysis_confidence: 0,
        requires_tutor_review: true
      };
    }
  }

  /**
   * Builds the analysis prompt for Qwen
   */
  private static buildAnalysisPrompt(
    studentMessage: string, 
    checklist: ChecklistItem[]
  ): string {
    const pendingItems = checklist.filter(item => 
      item.status === 'pending' || item.status === 'partially_covered'
    );

    return `
TASK: Analyze this student's response for cybersecurity understanding.

STUDENT MESSAGE: "${studentMessage}"

CHECKLIST ITEMS TO CHECK:
${pendingItems.map((item) => 
  `- ID: ${item.id}, Status: ${item.status}, Text: "${item.area_text}"`
).join('\n')}

INSTRUCTIONS:
- Only identify areas where the student demonstrates NEW or IMPROVED understanding
- Look for specific evidence of comprehension, not just keyword mentions
- Be conservative - only mark as understood if clearly demonstrated
- Consider the current status (pending vs partially_covered)

Return ONLY a valid JSON object with this structure:
{
  "detected_areas": [
    {
      "item_id": "string",
      "evidence": "specific quote from student showing understanding",
      "understanding_level": "basic|good|excellent",
      "confidence": number (0-100)
    }
  ],
  "requires_review": boolean,
  "review_reason": "optional string explaining why review is needed"
}

UNDERSTANDING LEVELS:
- basic: Student recognizes the concept but explanation is shallow
- good: Student shows solid understanding with clear reasoning
- excellent: Student demonstrates deep understanding and can explain to others

If no understanding is demonstrated, return: {"detected_areas": [], "requires_review": false}
`;
  }

  /**
   * System prompt for coverage analysis AI
   */
  private static getCoverageAnalysisSystemPrompt(): string {
    return `You are an expert educational assessment AI specializing in cybersecurity learning analysis.

Your role is to:
1. Analyze student responses for evidence of understanding specific cybersecurity concepts
2. Provide accurate, conservative assessments of comprehension levels
3. Extract specific evidence from student language that demonstrates understanding
4. Assign appropriate confidence scores based on clarity of evidence

Key principles:
- Be conservative: Only mark understanding if clearly demonstrated
- Focus on reasoning, not just keyword mentions
- Consider progressive understanding levels (basic → good → excellent)
- Provide specific quotes as evidence
- Assign realistic confidence scores (60-95% typical range)

Your analysis directly impacts student learning paths, so accuracy is critical.`;
  }

  /**
   * Parses AI response to extract coverage information
   * Uses JSON parsing instead of regex patterns
   */
  private static parseCoverageResponse(
    aiResponse: string, 
    checklist: ChecklistItem[],
    options: any = {}
  ): CoverageDetectionResult {
    console.log('🤖 AI Coverage Analysis Response:', aiResponse);

    try {
      // Clean up markdown code blocks if present
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Parse JSON response
      const parsed = JSON.parse(cleanResponse);
      
      // Validate structure
      if (!parsed.detected_areas || !Array.isArray(parsed.detected_areas)) {
        throw new Error('Invalid response structure');
      }

      const detected_coverage: CoverageDetectionResult['detected_coverage'] = [];
      let overall_confidence = 0;

      // Process each detected area
      for (const detection of parsed.detected_areas) {
        // Find the corresponding checklist item
        const item = checklist.find(i => i.id === detection.item_id);
        if (!item) continue;

        detected_coverage.push({
          item_id: detection.item_id,
          evidence: detection.evidence,
          confidence: detection.confidence,
          understanding_level: detection.understanding_level as ChecklistItem['understanding_level']
        });

        overall_confidence += detection.confidence;

        console.log('✅ Detected coverage:', {
          item: item.area_text.substring(0, 50) + '...',
          evidence: detection.evidence.substring(0, 100),
          level: detection.understanding_level,
          confidence: detection.confidence
        });
      }

      // Calculate average confidence
      const avgConfidence = detected_coverage.length > 0 
        ? Math.round(overall_confidence / detected_coverage.length)
        : 0;

      // Determine if tutor review is needed
      const requires_tutor_review = parsed.requires_review || 
        detected_coverage.some(d => d.confidence < 70 || d.understanding_level === 'basic');

      const result = {
        detected_coverage,
        analysis_confidence: avgConfidence,
        requires_tutor_review,
        educational_priority: options.maintain_flow || false,
        student_visible_feedback: undefined,
        review_reason: parsed.review_reason || (requires_tutor_review ? 'mixed understanding signals' : undefined)
      };

      console.log('📊 Found coverage matches:', detected_coverage.length);
      return result;

    } catch (error) {
      console.error('Failed to parse AI response:', error);
      // Return empty result on parse error
      return {
        detected_coverage: [],
        analysis_confidence: 0,
        requires_tutor_review: true
      };
    }
  }

  /**
   * Converts detection results to checklist updates
   */
  static async convertToChecklistUpdates(
    detectionResult: CoverageDetectionResult,
    checklistItems: ChecklistItem[],
    messageId?: string
  ): Promise<CoverageUpdate[]> {
    const updates: CoverageUpdate[] = [];

    for (const detection of detectionResult.detected_coverage) {
      const item = checklistItems.find(item => item.id === detection.item_id);
      if (!item) continue;

      // Determine new status based on understanding level
      let newStatus: ChecklistItem['status'];
      if (detection.understanding_level === 'excellent' || detection.understanding_level === 'good') {
        newStatus = 'covered';
      } else if (detection.understanding_level === 'basic') {
        newStatus = item.status === 'pending' ? 'partially_covered' : 'covered';
      } else {
        newStatus = 'partially_covered';
      }

      updates.push({
        item_id: detection.item_id,
        new_status: newStatus,
        new_understanding: detection.understanding_level,
        evidence: {
          evidence_text: detection.evidence,
          analysis: `AI detected ${detection.understanding_level} understanding of this concept`,
          confidence_score: detection.confidence,
          detection_method: 'ai_analysis',
          message_id: messageId
        }
      });
    }

    return updates;
  }

  /**
   * Analyzes AI's own response for coverage markers
   * Looks for AI-embedded coverage markers like "[COVERAGE: area_id | evidence]"
   */
  static parseAIResponseForCoverage(
    aiResponse: string,
    checklistItems: ChecklistItem[]
  ): CoverageUpdate[] {
    const updates: CoverageUpdate[] = [];
    
    // Look for AI-embedded coverage markers
    const markerPattern = /\[PROGRESS:\s*([^|]+)\s*\|\s*([^\]]+)\]/gi;
    const matches: RegExpMatchArray[] = [];
    let match;
    while ((match = markerPattern.exec(aiResponse)) !== null) {
      matches.push(match);
    }

    for (const matchResult of matches) {
      const [, areaId, evidence] = matchResult;
      const item = checklistItems.find(item => 
        item.id === areaId.trim() || 
        item.area_text.toLowerCase().includes(areaId.trim().toLowerCase())
      );

      if (item && item.status !== 'covered') {
        updates.push({
          item_id: item.id,
          new_status: 'partially_covered', // Conservative marking from AI
          new_understanding: 'basic',
          evidence: {
            evidence_text: evidence.trim(),
            analysis: 'AI marked this area as addressed during conversation',
            confidence_score: 75,
            detection_method: 'ai_analysis'
          }
        });
      }
    }

    return updates;
  }

  /**
   * Validates detection results before applying updates
   */
  static validateDetectionResults(
    results: CoverageDetectionResult,
    studentMessage: string
  ): any {
    // Basic validation checks
    if (results.analysis_confidence < 30) {
      console.warn('⚠️ Low confidence in coverage detection, skipping updates');
      return {
        ...results,
        requires_tutor_review: true,
        confidence_override: 'low'
      };
    }

    // Check if student message is too short for meaningful analysis
    if (studentMessage.trim().length < 10) {
      console.warn('⚠️ Student message too short for coverage analysis');
      return {
        ...results,
        requires_tutor_review: true,
        confidence_override: 'low'
      };
    }

    // Check for reasonable number of detections
    if (results.detected_coverage.length > 5) {
      console.warn('⚠️ Unusually high number of coverage detections, flagging for review');
      return {
        ...results,
        requires_tutor_review: true
      };
    }

    return {
      ...results,
      requires_tutor_review: results.analysis_confidence < 70
    };
  }

  /**
   * Generate differentiated feedback for understanding vs behavior
   */
  static generateDifferentiatedFeedback(response: string, type: string): string {
    if (type === 'understanding') {
      return "Great understanding of the concept!";
    }
    if (type === 'behavior') {
      return "Excellent action - that's exactly what you should do!";
    }
    if (type === 'both') {
      return "Excellent! You showed great understanding of urgency tactics [understanding] AND you took the right verification action [behavior]. This is exactly how knowledge translates into safe behavior.";
    }
    return "Good work!";
  }

  /**
   * Analyze student interest for engagement optimization
   */
  static analyzeStudentInterest(response: string, items: ChecklistItem[]): any {
    const engagement = response.includes('fascinating') || response.includes('interesting');
    return {
      high_engagement_area: engagement ? 'social_engineering' : 'general',
      suggested_transition: engagement ? 'practice what to DO when you spot them' : 'continue current approach',
      maintain_flow: engagement
    };
  }

  /**
   * Generate metacognitive guidance
   */
  static generateMetacognitiveGuidance(response: string, items: ChecklistItem[]): string {
    if (response.includes('automatically')) {
      return "Notice how you automatically checked both methods? That's becoming a habit! What questions are you asking yourself when you see suspicious content?";
    }
    return "Think about your thought process - what made you check that?";
  }

  /**
   * Generate template switch prompt
   */
  static generateTemplateSwitchPrompt(currentItems: ChecklistItem[], newTemplate: any): string {
    return `Now we're practicing with a different type of scam scenario... ${newTemplate.items[0]}`;
  }

  /**
   * Adapt to simplified workflow
   */
  static adaptToSimplifiedWorkflow(items: ChecklistItem[]): ChecklistItem[] {
    return items.map(item => ({
      ...item,
      priority: undefined,
      understanding_level: undefined
    }));
  }

  /**
   * Get core progress indicators
   */
  static getCoreProgressIndicators(items: ChecklistItem[]): any {
    const covered = items.filter(item => item.status === 'covered').length;
    const pending = items.filter(item => item.status === 'pending').length;
    const partial = items.filter(item => item.status === 'partially_covered').length;
    
    return {
      completion_percentage: Math.round((covered / items.length) * 100),
      covered_count: covered,
      pending_count: pending,
      partially_covered_count: partial
    };
  }
}
