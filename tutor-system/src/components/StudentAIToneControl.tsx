/**
 * Student opt-in control for the AI interaction choice (Peer / Adult / Multi-agent).
 * Purpose: "Choose AI role?" → dropdown; single-student AI-enabled rooms only.
 */

import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import {
  countStudentParticipants,
  isStudentToneFeatureAvailable,
  isTutorRoleLocked,
  resolveStudentAIChoice,
  STUDENT_AI_OPTIONS,
  type StudentAIChoice,
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
  const selectedChoice: StudentAIChoice | '' = locked
    ? resolveStudentAIChoice(aiConfig?.prompt_config)
    : '';

  const handleSelect = async (choice: StudentAIChoice | '') => {
    if (!choice) return;
    setError(null);
    setSaving(true);
    try {
      await setStudentAITone(choice);
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
            value={selectedChoice}
            disabled={loadingAI || saving}
            onChange={(e) => handleSelect(e.target.value as StudentAIChoice)}
            className="ai-setting-select"
          >
            <option value="" disabled>
              Select role
            </option>
            {STUDENT_AI_OPTIONS.map((opt) => (
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
