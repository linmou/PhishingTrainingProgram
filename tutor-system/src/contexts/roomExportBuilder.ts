/**
 * Build a single room export payload that keeps chat, feedback, and tutor-only AI interaction metadata in one non-overlapping JSON structure.
 */

import { AIInteraction, ChatExportData, Message, MessageFeedbackStats, Room } from '../types';
import { readPublicQuestion } from './transferAssessmentUiAdapter';

/**
 * Learner-visible question lines for a delivered assessment message. Only the public projection is
 * read, so an export can never carry the answer key or the transfer basis.
 */
const renderPublicQuestionLines = (message: Message): string[] => {
  const question = readPublicQuestion(message);
  if (!question) return [];
  const instruction = question.selectionType
    ? question.selectionType === 'multiple'
      ? 'Select all that apply.'
      : 'Choose one.'
    : 'Answer type not recorded for this question.';
  return [
    `   ${instruction}`,
    ...question.options.map((option) => `   ${option.id}. ${option.text}`),
  ];
};

interface BuildRoomExportDataArgs {
  room: Room;
  messages: Message[];
  messageFeedbackStats: Record<string, MessageFeedbackStats>;
  feedbackSummary: ChatExportData['feedback_summary'] | null;
  aiInteractions: AIInteraction[];
  isTutor: boolean;
}

interface BuildRoomTextExportArgs {
  room: Room;
  messages: Message[];
  messageFeedbackStats: Record<string, MessageFeedbackStats>;
  aiInteractions: AIInteraction[];
  isTutor: boolean;
}

export const buildTutorInteractionText = (interaction: AIInteraction, index: number): string => {
  const modeChanged = interaction.raw_mode && interaction.final_mode
    ? interaction.raw_mode !== interaction.final_mode
    : interaction.mode_rectified;

  const instruction = interaction.raw_instruction === null
    ? interaction.raw_mode === 'guard' ? 'none' : 'not recorded'
    : interaction.raw_instruction;

  return [
    `#${index + 1} - ${interaction.timestamp}`,
    `Parent Message: "${interaction.parent_message_content}"`,
    `AI Suggestion: "${interaction.ai_suggestion}"`,
    `Tutor Action: ${interaction.tutor_action}`,
    `Raw Mode: ${interaction.raw_mode ?? 'not recorded'}`,
    `Raw Instruction: ${instruction}`,
    `Mode Reason: ${interaction.mode_reason ?? 'not recorded'}`,
    `Final Mode: ${interaction.final_mode ?? 'not recorded'}`,
    `Mode Changed: ${modeChanged === undefined ? 'not recorded' : modeChanged ? 'yes' : 'no'}`,
    interaction.tutor_final_response ? `Final Response: "${interaction.tutor_final_response}"` : '',
    interaction.response_time_ms === undefined ? '' : `Response Time: ${interaction.response_time_ms}ms`,
  ].filter(Boolean).join('\n');
};

