#!/usr/bin/env node
/**
 * Fixtures for the transfer-assessment room UI tests: one room with two learners, persisted
 * message rows (including a delivered question with a private assessment_key), a prepared
 * review candidate, and the delivered/processed results component 102 returns.
 *
 * Responsibility: give every 103 test the same stable IDs and the same private material that
 * must never reach learner-facing state.
 */

import type { Message, Room, User } from '../types';
import type { TutorDecisionV3 } from '../types/assessment';
import type { PublicAssessmentDTO, PublicMessageDTO, ReviewedDeliveryDTO } from '../services/transferAssessmentService';

export const TRANSFER_ROOM_ID = '11111111-1111-4111-8111-111111111111';
export const TUTOR_ID = '22222222-2222-4222-8222-222222222222';
export const LEARNER_A_ID = '33333333-3333-4333-8333-333333333333';
export const LEARNER_B_ID = '44444444-4444-4444-8444-444444444444';
export const OBSERVER_ID = '55555555-5555-4555-8555-555555555555';
export const LEARNER_A_MESSAGE_ID = '66666666-6666-4666-8666-666666666666';
export const LEARNER_B_MESSAGE_ID = '77777777-7777-4777-8777-777777777777';
export const DELIVERED_QUESTION_ID = '88888888-8888-4888-8888-888888888888';
export const DELIVERED_ANSWER_ID = '99999999-9999-4999-8999-999999999999';
export const CHECKLIST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const CHECKLIST_ITEM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** The private answer key. It lives on public.messages by recorded owner tradeoff and must never be retained. */
export const PRIVATE_ASSESSMENT_KEY = ['B'];

export const tutorUser: User = {
  id: TUTOR_ID,
  email: 'tutor@example.com',
  display_name: 'Tutor',
  current_role: 'tutor',
  status: 'active',
  created_at: '2026-09-12T08:00:00Z',
  updated_at: '2026-09-12T08:00:00Z',
};

export const learnerAUser: User = {
  id: LEARNER_A_ID,
  email: 'learner-a@example.com',
  display_name: 'Learner A',
  current_role: 'student',
  status: 'active',
  created_at: '2026-09-12T08:00:00Z',
  updated_at: '2026-09-12T08:00:00Z',
};

export const learnerBUser: User = {
  ...learnerAUser,
  id: LEARNER_B_ID,
  email: 'learner-b@example.com',
  display_name: 'Learner B',
};

export const observerUser: User = {
  ...learnerAUser,
  id: OBSERVER_ID,
  email: 'observer@example.com',
  display_name: 'Observer',
  current_role: 'observer',
};

export const transferRoom: Room = {
  id: TRANSFER_ROOM_ID,
  tutor_id: TUTOR_ID,
  title: 'Transfer room',
  description: 'Room with a transfer-policy checklist',
  image_url: null,
  is_active: true,
  ai_assistant_enabled: true,
  ai_assistant_model: 'qwen3.5-flash',
  ai_assistant_prompt: 'Scenario prompt',
  op_id: null,
  op_display_name: null,
  op_avatar_url: null,
  password: null,
  pre_populated_dialogue: null,
  active_response_mode: 'tutoring',
  mode_changed_at: '2026-09-12T08:00:00Z',
  mode_change_source: 'reviewed_response',
  created_at: '2026-09-12T08:00:00Z',
  updated_at: '2026-09-12T08:00:00Z',
} as Room;

/** A learner message the teacher can focus on. */
export const learnerAMessageRow = {
  id: LEARNER_A_MESSAGE_ID,
  room_id: TRANSFER_ROOM_ID,
  user_id: LEARNER_A_ID,
  content: 'Someone asked me to pay with a gift card.',
  user_role: 'student',
  is_ai_generated: false,
  ai_model_used: null,
  ai_response_time_ms: null,
  parent_message_id: null,
  response_mode: null,
  // Later than learner B's message: the room's latest student message is learner A's.
  created_at: '2026-09-12T09:06:00Z',
};

export const learnerBMessageRow = {
  ...learnerAMessageRow,
  id: LEARNER_B_MESSAGE_ID,
  user_id: LEARNER_B_ID,
  content: 'My cousin sent me a link.',
  created_at: '2026-09-12T09:05:00Z',
};

/** The delivered question row as a raw `select('*')` returns it, including the private key. */
export const deliveredQuestionRow = {
  id: DELIVERED_QUESTION_ID,
  room_id: TRANSFER_ROOM_ID,
  user_id: TUTOR_ID,
  content: 'A stranger asks you to pay a fee to release a prize. What is the safest first step?',
  user_role: 'tutor',
  is_ai_generated: true,
  ai_model_used: 'qwen3.5-flash',
  ai_response_time_ms: 1200,
  parent_message_id: LEARNER_A_MESSAGE_ID,
  response_mode: 'assessment',
  created_at: '2026-09-12T09:10:00Z',
  assessment_options: [
    { id: 'A', text: 'Pay the fee quickly.' },
    { id: 'B', text: 'Stop and verify the offer through an official channel.' },
    { id: 'C', text: 'Forward the offer to a friend.' },
    { id: 'D', text: 'Reply with your bank details.' },
  ],
  assessment_key: PRIVATE_ASSESSMENT_KEY,
  assessment_lifecycle: 'delivered',
  assessment_checklist_id: CHECKLIST_ID,
  assessment_item_id: CHECKLIST_ITEM_ID,
  // Persisted by migration 045. Null on rows delivered before it ran.
  assessment_selection_type: 'single',
};

