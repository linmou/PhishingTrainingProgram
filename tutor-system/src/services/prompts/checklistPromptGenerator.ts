/**
 * Checklist-aware system prompt generation
 * Integrates with existing modular prompt system to include dynamic checklist status
 * Based on BDD scenario: "AI receives checklist context in system prompt"
 */

import { SystemPromptConfig } from './types';
import { generateSystemPrompt } from './index';
import { ChecklistItem, ChecklistSystemPromptData } from '../../types/checklist';

/**
 * Generates system prompt with dynamic checklist status integration
 * Implements the learning progress context described in the BDD features
 */
export function generateSystemPromptWithChecklist(
  config: SystemPromptConfig,
  checklistItems: ChecklistItem[]
): string {
  const checklistData = analyzeChecklistForPrompt(checklistItems);
  const basePrompt = generateSystemPrompt(config);
  
  // Insert checklist context after base prompt but before pedagogical instructions
  const checklistContext = buildChecklistContext(checklistData);
  
  // Find insertion point (after base prompt, before communication style)
  const insertionMarker = "## Communication Style:";
  const insertionPoint = basePrompt.indexOf(insertionMarker);
  
  if (insertionPoint === -1) {
    // Fallback: append at end
    return basePrompt + '\n\n' + checklistContext;
  }
  
  // Insert checklist context before communication style
  return basePrompt.slice(0, insertionPoint) + 
         checklistContext + '\n\n' +
         basePrompt.slice(insertionPoint);
}

/**
 * Analyzes checklist items to create prompt data structure
 */
function analyzeChecklistForPrompt(items: ChecklistItem[]): ChecklistSystemPromptData {
  const uncovered_critical = items.filter(item => 
    item.priority === 'critical' && item.status === 'pending'
  );
  
  const uncovered_important = items.filter(item =>
    item.priority === 'important' && item.status === 'pending' 
  );
  
  const partially_covered = items.filter(item => 
    item.status === 'partially_covered'
  );
  
  const well_covered = items.filter(item => 
    item.status === 'covered'
  );

  return {
    uncovered_critical,
    uncovered_important,
    partially_covered,
    well_covered,
    focus_areas: uncovered_critical.map(item => item.area_text),
    avoid_over_explaining: well_covered.map(item => item.area_text),
    reinforce_areas: partially_covered.map(item => item.area_text)
  };
}

/**
 * Builds the checklist context section for the system prompt
 * Matches the format specified in BDD scenarios
 */
function buildChecklistContext(data: ChecklistSystemPromptData): string {
  const sections = [
    "## CURRENT LEARNING PROGRESS:",
    "",
    "This student's understanding has been tracked throughout our conversation. Adapt your responses based on this progress:"
  ];

  // Critical areas that need immediate attention
  if (data.uncovered_critical.length > 0) {
    sections.push(
      "",
      "🔴 CRITICAL AREAS - PRIORITIZE THESE:",
      ...data.uncovered_critical.map(item => `- [ ] [CRITICAL] ${item.area_text}`)
    );
  }

  // Important areas still pending
  if (data.uncovered_important.length > 0) {
    sections.push(
      "",
      "🟡 IMPORTANT AREAS - ADDRESS WHEN APPROPRIATE:",
      ...data.uncovered_important.map(item => `- [ ] [IMPORTANT] ${item.area_text}`)
    );
  }

  // Areas that need reinforcement
  if (data.partially_covered.length > 0) {
    sections.push(
      "",
      "⚠️ PARTIALLY UNDERSTOOD - REINFORCE WITH EXAMPLES:",
      ...data.partially_covered.map(item => 
        `- [~] [${(item.priority || 'optional').toUpperCase()}] ${item.area_text} (${item.understanding_level || 'none'} understanding)`
      )
    );
  }

  // Well-covered areas to reference lightly
  if (data.well_covered.length > 0) {
    sections.push(
      "",
      "✅ WELL COVERED - REFERENCE LIGHTLY:",
      ...data.well_covered.map(item => 
        `- [✓] [${(item.priority || 'optional').toUpperCase()}] ${item.area_text} (${item.understanding_level || 'none'} mastery)`
      )
    );
  }

  // Instructions for AI behavior
  sections.push(
    "",
    "## YOUR ADAPTIVE INSTRUCTIONS:",
    ""
  );

  if (data.uncovered_critical.length > 0) {
    sections.push(
      "1. **PRIORITIZE CRITICAL GAPS**: Focus your responses on uncovered critical areas first. These are essential for student safety.",
      ""
    );
  }

  if (data.partially_covered.length > 0) {
    sections.push(
      "2. **REINFORCE PARTIAL UNDERSTANDING**: When mentioning partially covered topics, provide concrete examples to solidify understanding.",
      ""
    );
  }

  if (data.well_covered.length > 0) {
    sections.push(
      "3. **LEVERAGE MASTERED CONCEPTS**: Reference well-covered areas to build confidence, but don't over-explain them.",
      ""
    );
  }

  sections.push(
    "4. **MARK YOUR OBSERVATIONS**: When you notice the student demonstrating understanding of any area, mark it using:",
    "   [PROGRESS: area_description | evidence_of_understanding]",
    "",
    "5. **MAINTAIN NATURAL FLOW**: Let the conversation feel natural while strategically guiding toward priority areas.",
    ""
  );

  // Add completion encouragement if student is making good progress
  const totalItems = data.uncovered_critical.length + data.uncovered_important.length + 
                     data.partially_covered.length + data.well_covered.length;
  const completedItems = data.well_covered.length;
  
  if (totalItems > 0) {
    const completionPercentage = Math.round((completedItems / totalItems) * 100);
    
    if (completionPercentage >= 50) {
      sections.push(
        `**PROGRESS ENCOURAGEMENT**: This student has mastered ${completionPercentage}% of the learning objectives. Acknowledge their progress while guiding them toward completion.`,
        ""
      );
    } else if (completionPercentage >= 25) {
      sections.push(
        `**BUILDING MOMENTUM**: Student has covered ${completionPercentage}% of objectives. Build on their understanding to maintain engagement.`,
        ""
      );
    }
  }

  // Add cognitive/behavioral balance guidance
  const cognitiveItems = [...data.uncovered_critical, ...data.uncovered_important, ...data.partially_covered, ...data.well_covered]
    .filter(item => item.area_text.includes('[understanding]')).length;
  const behavioralItems = [...data.uncovered_critical, ...data.uncovered_important, ...data.partially_covered, ...data.well_covered]
    .filter(item => item.area_text.includes('[behavior]')).length;
    
  if (cognitiveItems > 0 && behavioralItems === 0) {
    sections.push(
      "**LEARNING BALANCE**: Student has strong conceptual understanding. Now transition from concept explanation to practical application and focus on behavioral items.",
      ""
    );
  }

  return sections.join('\n');
}

