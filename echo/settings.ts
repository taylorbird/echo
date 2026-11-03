// echo's own settings, as panels in Sable's settings pages. Hooked into
// src/lib/features/settings/category-panels.ts. They live on this device, not
// in Sable's synced preferences.

import type { CategoryPanel } from '#lib/features/settings/category-panels.js';
import { echoActive } from './active.js';
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
