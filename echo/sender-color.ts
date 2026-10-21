// echo: senders take echo-gomuks's colours. Its formula was the sum of the
// user ID's character codes over a ten-colour palette (--echo-sender-0…9,
// echo/styles/timeline.css), so most people keep the colour they had there.
// Sable hashes differently and onto eight slots. echo-gomuks also nudged
// senders apart per room; that state lived in its own storage and isn't here.
// Your own name is coloured too, as it was in echo-gomuks.

import { echoActive } from './active.js';

const PALETTE_SIZE = 10;

function echoSenderIndex(userId: string): number {
  let sum = 0;
  for (const character of userId) sum += character.charCodeAt(0);
  return sum % PALETTE_SIZE;
}

// The palette is defined for the desktop layout only; elsewhere the colour
// Sable would have used shows through as the var() fallback.
export function echoSenderColor(userId: string | null, sable: string): string {
  if (!echoActive() || !userId) return sable;
  return `var(--echo-sender-${echoSenderIndex(userId)}, ${sable})`;
}
