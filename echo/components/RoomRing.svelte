<!-- echo: a room's badge ring in the room list (echo/design/SPEC.md §4.4), from
     echo/ring.ts. Hooked into the badge lane (`.room-status`) of Sable's
     RoomNav.svelte; Sable's own badge stays beside it, unseen, for screen
     readers (echo/styles/roomlist.css). A reaction marker, which has no Sable
     badge, carries its own label (ringLabel). A reaction pops its emoji in with a
     small spring, unless Sable's Reduce motion is on (echo/motion.ts). -->
<script lang="ts">
  import type { RoomListItemView } from '#src/generated/protocol';
  import { isCustomReaction } from '#lib/features/room/messages/reaction-emote-label.js';
  import { useRoomList } from '#lib/rooms/room-list.svelte.js';
  import { preferences } from '#lib/settings/preferences.svelte.js';
  import MediaImage from '#lib/ui/MediaImage.svelte';
  import { shouldReduceMotion } from '#lib/ui/motion.js';
  import { hideQuietDot, resolveUnreadBadge } from '#lib/ui/primitives/unread-badge.js';
  import { echoActive } from '../active.js';
  import { echoReactions } from '../reactions.svelte.js';
  import { ringFor, ringLabel } from '../ring.js';
  import { mutedRoom } from '../unread.js';

  interface Props {
    room: RoomListItemView | undefined;
  }

  let { room }: Props = $props();
  const roomList = useRoomList();
  // Sable's component tests render RoomNav without echo's layer (echo/active.ts).
  const active = echoActive();

  let ring = $derived.by(() => {
    if (!active || !room) return null;
    // Whether Sable's UnreadBadge shows: the same counts and settings it reads.
    const counts = roomList.badgeUnreadFor(room);
    const badge = hideQuietDot(
      resolveUnreadBadge(counts, preferences, room.is_direct),
      preferences.showUnreadDots
    );
    return ringFor({
      badge: badge !== null,
      highlight: counts.highlight,
      unread: Math.max(room.unread, counts.unread),
      direct: room.is_direct,
      muted: mutedRoom(room),
      marker: echoReactions.marker(room.room_id),
      pop: echoReactions.pop(room.room_id)?.key ?? null,
      showEasterEggs: preferences.showEasterEggs,
    });
  });

  // A new emoji, or a pop ending, draws the ring afresh; only a pop springs.
  let shown = $derived(
    ring === null
      ? null
      : ring.content.kind === 'emoji'
        ? `${ring.popping ? 'pop' : 'marker'}:${ring.content.key}`
        : ring.content.kind
  );
  let spring = $derived(ring?.popping === true && !shouldReduceMotion());
  let label = $derived(ringLabel(ring));
</script>

{#if ring}
  {#key shown}
    <span
      class={['echo-ring', { 'echo-ring-pop': spring }]}
      data-tier={ring.tier}
      data-bar={ring.bar}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    >
      {#if ring.content.kind === 'count'}
        {ring.content.text}
      {:else if ring.content.kind === 'at'}
        @
      {:else if ring.content.kind === 'dot'}
        <span class="echo-ring-dot"></span>
      {:else if isCustomReaction(ring.content.key)}
        <MediaImage
          class="echo-ring-emote"
          source={ring.content.key}
          alt=""
          width={32}
          height={32}
          original
        />
      {:else}
        <span class="echo-ring-emoji">{ring.content.key}</span>
      {/if}
    </span>
  {/key}
{/if}

<style>
  /* Desktop only: echo/styles/roomlist.css draws it there. */
  .echo-ring {
    display: none;
  }
</style>
