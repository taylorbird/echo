// Where the phone's room list keeps its spaces: in the side drawer, opened
// from the place button by the title or a swipe from the left edge (the
// default), or along the top, a strip under the title (Settings → Appearance,
// "Spaces along the top": components/PhoneLayoutSettings.svelte). Remembered
// on this device only, like the open place (place.ts).

const KEY = 'echo-mobile-spaces-on-top';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

class PhoneLayout {
  /** Spaces in a strip under the title instead of the side drawer. */
  spacesOnTop = $state(false);

  constructor() {
    try {
      this.spacesOnTop = storage()?.getItem(KEY) === 'true';
    } catch {
      // Private mode: the default.
    }
  }

  setSpacesOnTop(on: boolean): void {
    this.spacesOnTop = on;
    try {
      storage()?.setItem(KEY, String(on));
    } catch {
      // Not remembered; the list still switches.
    }
  }
}

export const phoneLayout = new PhoneLayout();
