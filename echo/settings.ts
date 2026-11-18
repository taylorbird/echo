// echo's own settings, as panels in Sable's settings pages. Hooked into
// src/lib/features/settings/category-panels.ts. They live on this device, not
// in Sable's synced preferences.
//
// echo also has a category of its own in the settings list, "echo"
// (echo/settings-category.ts), for settings that belong to no Sable page.

import { MediaQuery } from 'svelte/reactivity';
import type { CategoryPanel } from '#lib/features/settings/category-panels.js';
import { electronBridge } from '#lib/platform/electron.js';
import { supportsAutoUpdate } from '#lib/platform/updates.js';
import { BREAKPOINTS } from '#lib/ui/breakpoints.js';
import { echoActive } from './active.js';
import EchoSettings from './components/EchoSettings.svelte';
import PhoneLayoutSettings from './components/PhoneLayoutSettings.svelte';
import ReactionSettings from './components/ReactionSettings.svelte';
import UpdateSettings from './components/UpdateSettings.svelte';

/** echo's category (echo/settings-category.ts): the desktop room list. */
export const echoRoomListSettings: CategoryPanel = {
  component: EchoSettings,
  section: 'echo-room-list',
  when: () => echoActive() && desktop.current,
};

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
 * echo's category, on a phone: where the room list keeps its spaces
 * (echo/mobile/layout.svelte.ts). Was under Appearance until 1.7.
 */
export const echoPhoneLayoutSettings: CategoryPanel = {
  component: PhoneLayoutSettings,
  section: 'echo-room-list',
  when: () => echoActive() && !desktop.current,
};

/** echo's category, in the desktop app: "Update without asking" (echo/updates.svelte.ts). */
export const echoUpdateSettings: CategoryPanel = {
  component: UpdateSettings,
  section: 'echo-updates',
  when: () => echoActive() && electronBridge() !== undefined && supportsAutoUpdate(),
};

/** Everything in echo's own category (echo/settings-category.ts), in order. */
export const echoCategoryPanels: CategoryPanel[] = [
  echoRoomListSettings,
  echoPhoneLayoutSettings,
  echoUpdateSettings,
];
