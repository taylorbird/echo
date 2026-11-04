<!-- echo's room list on a phone (PhoneShell.svelte's first screen). The rows are
     echo's (echo/design/SPEC.md §4.3–4.4): a round avatar, the name with its
     kind glyph and the time, a "Sender: text" line in the sender's colour, and
     the desktop's badge ring (components/RoomRing.svelte).

     Where to look works as on the desktop: a place, Home or a space, picked in
     the space drawer (SpaceDrawer.svelte, the desktop rail's places), and the
     rail's four sub-filters as chips under the title (SPEC §3.5): All chats,
     in sections, Rooms, Direct messages, and Recent, one list newest first.
     The drawer opens from the place button by the title or a swipe from the
     left edge. Sable's own bottom bar (UserQuickTools) stays below for the
     app-level pages: search, inbox, account. Data, unread counts, invites and
     navigation are Sable's. Styles: echo/styles/mobile.css. -->
<script lang="ts">
  import type { RoomListItemView } from '#src/generated/protocol';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import HouseIcon from 'phosphor-svelte/lib/HouseIcon';
  import NotePencilIcon from 'phosphor-svelte/lib/NotePencilIcon';
  import { useCoreClient } from '#lib/core/context.js';
  import { goToPage } from '#lib/features/room/room-navigation.js';
  import { isDeclining } from '#lib/rooms/invites.svelte.js';
  import { dismissedInvites } from '#lib/rooms/dismissed-invites.svelte.js';
  import { roomSectionPath } from '#lib/rooms/permalink.js';
  import {
    roomAvatarUrl,
    roomLabel,
    roomPathParam,
    useRoomList,
  } from '#lib/rooms/room-list.svelte.js';
  import { addUnread } from '#lib/rooms/spaces.js';
  import { hasUnread, type UnreadCount } from '#lib/rooms/unread.js';
  import { i18n } from '#lib/i18n.js';
  import { PeerProfiles } from '#lib/features/sidebar/peer-profiles.svelte.js';
  import { isActiveSpace, spaceDescendantRooms } from '#lib/features/sidebar/nav-rooms.js';
  import RoomInvites from '#lib/features/sidebar/RoomInvites.svelte';
  import Avatar from '#lib/ui/primitives/Avatar.svelte';
  import RoomIcon from '#lib/ui/primitives/RoomIcon.svelte';
  import TypingDots from '#lib/ui/primitives/TypingDots.svelte';
  import UnreadBadge from '#lib/ui/primitives/UnreadBadge.svelte';
  import { whenVisible } from '#lib/ui/when-visible.js';
  import EchoRoomPreview from '../components/RoomPreview.svelte';
  import EchoRoomRing from '../components/RoomRing.svelte';
  import {
    FILTERS,
    readFilter,
    readPlace,
    writeFilter,
    writePlace,
    type Filter,
    type Place,
  } from './place.js';
  import SpaceDrawer from './SpaceDrawer.svelte';
  import { listTime } from './time.js';

  const core = useCoreClient();
  const roomList = useRoomList();
  const profiles = new PeerProfiles(core);

  let place = $state<Place>(readPlace());
  let filter = $state<Filter>(readFilter());

  let chats = $derived(
    roomList.rooms.filter(
      (room) => room.state === 'joined' && !room.is_tombstoned && room.room_kind !== 'space'
    )
  );
  let spaces = $derived(roomList.rooms.filter(isActiveSpace));
  let spaceId = $derived(place.kind === 'space' ? place.spaceId : null);
  let space = $derived(spaces.find((room) => room.room_id === spaceId));

  // A space that's gone (left, or not synced yet) shows Home.
  let inPlace = $derived.by(() => {
    if (place.kind !== 'space' || space === undefined) return chats;
    const inside = new Set(
      spaceDescendantRooms(roomList.rooms, place.spaceId).map((room) => room.room_id)
    );
    return chats.filter((room) => inside.has(room.room_id));
  });

  function newestFirst(rooms: readonly RoomListItemView[]): RoomListItemView[] {
    return rooms.toSorted(
      (left, right) => (right.latest_event?.timestamp ?? 0) - (left.latest_event?.timestamp ?? 0)
    );
  }

  function filtered(target: Filter): RoomListItemView[] {
    if (target === 'dms') return inPlace.filter((room) => room.is_direct);
    if (target === 'rooms') return inPlace.filter((room) => !room.is_direct);
    return inPlace;
  }

  // All chats comes in two sections, direct messages over rooms, as the
  // desktop's list has headings; the rest are one list. Newest first within.
  type Section = { label: string | null; rows: RoomListItemView[] };
  let sections = $derived.by((): Section[] => {
    if (filter !== 'all') return [{ label: null, rows: newestFirst(filtered(filter)) }];
    return [
      { label: i18n.t('common.directMessages'), rows: newestFirst(filtered('dms')) },
      { label: i18n.t('nav.rooms'), rows: newestFirst(filtered('rooms')) },
    ].filter((section) => section.rows.length > 0);
  });
  let empty = $derived(sections.every((section) => section.rows.length === 0));

  let invites = $derived.by(() => {
    const pending = roomList.rooms.filter(
      (room) =>
        room.state === 'invited' &&
        !isDeclining(room.room_id) &&
        !dismissedInvites.has(room.room_id)
    );
    const here =
      place.kind === 'space' && space !== undefined
        ? pending.filter((room) =>
            new Set(space.space_children.map((child) => child.room_id)).has(room.room_id)
          )
        : pending;
    if (filter === 'dms') return here.filter((room) => room.is_direct);
    if (filter === 'rooms') return here.filter((room) => !room.is_direct);
    return here;
  });

  function filterUnread(target: Filter): UnreadCount {
    return filtered(target).reduce(
      (total, room) => addUnread(total, roomList.badgeUnreadFor(room)),
      { unread: 0, highlight: 0 }
    );
  }

  let title = $derived(
    place.kind === 'space' && space !== undefined
      ? (space.name ?? i18n.t('nav.space'))
      : i18n.t('nav.home')
  );

  function choose(next: Place): void {
    place = next;
    writePlace(next);
    drawerOpen = false;
  }

  function chooseFilter(next: Filter): void {
    filter = next;
    writeFilter(next);
  }

  // The chips: short labels, the desktop rail's full names for screen readers.
  const FILTER_LABELS: Record<Filter, { short: () => string; full: () => string }> = {
    all: { short: () => i18n.t('inbox.filterAll'), full: () => 'All chats' },
    rooms: { short: () => i18n.t('nav.rooms'), full: () => i18n.t('nav.rooms') },
    dms: { short: () => i18n.t('inbox.filterDirect'), full: () => i18n.t('common.directMessages') },
    recent: { short: () => 'Recent', full: () => 'Recent' },
  };

  function href(room: RoomListItemView): string {
    if (place.kind === 'space' && space !== undefined) {
      return resolve('/(app)/space/[spaceId]/[roomId]', {
        spaceId: roomPathParam(space, roomList.rooms),
        roomId: roomPathParam(room, roomList.rooms),
      });
    }
    return roomSectionPath(roomList.rooms, room.room_id);
  }

  function open(event: MouseEvent, target: string): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    goToPage(target);
  }

  // Sable's "New chat" form lives at /direct, behind its list on a phone.
  function newChat(): void {
    void goto(resolve('direct'), { state: { mobileDrawer: 'closed' } });
  }

  function peerOf(room: RoomListItemView): string | null {
    if (!room.is_direct || room.direct_targets.length !== 1) return null;
    return room.direct_targets[0];
  }

  function badgeLabel(counts: UnreadCount): string {
    if (counts.highlight > 0) return i18n.t('nav.unreadMentions', { count: counts.highlight });
    if (counts.unread > 0) return i18n.t('nav.unreadMessages', { count: counts.unread });
    return i18n.t('nav.markedUnread');
  }

  // The space drawer, and the swipe from the left edge that pulls it open.
  const EDGE = 28;
  let drawerOpen = $state(false);
  let pull = $state<number | null>(null);
  let gesture: { x: number; y: number; horizontal: boolean | null } | null = null;

  function touchStart(event: TouchEvent): void {
    const touch = event.touches.item(0);
    if (drawerOpen || event.touches.length !== 1 || !touch || touch.clientX > EDGE) return;
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
      pull = null;
      return;
    }
    if (gesture.horizontal) pull = Math.max(0, dx);
  }

  // Open once the swipe has pulled out a third of the panel's 5rem.
  function touchEnd(cancelled: boolean): void {
    const travelled = pull ?? 0;
    gesture = null;
    pull = null;
    if (!cancelled && travelled > 28) drawerOpen = true;
  }
