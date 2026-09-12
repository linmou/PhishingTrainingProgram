#!/usr/bin/env node
/**
 * Test responsible for src/contexts/roomExportBuilder.ts on the transfer-assessment path: a role
 * scoped export of a room that contains a delivered question.
 *
 * Responsibility: prove the learner export renders the public question (stem, instruction,
 * options) while no export of any role carries the assessment key, transfer basis, or teacher-only
 * assessment material.
 */

import { buildRoomExportData, buildRoomTextExport } from '../roomExportBuilder';
import { projectRoomMessage } from '../transferAssessmentUiAdapter';
import {
  TRANSFER_ROOM_ID,
  deliveredPublicAssessment,
  deliveredQuestionRow,
  learnerAMessageRow,
  transferRoom,
} from '../../test-support/transferRoomFixtures';
import {
  expectNoPrivateAssessmentFields,
  expectSerializedWithoutPrivateFields,
} from '../../test-support/transferPrivacyAssertions';
import type { Message } from '../../types';

const questionMessage = projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment) as unknown as Message;
const ordinaryMessage = projectRoomMessage(learnerAMessageRow) as unknown as Message;

const buildExport = (isTutor: boolean) => ({
  room: transferRoom,
  messages: [ordinaryMessage, questionMessage],
  messageFeedbackStats: {},
  feedbackSummary: null,
  aiInteractions: [],
  isTutor,
});

describe('roomExportBuilder transfer assessment projections', () => {
  it('renders the public question in the learner text export', () => {
    const text = buildRoomTextExport(buildExport(false));

    expect(text).toContain(deliveredQuestionRow.content);
    expect(text).toContain('Choose one.');
    expect(text).toContain('B. Stop and verify the offer through an official channel.');
    expect(text).not.toContain('assessment_key');
  });

  it('renders the public question in the teacher text export too', () => {
    const text = buildRoomTextExport(buildExport(true));

    expect(text).toContain('A. Pay the fee quickly.');
    expect(text).not.toContain('assessment_key');
  });

  it('keeps every private assessment field out of the learner JSON export', () => {
    const data = buildRoomExportData(buildExport(false) as never);

    expectNoPrivateAssessmentFields(data);
    expectSerializedWithoutPrivateFields(data);
  });

  it('keeps every private assessment field out of the teacher JSON export', () => {
    const data = buildRoomExportData(buildExport(true) as never);

    expectNoPrivateAssessmentFields(data);
    expectSerializedWithoutPrivateFields(data);
  });

  it('still separates teacher-only interaction metadata from the learner projection', () => {
    const learner = buildRoomExportData(buildExport(false) as never);
    const teacher = buildRoomExportData(buildExport(true) as never);

    expect(learner).not.toHaveProperty('ai_interactions');
    expect(teacher).toHaveProperty('ai_interactions');
    expect(transferRoom.id).toBe(TRANSFER_ROOM_ID);
  });
});