/** The same delivered row as a pre-045 assessment: the selection type column is null. */
export const deliveredQuestionRowWithoutSelectionType = {
  ...deliveredQuestionRow,
  assessment_selection_type: null,
};

export const deliveredPublicAssessment: PublicAssessmentDTO = {
  id: DELIVERED_QUESTION_ID,
  selection_type: 'single',
  stem: deliveredQuestionRow.content,
  rendered_text: [
    deliveredQuestionRow.content,
    'Choose one.',
    'A. Pay the fee quickly.',
    'B. Stop and verify the offer through an official channel.',
    'C. Forward the offer to a friend.',
    'D. Reply with your bank details.',
  ].join('\n'),
  options: deliveredQuestionRow.assessment_options as PublicAssessmentDTO['options'],
};

export const deliveredPublicMessage: PublicMessageDTO = {
  id: DELIVERED_QUESTION_ID,
  room_id: TRANSFER_ROOM_ID,
  user_id: TUTOR_ID,
  content: deliveredQuestionRow.content,
  user_role: 'tutor',
  is_ai_generated: true,
  parent_message_id: LEARNER_A_MESSAGE_ID,
  response_mode: 'assessment',
  created_at: deliveredQuestionRow.created_at,
};

export const reviewedDelivery: ReviewedDeliveryDTO = {
  message: deliveredPublicMessage,
  room: { ...transferRoom, active_response_mode: 'tutoring' },
};

/** Candidate decision returned by prepareTurn for learner A, including the private key. */
export const preparedCandidate: TutorDecisionV3 = {
  reason: 'The learner reports a payment request under pressure.',
  decision: {
    mode: 'assessment',
    instruction: 'transfer_assess',
    target_item_id: CHECKLIST_ITEM_ID,
  },
  response: deliveredQuestionRow.content,
  assessment: {
    stem: deliveredQuestionRow.content,
    rendered_text: deliveredPublicAssessment.rendered_text,
    selection_type: 'single',
    options: deliveredQuestionRow.assessment_options as NonNullable<TutorDecisionV3['assessment']>['options'],
    correct_option_ids: ['B'],
    transfer_basis: {
      concept_rule: 'Verify unexpected payment requests through an official channel.',
      source_context: 'Gift-card payment request',
      changed_context: 'Prize release fee',
      source_evidence_message_ids: [LEARNER_A_MESSAGE_ID],
    },
  },
};

/** The prepareTurn result record component 102 returns, with the item id as the server sends it. */
export const preparedTurnResult = {
  decision: preparedCandidate,
  progress_snapshot_hash: 'snapshot-hash-abc',
  room_id: TRANSFER_ROOM_ID,
  student_id: LEARNER_A_ID,
  checklist_id: CHECKLIST_ID,
  item_id: CHECKLIST_ITEM_ID,
  focus_student_message_id: LEARNER_A_MESSAGE_ID,
};

/** Same shape for a tutoring turn: no checklist item, and the id must stay null rather than "null". */
export const preparedTutoringTurnResult = {
  ...preparedTurnResult,
  decision: {
    ...preparedCandidate,
    decision: { mode: 'tutoring', instruction: 'scaffolding', target_item_id: null },
    assessment: null,
  },
  item_id: null,
};

export const transferChecklist = {
  id: CHECKLIST_ID,
  room_id: TRANSFER_ROOM_ID,
  student_id: LEARNER_A_ID,
  template_name: 'transfer',
  progress_policy_version: 'transfer_v1',
  is_active: true,
  created_at: '2026-09-12T08:30:00Z',
  updated_at: '2026-09-12T08:30:00Z',
  items: [
    {
      id: CHECKLIST_ITEM_ID,
      checklist_id: CHECKLIST_ID,
      area_text: 'Verify payment requests',
      priority: 'critical',
      status: 'partially_covered',
      understanding_level: 'basic',
      created_at: '2026-09-12T08:30:00Z',
      updated_at: '2026-09-12T08:30:00Z',
    },
  ],
};

/** A stored learner answer row, as the server-authoritative processing path produced it. */
export const deliveredAnswerRow: Message = {
  id: DELIVERED_ANSWER_ID,
  room_id: TRANSFER_ROOM_ID,
  user_id: LEARNER_A_ID,
  content: 'B',
  user_role: 'student',
  is_ai_generated: false,
  ai_model_used: null,
  ai_response_time_ms: null,
  parent_message_id: DELIVERED_QUESTION_ID,
  created_at: '2026-09-12T09:15:00Z',
  response_mode: null,
};

/**
 * A stored message row that carries private assessment material the browser must drop.
 * Used by the privacy helper and by the projection tests.
 */
export const rowWithPrivateMaterial = {
  ...deliveredQuestionRow,
  transfer_basis: { concept_rule: 'secret' },
  private_payload: { correct_option_ids: ['B'] },
  private_payload_hash: 'private-hash',
  public_payload_hash: 'public-hash',
  raw_model_output: '{"decision":{"mode":"assessment"}}',
  reviewed_payload: { response: 'secret' },
  source_transfer_basis: 'secret',
  teacher_confirmation_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
};
