// What the phone's places list and how a sub-filter splits it, as the
// desktop's do (echo/places.ts, echo/space-dms.ts, SPEC §3.5 and §4.2):
// - Home lists every chat;
// - the rooms outside spaces list the rooms no space holds, and every DM;
// - a space lists its rooms and the DMs whose other person is in it.
// All chats groups Rooms over Direct messages; Rooms and Direct messages keep
// their one section; Recent is one headerless list. Newest first throughout.

import type { RoomListItemView } from '#src/generated/protocol';
import type { Filter } from './place.js';

/** Whether a joined space holds the room as a child (Sable's rooms outside spaces). */
export function inSomeSpace(rooms: readonly RoomListItemView[], roomId: string): boolean {
  return rooms.some(
    (space) =>
      space.room_kind === 'space' &&
      space.state === 'joined' &&
      !space.is_tombstoned &&
      space.space_children.some((child) => child.room_id === roomId)
  );
}

export function newestFirst(rooms: readonly RoomListItemView[]): RoomListItemView[] {
  return [...rooms].sort(
    (left, right) => (right.latest_event?.timestamp ?? 0) - (left.latest_event?.timestamp ?? 0)
  );
}

export interface ListSection {
  key: 'rooms' | 'dms' | 'recent';
  /** Null for Recent's headerless list. */
  label: string | null;
  rows: RoomListItemView[];
}

/** The place's chats as the filter shows them, empty sections dropped. */
export function filterSections(
  chats: readonly RoomListItemView[],
  filter: Filter,
  labels: { rooms: string; dms: string }
): ListSection[] {
  if (filter === 'recent') {
    const recent: ListSection = { key: 'recent', label: null, rows: newestFirst(chats) };
    return [recent].filter((section) => section.rows.length > 0);
  }
  const rooms: ListSection = {
    key: 'rooms',
    label: labels.rooms,
    rows: newestFirst(chats.filter((room) => !room.is_direct)),
  };
  const dms: ListSection = {
    key: 'dms',
    label: labels.dms,
    rows: newestFirst(chats.filter((room) => room.is_direct)),
  };
  const shown = filter === 'rooms' ? [rooms] : filter === 'dms' ? [dms] : [rooms, dms];
  return shown.filter((section) => section.rows.length > 0);
}
