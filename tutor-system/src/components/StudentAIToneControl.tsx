/**
 * Student opt-in control for AI role (peer vs adult).
 * Purpose: "Choose AI role?" → dropdown; 1:1 AI-enabled rooms only.
 */

import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import {
  countStudentParticipants,
  isStudentToneFeatureAvailable,
  isTutorRoleLocked,
  roleIntensityToTone,
  STUDENT_TONE_OPTIONS,
  type StudentToneValue,
} from '../utils/studentAITone';

const StudentAIToneControl: React.FC = () => {
  const { user } = useAuth();
  const { currentRoom, participants, aiConfig, setStudentAITone, loadingAI } = useRoom();
  const [optedIn, setOptedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const locked = isTutorRoleLocked(aiConfig?.prompt_config);
  const studentCount = useMemo(
    () => countStudentParticipants(participants || []),
    [participants]
  );
  const available = isStudentToneFeatureAvailable({
    aiEnabled: Boolean(currentRoom?.ai_assistant_enabled),
    studentCount,
  });

  if (!user || user.current_role !== 'student' || !available) {
    return null;
  }

  const showDropdown = optedIn || locked;
  const selectedTone: StudentToneValue | '' = locked
    ? roleIntensityToTone(aiConfig?.prompt_config?.role?.role)
    : '';

  const handleSelect = async (tone: StudentToneValue | '') => {
    if (!tone) return;
    setError(null);
    setSaving(true);
    try {
      await setStudentAITone(tone);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set AI role';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="student-ai-tone-control" data-testid="student-ai-tone-control">
      {!showDropdown ? (
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => setOptedIn(true)}
          disabled={loadingAI || saving}
        >
          Choose AI role?
        </button>
      ) : (
        <label className="student-ai-tone-label">
          <span className="student-ai-tone-label-text">AI role</span>
          <select
            aria-label="AI role"
            value={selectedTone}
            disabled={loadingAI || saving}
            onChange={(e) => handleSelect(e.target.value as StudentToneValue)}
            className="ai-setting-select"
          >
            <option value="" disabled>
              Select role
            </option>
            {STUDENT_TONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p className="student-ai-tone-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default StudentAIToneControl;