/**
 * Updates system prompt after checklist changes
 * Used when tutor manually updates checklist or AI detects new coverage
 */
export async function regenerateSystemPromptForRoom(
  roomId: string,
  baseConfig: SystemPromptConfig,
  updatedChecklist: ChecklistItem[]
): Promise<string> {
  try {
    console.log('🔄 Regenerating system prompt with updated checklist for room:', roomId);
    
    const newPrompt = generateSystemPromptWithChecklist(baseConfig, updatedChecklist);
    
    // TODO: Update the AI configuration in the database
    // This would typically involve:
    // 1. Fetch current AI config for room
    // 2. Update system_prompt field
    // 3. Save back to database
    // For now, return the prompt for manual handling
    
    console.log('✅ System prompt regenerated successfully');
    console.log('📏 New prompt length:', newPrompt.length, 'characters');
    
    return newPrompt;
    
  } catch (error) {
    console.error('❌ Failed to regenerate system prompt:', error);
    throw new Error('Failed to regenerate system prompt');
  }
}

/**
 * Creates a focused prompt variation based on immediate learning needs
 * Useful when AI needs to address specific gaps or confusion
 */
export function createFocusedPromptVariation(
  baseConfig: SystemPromptConfig,
  checklistItems: ChecklistItem[],
  focusArea: string
): string {
  const focusItem = checklistItems.find(item => 
    item.area_text.toLowerCase().includes(focusArea.toLowerCase()) ||
    item.id === focusArea
  );
  
  if (!focusItem) {
    return generateSystemPromptWithChecklist(baseConfig, checklistItems);
  }
  
  // Create a modified checklist that emphasizes the focus area
  const modifiedChecklist = checklistItems.map(item => {
    if (item.id === focusItem.id) {
      return { ...item, priority: 'critical' as const };
    }
    return item;
  });
  
  const prompt = generateSystemPromptWithChecklist(baseConfig, modifiedChecklist);
  
  // Add specific focus instruction
  const focusInstruction = `
## IMMEDIATE FOCUS REQUIRED:
The student is currently struggling with: "${focusItem.area_text}"
Your next response should directly address this area with clear, supportive guidance.
`;
  
  return prompt + '\n\n' + focusInstruction;
}

/**
 * Generates summary of checklist progress for AI self-awareness
 * Helps AI understand how well the session is progressing
 */
export function generateProgressSummary(items: ChecklistItem[]): string {
  const total = items.length;
  const covered = items.filter(item => item.status === 'covered').length;
  const partial = items.filter(item => item.status === 'partially_covered').length;
  const pending = items.filter(item => item.status === 'pending').length;
  
  const criticalPending = items.filter(item => 
    item.priority === 'critical' && item.status === 'pending'
  ).length;
  
  const completionPercentage = total > 0 ? Math.round((covered / total) * 100) : 0;
  
  return `
## SESSION PROGRESS SUMMARY:
- **Overall Progress**: ${completionPercentage}% complete (${covered}/${total} areas mastered)
- **Status Breakdown**: ${covered} covered, ${partial} partially understood, ${pending} pending
- **Critical Gaps**: ${criticalPending} critical areas still need attention
- **Learning Velocity**: ${covered > 0 ? 'Good progress' : 'Getting started'}

Use this information to adjust your teaching pace and approach.
`;
}

/**
 * Export utility functions for external use
 */
export const ChecklistPromptUtils = {
  analyzeChecklistForPrompt,
  buildChecklistContext,
  generateProgressSummary,
  createFocusedPromptVariation
};