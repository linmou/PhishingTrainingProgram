/**
 * Build a single room export payload that keeps chat, feedback, and tutor-only AI metadata in one non-overlapping JSON structure.
 */

import { AIConfigChangeLog, AIInteraction, ChatExportData, Message, MessageFeedbackStats, Room } from '../types';

interface BuildRoomExportDataArgs {
  room: Room;
  messages: Message[];
  messageFeedbackStats: Record<string, MessageFeedbackStats>;
  feedbackSummary: ChatExportData['feedback_summary'] | null;
  aiInteractions: AIInteraction[];
  aiConfigHistory: AIConfigChangeLog[];
  isTutor: boolean;
}

export const buildRoomExportData = ({
  room,
  messages,
  messageFeedbackStats,
  feedbackSummary,
  aiInteractions,
  aiConfigHistory,
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
      is_ai_generated: msg.is_ai_generated,
      ai_model_used: msg.ai_model_used,
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
  exportData.ai_config_history = aiConfigHistory;
  exportData.export_metadata.total_ai_interactions = aiInteractions.length;
  exportData.export_metadata.interaction_summary = {
    accepted: aiInteractions.filter((entry) => entry.tutor_action === 'accepted').length,
    rejected: aiInteractions.filter((entry) => entry.tutor_action === 'rejected').length,
    modified: aiInteractions.filter((entry) => entry.tutor_action === 'modified').length,
    ignored: aiInteractions.filter((entry) => entry.tutor_action === 'ignored').length,
  };

  return exportData;
};
