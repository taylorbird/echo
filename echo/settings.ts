// echo's own settings, as panels in Sable's settings pages. Hooked into
// src/lib/features/settings/category-panels.ts. They live on this device, not
// in Sable's synced preferences.

import type { CategoryPanel } from '#lib/features/settings/category-panels.js';
import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
import { echoActive } from './active.js';
import ReactionSettings from './components/ReactionSettings.svelte';

// Phones keep Sable's room list, so its settings are desktop only.
function desktop(): boolean {
  return echoActive() && matchMedia(BREAKPOINTS.appLayout).matches;
}

/** Notifications: the room list's reactions (echo/reactions.svelte.ts). */
export const echoReactionSettings: CategoryPanel = { component: ReactionSettings, when: desktop };
