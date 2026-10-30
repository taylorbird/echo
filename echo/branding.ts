/// <reference types="vite/client" />

/**
 * echo's name in Sable's text.
 *
 * Every locale bundle passes through here as it loads (the one hook is in
 * src/lib/locales.ts), so "Sable" becomes "echo" in all languages without
 * editing src/locales/*.json, which upstream changes constantly. Strings about
 * the Sable project itself (supporting it, its resources) keep its name.
 *
 * In tests the swap follows echo/active.ts: Sable's own component tests render
 * without echo's layer and expect Sable's text. In the app it always applies,
 * since the English bundle can load before echo/init.ts has run.
 */

import { echoActive } from './active.js';

const KEEP_SABLE = /support|collective|resources/i;

function rebrand(value: unknown, path: string): unknown {
  if (typeof value === 'string') {
    return KEEP_SABLE.test(path) ? value : value.replace(/\bSable\b/g, 'echo');
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => rebrand(item, `${path}.${index}`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        rebrand(item, path ? `${path}.${key}` : key),
      ])
    );
  }
  return value;
}

export function brandLocale(bundle: Record<string, unknown>): Record<string, unknown> {
  if (import.meta.env.MODE === 'test' && !echoActive()) return bundle;
  return rebrand(bundle, '') as Record<string, unknown>;
}
