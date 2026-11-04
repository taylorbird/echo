// What a phone's room list shows: a place, picked in the space drawer
// (SpaceDrawer.svelte) as on the desktop's rail, and a filter, picked by the
// chips under the title as the desktop rail's sub-filters (SPEC §3.5).
// Remembered on this device only, like Sable's list width.

export type Place = { kind: 'home' } | { kind: 'space'; spaceId: string };

/** All chats in sections, rooms only, direct messages only, or one list newest first. */
export type Filter = 'all' | 'rooms' | 'dms' | 'recent';

export const FILTERS: readonly Filter[] = ['all', 'rooms', 'dms', 'recent'];

const PLACE_KEY = 'echo-mobile-place';
const FILTER_KEY = 'echo-mobile-filter';

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

function isFilter(value: unknown): value is Filter {
  return typeof value === 'string' && (FILTERS as readonly string[]).includes(value);
}

export function readPlace(): Place {
  const stored = read(PLACE_KEY);
  if (typeof stored === 'object' && stored !== null && 'kind' in stored) {
    if (stored.kind === 'space' && 'spaceId' in stored && typeof stored.spaceId === 'string') {
      return { kind: 'space', spaceId: stored.spaceId };
    }
  }
  // Home, and the older 'all', 'dms' and 'rooms' places (now Home with a filter).
  return { kind: 'home' };
}

export function writePlace(place: Place): void {
  write(PLACE_KEY, place);
}

export function readFilter(): Filter {
  const stored = read(FILTER_KEY);
  if (isFilter(stored)) return stored;
  // A place stored before filters existed carries its filter in its kind.
  const place = read(PLACE_KEY);
  if (typeof place === 'object' && place !== null && 'kind' in place) {
    if (place.kind === 'dms') return 'dms';
    if (place.kind === 'rooms') return 'rooms';
  }
  return 'all';
}

export function writeFilter(filter: Filter): void {
  write(FILTER_KEY, filter);
}
