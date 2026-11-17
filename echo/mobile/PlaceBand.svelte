<!-- The open place's band in the phone's space drawer: the desktop's parted
     rail (echo/components/RailBand.svelte, SPEC §3.5–3.6) under the open
     tile. Up to three unread one-to-one DMs, newest first, then the four
     sub-filters, the picked one wearing the glow pill. Rendered by
     SpaceTiles.svelte inside the open tile's item. Styles: echo/styles/mobile.css. -->
<script lang="ts">
  import type { RoomListItemView } from '#src/generated/protocol';
  import { roomAvatarUrl, roomLabel, useRoomList } from '#lib/rooms/room-list.svelte.js';
  import Avatar from '#lib/ui/primitives/Avatar.svelte';
  import UnreadBadge from '#lib/ui/primitives/UnreadBadge.svelte';
  import { FILTERS } from './filters.js';
  import type { Filter } from './place.js';

  interface Props {
    filter: Filter;
    unreadDms: readonly RoomListItemView[];
    onFilter: (filter: Filter) => void;
    onOpenRoom: (room: RoomListItemView) => void;
  }

  let { filter, unreadDms, onFilter, onOpenRoom }: Props = $props();

  const roomList = useRoomList();
</script>

<div class="echo-m-band" role="group" aria-label="Show">
  <div class="echo-m-tiles-separator" role="separator"></div>
  {#if unreadDms.length > 0}
    {#each unreadDms as room (room.room_id)}
      {@const name = roomLabel(room)}
      <button
        type="button"
        class="echo-m-tile echo-m-band-dm"
        aria-label={name}
        onclick={() => {
          onOpenRoom(room);
        }}
      >
        <Avatar id={room.room_id} src={roomAvatarUrl(room)} {name} size="medium" uniform />
        <UnreadBadge counts={roomList.badgeUnreadFor(room)} dm aria-hidden="true" />
      </button>
    {/each}
    <div class="echo-m-tiles-separator" role="separator"></div>
  {/if}
  {#each FILTERS as item (item.value)}
    <button
      type="button"
      class="echo-m-band-filter"
      aria-label={item.label}
      aria-pressed={filter === item.value}
      onclick={() => {
        onFilter(item.value);
      }}
    >
      <item.icon />
    </button>
  {/each}
</div>
