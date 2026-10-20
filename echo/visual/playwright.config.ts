import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// echo's screenshot harness: `mise run echo:shots`. See echo/visual/README.md.
const root = resolve(import.meta.dirname, '../..');
const port = process.env.ECHO_SHOTS_PORT ?? '4199';
const origin = `http://127.0.0.1:${port}`;

// The e2e suite's sources plus echo/, whose theme is the usual thing to change.
const WATCHED = ['src', 'crates', 'static', 'echo', 'vite.config.ts', 'package.json'];
const IGNORED = new Set(['generated', 'node_modules', 'target', '.svelte-kit']);

function newestMtime(path: string): number {
  // This harness isn't part of the app.
  if (path === import.meta.dirname) return 0;
  const entry = statSync(path, { throwIfNoEntry: false });
  if (!entry) return 0;
  if (!entry.isDirectory()) return entry.mtimeMs;
  let newest = 0;
  for (const child of readdirSync(path, { withFileTypes: true })) {
    if (!IGNORED.has(child.name)) newest = Math.max(newest, newestMtime(join(path, child.name)));
  }
  return newest;
}

function needsBuild(): boolean {
  if (process.env.ECHO_SHOTS_BUILD === '1') return true;
  if (process.env.ECHO_SHOTS_BUILD === '0') return false;
  const built = statSync(join(root, 'dist/index.html'), { throwIfNoEntry: false });
  if (!built) return true;
  return Math.max(...WATCHED.map((path) => newestMtime(join(root, path)))) > built.mtimeMs;
}

// Same build as the e2e suite (playwright.config.ts).
const build = needsBuild()
  ? 'SABLE_SKIP_DEEPFILTERNET=1 SABLE_WASM_OUTPUT=src/generated/wasm-e2e pnpm run build && '
  : '';

const browser = process.env.ECHO_SHOTS_BROWSER === 'chromium' ? 'Desktop Chrome' : 'Desktop Safari';

export default defineConfig({
  testDir: '.',
  testMatch: 'shots.spec.ts',
  outputDir: 'out/.results',
  workers: 1,
  retries: 0,
  timeout: 300_000,
  reporter: 'list',
  globalSetup: './global.setup.ts',
  globalTeardown: './global.teardown.ts',
  use: {
    ...devices[browser],
    baseURL: origin,
    contextOptions: { reducedMotion: 'reduce' },
    // A view that can't be reached is skipped, so fail its steps fast.
    actionTimeout: 10_000,
  },
  webServer: {
    command: `${build}pnpm exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: root,
    url: origin,
    reuseExistingServer: false,
    timeout: 900_000,
    stdout: 'pipe',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
});
