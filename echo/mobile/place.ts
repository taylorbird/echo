// What a phone's room list shows: a place, Home, the rooms outside spaces or a
// space, picked in the space drawer or strip (SpaceTiles.svelte) as on the
// desktop's rail, and the place's sub-filter, picked on its band in the drawer
// (PlaceBand.svelte) as on the desktop's parted rail (SPEC §3.5). The place is
// remembered on this device only, like Sable's list width; the filter starts
// at All chats with each new place, as on the desktop.

export type Place = { kind: 'home' } | { kind: 'unspaced' } | { kind: 'space'; spaceId: string };

export type Filter = 'all' | 'rooms' | 'dms' | 'recent';

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
    if (stored.kind === 'unspaced') return { kind: 'unspaced' };
  }
  // Home, and the older 'all', 'dms' and 'rooms' places.
  return { kind: 'home' };
}

export function writePlace(place: Place): void {
  write(PLACE_KEY, place);
}

export function samePlace(left: Place, right: Place): boolean {
  if (left.kind === 'space' && right.kind === 'space') return left.spaceId === right.spaceId;
  return left.kind === right.kind;
}
