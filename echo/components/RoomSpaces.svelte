<!-- echo: a room's spaces on its avatar in All chats (Home), so a room's place
     shows without opening the space: the avatar of each rail space that lists
     it (echo/row-spaces.ts), a small circle riding the avatar's edge, the first
     at the bottom right and up to two more further round. A room or DM outside
     every space shows none. Mounted by RoomNav.svelte after each row's avatar
     and drawn by echo/styles/roomlist.css, which also cuts the avatar away under
     each one; desktop only. Off in Settings → echo → Room list
     (echo/space-icons.svelte.ts). -->
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
  // Up to three fit round the avatar; the label names them all.
  let drawn = $derived(spaces.slice(0, 3));
  let label = $derived(spaces.map((space) => space.name ?? space.room_id).join(', '));
</script>

{#if shown && drawn.length > 0}
  <span
    class="echo-row-spaces"
    data-count={drawn.length}
    role="img"
    aria-label={`In ${label}`}
    title={label}
  >
    {#each drawn as space (space.room_id)}
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
