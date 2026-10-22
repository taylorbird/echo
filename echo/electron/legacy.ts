// echo: echo-gomuks shipped under this same bundle ID, so an install that
// updated from it still carries its files: the gomuks database and config,
// its media cache and its logs. Nothing here reads them. They are removed at
// start-up, in the background; a missing file is the normal case after the
// first run, and any error is ignored. Sable's own files in these folders have
// other names (credentials/, session.json, sable-tiles/, sable-video/, …).
// The Electron port of echo/legacy.rs, hooked in at electron/src/main.ts.

import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { ECHO_BUILD } from './app';

const DATA_FILES = ['gomuks.db', 'gomuks.db-shm', 'gomuks.db-wal', 'config.yaml'];
const CACHE_DIRS = ['media', 'tmp'];

export interface GomuksFolders {
  /** The app's data folder, which Tauri and Electron share: appData/<identifier>. */
  data: string;
  /** Tauri's cache folder: ~/Library/Caches/<identifier> on macOS. */
  cache: string;
  /** Tauri's log folder: ~/Library/Logs/<identifier> on macOS. */
  logs: string;
}

/** The folders Tauri gave a macOS app with this identifier, as legacy.rs saw them. */
export function macGomuksFolders(home: string, appData: string, identifier: string): GomuksFolders {
  return {
    data: join(appData, identifier),
    cache: join(home, 'Library', 'Caches', identifier),
    logs: join(home, 'Library', 'Logs', identifier),
  };
}

export async function removeGomuksLeftovers(folders: GomuksFolders): Promise<void> {
  await Promise.allSettled([
    ...DATA_FILES.map((name) => rm(join(folders.data, name), { force: true })),
    ...CACHE_DIRS.map((name) => rm(join(folders.cache, name), { recursive: true, force: true })),
    removeGomuksLogs(folders.logs),
  ]);
}

// gomuks wrote gomuks-<timestamp>.log files; anything else in the folder stays.
async function removeGomuksLogs(dir: string): Promise<void> {
  const names = await readdir(dir).catch(() => []);
  await Promise.allSettled(
    names
      .filter((name) => name.startsWith('gomuks-') && name.endsWith('.log'))
      .map((name) => rm(join(dir, name), { force: true }))
  );
}

/** Off the start-up path: schedules the clean-up and returns at once. macOS only, echo only. */
export function cleanGomuksLeftovers(
  platform: string,
  home: string,
  appData: string,
  identifier: string
): void {
  if (!ECHO_BUILD || platform !== 'darwin') return;
  setTimeout(() => {
    void removeGomuksLeftovers(macGomuksFolders(home, appData, identifier)).catch(() => undefined);
  }, 0);
}
