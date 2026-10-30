import { afterEach, expect, test, vi } from 'vitest';
import { echoRootFontPx } from './layout.js';

function stub(desktop: boolean): void {
  vi.stubGlobal('document', { documentElement: { dataset: { echo: 'on' } } });
  vi.stubGlobal('matchMedia', () => ({ matches: desktop }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("sizes the timeline's media from echo's 14px root on desktop", () => {
  stub(true);
  expect(echoRootFontPx(16)).toBe(14);
});

test("keeps Sable's root on phones, where the layout is Sable's", () => {
  stub(false);
  expect(echoRootFontPx(16)).toBe(16);
});

test("keeps Sable's root in Sable's own tests, without echo's layer", () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  expect(echoRootFontPx(16)).toBe(16);
});