</script>

<!-- The touch handlers are the swipe that opens the drawer; the place button is the accessible way. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="echo-m-rooms"
  ontouchstart={touchStart}
  ontouchmove={touchMove}
  ontouchend={() => {
    touchEnd(false);
  }}
  ontouchcancel={() => {
    touchEnd(true);
  }}
>
  <header class="echo-m-rooms-header">
    <button
      type="button"
      class="echo-m-place-button"
      aria-label="Spaces"
      aria-expanded={drawerOpen}
      onclick={() => {
        drawerOpen = true;
      }}
    >
      {#if place.kind === 'space' && space !== undefined}
        <Avatar id={space.room_id} src={space.avatar_url} name={space.name} size="small" />
      {:else}
        <HouseIcon weight="fill" />
      {/if}
    </button>
    <h1>{title}</h1>
    <button
      type="button"
      class="echo-m-icon-button"
      aria-label={i18n.t('nav.newChat')}
      onclick={newChat}
    >
      <NotePencilIcon />
    </button>
  </header>

  <nav class="echo-m-places" aria-label={i18n.t('nav.primary')}>
    {#each FILTERS as entry (entry)}
      {@const selected = filter === entry}
      <button
        type="button"
        class={['echo-m-chip', { selected, unread: !selected && hasUnread(filterUnread(entry)) }]}
        aria-pressed={selected}
        aria-label={FILTER_LABELS[entry].full()}
        onclick={() => {
          chooseFilter(entry);
        }}
      >
        <span class="echo-m-chip-label">{FILTER_LABELS[entry].short()}</span>
      </button>
    {/each}
  </nav>

  <div class="echo-m-scroll">
    <RoomInvites {invites} />
    {#if empty && invites.length === 0}
      <p class="echo-m-empty">
        {roomList.settled ? i18n.t('nav.chatsEmpty') : i18n.t('nav.roomsUnavailable')}
      </p>
    {/if}
    {#each sections as section (section.label ?? 'all')}
      {#if section.label}<h2 class="echo-m-section">{section.label}</h2>{/if}
      <ul class="echo-m-room-list" aria-label={section.label ?? title}>
        {#each section.rows as room (room.room_id)}
          {@const target = href(room)}
          {@const counts = roomList.badgeUnreadFor(room)}
          {@const name = roomLabel(room)}
          {@const avatar = roomAvatarUrl(room)}
          {@const peer = peerOf(room)}
          {@const typing = roomList.typingUserIds(room.room_id).length > 0}
          {@const time = listTime(room.latest_event?.timestamp)}
          <li
            class={[
              'echo-m-room',
              {
                unread: hasUnread(counts),
                dm: room.is_direct,
                mention: counts.highlight > 0,
                notify: (counts.notifying ?? 0) > 0,
              },
            ]}
            {@attach peer === null
              ? undefined
              : whenVisible(() => {
                  profiles.request(peer);
                })}
            {@attach whenVisible(
              () => {
                roomList.warm(room.room_id);
              },
              '0px',
              300
            )}
          >
            <!-- eslint-disable svelte/no-navigation-without-resolve -- href() resolves the route itself -->
            <a
              class="echo-m-room-link"
              href={target}
              onclick={(event) => {
                open(event, target);
              }}
            >
              <!-- eslint-enable svelte/no-navigation-without-resolve -->
              <span class="echo-m-room-avatar">
                {#if avatar || room.is_direct}
                  <Avatar id={room.room_id} src={avatar} {name} size="medium" uniform />
                {:else}
                  <span class="avatar-root echo-m-glyph" aria-hidden="true">
                    <RoomIcon roomKind={room.room_kind} joinRule={room.join_rule} />
                  </span>
                {/if}
              </span>
              <span class="echo-m-room-text">
                <span class="echo-m-room-name">{name}</span>
                <EchoRoomPreview {room} {profiles} />
                {#if time}<time class="echo-m-room-time" datetime={time.iso}>{time.label}</time
                  >{/if}
                <span class="echo-m-room-status">
                  <EchoRoomRing {room} />
                  {#if typing}
                    <TypingDots />
                  {:else}
                    <UnreadBadge
                      {counts}
                      dm={room.is_direct}
                      role="img"
                      aria-label={badgeLabel(counts)}
                    />
                  {/if}
                </span>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/each}
  </div>
</div>

<SpaceDrawer
  open={drawerOpen}
  {pull}
  {place}
  onChoose={choose}
  onClose={() => {
    drawerOpen = false;
  }}
/>
