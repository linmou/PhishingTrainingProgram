// Purpose: hold this tab's signed-in application user for trusted API requests.
// AuthContext is the only writer. Storage is shared across tabs, so requests must not read it at send time.

let currentApplicationUserId: string | null = null;

export function setApplicationUserId(userId: string | null): void {
  currentApplicationUserId = userId;
}

export function getApplicationUserId(): string | null {
  return currentApplicationUserId;
}
