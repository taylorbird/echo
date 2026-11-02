<!-- echo: the parted rail (echo/design/SPEC.md §3.3–3.5). Opening home, the
     rooms outside spaces, or a space splits the rail: the open tile sits on a
     lighter band, and the band carries the sub-filters, the selected one
     wearing the "you are here" pill. Hooked into Sable's NavigationRail.svelte
     after every rail tile; it renders only for the open, partable one. -->
<script lang="ts" module>
  // The picked sub-filter (SPEC §3.5). The room list reads it from
  // `data-echo-filter` on <html> (echo/styles/roomlist.css), so Sable's list
  // needs no change to be filtered.
  type EchoRailFilter = 'all' | 'rooms' | 'dms' | 'recent';

  const railFilter = $state<{ value: EchoRailFilter }>({ value: 'all' });

  function showRailFilter(owner: string, value: EchoRailFilter): void {
    const root = document.documentElement;
    root.dataset.echoFilterOwner = owner;
    root.dataset.echoFilter = value;
  }

  // Unless another band has taken the filter over since.
  function hideRailFilter(owner: string): void {
    const root = document.documentElement;
    if (root.dataset.echoFilterOwner !== owner) return;
    delete root.dataset.echoFilterOwner;
    delete root.dataset.echoFilter;
  }
</script>

<script lang="ts">
  import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
  import HashIcon from 'phosphor-svelte/lib/HashIcon';
  import StackIcon from 'phosphor-svelte/lib/StackIcon';
  import UserIcon from 'phosphor-svelte/lib/UserIcon';
  import type { Component } from 'svelte';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { findRoomByPathId, roomPathParam, useRoomList } from '#lib/rooms/room-list.svelte.js';
  import { hasUnread } from '#lib/rooms/unread.js';
  import { preferences } from '#lib/settings/preferences.svelte.js';
  import Avatar from '#lib/ui/primitives/Avatar.svelte';
  import UnreadBadge from '#lib/ui/primitives/UnreadBadge.svelte';
  import { echoActive } from '../active.js';
  import { echoRoomPath } from '../places.js';

  interface Props {
    /** The rail tile this follows; only the fields that say what it is. */
    item: { href: string; section?: string; initial?: string; dm?: boolean };
    active: boolean;
  }

  let { item, active }: Props = $props();

  type Filter = { value: EchoRailFilter; label: string; icon: Component };

  const ALL: Filter = { value: 'all', label: 'All chats', icon: StackIcon };
  const ROOMS: Filter = { value: 'rooms', label: 'Rooms', icon: HashIcon };
  const DMS: Filter = { value: 'dms', label: 'Direct messages', icon: UserIcon };
  const RECENT: Filter = { value: 'recent', label: 'Recent', icon: ClockIcon };

  // Every place that parts the rail gets the same four (SPEC §3.5): home, the
  // rooms outside spaces, and each space, whose DMs echo/space-dms.ts adds.
  // The rooms outside spaces only while Home is off: with Home their tile is
  // hidden (echo/styles/rail.css), and a band under it would be an empty strip.
  let partable = $derived(
    item.section === 'home' ||
      (item.section === 'unspaced' && !preferences.showHome) ||
      (item.initial !== undefined && item.dm !== true)
  );
  const filters: Filter[] = [ALL, ROOMS, DMS, RECENT];
  let open = $derived(active && partable && echoActive());

  // Up to three unread one-to-one DMs, newest first, sit at the top of the open
  // band (SPEC §3.6); Sable's own unread-DM tiles hide while it is open
  // (echo/styles/rail.css). The open room is left out, as Sable does. Each
  // opens in the place that is open, as any room does (echo/places.ts).
  const roomList = useRoomList();
  let openRoomId = $derived(findRoomByPathId(roomList.rooms, page.params.roomId)?.room_id);
  let unreadDms = $derived(
    open
      ? roomList.rooms
          .filter(
            (room) =>
              room.state === 'joined' &&
              room.is_direct &&
              room.direct_targets.length === 1 &&
              room.room_id !== openRoomId &&
              hasUnread(roomList.badgeUnreadFor(room))
          )
          .sort(
            (left, right) =>
              (right.latest_event?.timestamp ?? 0) - (left.latest_event?.timestamp ?? 0)
          )
          .slice(0, 3)
      : []
  );

  // A newly opened place starts unfiltered.
  $effect(() => {
    if (!open) return;
    railFilter.value = 'all';
    return () => {
      hideRailFilter(item.href);
    };
  });

  $effect(() => {
    if (open) showRailFilter(item.href, railFilter.value);
  });
