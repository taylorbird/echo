import { beforeEach, expect, test, vi } from 'vitest';
import type { AvailableUpdate } from '#lib/platform/updates.js';

interface State {
  update: AvailableUpdate | null;
  stage: { name: string };
}

const state: State = vi.hoisted(() => ({ update: null, stage: { name: 'available' } }));

const installPendingUpdate = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const setPendingUpdate = vi.hoisted(() =>
  vi.fn((found: AvailableUpdate) => {
    state.update = found;
  })
);

vi.mock('#lib/platform/desktop-update.svelte.js', () => ({
  desktopUpdate: {
    get update() {
      return state.update;
    },
    get stage() {
      return state.stage;
    },
  },
  installPendingUpdate,
  setPendingUpdate,
}));

vi.mock('#lib/platform/updates.js', () => ({ subscribeToUpdates: vi.fn() }));

// The node project has no localStorage; a small in-memory one stands in.
const stored = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => stored.set(key, value),
  clear: () => {
    stored.clear();
  },
});

const found: AvailableUpdate = { version: '1.7.1', notes: undefined, install: vi.fn() };

async function load(value: string | null) {
  vi.resetModules();
  localStorage.clear();
  if (value !== null) localStorage.setItem('echo.updateWithoutAsking', value);
  return (await import('./updates.svelte.js')).echoUpdates;
}

beforeEach(() => {
  state.update = null;
  state.stage = { name: 'available' };
  installPendingUpdate.mockClear();
  setPendingUpdate.mockClear();
});

test('off by default: a found update waits for Install, as in Sable', async () => {
  const updates = await load(null);
  expect(updates.withoutAsking).toBe(false);
  updates.found(found);
  expect(setPendingUpdate).not.toHaveBeenCalled();
  expect(installPendingUpdate).not.toHaveBeenCalled();
});

test('on: a found update is recorded and downloads at once', async () => {
  const updates = await load('true');
  updates.found(found);
  expect(setPendingUpdate).toHaveBeenCalledWith(found);
  expect(installPendingUpdate).toHaveBeenCalledOnce();
});

test('on: an update already downloading or downloaded is left alone', async () => {
  const updates = await load('true');
  state.stage = { name: 'downloading' };
  updates.found(found);
  state.stage = { name: 'staged' };
  updates.found(found);
  expect(installPendingUpdate).not.toHaveBeenCalled();
});

test('turning it on starts an update that is already waiting, and is remembered', async () => {
  const updates = await load(null);
  state.update = found;
  updates.setWithoutAsking(true);
  expect(installPendingUpdate).toHaveBeenCalledOnce();
  expect(localStorage.getItem('echo.updateWithoutAsking')).toBe('true');
});
