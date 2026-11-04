// echo's own settings, as panels in Sable's settings pages. Hooked into
// src/lib/features/settings/category-panels.ts. They live on this device, not
// in Sable's synced preferences.

import { MediaQuery } from 'svelte/reactivity';
import type { CategoryPanel } from '#lib/features/settings/category-panels.js';
import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
import { echoActive } from './active.js';
import PhoneLayoutSettings from './components/PhoneLayoutSettings.svelte';
import ReactionSettings from './components/ReactionSettings.svelte';

/**
 * Notifications: the room list's reactions (echo/reactions.svelte.ts). Both
 * echo room lists show them, the desktop's and the phone's
 * (echo/mobile/RoomListScreen.svelte).
 */
export const echoReactionSettings: CategoryPanel = {
  component: ReactionSettings,
  when: echoActive,
};

const desktop = new MediaQuery(BREAKPOINTS.appLayout);

/**
 * Appearance, on a phone: where the room list keeps its spaces
 * (echo/mobile/layout.svelte.ts).
 */
export const echoPhoneLayoutSettings: CategoryPanel = {
  component: PhoneLayoutSettings,
  when: () => echoActive() && !desktop.current,
};
