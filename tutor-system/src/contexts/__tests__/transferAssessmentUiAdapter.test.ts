#!/usr/bin/env node
/**
 * Contract tests for src/contexts/transferAssessmentUiAdapter.ts, covering the teacher-private
 * versus learner-public projection, required scope identity, and fail-closed behavior.
 *
 * Responsibility: prove the React boundary never retains private assessment material and never
 * invents identity or a public payload it was not given.
 */

import {
  createReviewCandidate,
  mergeRoomMessages,
  projectRoomMessage,
  publicAssessmentForDecision,
  readPublicQuestion,
} from '../transferAssessmentUiAdapter';
import {
  CHECKLIST_ID,
  CHECKLIST_ITEM_ID,
  DELIVERED_QUESTION_ID,
  LEARNER_A_ID,
  LEARNER_A_MESSAGE_ID,
  TRANSFER_ROOM_ID,
  deliveredQuestionRow,
  deliveredQuestionRowWithoutSelectionType,
  learnerAMessageRow,
  learnerBMessageRow,
  preparedCandidate,
  preparedTurnResult,
  preparedTutoringTurnResult,
  rowWithPrivateMaterial,
} from '../../test-support/transferRoomFixtures';
import { expectNoPrivateAssessmentFields } from '../../test-support/transferPrivacyAssertions';
import type { Message } from '../../types';

// The adapter imports component 102's facade, which constructs the Supabase client at module
// load. The transport is never used by these projections, so it is replaced here.
jest.mock('../../services/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() }, from: jest.fn(), channel: jest.fn(), storage: { from: jest.fn() } },
}));

describe('transferAssessmentUiAdapter projections', () => {
  it('projects a delivered question message without the private answer key', () => {
    const view = projectRoomMessage(deliveredQuestionRow);

    expect(view.id).toBe(DELIVERED_QUESTION_ID);
    expect(view.parent_message_id).toBe(LEARNER_A_MESSAGE_ID);
    expect(view.publicQuestion).not.toBeNull();
    expect(view.publicQuestion!.id).toBe(DELIVERED_QUESTION_ID);
    expect(view.publicQuestion!.stem).toBe(deliveredQuestionRow.content);
    expect(view.publicQuestion!.options.map((option) => option.id)).toEqual(['A', 'B', 'C', 'D']);
    expectNoPrivateAssessmentFields(view);
  });

  it('drops every private assessment field a crafted stored row could carry', () => {
    const view = projectRoomMessage(rowWithPrivateMaterial);

    expectNoPrivateAssessmentFields(view);
    expect(JSON.stringify(view)).not.toContain('assessment_key');
  });

  it('leaves an ordinary learner message without a public question', () => {
    const view = projectRoomMessage(learnerAMessageRow);

    expect(view.publicQuestion).toBeNull();
    expect(readPublicQuestion(view as unknown as Message)).toBeNull();
  });

  it('takes the canonical selection type from the persisted row after a reload', () => {
    const view = projectRoomMessage(deliveredQuestionRow);

    expect(view.publicQuestion!.selectionType).toBe('single');
  });

  it('does not invent a selection type for a row delivered before the column existed', () => {
    const view = projectRoomMessage(deliveredQuestionRowWithoutSelectionType);

    expect(view.publicQuestion!.selectionType).toBeNull();
  });

  it('prefers the explicit public projection on the delivery path over the persisted column', () => {
    const view = projectRoomMessage(deliveredQuestionRow, {
      id: DELIVERED_QUESTION_ID,
      selection_type: 'multiple',
      stem: deliveredQuestionRow.content,
      rendered_text: 'rendered',
      options: deliveredQuestionRow.assessment_options as never,
    });

    expect(view.publicQuestion!.selectionType).toBe('multiple');
  });

  it('fails closed instead of returning a partial question for a malformed option set', () => {
    const view = projectRoomMessage({
      ...deliveredQuestionRow,
      assessment_options: [{ id: 'A', text: 'only one' }],
    });

    expect(view.publicQuestion).toBeNull();
  });

  it('keeps the prepared scope identity and the null item id for a tutoring turn', () => {
    const candidate = createReviewCandidate(preparedTurnResult);
    const tutoring = createReviewCandidate(preparedTutoringTurnResult);

    expect(candidate).not.toBeNull();
    expect(candidate!.scope).toEqual({
      roomId: TRANSFER_ROOM_ID,
      studentId: LEARNER_A_ID,
      checklistId: CHECKLIST_ID,
      itemId: CHECKLIST_ITEM_ID,
      focusStudentMessageId: LEARNER_A_MESSAGE_ID,
    });
    expect(tutoring!.scope.itemId).toBeNull();
    expect(tutoring!.scope.itemId).not.toBe('null');
  });

  it('fails closed when the preparation result is missing required identity', () => {
    const { student_id, ...withoutStudent } = preparedTurnResult as Record<string, unknown>;

    expect(student_id).toBe(LEARNER_A_ID);
    expect(createReviewCandidate(withoutStudent)).toBeNull();
    expect(createReviewCandidate({})).toBeNull();
  });

  it('projection of the reviewed decision is public-only and carries no key', () => {
    const projection = publicAssessmentForDecision(preparedCandidate, DELIVERED_QUESTION_ID);

    expect(projection).not.toBeNull();
    expect(projection!.id).toBe(DELIVERED_QUESTION_ID);
    expect(projection!.options).toHaveLength(4);
    expectNoPrivateAssessmentFields(projection);
  });

  it('merges persisted messages by stable identity and keeps chronological order', () => {
    const first = projectRoomMessage(learnerAMessageRow);
    const second = projectRoomMessage(learnerBMessageRow);
    const corrected = { ...first, content: 'edited content' };
    const late = projectRoomMessage({
      ...learnerBMessageRow,
      id: LEARNER_A_MESSAGE_ID,
      content: 'from the realtime channel',
      created_at: '2026-09-12T08:59:00Z',
    });

    const merged = mergeRoomMessages([first], [second]);
    expect(merged.map((message) => message.id)).toEqual([learnerBMessageRow.id, LEARNER_A_MESSAGE_ID]);

    const deduped = mergeRoomMessages([first], [late]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].content).toBe('from the realtime channel');

    const replaced = mergeRoomMessages([first, second], [corrected]);
    expect(replaced).toHaveLength(2);
    expect(replaced.find((message) => message.id === LEARNER_A_MESSAGE_ID)!.content).toBe('edited content');
  });

  it('keeps pre-populated messages first and does not drop a realtime message the fetch does not know', () => {
    const prepopulated = {
      ...projectRoomMessage(learnerAMessageRow),
      id: 'prepop-room-0',
      user_id: 'system',
      content: 'scripted line',
      created_at: '2026-09-12T08:00:01Z',
    } as Message;
    const realtimeOnly = projectRoomMessage(learnerBMessageRow);

    const merged = mergeRoomMessages([prepopulated, realtimeOnly], [projectRoomMessage(learnerAMessageRow)]);

    expect(merged.map((message) => message.id)).toEqual([
      'prepop-room-0',
      learnerBMessageRow.id,
      LEARNER_A_MESSAGE_ID,
    ]);
  });
});
