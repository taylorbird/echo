// echo's unread indicators. Hooked into RoomList.badgeUnreadFor
// (src/lib/rooms/room-list.svelte.ts), so only the room list's and rail's
// badges change; the inbox and room jump keep Sable's counts.

import { MediaQuery } from 'svelte/reactivity';
import type { RoomListItemView } from '#src/generated/protocol';
import type { UnreadCount } from '#lib/rooms/unread.js';
import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
import { echoActive } from './active.js';

// Phones keep Sable's UI until echo has its own (echo/README.md).
const desktop = new MediaQuery(BREAKPOINTS.appLayout);

/** Whether the room's notification mode is mute (its own, else the default). */
export function mutedRoom(room: RoomListItemView | undefined): boolean {
  return room !== undefined && (room.notification.room ?? room.notification.default) === 'mute';
}

/**
 * Sable's core clears every count in a muted room. echo still marks a muted
 * room with unread messages, with a grey ring (echo/ring.ts): muting silences
 * a room, it does not hide that something happened in it. The raw count is
 * still on the row, so a muted room keeps it as an unread with nothing
 * notifying.
 */
export function echoBadgeCounts(room: RoomListItemView): UnreadCount {
  if (!echoActive() || !desktop.current || !mutedRoom(room) || room.unread === 0) {
    return room.counts;
  }
  return { unread: room.unread, highlight: 0, notifying: 0, marked: room.counts.marked };
}
