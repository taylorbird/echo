// echo: what a room's badge ring shows (echo/design/SPEC.md §4.4). One ring per
// row, drawn by echo/components/RoomRing.svelte in the badge lane over Sable's
// own badge, which stays for screen readers. Sable still decides whether a row
// has a badge at all (its badge modes, "show unread dots"); echo decides the
// ring's colour and what is inside it.

import { formatUnreadCount } from '#lib/ui/primitives/unread-badge.js';

/** The ring's colour. A reaction marker is blue; a pop keeps the room's colour. */
export type RingTier = 'unread' | 'mention' | 'dm' | 'muted' | 'reaction';

export type RingContent =
  | { kind: 'count'; text: string }
  | { kind: 'at' }
  | { kind: 'dot' }
  | { kind: 'emoji'; key: string };

export interface Ring {
  tier: RingTier;
  content: RingContent;
  /** The row's glow bar and wash: the tier's, none for a muted room or a pop alone. */
  bar: RingTier | null;
  /** A reaction is popping in: the emoji stands in for the ring's content. */
  popping: boolean;
}

export interface RingInput {
  /** Whether Sable shows this row a badge (counts after its badge modes). */
  badge: boolean;
  highlight: number;
  /** The room's total unread messages, before Sable's badge modes. */
  unread: number;
  direct: boolean;
  muted: boolean;
  /** A reaction marker's emoji, when "show reactions as notifications" is on. */
  marker: string | null;
  /** The emoji popping in for 5 seconds, when "show reactions in the room list" is on. */
  pop: string | null;
  showEasterEggs?: boolean;
}

function count(unread: number, showEasterEggs: boolean): RingContent {
  return unread > 0
    ? { kind: 'count', text: formatUnreadCount(unread, showEasterEggs) }
    : { kind: 'dot' };
}

function base(input: RingInput): Pick<Ring, 'tier' | 'content'> | null {
  const eggs = input.showEasterEggs ?? false;
  if (input.badge) {
    // A mention is just "@", without a count.
    if (input.highlight > 0) return { tier: 'mention', content: { kind: 'at' } };
    if (input.muted) return { tier: 'muted', content: count(input.unread, eggs) };
    // A DM's unread is a red dot: someone is waiting on you. No count.
    if (input.direct) return { tier: 'dm', content: { kind: 'dot' } };
    return { tier: 'unread', content: count(input.unread, eggs) };
  }
  // Mentions and unread outrank a reaction marker: one ring per row.
  if (input.marker === null) return null;
  return { tier: 'reaction', content: { kind: 'emoji', key: input.marker } };
}

export function ringFor(input: RingInput): Ring | null {
  const shown = base(input);
  const bar = shown === null || shown.tier === 'muted' ? null : shown.tier;
  if (input.pop !== null) {
    // The emoji pops into the ring the row has, in its colour, or into a purple
    // one; the row's bar and wash stay as they were.
    return {
      tier: shown?.tier ?? 'unread',
      content: { kind: 'emoji', key: input.pop },
      bar,
      popping: true,
    };
  }
  return shown === null ? null : { ...shown, bar, popping: false };
}
