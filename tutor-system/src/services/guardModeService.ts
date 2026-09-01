/** Purpose: persist reviewed tutor responses and room-level Guard Mode changes through narrow Supabase operations. */

import { Message, Room, TutorActionDecision, TutorResponseMode } from '../types';
import { supabase } from './supabase';

export interface ReviewedTutorResponseInput {
  roomId: string;
  tutorId: string;
  parentMessageId: string | null;
  rawDecision: TutorActionDecision;
  finalMode: TutorResponseMode;
  finalResponse: string;
  tutorAction: 'accepted' | 'modified';
  responseTimeMs: number;
  contextMessages: string[];
}

export interface ReviewedTutorResponseResult {
  message: Message;
  room: Room;
}

export async function sendReviewedTutorResponse(
  input: ReviewedTutorResponseInput
): Promise<ReviewedTutorResponseResult> {
  if (!input.finalResponse.trim()) {
    throw new Error('Tutor response cannot be empty');
  }

  const { data, error } = await (supabase as any).rpc('send_reviewed_tutor_response', {
    p_room_id: input.roomId,
    p_tutor_id: input.tutorId,
    p_parent_message_id: input.parentMessageId,
    p_content: input.finalResponse.trim(),
    p_raw_mode: input.rawDecision.mode,
    p_mode_reason: input.rawDecision.mode_reason,
    p_final_mode: input.finalMode,
    p_ai_suggestion: input.rawDecision.suggested_response,
    p_tutor_action: input.tutorAction,
    p_response_time_ms: input.responseTimeMs,
    p_context_messages: input.contextMessages
  });

  if (error) {
    throw new Error(`Failed to send reviewed tutor response: ${error.message}`);
  }

  if (!data?.message || !data?.room) {
    throw new Error('Reviewed tutor response did not return message and room state');
  }

  return data as ReviewedTutorResponseResult;
}

export async function setRoomResponseMode(
  roomId: string,
  tutorId: string,
  mode: TutorResponseMode
): Promise<Room> {
  const { data, error } = await supabase
    .from('rooms')
    .update({
      active_response_mode: mode,
      mode_changed_at: new Date().toISOString(),
      mode_change_source: 'manual_override'
    })
    .eq('id', roomId)
    .eq('tutor_id', tutorId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update room response mode: ${error?.message || 'room not found'}`);
  }

  return data as Room;
}
