<!-- echo: the one-line "Sender: text" preview under a room's name in the room
     list (echo/design/SPEC.md §4.3). Hooked into Sable's RoomNav.svelte. It also
     marks a direct message's row (`.echo-dm`), which the rail's sub-filters
     and the red DM badge read: a DM's link doesn't always say what it is. -->
<script lang="ts">
  import type { RoomListItemView } from '#src/generated/protocol';
  import { useCoreClient } from '#lib/core/context.js';
  import type { PeerProfiles } from '#lib/features/sidebar/peer-profiles.svelte.js';
  import { senderColor } from '#lib/ui/primitives/identity-color.js';

  interface Props {
    room: RoomListItemView | undefined;
    profiles: PeerProfiles;
  }

  let { room, profiles }: Props = $props();
  const core = useCoreClient();

  let latest = $derived(room?.latest_event ?? null);
  let sender = $derived(latest?.sender ?? null);
  let own = $derived(sender !== null && sender === core.session?.user_id);

  $effect(() => {
    if (sender !== null && !own) profiles.request(sender);
  });

  // Names longer than 16 characters are cut to 12 and an ellipsis.
  function shorten(name: string): string {
    return name.length > 16 ? `${name.slice(0, 12)}…` : name;
  }

  let name = $derived.by(() => {
    if (sender === null) return null;
    if (own) return 'You';
    const display = profiles.get(sender)?.display_name;
    return shorten(display ?? sender.replace(/^@/, '').split(':')[0]);
  });
</script>

{#if room?.is_direct}<span class="echo-dm" hidden></span>{/if}
{#if latest && latest.body}
  <span class="echo-room-preview"
    >{#if name}<span class="echo-preview-sender" style:color={senderColor(sender)}>{name}</span
      >{/if}{latest.body}</span
  >
{/if}

<style>
  .echo-room-preview {
    display: none;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .echo-preview-sender {
    font-weight: 500;
  }

  .echo-preview-sender::after {
    color: var(--echo-preview);
    content: ': ';
    font-weight: 400;
  }

  @media (width >= 48rem) {
    .echo-room-preview {
      color: var(--echo-preview);
      display: block;
      font-size: 0.9rem;
      line-height: 1.4;
      opacity: 0.9;
    }
  }
</style>
