<!-- echo: a room's spaces at the right edge of its row in All chats (Home), so a
     room's place shows without opening the space: the avatar of each rail space
     that lists it, stacked when there is more than one (echo/row-spaces.ts). A
     room or DM outside every space shows its section's generic glyph. Hooked into Sable's RoomNav.svelte
     after the badge lane; drawn by echo/styles/roomlist.css, desktop only. Off in
     Settings → echo → Room list (echo/space-icons.svelte.ts). -->
<script lang="ts">
  import { page } from '$app/state';
  import type { RoomListItemView } from '#src/generated/protocol';
  import { useCoreClient } from '#lib/core/context.js';
  import { roomAvatarUrl, useRoomList } from '#lib/rooms/room-list.svelte.js';
  import Avatar from '#lib/ui/primitives/Avatar.svelte';
  import { echoActive } from '../active.js';
  import { rowSpaces } from '../row-spaces.js';
  import { spacePeople } from '../space-dms.js';
  import { echoSpaceIcons } from '../space-icons.svelte.js';

  interface Props {
    room: RoomListItemView | undefined;
  }

  let { room }: Props = $props();
  const roomList = useRoomList();
  const core = useCoreClient();
  // Sable's component tests render RoomNav without echo's layer (echo/active.ts).
  const active = echoActive();

  let shown = $derived(
    active && room !== undefined && echoSpaceIcons.show && page.url.pathname.startsWith('/home')
  );
  let spaces = $derived.by(() => {
    if (!shown || !room) return [];
    const rooms = roomList.rooms;
    return rowSpaces(
      room,
      rooms,
      (space) => (room.is_direct ? spacePeople(core, space, rooms) : new Set<string>()),
      core.session?.user_id
    );
  });
  let label = $derived(spaces.map((space) => space.name ?? space.room_id).join(', '));
</script>

{#if shown && spaces.length === 0}
  <!-- In no space: the generic glyph of its section, a room's or a DM's, so
       every row's lane holds something. -->
  <span class="echo-row-spaces" role="img" aria-label="Not in a space" title="Not in a space">
    <span class="echo-row-space echo-row-space-none" data-kind={room?.is_direct ? 'dm' : 'room'}
    ></span>
  </span>
{:else if spaces.length > 0}
  <span class="echo-row-spaces" role="img" aria-label={`In ${label}`} title={label}>
    {#each spaces as space (space.room_id)}
      <Avatar
        class="echo-row-space"
        id={space.room_id}
        src={roomAvatarUrl(space)}
        name={space.name ?? space.room_id}
        size="tiny"
      />
    {/each}
  </span>
{/if}

<style>
  /* Drawn only where echo styles it: the desktop list (echo/styles/roomlist.css). */
  .echo-row-spaces {
    display: none;
  }
</style>
