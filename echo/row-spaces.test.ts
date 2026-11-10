import { describe, expect, it } from 'vitest';

import { rowSpaces, topSpaces, type SpaceRowRoom } from './row-spaces.js';

function room(id: string, extra: Partial<SpaceRowRoom> = {}): SpaceRowRoom {
  return {
    room_id: id,
    room_kind: 'room',
    state: 'joined',
    is_tombstoned: false,
    is_direct: false,
    direct_targets: [],
    space_children: [],
    ...extra,
  };
}

function space(id: string, children: string[], extra: Partial<SpaceRowRoom> = {}): SpaceRowRoom {
  return room(id, {
    room_kind: 'space',
    space_children: children.map((child) => ({ room_id: child })),
    ...extra,
  });
}

const tech = space('!tech', ['!homelab', '!sub']);
const sub = space('!sub', ['!deep']);
const family = space('!family', ['!dinner', '!homelab']);
const left = space('!left', ['!dinner'], { state: 'left' });
const rooms = [
  tech,
  sub,
  family,
  left,
  room('!homelab'),
  room('!deep'),
  room('!dinner'),
  room('!lonely'),
  room('!dm', { is_direct: true, direct_targets: ['@me', '@zach'] }),
];
const byId = new Map(rooms.map((entry) => [entry.room_id, entry]));
function get(id: string): SpaceRowRoom {
  const found = byId.get(id);
  if (!found) throw new Error(`no ${id} in the fixture`);
  return found;
}
const nobody = () => new Set<string>();
const ids = (list: SpaceRowRoom[]) => list.map((entry) => entry.room_id);

describe('topSpaces', () => {
  it('keeps joined spaces that no joined space holds', () => {
    expect(ids(topSpaces(rooms))).toEqual(['!tech', '!family']);
  });
});

describe('rowSpaces', () => {
  it('lists every top-level space a room sits in', () => {
    expect(ids(rowSpaces(get('!homelab'), rooms, nobody, '@me'))).toEqual(['!tech', '!family']);
  });

  it('counts a room in a subspace as in its top-level space', () => {
    expect(ids(rowSpaces(get('!deep'), rooms, nobody, '@me'))).toEqual(['!tech']);
  });

  it('ignores spaces you have left', () => {
    expect(ids(rowSpaces(get('!dinner'), rooms, nobody, '@me'))).toEqual(['!family']);
  });

  it('gives a room outside every space no icon', () => {
    expect(rowSpaces(get('!lonely'), rooms, nobody, '@me')).toEqual([]);
  });

  it('files a DM under the spaces the other person is in, not your own', () => {
    const people = (entry: SpaceRowRoom) =>
      new Set(entry.room_id === '!family' ? ['@me', '@zach'] : ['@me']);
    expect(ids(rowSpaces(get('!dm'), rooms, people, '@me'))).toEqual(['!family']);
  });

  it('gives a space row no icon', () => {
    expect(rowSpaces(tech, rooms, nobody, '@me')).toEqual([]);
  });
});
