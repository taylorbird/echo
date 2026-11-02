import { afterEach, expect, test, vi } from 'vitest';
import { brandLocale, echoAppName } from './branding.js';

const bundle = {
  about: { title: 'About Sable' },
  support: { title: 'Support Sable' },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test("leaves Sable's text alone while echo's layer is off, as in Sable's own tests", () => {
  expect(brandLocale(bundle)).toEqual(bundle);
});

test('swaps Sable for echo once echo is running, except about the Sable project', () => {
  vi.stubGlobal('document', { documentElement: { dataset: { echo: 'on' } } });
  expect(brandLocale(bundle)).toEqual({
    about: { title: 'About echo' },
    support: { title: 'Support Sable' },
  });
});

test('names the app echo where Sable writes its name in markup, once echo is running', () => {
  expect(echoAppName('Sable')).toBe('Sable');
  vi.stubGlobal('document', { documentElement: { dataset: { echo: 'on' } } });
  expect(echoAppName('Sable')).toBe('echo');
});
