// Purpose: resolve the role, Guard state, and stored character identity into one pure UI profile.

import type { Message, TutorTurnMode, UserRole } from '../types';

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
  message: Pick<Message, 'content' | 'user_role' | 'response_mode' | 'display_name' | 'avatar_url' | 'assessment_event' | 'guard_mode' | 'character' | 'persona_name' | 'persona_avatar'>,
  viewerRole?: string | null
): MessagePresentation {
  const mode: TutorTurnMode = message.response_mode ?? 'tutoring';
  const role = message.user_role as UserRole;
  const isGuard = message.guard_mode ?? mode === 'guard';
  const isAssessment = mode === 'assessment';
  const baseName = message.display_name || roleName(role) || role || 'User';
  const roleIcon = ROLE_ICONS[role] || '👤';
  const roleColor = ROLE_COLORS[role] || '#6b7280';

  if (message.assessment_event) return {
    displayName:'Assessment result',avatarName:'Assessment result',avatarUrl:null,
    body:message.content,roleBadge:null,roleColor:'#6b7280',roleIcon:'✓',isGuard:false,
    isAssessment:false,
  };

  if (message.character && message.persona_name) {
    return {
      displayName: message.persona_name, avatarName: message.persona_name,
      avatarUrl: message.persona_avatar || null, body: message.content,
      roleBadge: viewerRole === 'tutor' ? 'AI character' : null,
      roleColor, roleIcon, isGuard, isAssessment: false,
    };
  }
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
  };
}
