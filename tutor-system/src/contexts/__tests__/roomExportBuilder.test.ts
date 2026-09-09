/**
 * Test responsible for roomExportBuilder.ts and ensures room JSON exports merge chat, feedback, and tutor-only AI interaction snapshots without overlapping message shapes.
 */

import { buildRoomExportData, buildRoomTextExport, buildTutorInteractionText } from '../roomExportBuilder';
import { AIInteraction, Message, MessageFeedbackStats, Room, UserRole } from '../../types';
import fs from 'fs';
import path from 'path';

describe('buildRoomExportData', () => {
  const room: Room = {
    id: 'room-123',
    tutor_id: 'tutor-123',
    title: 'Nintendo Switch Deal Scam',
    description: 'Test room',
    image_url: null,
    is_active: true,
    ai_assistant_enabled: true,
    ai_assistant_model: 'gpt-4o-mini',
    ai_assistant_prompt: 'Stay focused on scam detection.',
    created_at: '2026-03-28T12:00:00Z',
    updated_at: '2026-03-28T12:10:00Z',
  };

  const messages: Message[] = [
    {
      id: 'msg-1',
      room_id: 'room-123',
      user_id: 'student-1',
      content: 'Is this giveaway real?',
      user_role: 'student' as UserRole,
      is_ai_generated: false,
      ai_model_used: null,
      ai_response_time_ms: null,
      parent_message_id: null,
      created_at: '2026-03-28T12:01:00Z',
      display_name: 'Student',
    },
    {
      id: 'msg-2',
      room_id: 'room-123',
      user_id: 'tutor-123',
      content: 'Look at the domain and the urgency language.',
      user_role: 'tutor' as UserRole,
      is_ai_generated: false,
      ai_model_used: 'gpt-4o-mini',
      ai_response_time_ms: 2100,
      parent_message_id: 'msg-1',
      created_at: '2026-03-28T12:02:00Z',
      display_name: 'Tutor',
    },
  ];

  const messageFeedbackStats: Record<string, MessageFeedbackStats> = {
    'msg-2': {
      likes: 2,
      dislikes: 0,
      average_rating: 4.5,
      total_feedback: 2,
      user_feedback: null,
    },
  };

  const aiInteractions: AIInteraction[] = [
    {
      timestamp: '2026-03-28T12:01:30Z',
      parent_message_id: 'msg-1',
      parent_message_content: 'Is this giveaway real?',
      ai_suggestion: 'Check whether the sender and link match Nintendo.',
      tutor_action: 'modified',
      tutor_final_response: 'Look at the domain and the urgency language.',
      response_time_ms: 5000,
      raw_mode: 'tutoring',
      raw_instruction: 'correction',
      mode_reason: 'The learner trusted an unsafe signal.',
      final_mode: 'guard',
      mode_rectified: true,
      ai_config_snapshot: {
        model_name: 'gpt-4o-mini',
        system_prompt: 'Stay focused on scam detection.',
        prompt_config: {
          role: { role: 'high' },
        },
        temperature: 0.4,
        max_tokens: 150,
        is_active: true,
      },
    },
  ];

  const feedbackSummary = {
    total_feedback: 2,
    average_rating: 4.5,
    liked_messages: 1,
    disliked_messages: 0,
  };

  it('builds a tutor JSON export that merges feedback data into chat export and includes AI interaction snapshots', () => {
    const exportData = buildRoomExportData({
      room,
      messages,
      messageFeedbackStats,
      feedbackSummary,
      aiInteractions,
      isTutor: true,
    });

    expect(exportData.feedback_summary).toEqual(feedbackSummary);
    expect(exportData.room.ai_enabled).toBe(true);
    expect(exportData.room.ai_model).toBe('gpt-4o-mini');
    expect(exportData.ai_interactions).toEqual(aiInteractions);
    expect(exportData.ai_config_history).toBeUndefined();
    expect(exportData.export_metadata.total_ai_interactions).toBe(1);
    expect(exportData.messages).toEqual([
      expect.objectContaining({
        id: 'msg-1',
        feedback_stats: undefined,
        ai_model_used: null,
      }),
      expect.objectContaining({
        id: 'msg-2',
        feedback_stats: messageFeedbackStats['msg-2'],
        ai_model_used: 'gpt-4o-mini',
      }),
    ]);
    expect(exportData.ai_interactions?.[0]).toEqual(
      expect.objectContaining({
        raw_mode: 'tutoring',
        raw_instruction: 'correction',
        mode_reason: 'The learner trusted an unsafe signal.',
        final_mode: 'guard',
        mode_rectified: true,
        ai_config_snapshot: {
          model_name: 'gpt-4o-mini',
          system_prompt: 'Stay focused on scam detection.',
          prompt_config: {
            role: { role: 'high' },
          },
          temperature: 0.4,
          max_tokens: 150,
          is_active: true,
        },
      })
    );
  });

  it('omits tutor-only AI export data for non-tutor exports while keeping feedback summary merged', () => {
    const exportData = buildRoomExportData({
      room,
      messages,
      messageFeedbackStats,
      feedbackSummary,
      aiInteractions,
      isTutor: false,
    });

    expect(exportData.feedback_summary).toEqual(feedbackSummary);
    expect(exportData.room.ai_enabled).toBeUndefined();
    expect(exportData.room.ai_model).toBeUndefined();
    expect(exportData.ai_interactions).toBeUndefined();
    expect(exportData.ai_config_history).toBeUndefined();
    expect(exportData.export_metadata.total_ai_interactions).toBeUndefined();
    expect(exportData.messages[1]).toEqual(
      expect.objectContaining({
        id: 'msg-2',
        feedback_stats: messageFeedbackStats['msg-2'],
      })
    );
  });

  it('formats the complete raw and reviewed decision trail for tutor TXT exports', () => {
    const text = buildTutorInteractionText(aiInteractions[0], 0);

    expect(text).toContain('Raw Mode: tutoring');
    expect(text).toContain('Raw Instruction: correction');
    expect(text).toContain('Mode Reason: The learner trusted an unsafe signal.');
    expect(text).toContain('Final Mode: guard');
    expect(text).toContain('Mode Changed: yes');
  });

  it('formats a contract-valid Guard decision without inventing an instruction', () => {
    const text = buildTutorInteractionText(
      {
        ...aiInteractions[0],
        raw_mode: 'guard',
        raw_instruction: null,
        final_mode: 'guard',
        mode_rectified: false,
      },
      0
    );

    expect(text).toContain('Raw Instruction: none');
    expect(text).toContain('Mode Changed: no');
    expect(text).not.toContain('undefined');
  });

  it('does not print placeholder garbage for historical interactions with missing decision metadata', () => {
    const text = buildTutorInteractionText(
      {
        ...aiInteractions[0],
        raw_mode: 'tutoring',
        raw_instruction: null,
        mode_reason: undefined,
        final_mode: undefined,
        mode_rectified: undefined,
      },
      0
    );

    expect(text).not.toMatch(/undefined|Raw Instruction: null/);
    expect(text).toContain('Raw Instruction: not recorded');
  });

  it('reports mode changes from the raw and final modes rather than a contradictory flag', () => {
    const text = buildTutorInteractionText(
      {
        ...aiInteractions[0],
        raw_mode: 'guard',
        final_mode: 'guard',
        mode_rectified: true,
      },
      0
    );

    expect(text).toContain('Mode Changed: no');

    const changedText = buildTutorInteractionText(
      {
        ...aiInteractions[0],
        raw_mode: 'guard',
        final_mode: 'tutoring',
        mode_rectified: false,
      },
      0
    );
    expect(changedText).toContain('Mode Changed: yes');
  });

  it('keeps the decision trail in the tutor TXT export and out of the student TXT export', () => {
    const args = { room, messages, messageFeedbackStats, aiInteractions };

    const tutorText = buildRoomTextExport({ ...args, isTutor: true });
    const studentText = buildRoomTextExport({ ...args, isTutor: false });

    expect(tutorText).toContain('Raw Mode: tutoring');
    expect(tutorText).toContain('Raw Instruction: correction');
    expect(tutorText).toContain('Mode Reason: The learner trusted an unsafe signal.');
    expect(tutorText).toContain('Final Mode: guard');
    expect(tutorText).toContain('Mode Changed: yes');
    expect(studentText).not.toMatch(/Raw Mode:|Raw Instruction:|Mode Reason:|Final Mode:|Mode Changed:/);
  });

  it('wires the tested TXT export builder into the room download path', () => {
    const roomContext = fs.readFileSync(path.resolve(process.cwd(), 'src/contexts/RoomContext.tsx'), 'utf8');

    expect(roomContext).toMatch(
      /const downloadChatHistory[\s\S]*?if \(format === 'json'\)[\s\S]*?\} else \{[\s\S]*?const content = buildRoomTextExport\s*\(\s*\{[\s\S]*?isTutor[\s\S]*?\}\s*\);[\s\S]*?new Blob\s*\(\s*\[content\]/
    );
  });
});
