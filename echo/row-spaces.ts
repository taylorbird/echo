// Which of the rail's spaces a room-list row belongs to, for the space icons at
// the right edge of each row in All chats (components/RoomSpaces.svelte).
//
// - A room belongs to the top-level spaces it sits in, directly or through a
//   joined subspace: the spaces whose rail tile would list it.
// - A DM belongs to the top-level spaces whose members (or a subspace's)
//   include the other person, the same rule that lists it there
//   (echo/space-dms.ts).
//
// Kept free of Sable's modules so it can be tested on plain data.

export interface SpaceRowRoom {
  room_id: string;
  room_kind: string | null;
  state: string;
  is_tombstoned: boolean;
  is_direct: boolean;
  direct_targets: readonly string[];
  space_children: readonly { room_id: string }[];
}

/** Sable's isActiveSpace (src/lib/features/sidebar/nav-rooms.ts). */
function activeSpace(room: SpaceRowRoom): boolean {
  return room.room_kind === 'space' && room.state === 'joined' && !room.is_tombstoned;
}

/** The joined spaces no other joined space holds: the rail's own tiles. */
export function topSpaces<R extends SpaceRowRoom>(rooms: readonly R[]): R[] {
  const joined = rooms.filter(activeSpace);
  const children = new Set(
    joined.flatMap((space) => space.space_children.map((child) => child.room_id))
  );
  return joined.filter((space) => !children.has(space.room_id));
}

/** The space and every joined space below it. */
export function spaceAndBelow<R extends SpaceRowRoom>(space: R, byId: ReadonlyMap<string, R>): R[] {
  const seen = new Set<string>([space.room_id]);
  const found = [space];
  for (let index = 0; index < found.length; index++) {
    for (const child of found[index].space_children) {
      const room = byId.get(child.room_id);
      if (room === undefined || !activeSpace(room) || seen.has(room.room_id)) continue;
      seen.add(room.room_id);
      found.push(room);
    }
  }
  return found;
}

/**
 * The rail's spaces that list `room`, in the order `rooms` gives them.
 * `people(space)` is everyone in that space or below it, as far as is known yet.
 */
export function rowSpaces<R extends SpaceRowRoom>(
  room: R,
  rooms: readonly R[],
  people: (space: R) => ReadonlySet<string>,
  own: string | undefined
): R[] {
  if (room.room_kind === 'space') return [];
  const byId = new Map(rooms.map((entry) => [entry.room_id, entry]));
  return topSpaces(rooms).filter((space) => {
    if (room.is_direct) {
      const members = people(space);
      return room.direct_targets.some((target) => target !== own && members.has(target));
    }
    return spaceAndBelow(space, byId).some((holder) =>
      holder.space_children.some((child) => child.room_id === room.room_id)
    );
  });
}
