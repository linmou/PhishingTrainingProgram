// Observer handoff is tab-local and consumed when the room page opens.
export function markRoomObserver(roomId: string): void {
  window.sessionStorage.setItem(`room-observer:${roomId}`, 'true');
}

export function isRoomObserver(roomId: string): boolean {
  return window.sessionStorage.getItem(`room-observer:${roomId}`) === 'true';
}

export function clearRoomObserver(roomId: string): void {
  window.sessionStorage.removeItem(`room-observer:${roomId}`);
}
