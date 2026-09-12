/**
 * Tests for src/utils/studentAITone.ts
 * Purpose: student AI tone policy — 1:1 room gate, opt-in/apply role flip, tutor lock metadata.
 * Spec: features/student_ai_tone.feature
 */

import {
  countStudentParticipants,
  isStudentToneFeatureAvailable,
  isTutorRoleLocked,
  applyStudentAIChoiceToPromptConfig,
  resolveStudentAIChoice,
  STUDENT_AI_OPTIONS,
} from '../studentAITone';
import type { SystemPromptConfig } from '../../services/prompts/types';
import type { User } from '../../types';

const basePromptConfig = (): SystemPromptConfig => ({
  role: { role: 'high' },
  communication_style: {
    teen_slang: 'low',
    conversational_markers: 'high',
    uncertainty_expression: 'low',
  },
  cognitive_parameters: {
    concept_density: 'low',
    perspective_taking: 'high',
    personal_examples: 'low',
    consequence_highlighting: 'high',
  },
  emotional_parameters: {
    enthusiasm_level: 'low',
    validation_frequency: 'low',
    mistake_normalization: 'high',
    confidence_building: 'high',
  },
  detection_areas: ['Suspicious links'],
  verification_steps: ['Check sender'],
});

const student = (id: string): User =>
  ({
    id,
    display_name: id,
    current_role: 'student',
  }) as User;

const tutor = (id: string): User =>
  ({
    id,
    display_name: id,
    current_role: 'tutor',
  }) as User;

describe('studentAITone policy (features/student_ai_tone.feature)', () => {
  describe('countStudentParticipants', () => {
    it('counts only participants with student role', () => {
      expect(
        countStudentParticipants([tutor('t1'), student('s1'), student('s2')])
      ).toBe(2);
      expect(countStudentParticipants([tutor('t1'), student('s1')])).toBe(1);
      expect(countStudentParticipants([tutor('t1')])).toBe(0);
    });
  });

  describe('isStudentToneFeatureAvailable', () => {
    it('is available only when AI enabled and exactly one student', () => {
      expect(
        isStudentToneFeatureAvailable({ aiEnabled: true, studentCount: 1 })
      ).toBe(true);
    });

    it('is unavailable when AI is disabled', () => {
      expect(
        isStudentToneFeatureAvailable({ aiEnabled: false, studentCount: 1 })
      ).toBe(false);
    });

    it('is unavailable when zero or multiple students (multi-student block)', () => {
      expect(
        isStudentToneFeatureAvailable({ aiEnabled: true, studentCount: 0 })
      ).toBe(false);
      expect(
        isStudentToneFeatureAvailable({ aiEnabled: true, studentCount: 2 })
      ).toBe(false);
    });
  });

  describe('STUDENT_AI_OPTIONS', () => {
    it('exposes Peer, Adult and Multi-agent', () => {
      expect(STUDENT_AI_OPTIONS).toEqual([
        { value: 'peer', label: 'Peer' },
        { value: 'adult', label: 'Adult' },
        { value: 'multi_agent', label: 'Multi-agent' },
      ]);
    });
  });

  describe('resolveStudentAIChoice', () => {
    it('derives Peer/Adult from the role when Multi-agent is not enabled', () => {
      const base = basePromptConfig();
      expect(resolveStudentAIChoice(base)).toBe('adult');
      expect(resolveStudentAIChoice({ ...base, role: { role: 'low' } })).toBe('peer');
      expect(resolveStudentAIChoice(null)).toBe('adult');
    });

    it('reports Multi-agent whenever interaction_mode is multi_agent', () => {
      const base = basePromptConfig();
      expect(
        resolveStudentAIChoice({ ...base, interaction_mode: 'multi_agent' })
      ).toBe('multi_agent');
    });
  });

  describe('applyStudentAIChoiceToPromptConfig', () => {
    it('sets peer role (low), single_agent mode and locks without changing other knobs', () => {
      const base = basePromptConfig();
      const next = applyStudentAIChoiceToPromptConfig(base, 'peer', 'student-1');

      expect(next.role.role).toBe('low');
      expect(next.interaction_mode).toBe('single_agent');
      expect(next.student_tone_lock).toEqual({
        locked: true,
        chosen_by_user_id: 'student-1',
        chosen_role: 'low',
        chosen_choice: 'peer',
      });
      expect(next.communication_style).toEqual(base.communication_style);
      expect(next.cognitive_parameters).toEqual(base.cognitive_parameters);
      expect(next.emotional_parameters).toEqual(base.emotional_parameters);
      expect(next.detection_areas).toEqual(base.detection_areas);
      expect(next.verification_steps).toEqual(base.verification_steps);
    });

    it('sets adult role (high) and locks', () => {
      const base = basePromptConfig();
      base.role = { role: 'low' };
      const next = applyStudentAIChoiceToPromptConfig(base, 'adult', 'student-1');

      expect(next.role.role).toBe('high');
      expect(next.interaction_mode).toBe('single_agent');
      expect(next.student_tone_lock?.locked).toBe(true);
      expect(next.student_tone_lock?.chosen_role).toBe('high');
    });

    it('enables multi_agent while preserving the configured Tutor tone', () => {
      const base = basePromptConfig();
      base.role = { role: 'low' };
      const next = applyStudentAIChoiceToPromptConfig(base, 'multi_agent', 'student-1');

      expect(next.interaction_mode).toBe('multi_agent');
      expect(next.role.role).toBe('low');
      expect(next.student_tone_lock?.chosen_choice).toBe('multi_agent');
      expect(next.student_tone_lock?.chosen_role).toBe('low');
      expect(next.communication_style).toEqual(base.communication_style);
    });

    it('switches back to single_agent when Peer or Adult replaces Multi-agent', () => {
      const multiAgent = applyStudentAIChoiceToPromptConfig(
        basePromptConfig(),
        'multi_agent',
        'student-1'
      );
      const backToPeer = applyStudentAIChoiceToPromptConfig(multiAgent, 'peer', 'student-1');

      expect(backToPeer.interaction_mode).toBe('single_agent');
      expect(backToPeer.role.role).toBe('low');
      expect(backToPeer.student_tone_lock?.chosen_choice).toBe('peer');
    });

    it('builds a minimal config with only role + lock when prior config is null', () => {
      const next = applyStudentAIChoiceToPromptConfig(null, 'peer', 'student-1');
      expect(next.role.role).toBe('low');
      expect(next.student_tone_lock?.locked).toBe(true);
      expect(next.detection_areas).toEqual([]);
      expect(next.verification_steps).toEqual([]);
    });
  });

  describe('isTutorRoleLocked', () => {
    it('is false when no lock metadata', () => {
      expect(isTutorRoleLocked(basePromptConfig())).toBe(false);
      expect(isTutorRoleLocked(null)).toBe(false);
    });

    it('is true when student_tone_lock.locked is true', () => {
      const locked = applyStudentAIChoiceToPromptConfig(
        basePromptConfig(),
        'peer',
        'student-1'
      );
      expect(isTutorRoleLocked(locked)).toBe(true);
    });
  });
});
