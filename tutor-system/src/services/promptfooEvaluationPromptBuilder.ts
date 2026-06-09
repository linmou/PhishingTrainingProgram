/**
 * Builds Promptfoo chat prompts in the same message order used by OpenAIService.generateResponse.
 */

export interface PromptfooEvaluationCaseVars {
  scenario_context: string;
  conversation_history: string;
  student_message: string;
}

export interface PromptfooChatMessage {
  role: 'system' | 'user';
  content: string;
}

export const buildEvaluationUserTurn = ({
  scenario_context,
  conversation_history,
  student_message
}: PromptfooEvaluationCaseVars): string => [
  'You are continuing this phishing-training tutoring conversation.',
  '',
  'Scenario context:',
  scenario_context,
  '',
  'Recent conversation:',
  conversation_history,
  '',
  "Student's latest message:",
  student_message,
  '',
  'Write the tutor response only. Do not prefix it with "Tutor:" or any speaker label.'
].join('\n');

export const buildPromptfooChatMessages = (systemPrompt: string): PromptfooChatMessage[] => [
  {
    role: 'system',
    content: systemPrompt
  },
  {
    role: 'user',
    content: buildEvaluationUserTurn({
      scenario_context: '{{scenario_context}}',
      conversation_history: '{{conversation_history}}',
      student_message: '{{student_message}}'
    })
  }
];
