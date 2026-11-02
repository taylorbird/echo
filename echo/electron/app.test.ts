import { expect, test } from 'vitest';
import { echoSchemeFor } from './app.js';

test('the release signs in through com.github.taylorbird.echo', () => {
  expect(echoSchemeFor('dev.tbird.echo')).toBe('com.github.taylorbird.echo');
});

test('dev and test builds each get their own scheme', () => {
  expect(echoSchemeFor('dev.tbird.echo.dev')).toBe('com.github.taylorbird.echo.dev');
  expect(echoSchemeFor('dev.tbird.echo.test')).toBe('com.github.taylorbird.echo.test');
  expect(echoSchemeFor('dev.tbird.echo.verify')).toBe('com.github.taylorbird.echo.verify');
});

test("identifiers that aren't echo's have no echo scheme", () => {
  expect(echoSchemeFor('moe.sable.next')).toBeNull();
  expect(echoSchemeFor('moe.sable.client')).toBeNull();
  expect(echoSchemeFor('')).toBeNull();
  expect(echoSchemeFor('dev.tbird.echoes')).toBeNull();
  expect(echoSchemeFor('dev.tbird.echo-dev')).toBeNull();
});

test('a suffix a URL scheme cannot carry has no scheme', () => {
  expect(echoSchemeFor('dev.tbird.echo.Dev')).toBeNull();
  expect(echoSchemeFor('dev.tbird.echo.my_build')).toBeNull();
  expect(echoSchemeFor('dev.tbird.echo.a b')).toBeNull();
  expect(echoSchemeFor('dev.tbird.echo.')).toBeNull();
});
