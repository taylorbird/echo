// Where a room opens, as echo-gomuks did it (gomuks web/src/ui/MainScreen.tsx):
// the rail's places are views of one list of chats, so a room opens in the
// place you are in when that place lists it — Home lists every chat, a space
// its rooms and the DMs echo/space-dms.ts adds to it — and otherwise in its
// space, or Home. Sable sends DMs to /direct and the rooms outside spaces to
// /rooms, places echo's rail doesn't show (echo/styles/rail.css). Hooked into
// Sable's roomSectionPath (src/lib/rooms/permalink.ts), which notifications,
// Cmd-K, permalinks and the rest open rooms through, and into RoomNav.svelte's
// links for the DMs a space lists. Desktop only.

import { resolve } from '$app/paths';
import type { RoomListItemView } from '#src/generated/protocol';
import { findRoomByPathId, roomPathParam } from '#lib/rooms/room-list.svelte.js';
import { spacesContainingRoom } from '#lib/rooms/spaces.js';
import { preferences } from '#lib/settings/preferences.svelte.js';
import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
import { echoActive } from './active.js';
import { spaceListsDm } from './space-dms.js';

function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Whether Sable files the room under a space (permalink.ts's rootSpaceOf). */
function inSomeSpace(rooms: readonly RoomListItemView[], roomId: string): boolean {
  return rooms.some(
    (space) =>
      space.room_kind === 'space' &&
      space.state === 'joined' &&
      !space.is_tombstoned &&
      space.space_children.some((child) => child.room_id === roomId)
  );
}

/**
 * The path a room opens at from `pathname`, or null where Sable's own choice
 * stands: echo off, a phone, a space, or a room the client doesn't know.
 */
export function echoRoomPath(
  rooms: readonly RoomListItemView[],
  roomIdOrAlias: string,
  pathname: string = typeof location === 'undefined' ? '' : location.pathname
): string | null {
  if (!echoActive() || !matchMedia(BREAKPOINTS.appLayout).matches) return null;
  const room = findRoomByPathId(rooms, roomIdOrAlias);
  if (room === undefined || room.room_kind === 'space') return null;
  const roomId = roomPathParam(room, rooms);
  const [, place = '', segment = ''] = pathname.split('/');

  if (place === 'home' && preferences.showHome) {
    return resolve('/(app)/home/[roomId]', { roomId });
  }

  if (place === 'space') {
    const space = findRoomByPathId(rooms, decoded(segment));
    if (
      space?.room_kind === 'space' &&
      (spacesContainingRoom([space], rooms, room.room_id).size > 0 ||
        spaceListsDm(space.room_id, room.room_id))
    ) {
      return resolve('/(app)/space/[spaceId]/[roomId]', {
        spaceId: roomPathParam(space, rooms),
        roomId,
      });
    }
  }

  // Not listed where you are: a space's room goes to its space, as in Sable;
  // anything else to Home rather than /rooms or /direct.
  if (inSomeSpace(rooms, room.room_id) || !preferences.showHome) return null;
  return resolve('/(app)/home/[roomId]', { roomId });
}

/** Where start-up lands with no room to restore: Home, not the rooms outside spaces. */
export function echoStartPath(): string | null {
  if (!echoActive() || !matchMedia(BREAKPOINTS.appLayout).matches) return null;
  return preferences.showHome ? resolve('/(app)/home') : null;
}
