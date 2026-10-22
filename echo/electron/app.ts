// Whether this Electron build is echo. echo/electron/build.sh builds with an
// echo identifier (dev.tbird.echo, or .dev/.test for other builds), which
// esbuild bakes in as __SABLE_IDENTIFIER__ (electron/build.mjs); a plain Sable
// build of this tree keeps Sable's behaviour. Nothing in echo/electron imports
// Electron itself: these modules are bundled into electron/src's main process,
// and whatever they need from Electron is passed in.

declare const __SABLE_IDENTIFIER__: string | undefined;

const identifier =
  process.env.SABLE_IDENTIFIER ??
  (typeof __SABLE_IDENTIFIER__ === 'string' ? __SABLE_IDENTIFIER__ : '');

/** The released app, as opposed to a dev or test build. */
export const ECHO_RELEASE = identifier === 'dev.tbird.echo';
export const ECHO_BUILD = ECHO_RELEASE || identifier.startsWith('dev.tbird.echo.');

// Sable's main process names itself in a few places people see (the macOS
// screen-recording prompt, the core's process name); echo builds say echo.
export function echoBranded(text: string): string {
  return ECHO_BUILD ? text.replaceAll('Sable', 'echo') : text;
}
