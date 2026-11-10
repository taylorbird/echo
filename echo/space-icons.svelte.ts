// Whether All chats shows each row's space icons at its right edge
// (components/RoomSpaces.svelte, echo/row-spaces.ts). On by default; turned off
// in Settings → echo → Room list (components/EchoSettings.svelte). Remembered
// on this device only, like echo's other settings.

const KEY = 'echo.spaceIcons';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

class SpaceIcons {
  /** Space icons on the rows of All chats. */
  show = $state(true);

  constructor() {
    try {
      this.show = storage()?.getItem(KEY) !== 'false';
    } catch {
      // Private mode: the default.
    }
  }

  setShow(on: boolean): void {
    this.show = on;
    try {
      storage()?.setItem(KEY, String(on));
    } catch {
      // Not remembered; the list still switches.
    }
  }
}

export const echoSpaceIcons = new SpaceIcons();
