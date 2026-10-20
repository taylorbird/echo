// echo's start-up: the defaults where echo and Sable differ, and the macOS window
// chrome. Imported once, for its effects, from src/routes/+layout.svelte.

import { type as osType } from '@tauri-apps/plugin-os';
import { supportsDesktopWindow } from '#lib/platform/window-decorations.js';
import { applyDeploymentDefaults } from '#lib/settings/preferences.svelte.js';
import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
import { startEcho } from './active.js';
import { closePanelOnEscape } from './panels.js';

const browser = typeof document !== 'undefined';
if (browser) startEcho();
const macApp = browser && supportsDesktopWindow() && osType() === 'macos';
// Phones keep Sable's UI until echo has its own (echo/README.md).
const desktop = browser && matchMedia(BREAKPOINTS.appLayout).matches;

// Defaults only: a setting the person has changed keeps their value.
applyDeploymentDefaults({
  // echo's rail starts with "All chats", every room in one list: Sable's Home.
  ...(desktop ? { showHome: true } : {}),
  // echo has no title-bar band on macOS. Sable's own title bar puts the window in
  // overlay style, so the panes can run to the top edge (echo/styles/frame.css);
  // without it, macOS draws its own bar across the top.
  ...(macApp ? { useCustomTitleBar: true } : {}),
});

// In the overlay window only the rail keeps a drag strip under the traffic
// lights, so the bands echo dragged by — the room list's header and the room
// and panel headers — become drag regions too. Tauri drags only from the
// element carrying the attribute, so the buttons in them still click.
const DRAG_SURFACES = [
  '.room-nav-header',
  '.room-header',
  '.room-header > .main',
  '.room-identity',
  '.room-identity > h1',
  '.room-view aside > .panel-header',
].join(', ');

function markDragSurfaces(root: ParentNode): void {
  for (const element of root.querySelectorAll(DRAG_SURFACES)) {
    if (!element.hasAttribute('data-tauri-drag-region')) {
      element.setAttribute('data-tauri-drag-region', '');
    }
  }
}

if (macApp) {
  const start = () => {
    markDragSurfaces(document);
    // Once a frame at most: the timeline mutates constantly.
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        markDragSurfaces(document);
      });
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}

if (browser) closePanelOnEscape();
