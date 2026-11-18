// "Update without asking" (Settings → echo → Updates,
// components/UpdateSettings.svelte). Off, echo updates as Sable does: a found
// update waits for Install in the update notice (components/UpdateNotice.svelte)
// or Sable's Alerts popover. On, a found update downloads by itself; it then
// installs when echo quits (echo/electron/updater.ts), or straight away with
// Restart. Desktop app only. Remembered on this device only, like echo's
// other settings.

import {
  desktopUpdate,
  installPendingUpdate,
  setPendingUpdate,
} from '#lib/platform/desktop-update.svelte.js';
import { subscribeToUpdates, type AvailableUpdate } from '#lib/platform/updates.js';

const KEY = 'echo.updateWithoutAsking';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Downloads the pending update unless it is already downloading or downloaded. */
function download(): void {
  const { stage } = desktopUpdate;
  if (desktopUpdate.update === null || stage.name === 'downloading' || stage.name === 'staged')
    return;
  void installPendingUpdate();
}

class EchoUpdates {
  /** Download found updates without asking. */
  withoutAsking = $state(false);

  constructor() {
    try {
      this.withoutAsking = storage()?.getItem(KEY) === 'true';
    } catch {
      // Private mode: the default.
    }
  }

  setWithoutAsking(on: boolean): void {
    this.withoutAsking = on;
    try {
      storage()?.setItem(KEY, String(on));
    } catch {
      // Not remembered; it still applies this session.
    }
    // An update already waiting starts now.
    if (on) download();
  }

  /** What a found update does: wait, or download at once. */
  found(update: AvailableUpdate): void {
    if (!this.withoutAsking) return;
    // The listeners run before Sable's own alert records the update, so record
    // it here first; Sable's later record of the same version changes nothing.
    setPendingUpdate(update);
    download();
  }
}

export const echoUpdates = new EchoUpdates();

/** Starts acting on found updates. Returns the stop function. */
export function startEchoUpdates(): () => void {
  return subscribeToUpdates((update) => {
    echoUpdates.found(update);
  });
}
