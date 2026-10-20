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
