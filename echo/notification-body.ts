import type { ConversationLine } from '#src/generated/protocol';

import { echoActive } from './active';

type Summarise = (lines: readonly ConversationLine[]) => string;

// Sable stacks a room's last five messages into one notification body, one per line. macOS
// banners have room for one or two body lines and draw the rest outside the banner, over its
// title. echo shows the latest message alone and counts the others on the same line.
export function echoNotificationBody(
  lines: readonly ConversationLine[],
  summarise: Summarise
): string {
  return echoActive() ? oneLineBody(lines, summarise) : summarise(lines);
}

export function oneLineBody(lines: readonly ConversationLine[], summarise: Summarise): string {
  const latest = oneLine(summarise(lines.slice(-1)));
  return lines.length <= 1 ? latest : `${latest} (+${lines.length - 1} more)`;
}

// A message can hold line breaks of its own, which would stack the same way.
function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ');
}