export const buildRoomTextExport = ({
  room,
  messages,
  messageFeedbackStats,
  aiInteractions,
  isTutor,
}: BuildRoomTextExportArgs): string => {
  const aiSummary = isTutor && aiInteractions.length > 0 ? [
    '',
    'AI Assistant Summary:',
    '====================',
    `Total AI suggestions: ${aiInteractions.length}`,
    `Accepted: ${aiInteractions.filter((entry) => entry.tutor_action === 'accepted').length} (${(aiInteractions.filter((entry) => entry.tutor_action === 'accepted').length / aiInteractions.length * 100).toFixed(2)}%)`,
    `Modified: ${aiInteractions.filter((entry) => entry.tutor_action === 'modified').length} (${(aiInteractions.filter((entry) => entry.tutor_action === 'modified').length / aiInteractions.length * 100).toFixed(2)}%)`,
    `Rejected: ${aiInteractions.filter((entry) => entry.tutor_action === 'rejected').length} (${(aiInteractions.filter((entry) => entry.tutor_action === 'rejected').length / aiInteractions.length * 100).toFixed(2)}%)`,
    `Ignored: ${aiInteractions.filter((entry) => entry.tutor_action === 'ignored').length} (${(aiInteractions.filter((entry) => entry.tutor_action === 'ignored').length / aiInteractions.length * 100).toFixed(2)}%)`,
    '',
    'Detailed AI Interactions:',
    '========================',
    ...aiInteractions.map(buildTutorInteractionText),
  ] : [];

  const messagesWithFeedback = Object.keys(messageFeedbackStats).length;
  const totalFeedbackCount = Object.values(messageFeedbackStats)
    .reduce((sum, stats) => sum + stats.total_feedback_count, 0);
  const feedbackSummary = messagesWithFeedback > 0 ? [
    '',
    'Feedback Summary:',
    '================',
    `Messages with feedback: ${messagesWithFeedback}`,
    `Total feedback entries: ${totalFeedbackCount}`,
    '',
  ] : [];

  return [
    `Room: ${room.title}`,
    `Created: ${new Date(room.created_at).toISOString()}`,
    ...(isTutor ? [
      `AI Assistant: ${room.ai_assistant_enabled ? 'Enabled' : 'Disabled'}`,
      room.ai_assistant_model ? `AI Model: ${room.ai_assistant_model}` : '',
    ] : []),
    ...feedbackSummary,
    'Messages:',
    '=========',
    ...messages.flatMap((message) => {
      const feedbackStats = messageFeedbackStats[message.id];
      const feedbackInfo = feedbackStats && feedbackStats.total_feedback_count > 0
        ? ` [👍${feedbackStats.like_count} 👎${feedbackStats.dislike_count}${feedbackStats.overall_average_rating ? ` ★${feedbackStats.overall_average_rating.toFixed(1)}` : ''}]`
        : '';
      const line = `[${message.created_at}] ${message.display_name || message.user_role} (${message.user_role}): ${message.content}${feedbackInfo}`;
      // A delivered question exports its public rendering, never its private material.
      return [line, ...renderPublicQuestionLines(message)];
    }),
    ...aiSummary,
  ].filter((line) => line !== '').join('\n');
};

export const buildRoomExportData = ({
  room,
  messages,
  messageFeedbackStats,
  feedbackSummary,
  aiInteractions,
  isTutor,
}: BuildRoomExportDataArgs): ChatExportData => {
  const exportData: ChatExportData = {
    room: {
      id: room.id,
      title: room.title,
      created_at: room.created_at,
    },
    messages: messages.map((msg) => ({
      id: msg.id,
      user_role: msg.user_role,
      display_name: msg.display_name,
      content: msg.content,
      created_at: msg.created_at,
      response_mode: msg.response_mode,
      ai_model_used: msg.ai_model_used,
      ai_response_time_ms: msg.ai_response_time_ms,
      feedback_stats: messageFeedbackStats[msg.id] || undefined,
    })),
    export_metadata: {
      exported_at: new Date().toISOString(),
      total_messages: messages.length,
    },
  };

  if (feedbackSummary) {
    exportData.feedback_summary = feedbackSummary;
  }

  if (!isTutor) {
    return exportData;
  }

  exportData.room.ai_enabled = room.ai_assistant_enabled;
  exportData.room.ai_model = room.ai_assistant_model;
  exportData.ai_interactions = aiInteractions;
  exportData.export_metadata.total_ai_interactions = aiInteractions.length;
  exportData.export_metadata.interaction_summary = {
    accepted: aiInteractions.filter((entry) => entry.tutor_action === 'accepted').length,
    rejected: aiInteractions.filter((entry) => entry.tutor_action === 'rejected').length,
    modified: aiInteractions.filter((entry) => entry.tutor_action === 'modified').length,
    ignored: aiInteractions.filter((entry) => entry.tutor_action === 'ignored').length,
  };

  return exportData;
};
