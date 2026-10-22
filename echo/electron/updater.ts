// echo's update feed for electron-updater: the latest release on
// taylorbird/echo, whose latest-mac.yml echo/release-electron.sh publishes with
// download URLs pinned to the tagged release. One feed: echo has no nightly
// channel, so Sable's stable/nightly choice is hidden (echo/styles/frame.css)
// and overridden here, right after Sable sets its own feed
// (electron/src/updater.ts).

import { ECHO_BUILD, ECHO_RELEASE } from './app';

export const ECHO_UPDATE_FEED = 'https://github.com/taylorbird/echo/releases/latest/download/';

interface FeedSetter {
  setFeedURL(options: { provider: 'generic'; url: string; channel: string }): void;
}

export function echoUseUpdateFeed(updater: FeedSetter): void {
  if (!ECHO_BUILD) return;
  // Dev and test builds can point at a local feed to try an update.
  const url = (!ECHO_RELEASE && process.env.ECHO_UPDATE_FEED) || ECHO_UPDATE_FEED;
  updater.setFeedURL({ provider: 'generic', url, channel: 'latest' });
}
