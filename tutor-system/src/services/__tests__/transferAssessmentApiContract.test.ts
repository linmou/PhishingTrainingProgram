// Test responsibility: freeze the six-operation API envelope and public/private DTO boundary.

import fs from 'fs';
import path from 'path';
import {
  ASSESSMENT_API_ERROR_STATUS,
  ASSESSMENT_API_OPERATIONS,
  ASSESSMENT_PRIVATE_FIELD_NAMES,
  PUBLIC_ASSESSMENT_DTO_KEYS,
  errorEnvelope,
  isAssessmentApiOperation,
  projectPublicPayload,
  successEnvelope,
} from '../../types/assessmentApi';
import { TransferAssessmentService, type ProcessedMessageDTO } from '../transferAssessmentService';

describe('assessment API contract', () => {
  it('keeps exactly six stable operations and versioned envelopes', () => {
    expect(ASSESSMENT_API_OPERATIONS).toEqual([
      'initialize_checklist', 'post_message', 'analyze_message',
      'prepare_turn', 'send_reviewed', 'process_message',
    ]);
    expect(new Set(ASSESSMENT_API_OPERATIONS).size).toBe(6);
    ASSESSMENT_API_OPERATIONS.forEach((operation) => expect(isAssessmentApiOperation(operation)).toBe(true));
    expect(isAssessmentApiOperation('grade_locally')).toBe(false);
    expect(successEnvelope({ id: 'x' })).toEqual({ ok: true, data: { id: 'x' } });
    expect(errorEnvelope('INVALID_SCOPE', 'scope mismatch')).toEqual({
      ok: false,
      error: { code: 'INVALID_SCOPE', message: 'scope mismatch', retryable: false },
    });
  });

  it('defines all stable failure classes', () => {
    for (const code of [
      'AUTHORIZATION_NOT_CONFIGURED', 'UNAUTHORIZED', 'FORBIDDEN',
      'ASSESSMENT_FEATURE_DISABLED', 'LEGACY_CHECKLIST', 'LEGACY_ASSESSMENT_INCOMPLETE',
      'UNSUPPORTED_ROOM_SCOPE', 'ASSESSMENT_ALREADY_OPEN', 'ASSESSMENT_TERMINAL',
      'INVALID_SCOPE', 'WRONG_LEARNER', 'ITEM_VALIDATION_FAILED',
      'AI_PROVIDER_NOT_CONFIGURED', 'AI_PROVIDER_ERROR', 'AI_OUTPUT_TRUNCATED',
      'AI_OUTPUT_INVALID', 'PROGRESSION_LOCKED', 'PERSISTENCE_FAILED',
    ]) expect(ASSESSMENT_API_ERROR_STATUS[code]).toBeDefined();
  });

  it('projects an assessment to exactly id, student_id, selection_type, stem, and options', () => {
    const result = TransferAssessmentService.toPublicAssessment({
      id: 'assessment-1',
      student_id: 'learner-1',
      selection_type: 'single',
      stem: 'Which action is safest?',
      rendered_text: 'private duplicate rendering',
      options: [
        { id: 'A', text: 'Open it' },
        { id: 'B', text: 'Verify elsewhere' },
        { id: 'C', text: 'Forward it' },
        { id: 'D', text: 'Reply' },
      ],
      correct_option_ids: ['B'],
      learner_safe_explanation: 'Verify through a known channel.',
      transfer_basis: { concept_rule: 'verify', source_context: 'x', changed_context: 'y', source_evidence_message_ids: ['m1'] },
    });

    expect(Object.keys(result)).toEqual(PUBLIC_ASSESSMENT_DTO_KEYS);
    expect(result.student_id).toBe('learner-1');
    expect(JSON.stringify(result)).not.toContain('rendered_text');
    expect(JSON.stringify(result)).not.toContain('learner_safe_explanation');
  });

  it('rejects a missing target instead of inferring learner identity', () => {
    expect(() => TransferAssessmentService.toPublicAssessment({
      id: 'assessment-1', selection_type: 'single', stem: 'Question',
      options: [{ id: 'A', text: 'One' }],
    })).toThrow('INVALID_SCOPE');
  });

  it('prunes rendered and private fields recursively from generic public payloads', () => {
    const projected = projectPublicPayload({
      safe: true,
      rendered_text: 'forbidden',
      nested: {
        correct_option_ids: ['B'],
        learner_safe_explanation: 'private except terminal failure',
        raw_provider_output: 'private',
      },
    });
    expect(projected).toEqual({ safe: true, nested: {} });
    expect(ASSESSMENT_PRIVATE_FIELD_NAMES).toEqual(expect.arrayContaining([
      'rendered_text', 'correct_option_ids', 'learner_safe_explanation', 'raw_provider_output',
    ]));
  });

  it('keeps the canonical processed-message DTO field set unchanged', () => {
    const dto: ProcessedMessageDTO = {
      message_id: 'answer-1',
      assessment_id: 'assessment-1',
      processing_state: 'applied',
      answer_outcome: 'failed',
      attempt_number: 2,
      attempts_used: 2,
      attempts_remaining: 0,
      selected_option_ids: ['A'],
      terminal: true,
      transition: { disposition: 'applied' },
      feedback_required: true,
      code: null,
      already_processed: false,
      terminal_failure_feedback: {
        correct_option_ids: ['B'],
        learner_safe_explanation: 'Verify via the official channel.',
      },
    };
    expect(Object.keys(dto)).toEqual([
      'message_id', 'assessment_id', 'processing_state', 'answer_outcome', 'attempt_number',
      'attempts_used', 'attempts_remaining', 'selected_option_ids', 'terminal', 'transition',
      'feedback_required', 'code', 'already_processed', 'terminal_failure_feedback',
    ]);
  });

  it('keeps production grading and provider configuration in the trusted handler', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/assessment-api/index.ts'),
      'utf8'
    );
    expect(source).toContain("resolveTransferAnswer } from '../../../src/services/transferAssessmentOrchestrator.ts'");
    expect(source).toContain("deps.env('OAI_API_KEY')");
    expect(source).toContain("deps.env('OAI_BASE_URL')");
    expect(source).toContain("deps.env('OAI_MODEL')");
    expect(source).toContain("const PROVIDER_MODEL = 'qwen3.5-flash'");
    expect(source).toContain('p_expected_attempt_count');
    expect(source).toContain("committed.code === 'CONCURRENT_MODIFICATION'");
    expect(source).not.toContain('REACT_APP_OAI');
  });
});
