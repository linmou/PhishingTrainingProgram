// Purpose: resolve the role, response mode, and optional Multi-agent tag into one pure UI profile.

import type { Message, TutorTurnMode, UserRole } from '../types';
import { decodeAgentMessage } from '../services/tutorDecisionContract';

export interface MessagePresentation {
  displayName: string;
  avatarName: string;
  avatarUrl: string | null;
  body: string;
  roleBadge: string | null;
  roleColor: string;
  roleIcon: string;
  isGuard: boolean;
  isAssessment: boolean;
  isMultiagent: boolean;
  agentCharacter: 'riley' | 'tutor' | null;
}

const ROLE_COLORS: Record<UserRole, string> = {
  tutor: '#3b82f6',
  student: '#10b981',
  observer: '#6b7280',
};

const ROLE_ICONS: Record<UserRole, string> = {
  tutor: '👨‍🏫',
  student: '👨‍🎓',
  observer: '👁️',
};

const roleName = (role: UserRole): string => role === 'tutor' ? 'Tutor' : role === 'student' ? 'Student' : 'Observer';

/** Resolve presentation without consulting room state or inferring AI authorship. */
export function resolveMessagePresentation(
  message: Pick<Message, 'content' | 'user_role' | 'response_mode' | 'display_name' | 'avatar_url'>,
  viewerRole?: string | null
): MessagePresentation {
  const mode: TutorTurnMode = message.response_mode ?? 'tutoring';
  const role = message.user_role as UserRole;
  const isGuard = mode === 'guard';
  const isAssessment = mode === 'assessment';
  const isMultiagent = mode === 'multiagent' && message.user_role === 'tutor';
  const agent = isMultiagent ? decodeAgentMessage(message) : null;
  const baseName = message.display_name || roleName(role) || role || 'User';
  const roleIcon = ROLE_ICONS[role] || '👤';
  const roleColor = ROLE_COLORS[role] || '#6b7280';

  if (isGuard) {
    return {
      displayName: 'Security Supervisor',
      avatarName: 'Security Supervisor',
      avatarUrl: null,
      body: message.content,
      roleBadge: null,
      roleColor: '#b91c1c',
      roleIcon: '🛡️',
      isGuard: true,
      isAssessment,
      isMultiagent: false,
      agentCharacter: null,
    };
  }

  if (agent) {
    const isRiley = agent.character === 'riley';
    const characterName = isRiley ? 'Riley' : baseName;
    return {
      displayName: characterName,
      avatarName: characterName,
      avatarUrl: isRiley ? null : message.avatar_url || null,
      body: agent.content,
      roleBadge: viewerRole === 'student' ? null : `${ROLE_ICONS.tutor} AI chatbot`,
      roleColor: isRiley ? '#d97706' : ROLE_COLORS.tutor,
      roleIcon: isRiley ? '🧑‍💼' : ROLE_ICONS.tutor,
      isGuard: false,
      isAssessment: false,
      isMultiagent: true,
      agentCharacter: agent.character,
    };
  }

  return {
    displayName: baseName,
    avatarName: baseName,
    avatarUrl: message.avatar_url || null,
    body: message.content,
    roleBadge: viewerRole === 'student'
      ? null
      : role === 'tutor'
        ? `${ROLE_ICONS.tutor} AI chatbot`
        : `${roleIcon} ${role}`,
    roleColor,
    roleIcon,
    isGuard: false,
    isAssessment,
    isMultiagent: false,
    agentCharacter: null,
  };
}
