<!-- echo's space drawer on a phone: the desktop rail's places (SPEC §3) in a
     narrow panel that slides over the room list from the left. Home, a
     divider, then the spaces and space folders in the sidebar's own order
     (Sable's account data, as the rail reads it), each with its unread badge;
     the open place carries the rail's glow pill. A folder shows its spaces'
     avatars in a 2×2 grid while closed and opens in place, and it is open
     while one of its spaces is, as on the desktop (echo/folders.ts).

     RoomListScreen.svelte opens it from the title's place button or a swipe
     from the left edge, and passes `pull` while that swipe is under way. A
     tap on the scrim, a swipe back left or Escape closes it. Styles:
     echo/styles/mobile.css. -->
<script lang="ts">
  import type { RoomListItemView } from '#src/generated/protocol';
  import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
  import HouseIcon from 'phosphor-svelte/lib/HouseIcon';
  import { i18n } from '#lib/i18n.js';
  import { isActiveSpace } from '#lib/features/sidebar/nav-rooms.js';
  import { useRoomList } from '#lib/rooms/room-list.svelte.js';
  import { addUnread, spaceUnreadTotals } from '#lib/rooms/spaces.js';
  import { NO_UNREAD, type UnreadCount } from '#lib/rooms/unread.js';
  import { folderName, layoutSpaceIds, mergeSpaces } from '#lib/spaces/sidebar-layout.js';
  import { useSpaceSidebar } from '#lib/spaces/sidebar-layout.svelte.js';
  import Avatar from '#lib/ui/primitives/Avatar.svelte';
  import UnreadBadge from '#lib/ui/primitives/UnreadBadge.svelte';
  import type { Place } from './place.js';

  interface Props {
    open: boolean;
    /** How far a swipe from the edge has pulled the closed drawer, in px. */
    pull: number | null;
    place: Place;
    onChoose: (place: Place) => void;
    onClose: () => void;
  }

  let { open, pull, place, onChoose, onClose }: Props = $props();

  const roomList = useRoomList();
  const sidebar = useSpaceSidebar();

  // The rail's spaces (SidebarNav.svelte): every top-level space, then the
  // spaces pinned in the sidebar layout that are also inside another space.
  let joined = $derived(roomList.rooms.filter(isActiveSpace));
  let spaces = $derived.by(() => {
    const children = new Set(joined.flatMap((space) => space.space_children.map((c) => c.room_id)));
    const pinned = new Set(layoutSpaceIds(sidebar.items));
    const top = joined.filter((space) => !children.has(space.room_id));
    return [
      ...top,
      ...joined.filter((space) => children.has(space.room_id) && pinned.has(space.room_id)),
    ];
  });
  let byId = $derived(new Map(spaces.map((space) => [space.room_id, space])));
  let entries = $derived(
    mergeSpaces(
      sidebar.items,
      spaces.map((space) => space.room_id)
    )
  );

  let spaceUnread = $derived(spaceUnreadTotals(spaces, roomList.rooms, roomList.badgeUnreadFor));
  let homeUnread = $derived(
    roomList.rooms
      .filter((room) => room.state === 'joined' && room.room_kind !== 'space')
      .reduce((total, room) => addUnread(total, roomList.badgeUnreadFor(room)), {
        unread: 0,
        highlight: 0,
      })
  );

  let currentSpace = $derived(place.kind === 'space' ? place.spaceId : null);

  // A folder is open while one of its spaces is; another one can be opened by
  // hand to pick from it, and closes again when the drawer does.
  let expanded = $state<string | null>(null);
  $effect(() => {
    if (!open) expanded = null;
  });

  function folderOpen(folderId: string, content: readonly string[]): boolean {
    return expanded === folderId || (currentSpace !== null && content.includes(currentSpace));
  }

  function folderUnread(content: readonly string[]): UnreadCount {
    return content.reduce((total, id) => addUnread(total, spaceUnread.get(id) ?? NO_UNREAD), {
      unread: 0,
      highlight: 0,
    });
  }

  function badgeLabel(counts: UnreadCount): string | undefined {
    if (counts.highlight > 0) return i18n.t('nav.unreadMentions', { count: counts.highlight });
    if (counts.unread > 0) return i18n.t('nav.unreadMessages', { count: counts.unread });
    return undefined;
  }

  // The swipe back: a drag left on the open panel closes it past a third.
  let push = $state<number | null>(null);
  let gesture: { x: number; y: number; horizontal: boolean | null } | null = null;

  function touchStart(event: TouchEvent): void {
    const touch = event.touches.item(0);
    if (!open || event.touches.length !== 1 || !touch) return;
    gesture = { x: touch.clientX, y: touch.clientY, horizontal: null };
  }

  function touchMove(event: TouchEvent): void {
    const touch = event.touches.item(0);
    if (!gesture || !touch) return;
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    gesture.horizontal ??=
      Math.abs(dx) > 6 || Math.abs(dy) > 6 ? Math.abs(dx) > Math.abs(dy) : null;
    if (gesture.horizontal === false) {
      gesture = null;
      push = null;
      return;
    }
    if (gesture.horizontal) push = Math.min(0, dx);
  }

  function touchEnd(): void {
    const travelled = push ?? 0;
    gesture = null;
    push = null;
    if (travelled < -panelWidth / 3) onClose();
  }

  let panelWidth = $state(80);

  // How much of the panel shows: all of it when open (less a swipe back), or
  // as much as a swipe from the edge has pulled.
  let shown = $derived(
    open ? panelWidth + (push ?? 0) : Math.min(panelWidth, Math.max(0, pull ?? 0))
  );
  let moving = $derived(push !== null || (pull !== null && !open));

  function keydown(event: KeyboardEvent): void {
    if (open && event.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={keydown} />

{#snippet spaceTile(space: RoomListItemView, inFolder: boolean)}
  {@const counts = spaceUnread.get(space.room_id) ?? NO_UNREAD}
  {@const current = currentSpace === space.room_id}
  <li>
    <button
      type="button"
      class={['echo-m-tile', { 'in-folder': inFolder }]}
      aria-current={current ? 'page' : undefined}
      aria-label={space.name ?? space.room_id}
      aria-describedby={badgeLabel(counts) ? `echo-m-tile-${space.room_id}` : undefined}
      onclick={() => {
        onChoose({ kind: 'space', spaceId: space.room_id });
      }}
    >
      <Avatar id={space.room_id} src={space.avatar_url} name={space.name} size="medium" />
      <UnreadBadge {counts} aria-hidden="true" />
    </button>
    {#if badgeLabel(counts)}
      <span id={`echo-m-tile-${space.room_id}`} class="echo-m-sr">{badgeLabel(counts)}</span>
    {/if}
  </li>
{/snippet}

<div
  class={['echo-m-drawer', { open, moving }]}
  style:--echo-m-drawer-shown={String(panelWidth > 0 ? shown / panelWidth : 0)}
  inert={!open}
>
  <button
    type="button"
    class="echo-m-drawer-scrim"
    tabindex="-1"
    aria-label={i18n.t('common.close')}
    onclick={onClose}
  ></button>
  <!-- The touch handlers are the swipe back; the scrim and Escape are the accessible ways. -->
  <nav
    class="echo-m-drawer-panel"
    aria-label="Spaces"
    bind:clientWidth={panelWidth}
    ontouchstart={touchStart}
    ontouchmove={touchMove}
    ontouchend={touchEnd}
    ontouchcancel={touchEnd}
  >
    <ul class="echo-m-drawer-list">
      <li>
        <button
          type="button"
          class="echo-m-tile echo-m-tile-home"
          aria-current={place.kind === 'home' ? 'page' : undefined}
          aria-label={i18n.t('nav.home')}
          onclick={() => {
            onChoose({ kind: 'home' });
          }}
        >
          <HouseIcon weight={place.kind === 'home' ? 'fill' : 'regular'} />
          <UnreadBadge counts={homeUnread} aria-hidden="true" />
        </button>
      </li>
      <li class="echo-m-drawer-separator" role="separator"></li>
      {#each entries as entry (entry.kind === 'folder' ? entry.id : entry.room_id)}
        {#if entry.kind === 'space'}
          {@const space = byId.get(entry.room_id)}
          {#if space}{@render spaceTile(space, false)}{/if}
        {:else}
          {@const content = entry.content.filter((id) => byId.has(id))}
          {@const name =
            folderName(entry, (id) => byId.get(id)?.name ?? null) ?? i18n.t('nav.folder')}
          {#if content.length > 0}
            {#if folderOpen(entry.id, content)}
              <li class="echo-m-folder open">
                <button
                  type="button"
                  class="echo-m-folder-caret"
                  aria-expanded="true"
                  aria-label={name}
                  onclick={() => {
                    if (currentSpace !== null && content.includes(currentSpace)) {
                      onChoose({ kind: 'home' });
                    }
                    expanded = null;
                  }}
                >
                  <CaretUpIcon />
                </button>
                <ul>
                  {#each content as id (id)}
                    {@const space = byId.get(id)}
                    {#if space}{@render spaceTile(space, true)}{/if}
                  {/each}
                </ul>
              </li>
            {:else}
              {@const counts = folderUnread(content)}
              <li>
                <button
                  type="button"
                  class="echo-m-tile echo-m-folder-tile"
                  aria-expanded="false"
                  aria-label={name}
                  onclick={() => {
                    expanded = entry.id;
                  }}
                >
                  <span class="echo-m-folder-grid" aria-hidden="true">
                    {#each content.slice(0, 4) as id (id)}
                      {@const space = byId.get(id)}
                      {#if space}
                        <Avatar
                          id={space.room_id}
                          src={space.avatar_url}
                          name={space.name}
                          size="tiny"
                        />
                      {/if}
                    {/each}
                  </span>
                  <UnreadBadge {counts} aria-hidden="true" />
                </button>
              </li>
            {/if}
          {/if}
        {/if}
      {/each}
    </ul>
  </nav>
</div>
