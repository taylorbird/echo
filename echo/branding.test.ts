import { afterEach, expect, test, vi } from 'vitest';
import { brandLocale } from './branding.js';

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
