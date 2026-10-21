// echo: "New chat" in the rail's create (+) menu. Sable offers it only in the
// direct messages section, whose rail tile echo hides (echo/styles/rail.css),
// so it opens the same page from here: /direct's form for starting a DM.
// Spread into NavigationRail.svelte's create entries. Desktop only.

import ChatCircleDotsIcon from 'phosphor-svelte/lib/ChatCircleDotsIcon';
import { resolve } from '$app/paths';
import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
import { echoActive } from './active.js';

export function echoCreateEntries() {
  if (!echoActive() || !matchMedia(BREAKPOINTS.appLayout).matches) return [];
  return [{ href: resolve('direct'), label: 'nav.newChat', icon: ChatCircleDotsIcon }] as const;
}
