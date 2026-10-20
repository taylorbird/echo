// echo's right panel (echo/design/SPEC.md §8): opened by its header button and
// closed by that button again, by the panel's own close button, by Esc, or by
// opening another room. Sable remembered an open members panel and showed it in
// every room, open from the first start.

import { BREAKPOINTS } from '#lib/ui/breakpoints.js';

import type { RoomPanels } from '#lib/features/room/room-panels.svelte.js';

/**
 * A room's panels, starting closed. Hooked into RoomView, which makes one set
 * per room: Sable's remembered members panel is not reopened, so each room
 * opens with the panel closed. On a phone the panel is a sheet and Sable's
 * own handling stays.
 */
export function echoRoomPanels(panels: RoomPanels): RoomPanels {
  if (matchMedia(BREAKPOINTS.appLayout).matches) panels.desktopMembersOpen = false;
  return panels;
}

// The open right panel's close button: the last button in its header.
const CLOSE_BUTTON = '.room-view aside .panel-header .suffix > .panel-header-button:last-child';
// Anything that should take Esc first.
const OVERLAY =
  '[role="dialog"], [role="menu"], [role="listbox"], [data-state="open"][role="tooltip"]';

/** Esc closes the open right panel, as in echo, when nothing else used it. */
export function closePanelOnEscape(): void {
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
    if (!matchMedia(BREAKPOINTS.appLayout).matches) return;
    if (document.querySelector(OVERLAY)) return;
    const close = document.querySelector<HTMLButtonElement>(CLOSE_BUTTON);
    if (!close) return;
    event.preventDefault();
    close.click();
  });
}
