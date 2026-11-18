import { describe, expect, it } from 'vitest';
import type { RoomListItemView } from '#src/generated/protocol';
import type { UnreadCount } from '#lib/rooms/unread.js';
import { filterSections } from './lists.js';

const labels = { mentions: 'Mentions', rooms: 'Rooms', dms: 'Direct messages' };

function chat(id: string, direct: boolean, time: number): RoomListItemView {
  return {
    room_id: id,
    is_direct: direct,
    latest_event: { timestamp: time },
  } as unknown as RoomListItemView;
}

const counts: Record<string, UnreadCount> = {
  quietDm: { unread: 0, highlight: 0 },
  unreadDm: { unread: 2, highlight: 0 },
  quietRoom: { unread: 5, highlight: 0 },
  mentionRoom: { unread: 1, highlight: 1 },
};
const countOf = (room: RoomListItemView): UnreadCount =>
  counts[room.room_id] ?? { unread: 0, highlight: 0 };

const chats = [
  chat('quietDm', true, 4),
  chat('unreadDm', true, 1),
  chat('quietRoom', false, 3),
  chat('mentionRoom', false, 2),
];

function shape(filter: Parameters<typeof filterSections>[1]) {
  return filterSections(chats, filter, labels, countOf).map((section) => [
    section.key,
    section.rows.map((room) => room.room_id),
  ]);
}

describe('phone list sections', () => {
  it('puts unread DMs and mentioning rooms in Mentions, above Rooms and DMs', () => {
    expect(shape('all')).toEqual([
      ['mentions', ['mentionRoom', 'unreadDm']],
      ['rooms', ['quietRoom']],
      ['dms', ['quietDm']],
    ]);
  });

  it('keeps Mentions within the picked filter', () => {
    expect(shape('rooms')).toEqual([
      ['mentions', ['mentionRoom']],
      ['rooms', ['quietRoom']],
    ]);
    expect(shape('dms')).toEqual([
      ['mentions', ['unreadDm']],
      ['dms', ['quietDm']],
    ]);
  });

  it('leaves Recent as one list, newest first', () => {
    expect(shape('recent')).toEqual([
      ['recent', ['quietDm', 'quietRoom', 'mentionRoom', 'unreadDm']],
    ]);
  });
});
