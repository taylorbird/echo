import { toasts, type UndoOptions } from '#lib/ui/toasts.svelte.js';
import { echoActive } from './active.js';

// Settings → Appearance confirms a theme change ("Neon City is now your dark
// theme · Undo"). Sable says it with an app-wide toast in the window's corner,
// far from the setting. In echo the same message shows inline: in the theme
// catalog's bottom bar while the catalog is open, under the theme list
// otherwise (echo/components/ThemeNotice.svelte). CustomThemes.svelte imports
// this in place of Sable's toast store; it keeps the same two calls, and hands
// them to Sable's store when echo's layer is off, as in Sable's own tests.

const UNDO_AFTER_MS = 10_000;

export type ThemeNotice = UndoOptions & { id: number; message: string };

class ThemeNotices {
  current = $state.raw<ThemeNotice | null>(null);
  #next = 1;
  #timer: ReturnType<typeof setTimeout> | undefined;

  undoable(message: string, options: UndoOptions): number {
    if (!echoActive()) return toasts.undoable(message, options);
    this.#close();
    const id = this.#next++;
    this.current = { id, message, ...options };
    this.#timer = setTimeout(() => {
      this.#close();
    }, UNDO_AFTER_MS);
    return id;
  }

  dismiss(id: number): void {
    if (!echoActive()) {
      toasts.dismiss(id);
      return;
    }
    if (this.current?.id === id) this.#close();
  }

  undo(): void {
    const notice = this.current;
    if (!notice) return;
    this.#clear();
    notice.onUndo();
  }

  close(): void {
    this.#close();
  }

  #close(): void {
    const notice = this.current;
    this.#clear();
    notice?.onClose?.();
  }

  #clear(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.current = null;
  }
}

export const echoThemeToasts = new ThemeNotices();
