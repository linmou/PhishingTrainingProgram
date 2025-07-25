/**
 * Learning stages framework for educational scaffolding
 */

import { LearningStage } from '../types';

export const LEARNING_STAGES: Record<string, LearningStage> = {
  stage1: {
    name: "Get First Reaction",
    prompt: "Look at this content. What do you think - is this real or fake? What's your gut reaction?",
    purpose: "Assess initial judgment without influence"
  },
  stage2: {
    name: "Explore Reasoning", 
    prompt: "[Reflect their answer] What made you decide that? What did you see that helped you figure it out?",
    purpose: "Understand their reasoning process and identify knowledge gaps"
  },
  stage3: {
    name: "Fill Knowledge Gaps",
    prompt: "Based on what the teen missed, use scaffolding techniques to help them learn",
    purpose: "Teach missing concepts using appropriate scaffolding methods"
  }
};