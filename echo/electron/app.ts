// Whether this Electron build is echo. echo/electron/build.sh builds with an
// echo identifier (dev.tbird.echo, or .dev/.test for other builds), which
// esbuild bakes in as __SABLE_IDENTIFIER__ (electron/build.mjs); a plain Sable
// build of this tree keeps Sable's behaviour. Nothing in echo/electron imports
// Electron itself: these modules are bundled into electron/src's main process
// and preload, and whatever they need from Electron is passed in.

declare const __SABLE_IDENTIFIER__: string | undefined;

// The preload runs sandboxed, where `process` is Electron's reduced stand-in.
const identifier =
  (typeof process === 'object' ? process.env.SABLE_IDENTIFIER : undefined) ??
  (typeof __SABLE_IDENTIFIER__ === 'string' ? __SABLE_IDENTIFIER__ : '');

/** The released app, as opposed to a dev or test build. */
export const ECHO_RELEASE = identifier === 'dev.tbird.echo';
export const ECHO_BUILD = ECHO_RELEASE || identifier.startsWith('dev.tbird.echo.');

const ECHO_IDENTIFIER = 'dev.tbird.echo';
const ECHO_SCHEME_PREFIX = 'com.github.taylorbird.echo';

/**
 * The OAuth sign-in scheme of the echo build with this identifier, or null for one that isn't
 * echo's: `dev.tbird.echo` signs in through `com.github.taylorbird.echo`, and a dev or test build
 * through its own (`dev.tbird.echo.dev` → `com.github.taylorbird.echo.dev`), so no two installs
 * share a scheme. The servers accept these because they start with `client_uri`'s host reversed
 * (`https://github.com/taylorbird/echo`, echo/core/brand.rs). build.sh maps it the same way and
 * checks the packaged Info.plist declares it.
 */
export function echoSchemeFor(identifier: string): string | null {
  if (!identifier.startsWith(ECHO_IDENTIFIER)) return null;
  const suffix = identifier.slice(ECHO_IDENTIFIER.length);
  if (suffix !== '' && !/^\.[a-z0-9][a-z0-9.-]*$/.test(suffix)) return null;
  return `${ECHO_SCHEME_PREFIX}${suffix}`;
}

/** This build's sign-in scheme; null in Sable builds, which keep Sable's. */
export const ECHO_SCHEME = ECHO_BUILD ? echoSchemeFor(identifier) : null;

/** The schemes the main process takes deep links for: only echo's own, in echo builds. */
export function echoDeepLinkSchemes(): string[] | null {
  return ECHO_SCHEME ? [ECHO_SCHEME] : null;
}

// Sable's main process names itself in a few places people see (the macOS
// screen-recording prompt, the core's process name); echo builds say echo.
export function echoBranded(text: string): string {
  return ECHO_BUILD ? text.replaceAll('Sable', 'echo') : text;
}