</script>

{#if open}
  <div class="echo-rail-band" role="group" aria-label="Show">
    <div class="echo-rail-band-inner">
      <div class="echo-sub-divider" role="separator"></div>
      {#if unreadDms.length > 0}
        {#each unreadDms as room (room.room_id)}
          {@const name = room.name ?? room.room_id}
          <!-- eslint-disable svelte/no-navigation-without-resolve -- echoRoomPath() resolves the route itself -->
          <a
            class="rail-item nav-tab nav-tab-side space-item echo-rail-dm"
            href={echoRoomPath(roomList.rooms, room.room_id, page.url.pathname) ??
              resolve('/(app)/direct/[roomId]', {
                roomId: roomPathParam(room, roomList.rooms),
              })}
            aria-label={name}
            title={name}
          >
            <Avatar class="space-initial" id={room.room_id} src={room.avatar_url} {name} uniform />
            <UnreadBadge counts={roomList.badgeUnreadFor(room)} dm />
          </a>
          <!-- eslint-enable svelte/no-navigation-without-resolve -->
        {/each}
        <div class="echo-sub-divider" role="separator"></div>
      {/if}
      {#each filters as filter (filter.value)}
        <button
          type="button"
          class="echo-sub-filter"
          aria-label={filter.label}
          title={filter.label}
          aria-pressed={railFilter.value === filter.value}
          onclick={() => {
            railFilter.value = filter.value;
          }}
        >
          <filter.icon />
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .echo-rail-band {
    align-self: stretch;
    display: grid;
    grid-template-rows: 1fr;
    min-height: 0;
  }

  .echo-rail-band-inner {
    align-items: stretch;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  /* Engraved, like the rail's own dividers (SPEC §3.4). */
  .echo-sub-divider {
    align-self: center;
    background: rgb(0 0 0 / 40%);
    box-shadow: 0 1px 0 rgb(var(--echo-warm-rgb) / 8%);
    flex: none;
    height: 1px;
    margin: 0.4375rem 0 0.3125rem;
    width: 2.5rem;
  }

  /* Full rail width, so the selected one is a band across the layer; glyphs
     smaller than the tiles, since these belong to the tile above (SPEC §3.5). */
  .echo-sub-filter {
    align-items: center;
    background: none;
    border: 0;
    border-radius: 0;
    color: var(--echo-text-2);
    cursor: default;
    display: flex;
    flex: none;
    height: 3.125rem;
    justify-content: center;
    padding: 0;
    position: relative;
  }

  .echo-sub-filter:hover,
  .echo-sub-filter:focus-visible {
    background: var(--echo-entry-hover);
    color: var(--echo-text);
    outline: none;
  }

  /* The selected one is marked by the pill alone: the same pill as the
     tiles', at the same x. Its glyph and ground stay as they are. */
  .echo-sub-filter[aria-pressed='true']::before {
    background: var(--echo-accent-glow);
    border-radius: 999px;
    box-shadow:
      0 0 6px var(--echo-accent-near),
      0 0 14px var(--echo-accent-far);
    content: '';
    height: 1.5625rem;
    inset-block: 0;
    left: calc((var(--navigation-rail-width) - 3.125rem) / 2 - 0.75rem);
    margin-block: auto;
    position: absolute;
    width: 0.1875rem;
  }

  .echo-sub-filter :global(svg) {
    height: 1.4375rem;
    width: 1.4375rem;
  }

  /* The band opens on the house curve, contents fading in ahead of it. */
  @keyframes echo-band-part {
    from {
      grid-template-rows: 0fr;
    }
  }

  @keyframes echo-band-fade {
    0% {
      opacity: 0;
    }

    55%,
    100% {
      opacity: 1;
    }
  }

  /* Gated on Sable's setting only, not the system query (echo/motion.ts). */
  :global(html:not([data-reduced-motion='on'])) .echo-rail-band {
    /* stylelint-disable-next-line defensive-css/require-prefers-reduced-motion */
    animation: echo-band-part 0.42s cubic-bezier(0.32, 0.72, 0, 1);
  }

  :global(html:not([data-reduced-motion='on'])) .echo-rail-band-inner {
    /* stylelint-disable-next-line defensive-css/require-prefers-reduced-motion */
    animation: echo-band-fade 0.42s cubic-bezier(0.32, 0.72, 0, 1);
  }
</style>
