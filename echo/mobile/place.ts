// What a phone's room list shows: a place, Home or a space, picked in the
// space strip (SpaceTiles.svelte) as on the desktop's rail. Remembered on this
// device only, like Sable's list width.

export type Place = { kind: 'home' } | { kind: 'space'; spaceId: string };

const PLACE_KEY = 'echo-mobile-place';

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    // Private mode or a bad value: the default.
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not remembered; the list still switches.
  }
}

export function readPlace(): Place {
  const stored = read(PLACE_KEY);
  if (typeof stored === 'object' && stored !== null && 'kind' in stored) {
    if (stored.kind === 'space' && 'spaceId' in stored && typeof stored.spaceId === 'string') {
      return { kind: 'space', spaceId: stored.spaceId };
    }
  }
  // Home, and the older 'all', 'dms' and 'rooms' places.
  return { kind: 'home' };
}

export function writePlace(place: Place): void {
  write(PLACE_KEY, place);
}
