// Which part of the room list a phone shows: every chat, direct messages,
// rooms, or one space. Remembered on this device only, like Sable's list width.

export type Place =
  | { kind: 'all' }
  | { kind: 'dms' }
  | { kind: 'rooms' }
  | { kind: 'space'; spaceId: string };

const KEY = 'echo-mobile-place';

function isPlace(value: unknown): value is Place {
  if (typeof value !== 'object' || value === null || !('kind' in value)) return false;
  if (value.kind === 'space') return 'spaceId' in value && typeof value.spaceId === 'string';
  return value.kind === 'all' || value.kind === 'dms' || value.kind === 'rooms';
}

export function readPlace(): Place {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (isPlace(stored)) return stored;
  } catch {
    // Private mode or a bad value: start from everything.
  }
  return { kind: 'all' };
}

export function writePlace(place: Place): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(place));
  } catch {
    // Not remembered; the list still switches.
  }
}
