/**
 * Build a single room export payload that keeps chat, feedback, and tutor-only AI interaction metadata in one non-overlapping JSON structure.
 */

import { AIInteraction, ChatExportData, Message, MessageFeedbackStats, Room, UserRole } from '../types';
import { readAnswerLifecycle, readPublicQuestion } from './transferAssessmentUiAdapter';
import type { AnswerLifecycleView } from './transferAssessmentUiAdapter';

interface PublicQuestionExport {
  id: string;
  stem: string;
  selection_type: 'single' | 'multiple';
  options: Array<{ id: string; text: string }>;
}

interface AnswerLifecycleExport {
  assessment_id: string;
  state: AnswerLifecycleView['state'];
  processing_state: AnswerLifecycleView['processingState'];
  answer_outcome: AnswerLifecycleView['answerOutcome'];
  attempt_number: AnswerLifecycleView['attemptNumber'];
  attempts_used: AnswerLifecycleView['attemptsUsed'];
  attempts_remaining: AnswerLifecycleView['attemptsRemaining'];
  terminal: boolean;
  terminal_explanation?: string;
}

type RoomExportMessage = ChatExportData['messages'][number] & {
  public_question?: PublicQuestionExport;
  answer_lifecycle?: AnswerLifecycleExport;
};

type RoomExportData = Omit<ChatExportData, 'messages'> & {
  messages: RoomExportMessage[];
};

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
  userRole: UserRole;
  userId: string | null;
}

interface BuildRoomTextExportArgs {
  room: Room;
  messages: Message[];
  messageFeedbackStats: Record<string, MessageFeedbackStats>;
  aiInteractions: AIInteraction[];
  userRole: UserRole;
  userId: string | null;
}

const lifecycleForQuestion = (
  messages: Message[],
  questionMessage: Message,
  userRole: UserRole,
  userId: string | null
): AnswerLifecycleView | null => {
  const question = readPublicQuestion(questionMessage);
  if (!question || userRole !== 'student' || question.studentId !== userId) return null;

  const questionLifecycle = readAnswerLifecycle(questionMessage);
  const answerWithLifecycle = messages.find((message) => {
    const lifecycle = readAnswerLifecycle(message);
    return (
      message.user_role === 'student' &&
      message.user_id === question.studentId &&
      message.parent_message_id === questionMessage.id &&
      lifecycle?.messageId === message.id &&
      lifecycle.assessmentId === question.id
    );
  });
  const answerLifecycle = answerWithLifecycle ? readAnswerLifecycle(answerWithLifecycle) : null;
  const lifecycle = questionLifecycle ?? answerLifecycle;
  if (!lifecycle || lifecycle.assessmentId !== question.id) return null;

  const answer = messages.find((message) => message.id === lifecycle.messageId);
  const linkedAnswerLifecycle = answer ? readAnswerLifecycle(answer) : null;
  if (
    !answer ||
    answer.user_role !== 'student' ||
    answer.user_id !== question.studentId ||
    answer.parent_message_id !== questionMessage.id
  ) return null;

  if (linkedAnswerLifecycle && (
    linkedAnswerLifecycle.messageId !== lifecycle.messageId ||
    linkedAnswerLifecycle.assessmentId !== lifecycle.assessmentId
  )) return null;

  return lifecycle;
};

const publicQuestionExport = (message: Message): PublicQuestionExport | null => {
  const question = readPublicQuestion(message);
  if (!question) return null;
  return {
    id: question.id,
    stem: question.stem,
    selection_type: question.selectionType,
    options: question.options.map(({ id, text }) => ({ id, text })),
  };
};

const answerLifecycleExport = (lifecycle: AnswerLifecycleView): AnswerLifecycleExport => {
  const terminalExplanation = lifecycle.state === 'failed' &&
    lifecycle.answerOutcome === 'failed' && lifecycle.terminal
    ? lifecycle.terminalFailureFeedback?.learner_safe_explanation
    : undefined;
  return {
    assessment_id: lifecycle.assessmentId,
    state: lifecycle.state,
    processing_state: lifecycle.processingState,
    answer_outcome: lifecycle.answerOutcome,
    attempt_number: lifecycle.attemptNumber,
    attempts_used: lifecycle.attemptsUsed,
    attempts_remaining: lifecycle.attemptsRemaining,
    terminal: lifecycle.terminal,
    ...(terminalExplanation ? { terminal_explanation: terminalExplanation } : {}),
  };
};

const renderAnswerLifecycleLines = (lifecycle: AnswerLifecycleView | null): string[] => {
  if (!lifecycle) return [];
  if (lifecycle.answerOutcome === 'retry') {
    const attemptLabel = lifecycle.attemptsRemaining === 1 ? 'attempt' : 'attempts';
    return [`   Incorrect. ${lifecycle.attemptsRemaining} ${attemptLabel} remaining.`];
  }
  if (lifecycle.answerOutcome === 'passed') return ['   Correct.'];
  if (lifecycle.answerOutcome !== 'failed') return [];

  const explanation = lifecycle.terminal && lifecycle.terminalFailureFeedback
    ? lifecycle.terminalFailureFeedback.learner_safe_explanation
    : null;
  return [
    '   Final answer: incorrect.',
    ...(explanation ? [`   Explanation: ${explanation}`] : []),
  ];
};

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
  userRole,
  userId,
}: BuildRoomTextExportArgs): string => {
  const isTutor = userRole === 'tutor';
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
      const lifecycle = readPublicQuestion(message)
        ? lifecycleForQuestion(messages, message, userRole, userId)
        : null;
      return [
        line,
        ...renderPublicQuestionLines(message),
        ...renderAnswerLifecycleLines(lifecycle),
      ];
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
  userRole,
  userId,
}: BuildRoomExportDataArgs): RoomExportData => {
  const isTutor = userRole === 'tutor';
  const exportData: RoomExportData = {
    room: {
      id: room.id,
      title: room.title,
      created_at: room.created_at,
    },
    messages: messages.map((msg) => {
      const question = publicQuestionExport(msg);
      const lifecycle = question
        ? lifecycleForQuestion(messages, msg, userRole, userId)
        : null;
      return {
        id: msg.id,
        user_role: msg.user_role,
        display_name: msg.display_name,
        content: msg.content,
        created_at: msg.created_at,
        response_mode: msg.response_mode,
        ai_model_used: msg.ai_model_used,
        ai_response_time_ms: msg.ai_response_time_ms,
        feedback_stats: messageFeedbackStats[msg.id] || undefined,
        ...(question ? { public_question: question } : {}),
        ...(lifecycle ? { answer_lifecycle: answerLifecycleExport(lifecycle) } : {}),
      };
    }),
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
