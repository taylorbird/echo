import { describe, expect, it } from 'vitest';

import { ringFor, ringLabel, type RingInput } from './ring.js';

const quiet: RingInput = {
  badge: false,
  highlight: 0,
  unread: 0,
  direct: false,
  muted: false,
  marker: null,
  pop: null,
};

describe('ringFor', () => {
  it('draws nothing for a room with no badge, marker or pop', () => {
    expect(ringFor(quiet)).toBeNull();
  });

  it('shows the total unread count in purple, as Sable formats it', () => {
    expect(ringFor({ ...quiet, badge: true, unread: 4 })).toEqual({
      tier: 'unread',
      content: { kind: 'count', text: '4' },
      bar: 'unread',
      popping: false,
    });
    expect(ringFor({ ...quiet, badge: true, unread: 1500 })?.content).toEqual({
      kind: 'count',
      text: '1k+',
    });
  });

  it('shows a dot when a room is unread without a count', () => {
    expect(ringFor({ ...quiet, badge: true })?.content).toEqual({ kind: 'dot' });
  });

  it('shows a mention as "@" alone, in red', () => {
    const ring = ringFor({ ...quiet, badge: true, highlight: 3, unread: 9 });
    expect(ring?.tier).toBe('mention');
    expect(ring?.content).toEqual({ kind: 'at' });
  });

  it("shows a DM's unread as a red dot with no number", () => {
    const ring = ringFor({ ...quiet, badge: true, unread: 5, direct: true });
    expect(ring?.tier).toBe('dm');
    expect(ring?.content).toEqual({ kind: 'dot' });
  });

  it('shows a muted room grey with its count, and leaves the row unlit', () => {
    expect(ringFor({ ...quiet, badge: true, unread: 7, muted: true })).toEqual({
      tier: 'muted',
      content: { kind: 'count', text: '7' },
      bar: null,
      popping: false,
    });
  });

  it('shows a reaction marker in blue when nothing outranks it', () => {
    expect(ringFor({ ...quiet, marker: '👍' })).toEqual({
      tier: 'reaction',
      content: { kind: 'emoji', key: '👍' },
      bar: 'reaction',
      popping: false,
    });
  });

  it('lets mentions, DMs and unread outrank a reaction marker', () => {
    expect(ringFor({ ...quiet, badge: true, highlight: 1, marker: '👍' })?.tier).toBe('mention');
    expect(ringFor({ ...quiet, badge: true, direct: true, marker: '👍' })?.tier).toBe('dm');
    expect(ringFor({ ...quiet, badge: true, unread: 2, marker: '👍' })?.tier).toBe('unread');
  });

  it("pops the emoji into the room's ring, keeping its colour and bar", () => {
    expect(ringFor({ ...quiet, badge: true, highlight: 1, pop: '🎉' })).toEqual({
      tier: 'mention',
      content: { kind: 'emoji', key: '🎉' },
      bar: 'mention',
      popping: true,
    });
  });

  it('pops into a purple ring on a quiet row without lighting the row', () => {
    expect(ringFor({ ...quiet, pop: '🎉' })).toEqual({
      tier: 'unread',
      content: { kind: 'emoji', key: '🎉' },
      bar: null,
      popping: true,
    });
  });
});

describe('ringLabel', () => {
  it('names a reaction marker, which has no Sable badge to speak for it', () => {
    expect(ringLabel(ringFor({ ...quiet, marker: '👍' }))).toBe('New reaction to your message');
    // A pop over the marker is still the marker's ring.
    expect(ringLabel(ringFor({ ...quiet, marker: '👍', pop: '🎉' }))).toBe(
      'New reaction to your message'
    );
  });

  it("stays silent where Sable's own badge is read out, or nothing is drawn", () => {
    expect(ringLabel(ringFor({ ...quiet, badge: true, unread: 2, marker: '👍' }))).toBeNull();
    expect(ringLabel(ringFor({ ...quiet, badge: true, highlight: 1 }))).toBeNull();
    // A pop alone: the row's "reacted to" preview says it.
    expect(ringLabel(ringFor({ ...quiet, pop: '🎉' }))).toBeNull();
    expect(ringLabel(ringFor(quiet))).toBeNull();
  });
});
