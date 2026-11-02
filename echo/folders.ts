// echo: a space folder in the rail is open exactly while one of its spaces is.
// Sable opens and closes a folder on its own (the open ones are remembered), so
// an open folder can sit there with none of its spaces open, a step echo's rail
// doesn't have. Here clicking a closed folder opens a space in it, the last one
// you were in or else its first, and the folder's caret goes Home, which closes
// it. Hooked into NavigationRail.svelte's folderOpen and the folder's two
// buttons. Desktop only.

import { resolve } from '$app/paths';
import type { SidebarFolder } from '#lib/spaces/sidebar-layout.js';
import { preferences } from '#lib/settings/preferences.svelte.js';
import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
import { echoActive } from './active.js';

const LAST_SPACE_KEY = 'echo.folderLastSpace';

function desktop(): boolean {
  return echoActive() && matchMedia(BREAKPOINTS.appLayout).matches;
}

function lastSpaces(): Partial<Record<string, string>> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(LAST_SPACE_KEY) ?? '{}');
    return stored !== null && typeof stored === 'object' ? stored : {};
  } catch {
    return {};
  }
}

/**
 * Whether the folder is open: when one of its spaces is (`isOpen`), which it
 * also remembers as the folder's last space. Null where Sable's own open state
 * stands: echo off, or a phone.
 */
export function echoFolderOpen(
  folder: SidebarFolder,
  isOpen: (roomId: string) => boolean
): boolean | null {
  if (!desktop()) return null;
  const open = folder.content.find(isOpen);
  if (open === undefined) return false;

  const last = lastSpaces();
  if (last[folder.id] !== open) {
    last[folder.id] = open;
    try {
      localStorage.setItem(LAST_SPACE_KEY, JSON.stringify(last));
    } catch {
      // Not remembered: the folder's first space opens next time.
    }
  }
  return true;
}

/**
 * A closed folder was clicked: opens its last space if it still holds it, else
 * its first (`spaces` are the ones the client knows). False where Sable should
 * expand the folder instead.
 */
export function echoEnterFolder(
  folder: SidebarFolder,
  spaces: readonly string[],
  openSpace: (roomId: string) => void
): boolean {
  if (!desktop()) return false;
  const last = lastSpaces()[folder.id];
  const target = last !== undefined && spaces.includes(last) ? last : spaces.at(0);
  if (target === undefined) return false;
  openSpace(target);
  return true;
}

/** The open folder's caret was clicked: goes Home. False where Sable should collapse it. */
export function echoLeaveFolder(navigate: (href: string) => void): boolean {
  if (!desktop()) return false;
  navigate(preferences.showHome ? resolve('/(app)/home') : resolve('/(app)/rooms'));
  return true;
}
