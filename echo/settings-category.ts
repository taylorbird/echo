// echo's own category in the settings list, "echo" (/settings/echo), for
// settings that belong to no Sable page. Hooked into
// src/lib/settings/registry.ts; its panels are in echo/settings.ts. Kept apart
// from those panels because the registry is read outside the UI too.

import WaveformIcon from 'phosphor-svelte/lib/WaveformIcon';
import type { SettingsCategory } from '#lib/settings/registry.js';
import { sableTest } from './active.js';

/** The id of echo's own settings category. */
export const ECHO_SETTINGS = 'echo';

/**
 * echo's category. Left out in Sable's own tests, which count Sable's
 * categories (echo/active.ts). The names are plain English: Sable's
 * translator passes unknown keys through.
 */
export const echoSettingsCategories: SettingsCategory[] = sableTest()
  ? []
  : [
      {
        id: ECHO_SETTINGS,
        name: 'echo',
        description: "Settings for echo's own features.",
        icon: WaveformIcon,
        sections: [{ id: 'echo-room-list', name: 'Room list' }],
        items: [],
      },
    ];
