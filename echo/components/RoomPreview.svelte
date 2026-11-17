<!-- echo: the one-line "Sender: text" preview under a room's name in the room
     list (echo/design/SPEC.md §4.3). Hooked into Sable's RoomNav.svelte. It also
     marks a direct message's row (`.echo-dm`), which the rail's sub-filters
     read: a DM's link doesn't always say what it is.
     It also draws the conversation-kind glyph after the name (SPEC §4.3). While
     someone's reaction to your message pops in (echo/reactions.svelte.ts,
     SPEC §4.6) the preview says who reacted to what. -->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import { page } from '$app/state';
  import type { RoomListItemView } from '#src/generated/protocol';
  import { useCoreClient } from '#lib/core/context.js';
  import type { PeerProfiles } from '#lib/features/sidebar/peer-profiles.svelte.js';
  import { findRoomByPathId, useRoomList } from '#lib/rooms/room-list.svelte.js';
  import { senderColor } from '#lib/ui/primitives/identity-color.js';
  import { motionMs } from '#lib/ui/motion.js';
  import { echoActive } from '../active.js';
  import { connectEchoReactions, echoReactions } from '../reactions.svelte.js';
  import { mutedRoom } from '../unread.js';

  interface Props {
    room: RoomListItemView | undefined;
    profiles: PeerProfiles;
  }

  let { room, profiles }: Props = $props();
  const core = useCoreClient();
  const roomList = useRoomList();
  // Sable's component tests render RoomNav without echo's layer (echo/active.ts).
  const active = echoActive();

  if (active) {
    connectEchoReactions(
      core,
      (roomId) => mutedRoom(roomList.byId(roomId)),
      () => findRoomByPathId(roomList.rooms, page.params.roomId)?.room_id ?? null
    );
  }

  let latest = $derived(room?.latest_event ?? null);
  let sender = $derived(latest?.sender ?? null);
  let own = $derived(sender !== null && sender === core.session?.user_id);
  let reaction = $derived(active && room ? echoReactions.pop(room.room_id) : null);

  $effect(() => {
    if (sender !== null && !own) profiles.request(sender);
  });

  $effect(() => {
    if (reaction) profiles.request(reaction.sender);
  });

  // Names longer than 16 characters are cut to 12 and an ellipsis.
  function shorten(name: string): string {
    return name.length > 16 ? `${name.slice(0, 12)}…` : name;
  }

  function nameOf(userId: string): string {
    const display = profiles.get(userId)?.display_name;
    return shorten(display ?? userId.replace(/^@/, '').split(':')[0]);
  }

  // What kind of conversation this is: a person for a one-to-one DM, two
  // people for a group DM or an unnamed room named after its members, chat
  // bubbles for a room with a real name or alias.
  let kind = $derived.by((): 'dm' | 'group' | 'room' | null => {
    if (!room) return null;
    if (room.is_direct) return room.direct_targets.length > 1 ? 'group' : 'dm';
    if (room.name === null && room.canonical_alias === null) return 'group';
    return 'room';
  });

  let name = $derived.by(() => {
    if (sender === null) return null;
    if (own) return 'You';
    return nameOf(sender);
  });
</script>

{#if room?.is_direct}<span class="echo-dm" hidden></span>{/if}
{#if kind}
  <!-- Lucide user / users / messages-square, as echo drew them. -->
  <svg
    class="echo-room-kind"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {#if kind === 'dm'}
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    {:else if kind === 'group'}
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path
        d="M22 21v-2a4 4 0 0 0-3-3.87"
      /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    {:else}
      <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" /><path
        d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"
      />
    {/if}
  </svg>
{/if}
{#if reaction || (latest && latest.body)}
  <span class="echo-room-preview">
    {#if reaction}
      <span class="echo-preview-line" transition:fade={{ duration: motionMs(250) }}
        ><span class="echo-preview-reactor" style:color={senderColor(reaction.sender)}
          >{nameOf(reaction.sender)}</span
        >
        reacted to “{reaction.excerpt}”</span
      >
    {:else if latest && latest.body}
      <span class="echo-preview-line" transition:fade={{ duration: motionMs(250) }}
        >{#if name}<span class="echo-preview-sender" style:color={senderColor(sender)}>{name}</span
          >{/if}{latest.body}</span
      >
    {/if}
  </span>
{/if}

<style>
  .echo-room-preview {
    display: none;
    min-width: 0;
  }

  .echo-preview-line {
    grid-area: 1 / 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .echo-room-kind {
    display: none;
  }

  .echo-preview-sender,
  .echo-preview-reactor {
    font-weight: 500;
  }

  .echo-preview-sender::after {
    color: var(--echo-preview);
    content: ': ';
    font-weight: 400;
  }

  @media (width >= 48rem) {
    .echo-room-kind {
      color: var(--echo-kind-glyph);
      display: block;
      height: 0.9375rem;
      opacity: var(--echo-kind-glyph-opacity);
      width: 0.9375rem;
    }

    /* The two lines stack in one cell, so a reaction crossfades over the
       latest message. */
    .echo-room-preview {
      color: var(--echo-preview);
      display: grid;
      font-size: 0.9rem;
      grid-template-columns: minmax(0, 1fr);
      line-height: 1.4;
      opacity: 0.9;
    }
  }
</style>
