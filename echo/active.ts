/// <reference types="vite/client" />

// Whether echo's layer is running: echo/init.ts, imported by the app's root
// layout, switches it on. Sable's component tests render pieces without that
// layout, so where echo changes what Sable shows (not just how it looks) it
// checks this, and those tests keep testing Sable.

const ATTRIBUTE = 'echo';

export function startEcho(): void {
  document.documentElement.dataset[ATTRIBUTE] = 'on';
}

export function echoActive(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset[ATTRIBUTE] === 'on';
}

// In the app, echo's layer is on from start-up; modules that read it once as
// they load can run before echo/init.ts has. Only Sable's own tests run
// without it, so this tells those apart.
export function sableTest(): boolean {
  return import.meta.env.MODE === 'test' && !echoActive();
}
