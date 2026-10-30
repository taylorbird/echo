// echo: reactions to your messages in the room list (echo/design/SPEC.md §4.6).
// echo/core/reactions.rs reports each one as an `echo` core event; here a live
// one pops its emoji into the room's ring for 5 seconds (echo/ring.ts) while the
// row's preview says who reacted to what, and with "show reactions as
// notifications" on it also leaves a marker on the room until you open it.
//
// Servers don't count reactions as unread, so the markers are echo's own:
// kept per account in this device's local storage, not synced to your other
// devices. A watermark (the last time echo ran for that account) lets
// reactions that arrived while echo was closed still leave markers, without
// a pop, and keeps a fresh sign-in from marking old history.

import { untrack } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import type { CoreEvent } from '#src/generated/protocol';

/** How long a pop shows. */
export const POP_MS = 5000;
/** A reaction older than this when it arrives is catch-up, not live: no pop. */
export const LIVE_MS = 60_000;
/** How often a running echo moves the watermark forward. */
const WATERMARK_EVERY_MS = 60_000;

const SETTINGS_KEY = 'echo.reactionSettings';
const ACCOUNT_PREFIX = 'echo.reactions.';

/** One reaction by someone else to a message of yours (echo/core/reactions.rs). */
export interface ReactionToOwn {
  room_id: string;
  sender: string;
  key: string;
  target_event_id: string;
  excerpt: string;
  origin_server_ts: number;
}

export interface ReactionPop {
  key: string;
  sender: string;
  excerpt: string;
  until: number;
}

interface Marker {
  key: string;
  at: number;
}

interface AccountState {
  watermark: number;
  markers: Record<string, Marker>;
}

/** The reaction in an `echo` core event, or null for anything else. */
export function reactionToOwn(event: CoreEvent): ReactionToOwn | null {
  if (event.type !== 'echo') return null;
  const body = event.event;
  if (typeof body !== 'object' || body === null) return null;
  const fields = body as Record<string, unknown>;
  if (fields.kind !== 'reaction_to_own') return null;
  const { room_id, sender, key, target_event_id, excerpt, origin_server_ts } = fields;
  if (
    typeof room_id !== 'string' ||
    typeof sender !== 'string' ||
    typeof key !== 'string' ||
    key === '' ||
    typeof target_event_id !== 'string' ||
    typeof excerpt !== 'string' ||
    typeof origin_server_ts !== 'number'
  ) {
    return null;
  }
  return { room_id, sender, key, target_event_id, excerpt, origin_server_ts };
}

function localStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readJson(storage: Storage | null, key: string): unknown {
  try {
    return JSON.parse(storage?.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function writeJson(storage: Storage | null, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Not remembered: the markers last until echo quits.
  }
}

function isMarker(value: unknown): value is Marker {
  if (typeof value !== 'object' || value === null) return false;
  const marker = value as Record<string, unknown>;
  return typeof marker.key === 'string' && typeof marker.at === 'number';
}

export class EchoReactions {
  /** "Show reactions in the room list" (on by default). */
  inList = $state(true);
  /** "Show reactions as notifications" (off by default). */
  asNotifications = $state(false);

  readonly #pops = new SvelteMap<string, ReactionPop>();
  readonly #markers = new SvelteMap<string, Marker>();
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- timer handles, never rendered
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #storage: Storage | null;
  readonly #now: () => number;
  #account: string | null = null;
  /** The watermark this run started from: newer reactions are news. */
  #since = 0;

  constructor(storage: Storage | null = localStore(), now: () => number = Date.now) {
    this.#storage = storage;
    this.#now = now;
    const stored = readJson(storage, SETTINGS_KEY);
    if (typeof stored === 'object' && stored !== null) {
      const settings = stored as Record<string, unknown>;
      if (typeof settings.inList === 'boolean') this.inList = settings.inList;
      if (typeof settings.asNotifications === 'boolean') {
        this.asNotifications = settings.asNotifications;
      }
    }
  }

  setInList(on: boolean): void {
    this.inList = on;
    if (!on) {
      for (const roomId of [...this.#pops.keys()]) this.#endPop(roomId);
      this.#clearMarkers();
    }
    this.#saveSettings();
  }

  setAsNotifications(on: boolean): void {
    this.asNotifications = on;
    // Turned off, the markers go: turning it on again shouldn't bring back old ones.
    if (!on) this.#clearMarkers();
    this.#saveSettings();
  }

  /**
   * Switches to an account's markers and watermark. Its first run starts the
   * watermark now, so a fresh sign-in doesn't mark old reactions.
   */
  useAccount(accountId: string | null): void {
    if (accountId === this.#account) return;
    if (this.#account !== null) this.touch();
    for (const roomId of [...this.#pops.keys()]) this.#endPop(roomId);
    this.#markers.clear();
    this.#account = accountId;
    if (accountId === null) return;

    const stored = readJson(this.#storage, ACCOUNT_PREFIX + accountId);
    const state = typeof stored === 'object' && stored !== null ? (stored as AccountState) : null;
    const watermark = typeof state?.watermark === 'number' ? state.watermark : this.#now();
    this.#since = watermark;
    for (const [roomId, marker] of Object.entries(state?.markers ?? {})) {
      if (isMarker(marker)) this.#markers.set(roomId, marker);
    }
    this.touch();
  }

  /** Moves the account's watermark to now: echo is running and syncing. */
  touch(): void {
    if (this.#account === null) return;
    writeJson(this.#storage, ACCOUNT_PREFIX + this.#account, {
      watermark: this.#now(),
      markers: Object.fromEntries(this.#markers),
    } satisfies AccountState);
  }

  /**
   * A reaction to one of your messages. `muted` rooms get nothing; the `open`
   * room gets its pop but no marker, since you're already looking at it.
   */
  receive(reaction: ReactionToOwn, room: { muted: boolean; open: boolean }): void {
    if (!this.inList || room.muted) return;
    const now = this.#now();
    const live = now - reaction.origin_server_ts <= LIVE_MS;
    if (live) this.#pop(reaction, now);

    const news = live || reaction.origin_server_ts > this.#since;
    if (!this.asNotifications || room.open || !news || this.#account === null) return;
    const current = this.#markers.get(reaction.room_id);
    if (current !== undefined && current.at > reaction.origin_server_ts) return;
    this.#markers.set(reaction.room_id, { key: reaction.key, at: reaction.origin_server_ts });
    this.touch();
  }

  /** You opened the room: its marker goes. */
  open(roomId: string): void {
    if (!this.#markers.delete(roomId)) return;
    this.touch();
  }

  /** The reaction popping in on a room's row, if any. */
  pop(roomId: string): ReactionPop | null {
    return this.inList ? (this.#pops.get(roomId) ?? null) : null;
  }

  /** The room's reaction marker's emoji, if it should show. */
  marker(roomId: string): string | null {
    if (!this.inList || !this.asNotifications) return null;
    return this.#markers.get(roomId)?.key ?? null;
  }

  /** Keeps the watermark moving while echo runs; returns a stop function. */
  keepWatermark(): () => void {
    const timer = setInterval(() => {
      this.touch();
    }, WATERMARK_EVERY_MS);
    const onHide = () => {
      this.touch();
    };
    if (typeof window !== 'undefined') window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(timer);
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', onHide);
    };
  }

  #pop(reaction: ReactionToOwn, now: number): void {
    // The newest reaction shows, and the 5 seconds start again.
    const roomId = reaction.room_id;
    clearTimeout(this.#timers.get(roomId));
    this.#pops.set(roomId, {
      key: reaction.key,
      sender: reaction.sender,
      excerpt: reaction.excerpt,
      until: now + POP_MS,
    });
    this.#timers.set(
      roomId,
      setTimeout(() => {
        this.#endPop(roomId);
      }, POP_MS)
    );
  }

  #endPop(roomId: string): void {
    clearTimeout(this.#timers.get(roomId));
    this.#timers.delete(roomId);
    this.#pops.delete(roomId);
  }

  #clearMarkers(): void {
    if (this.#markers.size === 0) return;
    this.#markers.clear();
    this.touch();
  }

  #saveSettings(): void {
    writeJson(this.#storage, SETTINGS_KEY, {
      inList: this.inList,
      asNotifications: this.asNotifications,
    });
  }
}

export const echoReactions = new EchoReactions();

interface ReactionSources {
  subscribeEvents: (onEvent: (event: CoreEvent) => void) => () => void;
  readonly session: { account_id: string } | null;
}

let connected: { core: object; stop: () => void } | null = null;

/**
 * Starts listening on a core client, once: the first room list row calls
 * this. `muted` and `openRoomId` come from the room list and the route.
 */
export function connectEchoReactions(
  core: ReactionSources,
  muted: (roomId: string) => boolean,
  openRoomId: () => string | null
): void {
  if (connected?.core === core) return;
  connected?.stop();
  const stop = $effect.root(() => {
    $effect(() => {
      const accountId = core.session?.account_id ?? null;
      untrack(() => {
        echoReactions.useAccount(accountId);
      });
    });
    $effect(() => {
      const open = openRoomId();
      if (open !== null) {
        untrack(() => {
          echoReactions.open(open);
        });
      }
    });
    $effect(() => echoReactions.keepWatermark());
    $effect(() =>
      untrack(() =>
        core.subscribeEvents((event) => {
          const reaction = reactionToOwn(event);
          if (reaction === null) return;
          echoReactions.receive(reaction, {
            muted: muted(reaction.room_id),
            open: openRoomId() === reaction.room_id,
          });
        })
      )
    );
  });
  connected = { core, stop };
}
