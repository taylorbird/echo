// echo's start-up: the defaults where echo and Sable differ, and the macOS window
// chrome. Imported once, for its effects, from src/routes/+layout.svelte.

import { isTauri } from '@tauri-apps/api/core';
import { type as osType } from '@tauri-apps/plugin-os';
import { electronBridge } from '#lib/platform/electron.js';
import { supportsDesktopWindow } from '#lib/platform/window-decorations.js';
import { applyDeploymentDefaults } from '#lib/settings/preferences.svelte.js';
import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
import { startEcho } from './active.js';
import { closePanelOnEscape } from './panels.js';
import { expandOnMarkerClick } from './sections.js';

const browser = typeof document !== 'undefined';
if (browser) startEcho();

// Which OS the app runs on, in Tauri's names, or null in a browser tab. The
// desktop app is Electron; Tauri builds (echo 1.0, mobile) still get the look.
function appOs(): string | null {
  const electron = electronBridge();
  if (electron) {
    if (electron.platform === 'darwin') return 'macos';
    return electron.platform === 'win32' ? 'windows' : 'linux';
  }
  return isTauri() ? osType() : null;
}

const os = browser ? appOs() : null;
// The app's look (echo/styles/frame.css, popups.css) keys on this; a browser
// tab keeps the flat frame.
if (os) document.documentElement.dataset.echoApp = os;
const macApp = os === 'macos';
const tauriMac = macApp && supportsDesktopWindow();
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
// Electron drags from a region's whole box instead; there the same bands are
// drag regions in CSS, with their controls cut out (echo/styles/frame.css).
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

if (tauriMac) {
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

// Sable's pages title themselves "… - Sable"; the window menu and Mission
// Control show that, so the suffix is swapped here rather than in each page.
function brandTitle(): void {
  if (document.title.endsWith(' - Sable')) {
    document.title = `${document.title.slice(0, -' - Sable'.length)} - echo`;
  }
}

if (browser) {
  brandTitle();
  new MutationObserver(brandTitle).observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

if (browser) closePanelOnEscape();
if (browser) expandOnMarkerClick();
