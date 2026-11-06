/// <reference types="vite/client" />
import { expect, test } from 'vitest';

// echo/styles/themes.css fills echo's colour tokens from a loaded Sable theme.
// An echo token it leaves out keeps echo's own colour under every theme, which
// is the bug the bridge exists to prevent, so each new token needs a line there.

const files: Record<string, string> = import.meta.glob(
  ['./styles/*.css', './components/*.svelte'],
  { query: '?raw', import: 'default', eager: true }
);

// Tokens that are not colours, or that are set inside a component from other
// echo tokens (so they follow the theme through those).
const NOT_THEMED = new Set([
  '--echo-bar',
  '--echo-bar-far',
  '--echo-bar-near',
  '--echo-heading-glyph',
  '--echo-rail-footer-height',
  '--echo-row-tier',
  '--echo-sk-base',
  '--echo-sk-highlight',
  '--echo-tier',
  '--echo-tier-ink',
]);

const BRIDGE = './styles/themes.css';

function defined(css: string): Set<string> {
  return new Set([...css.matchAll(/(--echo-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
}

const sources = Object.entries(files).filter(([name]) => name !== BRIDGE);

test('the theme bridge fills every echo colour token', () => {
  const bridge = defined(files[BRIDGE]);
  const missing = sources
    .flatMap(([name, css]) => [...defined(css)].map((token) => `${token} (${name})`))
    .filter((entry) => {
      const token = entry.split(' ')[0];
      return !NOT_THEMED.has(token) && !bridge.has(token);
    });
  expect(sources.length).toBeGreaterThan(5);
  expect([...new Set(missing)]).toEqual([]);
});

test('no echo colour is stored as a bare RGB triplet, which a theme colour cannot fill', () => {
  const triplets = sources.filter(([, css]) => /rgb\(var\(--echo-/.test(css)).map(([name]) => name);
  expect(triplets).toEqual([]);
});
