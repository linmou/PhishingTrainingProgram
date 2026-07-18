/**
 * Tests for src/utils/studentAITone.ts
 * Purpose: student AI tone policy — 1:1 room gate, opt-in/apply role flip, tutor lock metadata.
 * Spec: features/student_ai_tone.feature
 */

import {
  countStudentParticipants,
  isStudentToneFeatureAvailable,
  isTutorRoleLocked,
  applyStudentToneToPromptConfig,
  STUDENT_TONE_OPTIONS,
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

  describe('STUDENT_TONE_OPTIONS', () => {
    it('exposes only Peer and Adult', () => {
      expect(STUDENT_TONE_OPTIONS).toEqual([
        { value: 'peer', label: 'Peer' },
        { value: 'adult', label: 'Adult' },
      ]);
    });
  });

  describe('applyStudentToneToPromptConfig', () => {
    it('sets peer role (low) and locks without changing other knobs', () => {
      const base = basePromptConfig();
      const next = applyStudentToneToPromptConfig(base, 'peer', 'student-1');

      expect(next.role.role).toBe('low');
      expect(next.student_tone_lock).toEqual({
        locked: true,
        chosen_by_user_id: 'student-1',
        chosen_role: 'low',
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
      const next = applyStudentToneToPromptConfig(base, 'adult', 'student-1');

      expect(next.role.role).toBe('high');
      expect(next.student_tone_lock?.locked).toBe(true);
      expect(next.student_tone_lock?.chosen_role).toBe('high');
    });

    it('builds a minimal config with only role + lock when prior config is null', () => {
      const next = applyStudentToneToPromptConfig(null, 'peer', 'student-1');
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
      const locked = applyStudentToneToPromptConfig(
        basePromptConfig(),
        'peer',
        'student-1'
      );
      expect(isTutorRoleLocked(locked)).toBe(true);
    });
  });
});
