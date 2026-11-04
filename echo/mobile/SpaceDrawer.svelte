<!-- echo's space drawer on a phone: the space strip's tiles
     (SpaceTiles.svelte) in a narrow column that slides over the room list
     from the left. RoomListScreen.svelte opens it with a swipe from the left
     edge, and passes `pull` while that swipe is under way. A tap on the scrim,
     a swipe back left or Escape closes it. Styles: echo/styles/mobile.css. -->
<script lang="ts">
  import { i18n } from '#lib/i18n.js';
  import type { Place } from './place.js';
  import SpaceTiles from './SpaceTiles.svelte';

  interface Props {
    open: boolean;
    /** How far a swipe from the edge has pulled the closed drawer, in px. */
    pull: number | null;
    place: Place;
    onChoose: (place: Place) => void;
    onClose: () => void;
  }

  let { open, pull, place, onChoose, onClose }: Props = $props();

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
    aria-label="Space drawer"
    bind:clientWidth={panelWidth}
    ontouchstart={touchStart}
    ontouchmove={touchMove}
    ontouchend={touchEnd}
    ontouchcancel={touchEnd}
  >
    <SpaceTiles {place} {onChoose} direction="column" idPrefix="echo-m-drawer" shown={open} />
  </nav>
</div>
