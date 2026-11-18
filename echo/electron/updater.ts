// echo's update feed and behaviour for electron-updater, applied right after
// Sable sets its own feed (electron/src/updater.ts, on start-up and whenever the
// update channel setting changes).
//
// Feed: the latest release on taylorbird/echo, whose latest-mac.yml
// echo/release-electron.sh publishes with download URLs pinned to the tagged
// release. One feed: echo has no nightly channel, so Sable's stable/nightly
// choice is hidden (echo/styles/frame.css) and overridden here.
//
// Behaviour: echo updates itself, as echo-gomuks did. Sable only downloads
// when you press Install in the rail's Alerts popover and only installs on
// Restart, so an update nobody clicked never arrived. Here a found update
// downloads in the background and installs when echo quits; the alert still
// offers Restart to apply it now.
//
// Log: electron-updater only logs to the console, which a Finder-launched app
// has nowhere to keep, so its log goes to ~/Library/Logs/echo/<identifier>-updater.log.

import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { BUILD_IDENTIFIER, ECHO_BUILD, ECHO_RELEASE } from './app';

export const ECHO_UPDATE_FEED = 'https://github.com/taylorbird/echo/releases/latest/download/';

type Log = (message?: unknown) => void;

// electron-updater's Logger shape, as methods so its narrower debug(string) fits.
interface UpdateLog {
  info(message?: unknown): void;
  warn(message?: unknown): void;
  error(message?: unknown): void;
  debug?(message: string): void;
}

interface EchoUpdater {
  setFeedURL(options: { provider: 'generic'; url: string; channel: string }): void;
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  logger: UpdateLog | null;
  on(event: 'error', listener: (error: Error) => void): unknown;
}

// Set up once per updater; the feed is re-applied on every channel change.
const configured = new WeakSet<object>();

/** A logger that appends to the build's updater log; it never throws. */
export function echoUpdateLogger(file: string): Required<UpdateLog> {
  const write =
    (level: string): Log =>
    (message) => {
      try {
        mkdirSync(join(file, '..'), { recursive: true });
        const text =
          message instanceof Error ? (message.stack ?? message.message) : String(message);
        appendFileSync(file, `${new Date().toISOString()} ${level} ${text}\n`);
      } catch {
        // A log we can't write must not break updating.
      }
    };
  return { info: write('info'), warn: write('warn'), error: write('error'), debug: write('debug') };
}

export function echoUseUpdateFeed(updater: EchoUpdater): void {
  if (!ECHO_BUILD) return;
  // Dev and test builds can point at a local feed to try an update.
  const url = (!ECHO_RELEASE && process.env.ECHO_UPDATE_FEED) || ECHO_UPDATE_FEED;
  updater.setFeedURL({ provider: 'generic', url, channel: 'latest' });
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  if (configured.has(updater)) return;
  configured.add(updater);
  const log = echoUpdateLogger(
    join(homedir(), 'Library/Logs/echo', `${BUILD_IDENTIFIER}-updater.log`)
  );
  updater.logger = log;
  // A background download that fails reports here; without a listener it
  // would only reach the console.
  updater.on('error', (error) => {
    log.error(error);
  });
}
