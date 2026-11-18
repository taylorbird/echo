import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

function fakeUpdater() {
  const listeners: ((error: Error) => void)[] = [];
  return {
    feeds: [] as { url: string }[],
    autoInstallOnAppQuit: false,
    logger: null as unknown,
    listeners,
    setFeedURL(options: { url: string }) {
      this.feeds.push(options);
    },
    on(_event: 'error', listener: (error: Error) => void) {
      listeners.push(listener);
    },
  };
}

async function load(identifier: string) {
  vi.resetModules();
  vi.stubEnv('SABLE_IDENTIFIER', identifier);
  return import('./updater.js');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

test('an echo build keeps manual downloads but installs a downloaded update on quit', async () => {
  const { echoUseUpdateFeed, ECHO_UPDATE_FEED } = await load('dev.tbird.echo');
  const updater = fakeUpdater();
  echoUseUpdateFeed(updater as never);
  expect(updater.feeds).toEqual([
    { provider: 'generic', url: ECHO_UPDATE_FEED, channel: 'latest' },
  ]);
  expect(updater.autoInstallOnAppQuit).toBe(true);
  expect(updater.logger).not.toBeNull();
  expect(updater.listeners).toHaveLength(1);
});

test('re-applying the feed on a channel change adds no second error listener', async () => {
  const { echoUseUpdateFeed } = await load('dev.tbird.echo');
  const updater = fakeUpdater();
  echoUseUpdateFeed(updater as never);
  echoUseUpdateFeed(updater as never);
  expect(updater.feeds).toHaveLength(2);
  expect(updater.listeners).toHaveLength(1);
});

test("a plain Sable build keeps Sable's updater as it is", async () => {
  const { echoUseUpdateFeed } = await load('moe.sable.next');
  const updater = fakeUpdater();
  echoUseUpdateFeed(updater as never);
  expect(updater.feeds).toEqual([]);
  expect(updater.autoInstallOnAppQuit).toBe(false);
  expect(updater.logger).toBeNull();
});

test('the updater log appends timestamped lines and never throws', async () => {
  const { echoUpdateLogger } = await load('dev.tbird.echo');
  const file = join(mkdtempSync(join(tmpdir(), 'echo-updater-')), 'logs', 'updater.log');
  const log = echoUpdateLogger(file);
  log.info('Checking for update');
  log.error(new Error('download failed'));
  const lines = readFileSync(file, 'utf8').trim().split('\n');
  expect(lines[0]).toMatch(/^\d{4}-\d\d-\d\dT.* info Checking for update$/);
  expect(lines[1]).toContain('error Error: download failed');
  expect(() => {
    echoUpdateLogger('/dev/null/nope/updater.log').info('x');
  }).not.toThrow();
});
