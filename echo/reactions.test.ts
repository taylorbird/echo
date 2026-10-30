import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EchoReactions,
  LIVE_MS,
  POP_MS,
  reactionToOwn,
  type ReactionToOwn,
} from './reactions.svelte.js';

class MemoryStorage implements Storage {
  readonly #items = new Map<string, string>();
  get length(): number {
    return this.#items.size;
  }
  clear(): void {
    this.#items.clear();
  }
  getItem(key: string): string | null {
    return this.#items.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.#items.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.#items.delete(key);
  }
  setItem(key: string, value: string): void {
    this.#items.set(key, value);
  }
}

const START = 1_800_000_000_000;
const ROOM = '!room:example.org';
const elsewhere = { muted: false, open: false };

function reaction(fields: Partial<ReactionToOwn> = {}): ReactionToOwn {
  return {
    room_id: ROOM,
    sender: '@bob:example.org',
    key: '👍',
    target_event_id: '$mine',
    excerpt: 'my words',
    origin_server_ts: Date.now(),
    ...fields,
  };
}

describe('EchoReactions', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    storage = new MemoryStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function signedIn(): EchoReactions {
    const reactions = new EchoReactions(storage);
    reactions.useAccount('account');
    return reactions;
  }

  it('pops a live reaction for 5 seconds', () => {
    const reactions = signedIn();
    reactions.receive(reaction(), elsewhere);
    expect(reactions.pop(ROOM)).toMatchObject({ key: '👍', sender: '@bob:example.org' });

    vi.advanceTimersByTime(POP_MS - 1);
    expect(reactions.pop(ROOM)).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(reactions.pop(ROOM)).toBeNull();
  });

  it('shows the newest of several reactions and restarts the 5 seconds', () => {
    const reactions = signedIn();
    reactions.receive(reaction(), elsewhere);
    vi.advanceTimersByTime(3000);
    reactions.receive(reaction({ key: '🎉', origin_server_ts: Date.now() }), elsewhere);
    expect(reactions.pop(ROOM)?.key).toBe('🎉');

    vi.advanceTimersByTime(POP_MS - 1);
    expect(reactions.pop(ROOM)?.key).toBe('🎉');
    vi.advanceTimersByTime(1);
    expect(reactions.pop(ROOM)).toBeNull();
  });

  it("doesn't pop a reaction that isn't live", () => {
    const reactions = signedIn();
    reactions.receive(reaction({ origin_server_ts: Date.now() - LIVE_MS - 1 }), elsewhere);
    expect(reactions.pop(ROOM)).toBeNull();
  });

  it('ignores muted rooms', () => {
    const reactions = signedIn();
    reactions.setAsNotifications(true);
    reactions.receive(reaction(), { muted: true, open: false });
    expect(reactions.pop(ROOM)).toBeNull();
    expect(reactions.marker(ROOM)).toBeNull();
  });

  it('does nothing with "show reactions in the room list" off', () => {
    const reactions = signedIn();
    reactions.setAsNotifications(true);
    reactions.setInList(false);
    reactions.receive(reaction(), elsewhere);
    expect(reactions.pop(ROOM)).toBeNull();
    expect(reactions.marker(ROOM)).toBeNull();
  });

  it('leaves no marker with "show reactions as notifications" off', () => {
    const reactions = signedIn();
    reactions.receive(reaction(), elsewhere);
    expect(reactions.marker(ROOM)).toBeNull();
  });

  it('keeps a marker with the latest emoji until the room is opened', () => {
    const reactions = signedIn();
    reactions.setAsNotifications(true);
    reactions.receive(reaction(), elsewhere);
    vi.advanceTimersByTime(1000);
    reactions.receive(reaction({ key: '❤️', origin_server_ts: Date.now() }), elsewhere);
    vi.advanceTimersByTime(POP_MS * 2);
    expect(reactions.pop(ROOM)).toBeNull();
    expect(reactions.marker(ROOM)).toBe('❤️');

    reactions.open(ROOM);
    expect(reactions.marker(ROOM)).toBeNull();
  });

  it('pops but leaves no marker in the room you have open', () => {
    const reactions = signedIn();
    reactions.setAsNotifications(true);
    reactions.receive(reaction(), { muted: false, open: true });
    expect(reactions.pop(ROOM)).not.toBeNull();
    expect(reactions.marker(ROOM)).toBeNull();
  });

  it('keeps markers per account across a restart', () => {
    const first = signedIn();
    first.setAsNotifications(true);
    first.receive(reaction(), elsewhere);

    const restarted = new EchoReactions(storage);
    expect(restarted.asNotifications).toBe(true);
    restarted.useAccount('account');
    expect(restarted.marker(ROOM)).toBe('👍');
    restarted.useAccount('other');
    expect(restarted.marker(ROOM)).toBeNull();
  });

  it('marks, without a pop, what arrived while echo was closed', () => {
    const first = signedIn();
    first.setAsNotifications(true);
    vi.advanceTimersByTime(60_000);
    first.touch();
    const closedAt = Date.now();

    vi.setSystemTime(closedAt + 3_600_000);
    const restarted = new EchoReactions(storage);
    restarted.useAccount('account');
    restarted.receive(reaction({ origin_server_ts: closedAt + 60_000 }), elsewhere);
    expect(restarted.pop(ROOM)).toBeNull();
    expect(restarted.marker(ROOM)).toBe('👍');

    // From before the watermark: already seen.
    restarted.receive(
      reaction({ room_id: '!old:example.org', origin_server_ts: closedAt - 1000 }),
      elsewhere
    );
    expect(restarted.marker('!old:example.org')).toBeNull();
  });

  it("doesn't mark old history on an account's first run", () => {
    const reactions = new EchoReactions(storage);
    reactions.setAsNotifications(true);
    reactions.useAccount('fresh');
    reactions.receive(reaction({ origin_server_ts: Date.now() - 86_400_000 }), elsewhere);
    expect(reactions.marker(ROOM)).toBeNull();
  });

  it('clears markers when "show reactions as notifications" is turned off', () => {
    const reactions = signedIn();
    reactions.setAsNotifications(true);
    reactions.receive(reaction(), elsewhere);
    reactions.setAsNotifications(false);
    reactions.setAsNotifications(true);
    expect(reactions.marker(ROOM)).toBeNull();
  });
});

describe('reactionToOwn', () => {
  it('reads echo events and nothing else', () => {
    const payload = { kind: 'reaction_to_own', ...reaction({ origin_server_ts: 5 }) };
    expect(reactionToOwn({ type: 'echo', event: payload })).toEqual(
      reaction({ origin_server_ts: 5 })
    );
    expect(reactionToOwn({ type: 'echo', event: { ...payload, kind: 'other' } })).toBeNull();
    expect(reactionToOwn({ type: 'echo', event: { ...payload, key: 7 } })).toBeNull();
    expect(reactionToOwn({ type: 'room_widgets_changed', room_id: ROOM })).toBeNull();
  });
});
