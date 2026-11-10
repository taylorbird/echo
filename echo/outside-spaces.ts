// The rooms outside spaces' glyph: a globe, as echo had it (SPEC §3, item 2).
// It marks their rail tile (hooked into Sable's NavigationRail.svelte, which
// otherwise draws a hash) and, in All chats, the space lane of a row that is in
// no space (components/RoomSpaces.svelte), so the two read as the same place.

import GlobeIcon from 'phosphor-svelte/lib/GlobeIcon';
import { echoActive } from './active.js';

export const OutsideSpacesIcon = GlobeIcon;

/** The rooms outside spaces' rail icon: echo's globe, or Sable's own with echo off. */
export function echoUnspacedIcon<T>(sable: T): T | typeof GlobeIcon {
  return echoActive() ? GlobeIcon : sable;
}
