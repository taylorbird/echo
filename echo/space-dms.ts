// Which direct messages a place in the rail lists, as echo decided it
// (gomuks web/src/api/statestore/space.ts):
// - a space lists the DMs whose other person is a member of the space or of a
//   space below it, as Element does: nobody adds DMs to a space as children;
// - the rooms outside spaces list every DM, since no space claims one.
// Sable lists no DMs in either, so its rooms there gain them. Hooked into
// RoomNav.svelte, where the section's rows are made; the rail's sub-filters
// (echo/components/RailBand.svelte) then narrow the list to rooms or DMs.

import { MediaQuery, SvelteMap } from 'svelte/reactivity';
import type { RoomListItemView } from '#src/generated/protocol';
import type { CoreClient } from '#lib/core/client.svelte.js';
import type { NavSectionKind } from '#lib/features/sidebar/nav-section.js';
import { roomRow, type RoomNavRow } from '#lib/features/sidebar/nav-rows.js';
import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
import { echoActive } from './active.js';

// Phones keep Sable's UI until echo has its own (echo/README.md).
const desktop = new MediaQuery(BREAKPOINTS.appLayout);

// Joined and invited members of each space, fetched once a session.
const spaceMembers = new SvelteMap<string, ReadonlySet<string>>();
const requested = new Set<string>();
// The DMs each space's list last gained here, for echo/places.ts.
const listedDms = new Map<string, ReadonlySet<string>>();

/** Whether the space's list, when last shown, held this DM because of echo. */
export function spaceListsDm(spaceId: string, roomId: string): boolean {
  return listedDms.get(spaceId)?.has(roomId) ?? false;
}

function membersOf(core: CoreClient, spaceId: string): ReadonlySet<string> | undefined {
  if (!requested.has(spaceId)) {
    requested.add(spaceId);
    Promise.resolve()
      .then(() => core.rpc.members.list({ room_id: spaceId, memberships: [] }))
      .then(
        (members) => {
          spaceMembers.set(
            spaceId,
            new Set(
              members
                .filter((member) => member.membership === 'join' || member.membership === 'invite')
                .map((member) => member.user_id)
            )
          );
        },
        (error: unknown) => {
          requested.delete(spaceId);
          console.debug('[echo rail] space members unavailable', error);
        }
      );
  }
  return spaceMembers.get(spaceId);
}

/** The space and every joined space below it. */
function spaceAndBelow(space: RoomListItemView, byId: Map<string, RoomListItemView>): string[] {
  const seen = new Set<string>([space.room_id]);
  const queue = [space];
  for (let next = queue.shift(); next; next = queue.shift()) {
    for (const child of next.space_children) {
      const room = byId.get(child.room_id);
      if (room?.room_kind !== 'space' || room.state !== 'joined' || seen.has(room.room_id))
        continue;
      seen.add(room.room_id);
      queue.push(room);
    }
  }
  return [...seen];
}

interface Section {
  section: NavSectionKind;
  space: RoomListItemView | null;
  rooms: readonly RoomListItemView[];
  core: CoreClient;
  compare: (left: RoomNavRow, right: RoomNavRow) => number;
}

/** A section's rows with the DMs echo listed there added. */
export function echoSectionRooms(rows: RoomNavRow[], context: Section): RoomNavRow[] {
  if (!echoActive() || !desktop.current) return rows;
  const { section, space, rooms, core, compare } = context;
  const own = core.session?.user_id;
  const directs = rooms.filter(
    (room) => room.state === 'joined' && room.is_direct && !room.is_tombstoned
  );

  if (section === 'unspaced') {
    const listed = new Set(rows.map((row) => row.roomId));
    return [...rows, ...directs.filter((room) => !listed.has(room.room_id)).map(roomRow)].sort(
      compare
    );
  }

  if (section === 'space' && space) {
    const byId = new Map(rooms.map((room) => [room.room_id, room]));
    const people = new Set<string>();
    for (const spaceId of spaceAndBelow(space, byId)) {
      for (const person of membersOf(core, spaceId) ?? []) people.add(person);
    }
    const listed = new Set(rows.map((row) => row.roomId));
    const shared = directs.filter(
      (room) =>
        !listed.has(room.room_id) &&
        room.direct_targets.some((target) => target !== own && people.has(target))
    );
    listedDms.set(space.room_id, new Set(shared.map((room) => room.room_id)));
    return [...rows, ...shared.map(roomRow).sort(compare)];
  }

  return rows;
}
