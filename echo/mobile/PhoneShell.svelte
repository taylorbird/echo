<!-- echo's phone shell: two screens, the room list (RoomListScreen.svelte) and
     whatever page is open (a room, settings, …), pushed over it from the right
     as on iOS, and dragged back off it from the left edge.

     Which screen shows follows the same state Sable's MobileNavDrawer keeps
     (`page.state.mobileDrawer`, the route), so Sable's own back buttons
     (backToRoomList), room links (goToPage) and deep links keep working
     unchanged. Styles: echo/styles/mobile.css. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import BackIcon from 'phosphor-svelte/lib/CaretLeftIcon';
  import { i18n } from '#lib/i18n.js';
  import { providePageMeta } from '#lib/core/page-meta.js';
  import { backToRoomList } from '#lib/features/room/room-navigation.js';
  import UserQuickTools from '#lib/features/sidebar/UserQuickTools.svelte';
  import CoreHealthBanner from '#lib/ui/CoreHealthBanner.svelte';
  import PanelHeader from '#lib/ui/primitives/PanelHeader.svelte';
  import PanelHeaderButton from '#lib/ui/primitives/PanelHeaderButton.svelte';
  import RoomListScreen from './RoomListScreen.svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  // As in MobileNavDrawer.svelte: the routes whose index is the room list, and
  // the app-level pages that carry the bottom bar instead.
  const LIST_INDEX_PATHS = new Set(['/home', '/rooms', '/direct']);
  const PINNED_LIST_PATHS = new Set(['/home', '/rooms']);
  const QUICK_TOOLS_PATHS = new Set(['/navigate', '/inbox', '/profile', '/alerts']);
  // How far from the left edge a drag starts going back, and how far it must go.
  const EDGE = 28;
  const BACK_FRACTION = 0.35;

  let pathname = $derived(page.url.pathname);
  let spaceIndex = $derived(/^\/space\/[^/]+$/.test(pathname));
  let spaceLobby = $derived(/^\/space\/[^/]+\/lobby$/.test(pathname));
  let settingsPage = $derived(/^\/settings(\/[^/]+)?$/.test(pathname));
  let quickTools = $derived(QUICK_TOOLS_PATHS.has(pathname));
  let pinnedList = $derived(PINNED_LIST_PATHS.has(pathname) || spaceIndex);
  let defaultList = $derived(LIST_INDEX_PATHS.has(pathname) || spaceIndex);
  let listOpen = $derived(
    quickTools
      ? false
      : pinnedList ||
          (page.state.mobileDrawer === undefined ? defaultList : page.state.mobileDrawer === 'open')
  );
  let backBar = $derived(
    !listOpen && !quickTools && !spaceLobby && !settingsPage && page.params.roomId === undefined
  );

  const pageMeta = $state({ title: '' });
  providePageMeta(pageMeta);

  // The swipe back: a drag that starts at the left edge of the open page.
  let drag = $state<number | null>(null);
  let gesture: { x: number; y: number; width: number; horizontal: boolean | null } | null = null;

  function touchStart(event: TouchEvent): void {
    const touch = event.touches.item(0);
    if (listOpen || pinnedList || quickTools || event.touches.length !== 1 || !touch) return;
    if (touch.clientX > EDGE) return;
    gesture = { x: touch.clientX, y: touch.clientY, width: window.innerWidth, horizontal: null };
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
      drag = null;
      return;
    }
    if (gesture.horizontal) drag = Math.max(0, dx);
  }

  function touchEnd(cancelled: boolean): void {
    const travelled = drag ?? 0;
    const width = gesture?.width ?? 1;
    gesture = null;
    drag = null;
    if (!cancelled && travelled > width * BACK_FRACTION) backToRoomList();
  }
</script>

<div
  class={['echo-m-shell', { 'list-open': listOpen, dragging: drag !== null }]}
  style:--echo-m-drag={drag === null ? undefined : `${String(drag)}px`}
>
  <section class="echo-m-screen echo-m-list" inert={!listOpen} aria-label={i18n.t('nav.primary')}>
    <CoreHealthBanner />
    <RoomListScreen />
    <div class="echo-m-tabs"><UserQuickTools mobile /></div>
  </section>
  <!-- The touch handlers are the swipe back; the back button is the accessible way. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <section
    class={[
      'echo-m-screen echo-m-content',
      { 'with-quick-tools': quickTools, 'with-back-bar': backBar },
    ]}
    inert={listOpen}
    ontouchstart={touchStart}
    ontouchmove={touchMove}
    ontouchend={() => {
      touchEnd(false);
    }}
    ontouchcancel={() => {
      touchEnd(true);
    }}
  >
    {#if !listOpen}<CoreHealthBanner />{/if}
    {#if backBar}
      <PanelHeader class="mobile-back-bar" title={pageMeta.title}>
        {#snippet prefix()}
          <PanelHeaderButton
            class="back-button"
            label={i18n.t('timeline.back')}
            onclick={backToRoomList}
          >
            <BackIcon />
          </PanelHeaderButton>
        {/snippet}
      </PanelHeader>
    {/if}
    <div id="main-content" class="echo-m-main" tabindex="-1">
      {@render children()}
    </div>
    {#if quickTools}
      <div class="echo-m-tabs"><UserQuickTools mobile /></div>
    {/if}
  </section>
</div>
